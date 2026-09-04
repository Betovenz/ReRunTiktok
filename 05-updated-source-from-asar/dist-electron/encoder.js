"use strict";
// encoder.ts — pick the best available H.264 encoder for the current machine.
//
// ffmpeg-static ships a full FFmpeg build on every OS, but which *hardware* encoders
// actually run depends on the GPU present at runtime, not just what FFmpeg was compiled
// with. So we don't trust `-encoders` alone — we do a tiny throwaway encode of a black
// frame with each candidate and keep the first that exits cleanly. Hardware encoders
// keep the CPU free so one machine can push several concurrent lives; libx264 is the
// universal software fallback.
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoEncoderArgs = videoEncoderArgs;
exports.overlayCost = overlayCost;
exports.detectEncoderMeasurements = detectEncoderMeasurements;
exports.planFromMeasurements = planFromMeasurements;
exports.bitrateForFrame = bitrateForFrame;
exports.sustainableStreamCount = sustainableStreamCount;
exports.canDegradeFurther = canDegradeFurther;
const node_child_process_1 = require("node:child_process");
// Hardware encoder candidates per platform, tried in order; libx264 marks the end of the
// hardware list. Which encoder actually gets USED is decided in planFromMeasurements —
// libx264 wins when measurably fast enough (it hits the target bitrate accurately where
// h264_videotoolbox silently delivers ~20-25% less), hardware wins when the CPU can't.
function candidatesForPlatform() {
    switch (process.platform) {
        case 'darwin':
            return ['h264_videotoolbox', 'libx264'];
        case 'win32':
            return ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264'];
        default:
            return ['h264_nvenc', 'h264_qsv', 'libx264'];
    }
}
// The codec-specific portion of the FFmpeg command: everything from `-c:v` through the
// rate-control flags. Shared flags (-pix_fmt, -r, -g) stay in the caller. Each hardware
// encoder uses its own low-latency knobs; libx264 keeps the original veryfast/zerolatency.
function videoEncoderArgs(encoder, rate, preset = 'normal') {
    const bitrate = `${rate.bitrateKbps}k`;
    const maxrate = `${rate.maxrateKbps}k`;
    const bufsize = `${rate.bufsizeKbps}k`;
    const common = ['-b:v', bitrate, '-maxrate', maxrate, '-bufsize', bufsize];
    const x264Preset = preset === 'fast' ? 'ultrafast' : 'veryfast';
    switch (encoder) {
        case 'h264_videotoolbox':
            // Apple hardware encoder: no x264-style preset/tune; -realtime keeps latency low.
            return ['-c:v', 'h264_videotoolbox', '-profile:v', 'main', '-realtime', '1', ...common];
        case 'h264_nvenc':
            // NVIDIA: p4 balances speed/quality, ll tune = low latency, CBR for stable RTMP.
            return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-tune', 'll', '-profile:v', 'main', '-rc', 'cbr', ...common];
        case 'h264_qsv':
            // Intel Quick Sync.
            return ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-profile:v', 'main', ...common];
        case 'h264_amf':
            // AMD: low-latency usage + CBR.
            return ['-c:v', 'h264_amf', '-usage', 'lowlatency', '-rc', 'cbr', '-profile:v', 'main', ...common];
        default:
            return [
                '-c:v',
                'libx264',
                '-preset',
                x264Preset,
                '-tune',
                'zerolatency',
                '-profile:v',
                'main',
                '-level',
                '4.1',
                ...common,
            ];
    }
}
// Encode ~3 frames of a black clip to /dev/null with the given encoder. Exit 0 means the
// encoder is present AND the hardware/driver accepts it. Timed out or non-zero => unusable.
function encoderWorks(ffmpegPath, encoder) {
    return new Promise((resolve) => {
        const probe = (0, node_child_process_1.spawn)(ffmpegPath, [
            '-hide_banner',
            '-loglevel',
            'error',
            '-f',
            'lavfi',
            '-i',
            'color=c=black:s=256x256:r=30:d=0.1',
            '-c:v',
            encoder,
            '-f',
            'null',
            '-',
        ]);
        let done = false;
        const settle = (result) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            try {
                probe.kill('SIGKILL');
            }
            catch {
                // Already exited; kill is best-effort.
            }
            resolve(result);
        };
        const timer = setTimeout(() => settle(false), 8000);
        timer.unref?.();
        probe.on('error', () => settle(false));
        probe.on('close', (code) => settle(code === 0));
    });
}
// Encode a few real seconds of the actual clip being streamed through the exact
// production libx264 settings, and read FFmpeg's own -progress speed=Nx figure. A flat-
// color probe (encoderWorks) encodes trivially fast regardless of machine, so it can only
// tell us the codec runs — not whether THIS machine's CPU can sustain it on THIS content,
// which is exactly what determines whether the live stutters.
function benchmarkEncoderSpeed(ffmpegPath, samplePath, rate, encoder, preset, downscale) {
    const scaleStep = downscale ? `,scale=${downscale.width}:${downscale.height}` : '';
    return new Promise((resolve) => {
        const probe = (0, node_child_process_1.spawn)(ffmpegPath, [
            '-hide_banner',
            '-loglevel',
            'error',
            '-i',
            samplePath,
            // 3s was too short to be meaningful: process startup dominated and the same machine
            // read anywhere from 1.6x to 2.5x. 5s steadies it without making the seller wait.
            '-t',
            '5',
            '-vf',
            `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black${scaleStep}`,
            ...videoEncoderArgs(encoder, rate, preset),
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-g',
            '60',
            '-an',
            '-progress',
            'pipe:2',
            '-nostats',
            '-f',
            'null',
            '-',
        ]);
        let lastSpeed = 0;
        let done = false;
        const settle = (speed) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            try {
                probe.kill('SIGKILL');
            }
            catch {
                // Already exited; kill is best-effort.
            }
            resolve(speed);
        };
        // The benchmark itself must never block startup for long: worst case, treat it as
        // "too slow" and fall back to hardware, which is the safe default anyway.
        const timer = setTimeout(() => settle(lastSpeed), 12000);
        timer.unref?.();
        probe.stderr.on('data', (chunk) => {
            const match = /speed=\s*([0-9.]+)x/.exec(String(chunk));
            if (match)
                lastSpeed = Number(match[1]);
        });
        probe.on('error', () => settle(0));
        probe.on('close', () => settle(lastSpeed));
    });
}
// Above the 1.0x a live needs just to keep pace, leaving room for OS jitter and
// measurement noise — repeat benchmark runs on the same hardware were measured drifting
// between 1.7x and 2.5x, and the failing tester machine ran at 0.56x, far below anything
// this separates. Overlay cost is NOT part of this margin; it has its own factor below.
const SAFE_SPEED = 1.25;
// The benchmark encodes the bare scaled clip, but a real live also runs the camera
// zoom/crop plus drawtext clocks/marquees. Measured on the same clip and machine:
// bare filter 9.88x vs zoom + two drawtext 8.09x = 0.82. Applied to every measurement so
// the plan is judged on what the live will actually run, not the cheaper benchmark graph.
//
// That 0.82 came from a three-layer graph. The real filter chain is strictly serial — one
// node per overlay, each compositing over the whole 1080x1920 frame — and the app allows
// up to 12 images + 6 clocks + 8 texts, so a heavily decorated live costs far more than a
// flat factor admits. overlayCost() below charges per layer instead, with the flat value
// kept as the default for capacity math that has no specific live in hand.
const OVERLAY_COST = 0.8;
// Per-layer share of the frame budget, back-solved from the measurement above: three
// layers cost 0.82, so each costs roughly 0.94 (0.94^3 = 0.83). Image overlays are the
// expensive kind — a full-frame alpha composite — while drawtext touches a small region,
// so text and clocks are charged at half a layer.
const LAYER_COST = 0.94;
const FLOOR_OVERLAY_COST = 0.35;
// What fraction of the benchmark speed survives this live's filter graph.
function overlayCost(layers) {
    const weighted = layers.images + (layers.clocks + layers.texts) * 0.5 + (layers.zoomed ? 1 : 0);
    // Never let a maxed-out graph drive the estimate to near zero — past a point the model
    // is extrapolating well beyond what was measured, and the mid-live watchdog is the
    // backstop that catches whatever this gets wrong.
    return Math.max(FLOOR_OVERLAY_COST, LAYER_COST ** weighted);
}
// Same 9:16 shape, 44% of the pixels.
const REDUCED_FRAME = { width: 720, height: 1280 };
// Last-resort floor for very weak machines (25% of the pixels). Soft, but TikTok viewers
// watch on phones — a smooth 540p live sells; a stuttering 1080p one doesn't.
const FLOOR_FRAME = { width: 540, height: 960 };
// Measured speedups over veryfast @ 1080x1920 on the same clip and machine: ultrafast
// ~1.8x, and the 720x1280 downscale ~1.7x on top. Used to project fallback options from
// the baseline reading instead of spending several more benchmark rounds while the seller
// waits to go live. FAST_PRESET_GAIN applies to libx264 ONLY: hardware encoders ignore
// the preset entirely (videoEncoderArgs emits the same command either way), which is the
// bug that used to leave weak-GPU machines "degraded" on paper but unchanged in practice.
const FAST_PRESET_GAIN = 1.8;
const DOWNSCALE_GAIN = 1.7;
// 540x960 over 720x1280, measured at 1.2 on a machine where decode dominates; on the weak
// machines that actually reach this tier the encoder dominates and the true gain is
// larger, so 1.2 is the conservative floor.
const FLOOR_DOWNSCALE_GAIN = 1.2;
let cachedMeasurements = null;
// Measure (once per app run) what this machine can actually do — a tester's Windows box
// was running at 0.56x (16fps instead of 30) because the old code only ever benchmarked
// on macOS and let every other platform fall through to libx264 unchecked.
function detectEncoderMeasurements(ffmpegPath, samplePath, rate) {
    if (!cachedMeasurements) {
        cachedMeasurements = (async () => {
            // First usable hardware encoder, if any.
            let hardware = null;
            for (const candidate of candidatesForPlatform()) {
                if (candidate === 'libx264')
                    break;
                if (await encoderWorks(ffmpegPath, candidate)) {
                    hardware = candidate;
                    break;
                }
            }
            const softwareSpeed = await benchmarkEncoderSpeed(ffmpegPath, samplePath, rate, 'libx264', 'normal', null);
            // Always measure hardware when the machine has it — even when libx264 already clears
            // the bar on its own. Measuring it only on libx264's failure left hardwareSpeed at 0
            // for the entire app run, and a 0 makes every hardware rung of the ladder project 0
            // and therefore unselectable. A GPU machine opening its 2nd or 3rd concurrent live
            // (where speeds are divided by the stream count) would then drop resolution instead
            // of moving to the GPU it already had, and watchdog escalation could never reach it
            // either. Preferring libx264 when it is fast enough still happens — planCandidates
            // lists it first — so the bitrate-accuracy win is kept without blinding the ladder.
            // Cost: one extra ~5s benchmark, once per app run, during the first live only.
            const hardwareSpeed = hardware
                ? await benchmarkEncoderSpeed(ffmpegPath, samplePath, rate, hardware, 'normal', null)
                : 0;
            return { hardware, softwareSpeed, hardwareSpeed };
        })();
    }
    return cachedMeasurements;
}
// Every way this machine could encode, best quality first. Each step down trades visible
// quality for speed, with the projected speed of each option computed from the encoder it
// actually uses — a hardware encoder's only real lever is the downscale.
function planCandidates(meas, effSoftware, effHardware) {
    const list = [
        { encoder: 'libx264', preset: 'normal', downscale: null, measuredSpeed: effSoftware, projected: effSoftware },
    ];
    if (meas.hardware) {
        list.push({ encoder: meas.hardware, preset: 'normal', downscale: null, measuredSpeed: effHardware, projected: effHardware });
    }
    list.push({
        encoder: 'libx264',
        preset: 'fast',
        downscale: null,
        measuredSpeed: effSoftware,
        projected: effSoftware * FAST_PRESET_GAIN,
    });
    if (meas.hardware) {
        list.push({
            encoder: meas.hardware,
            preset: 'normal',
            downscale: REDUCED_FRAME,
            measuredSpeed: effHardware,
            projected: effHardware * DOWNSCALE_GAIN,
        });
    }
    list.push({
        encoder: 'libx264',
        preset: 'fast',
        downscale: REDUCED_FRAME,
        measuredSpeed: effSoftware,
        projected: effSoftware * FAST_PRESET_GAIN * DOWNSCALE_GAIN,
    });
    if (meas.hardware) {
        list.push({
            encoder: meas.hardware,
            preset: 'normal',
            downscale: FLOOR_FRAME,
            measuredSpeed: effHardware,
            projected: effHardware * DOWNSCALE_GAIN * FLOOR_DOWNSCALE_GAIN,
        });
    }
    list.push({
        encoder: 'libx264',
        preset: 'fast',
        downscale: FLOOR_FRAME,
        measuredSpeed: effSoftware,
        projected: effSoftware * FAST_PRESET_GAIN * DOWNSCALE_GAIN * FLOOR_DOWNSCALE_GAIN,
    });
    return list;
}
// Turn the raw measurements into a plan for ONE live starting now.
// - concurrent: how many FFmpeg encodes will run at once including this one. They share
//   the same silicon, so each measurement is divided by it — conservative (encoders don't
//   degrade perfectly linearly), but a downgraded-smooth stream beats a stuttering one.
// - degradeLevel: raised by the mid-live watchdog when a running live proves slower than
//   the benchmark promised; each level forces the next candidate that is actually faster,
//   so escalation always buys real speed instead of re-picking the same losing plan.
function planFromMeasurements(meas, opts) {
    const divisor = Math.max(1, opts.concurrent);
    const cost = opts.filterCost ?? OVERLAY_COST;
    const effSoftware = (meas.softwareSpeed * cost) / divisor;
    const effHardware = (meas.hardwareSpeed * cost) / divisor;
    const list = planCandidates(meas, effSoftware, effHardware);
    let index = list.findIndex((candidate) => candidate.projected >= SAFE_SPEED);
    if (index === -1) {
        // Nothing reaches the bar: take whatever projects fastest.
        index = list.reduce((best, candidate, i) => (candidate.projected > list[best].projected ? i : best), 0);
    }
    for (let step = 0; step < opts.degradeLevel; step += 1) {
        const next = list.findIndex((candidate, i) => i > index && candidate.projected > list[index].projected);
        if (next === -1)
            break;
        index = next;
    }
    const chosen = list[index];
    return { encoder: chosen.encoder, preset: chosen.preset, downscale: chosen.downscale, measuredSpeed: chosen.measuredSpeed };
}
// How many simultaneous lives this machine can actually carry at full quality, derived
// from the benchmark rather than from a core count. os.cpus() reports LOGICAL processors,
// so a 4-core/8-thread box looks like 8 and a core-count guardrail advertises twice the
// capacity it has — SMT threads share one core's execution units and x264 gains far less
// from them than from real cores. A measured number sidesteps that entirely, and also
// accounts for clock speed, thermal limits, and whether a usable GPU is present.
// Bitrate that suits a downscaled frame. The degrade ladder used to shrink the picture
// while still asking for the full 1080p bitrate, which is both wasteful (540x960 at
// 6000 kbps spends bits on detail that no longer exists) and useless against the failure
// it most often faces: when the uplink is the bottleneck, a smaller frame at the same
// bitrate sends exactly as many bytes and drops exactly as often. Scaling the rate with
// the pixel count makes one ladder answer both CPU and network trouble.
const FULL_FRAME_PIXELS = 1080 * 1920;
const MIN_LADDER_BITRATE_KBPS = 1500;
function bitrateForFrame(bitrateKbps, downscale) {
    if (!downscale)
        return bitrateKbps;
    // ^0.75 rather than a straight pixel ratio: perceived quality needs more bits per pixel
    // at smaller sizes, so a linear cut would look worse than the resolution drop alone.
    const ratio = (downscale.width * downscale.height) / FULL_FRAME_PIXELS;
    const scaled = Math.round((bitrateKbps * ratio ** 0.75) / 250) * 250;
    return Math.max(MIN_LADDER_BITRATE_KBPS, Math.min(bitrateKbps, scaled));
}
function sustainableStreamCount(meas) {
    // Judged at the quality FLOOR, not at full quality. The ladder degrades a live rather
    // than letting it stutter, so "how many can this machine carry" honestly means how many
    // it can carry after degrading. Measuring at 1080p instead would cut a mid-range machine
    // from four concurrent lives to one and lock out sellers who happily run several shops
    // today at reduced resolution — a guardrail should catch the machine that cannot cope at
    // all, not revoke capacity people are already using.
    const software = meas.softwareSpeed * OVERLAY_COST * FAST_PRESET_GAIN * DOWNSCALE_GAIN * FLOOR_DOWNSCALE_GAIN;
    const hardware = meas.hardwareSpeed * OVERLAY_COST * DOWNSCALE_GAIN * FLOOR_DOWNSCALE_GAIN;
    return Math.max(1, Math.floor(Math.max(software, hardware) / SAFE_SPEED));
}
// Whether raising degradeLevel by one would change anything — the mid-live watchdog uses
// this to stop restarting a live that is already at the floor.
function canDegradeFurther(meas, opts) {
    const current = planFromMeasurements(meas, opts);
    const next = planFromMeasurements(meas, { ...opts, degradeLevel: opts.degradeLevel + 1 });
    return (next.encoder !== current.encoder ||
        next.preset !== current.preset ||
        (next.downscale?.width ?? 0) !== (current.downscale?.width ?? 0));
}
