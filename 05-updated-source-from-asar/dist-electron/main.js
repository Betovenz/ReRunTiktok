"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_stream_1 = require("node:stream");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
// Named import, never a default one: electron-updater marks itself __esModule but exports
// no `default`, so `import electronUpdater from ...` compiles to an undefined binding and
// every autoUpdater access throws. `autoUpdater` itself is a lazy getter that builds the
// platform updater on first access, so it must stay untouched until the app is ready.
const electron_updater_1 = require("electron-updater");
const encoder_1 = require("./encoder");
const notify_1 = require("./notify");
const chat_engine_1 = require("./chat-engine");
electron_1.protocol.registerSchemesAsPrivileged([
    {
        scheme: 'rerun-media',
        privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true },
    },
]);
let mainWindow = null;
const mediaTokens = new Map();
// Give up only after a long run of failures: a TikTok-side outage can last minutes.
const MAX_RESTART_ATTEMPTS = 12;
const RESTART_HEALTHY_AFTER_MS = 90000;
// See the watchdog in startFfmpeg: with -re a healthy stream sits just under 1.0x, so
// "falling behind" has to mean clearly below that band, sustained for 45s rather than 20.
// drawtext reload interval in frames for the clocks that still need a file. At 30fps this
// is 3 reads a second instead of 30 — Thai date and weekday text changes once a minute at
// the fastest, so nothing visible is lost.
const CLOCK_RELOAD_FRAMES = 10;
const LIVE_SPEED_FLOOR = 0.8;
const LIVE_SPEED_STREAK = 45;
// Drops this many times in one live and we stop blaming luck and start lowering the
// bitrate. 2000 kbps is the floor — below that 1080x1920 stops being worth watching.
const NETWORK_BACKOFF_AFTER_DROPS = 3;
const MIN_BACKOFF_BITRATE_KBPS = 2000;
// One live per TikTok account can run concurrently, so every piece of per-stream
// state (ffmpeg process, clock file/timer, status, TikTok room) lives in its own
// session struct keyed by accountId instead of a single set of module globals.
const streamSessions = new Map();
// Set once the encoder benchmark has run (first live of the app run). Until then the
// core-count estimate below is all we have.
let measuredStreamCapacity = null;
// Guardrail: cap simultaneous lives so one machine isn't oversubscribed.
//
// Three limits, whichever is tightest:
//  - cores: roughly one live per two CPUs. os.cpus() counts LOGICAL processors, so this
//    overcounts on Hyper-Threading — kept only as the estimate used before the first
//    benchmark exists, and superseded by the measured figure as soon as one does.
//  - measured: what this machine actually encoded during the startup benchmark. Immune to
//    the SMT overcount, and also reflects clock speed, thermals, and GPU availability.
//  - RAM: every concurrent live adds a hidden TikTok LIVE Manager window (a full Chromium
//    renderer, ~350MB) plus an ffmpeg process (~140MB measured). RAM runs out before the
//    CPU cap does on small machines, and nothing else guards it.
function maxConcurrentStreams() {
    const cores = node_os_1.default.cpus()?.length || 2;
    const coreCap = Math.max(1, Math.min(8, Math.floor(cores / 2)));
    // Keep 40% of RAM for the OS and whatever else the seller is running; ~800MB covers the
    // app's own window and main process, ~600MB covers each additional live.
    const usableBytes = node_os_1.default.totalmem() * 0.6 - 800 * 1024 * 1024;
    const ramCap = Math.max(1, Math.floor(usableBytes / (600 * 1024 * 1024)));
    return Math.max(1, Math.min(coreCap, ramCap, measuredStreamCapacity ?? coreCap));
}
// How many accounts currently hold a live pipeline (ffmpeg running or a TikTok room open).
function activeStreamCount() {
    let count = 0;
    for (const session of streamSessions.values()) {
        if (session.ffmpegProcess || session.room)
            count += 1;
    }
    return count;
}
function idleStatus() {
    return { state: 'idle', message: 'พร้อมใช้งาน' };
}
function getStreamSession(accountId) {
    const id = normalizeAccountId(accountId);
    let sessionState = streamSessions.get(id);
    if (!sessionState) {
        sessionState = {
            accountId: id,
            ffmpegProcess: null,
            clockTimers: [],
            clockTextPaths: [],
            status: idleStatus(),
            room: null,
            liveTitle: '',
            degradeLevel: 0,
            tech: '',
            degradeRestartPending: false,
            applySwitchTimer: null,
            applyRestartPending: false,
            stopGeneration: 0,
            retry: null,
        };
        streamSessions.set(id, sessionState);
    }
    return sessionState;
}
function peekStreamSession(accountId) {
    return streamSessions.get(normalizeAccountId(accountId)) ?? null;
}
function unpackedBinary(binaryPath) {
    if (!binaryPath)
        return null;
    return electron_1.app.isPackaged ? binaryPath.replace('app.asar', 'app.asar.unpacked') : binaryPath;
}
function mediaUrl(filePath) {
    const token = (0, node_crypto_1.randomUUID)();
    mediaTokens.set(token, filePath);
    return `rerun-media://local/${token}`;
}
function mediaMimeType(filePath) {
    switch (node_path_1.default.extname(filePath).toLowerCase()) {
        case '.mp4':
        case '.m4v':
            return 'video/mp4';
        case '.mov':
            return 'video/quicktime';
        case '.mkv':
            return 'video/x-matroska';
        case '.webm':
            return 'video/webm';
        case '.png':
            return 'image/png';
        case '.webp':
            return 'image/webp';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        default:
            return 'application/octet-stream';
    }
}
function assertTrustedSender(event) {
    const senderUrl = event.senderFrame?.url ?? '';
    if (senderUrl.startsWith('file://') || senderUrl.startsWith('http://localhost:5173'))
        return;
    throw new Error('คำขอนี้ไม่ได้มาจากหน้าต่างหลักของแอป');
}
function updateStatus(sessionState, next) {
    const previous = sessionState.status;
    sessionState.status = next;
    mainWindow?.webContents.send('stream:status-changed', { accountId: sessionState.accountId, status: next });
    notifyStatusTransition(sessionState, previous.state, next);
    recordHistoryTransition(sessionState, previous, next);
    return next;
}
// Fire a LINE push on meaningful stream-state transitions (only on the *edge*, so we don't
// spam on repeated same-state updates). Best-effort and non-blocking.
function notifyStatusTransition(sessionState, previous, next) {
    const config = getLineConfig();
    if (!config.enabled)
        return;
    const label = sessionState.liveTitle.trim() || sessionState.accountId;
    // retry.everLive is only true once this live has been on air before, and it is set
    // *after* the first live transition — so it exactly distinguishes an auto-reconnect
    // (stay quiet) from a genuinely new live (notify).
    const isReconnect = sessionState.retry?.everLive === true;
    if (next.state === 'live' && previous !== 'live' && !isReconnect && config.notifyOnLive) {
        void pushLine(config, `🟢 เริ่มไลฟ์แล้ว\nบัญชี: ${label}\nเวลา: ${nowText()}`);
    }
    else if (next.state === 'idle' && (previous === 'live' || previous === 'stopping') && config.notifyOnStop) {
        void pushLine(config, `⚪️ ไลฟ์จบแล้ว\nบัญชี: ${label}\nเวลา: ${nowText()}`);
    }
    else if (next.state === 'error' && previous !== 'error' && config.notifyOnError) {
        void pushLine(config, `🔴 ไลฟ์มีปัญหา\nบัญชี: ${label}\n${next.message}\nเวลา: ${nowText()}`);
    }
}
function nowText() {
    return new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}
function pushLine(config, text) {
    return (0, notify_1.sendLineMessage)(config, text).then(() => undefined);
}
function normalizeAccountId(value) {
    if (typeof value !== 'string')
        return 'main';
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 48);
    return normalized || 'main';
}
function tikTokPartition(accountId) {
    return `persist:tiktok-${normalizeAccountId(accountId)}`;
}
function tikTokAuthPath(accountId) {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'tiktok-auth', `${normalizeAccountId(accountId)}.json`);
}
function saveTikTokAuth(accountId, snapshot) {
    const filePath = tikTokAuthPath(accountId);
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(filePath), { recursive: true });
    (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(snapshot), { encoding: 'utf8', mode: 0o600 });
}
function loadTikTokAuth(accountId) {
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(tikTokAuthPath(accountId), 'utf8'));
        if (parsed.version !== 1 || typeof parsed.requestUrl !== 'string' || typeof parsed.userAgent !== 'string')
            return null;
        return {
            version: 1,
            requestUrl: parsed.requestUrl,
            userAgent: parsed.userAgent,
            referer: typeof parsed.referer === 'string' ? parsed.referer : 'https://www.tiktok.com/',
            capturedAt: Number(parsed.capturedAt) || 0,
        };
    }
    catch {
        return null;
    }
}
function chatConfigPath(accountId) {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'chat-config', `${normalizeAccountId(accountId)}.json`);
}
function sanitizeChatConfig(value) {
    const base = (0, chat_engine_1.defaultChatConfig)();
    if (!value || typeof value !== 'object')
        return base;
    const input = value;
    const rules = Array.isArray(input.rules)
        ? input.rules
            .filter((item) => Boolean(item && typeof item === 'object'))
            .map((item) => ({
            id: typeof item.id === 'string' && item.id ? item.id : (0, node_crypto_1.randomUUID)(),
            keyword: typeof item.keyword === 'string' ? item.keyword.slice(0, 120) : '',
            reply: typeof item.reply === 'string' ? item.reply.slice(0, 500) : '',
            enabled: item.enabled !== false,
        }))
            .slice(0, 100)
        : base.rules;
    const ai = input.ai && typeof input.ai === 'object' ? input.ai : {};
    return {
        enabled: input.enabled === true,
        rules,
        ai: {
            enabled: ai.enabled === true,
            provider: ai.provider === 'claude' ? 'claude' : 'gemini',
            apiKey: typeof ai.apiKey === 'string' ? ai.apiKey.trim().slice(0, 200) : '',
            model: typeof ai.model === 'string' && ai.model.trim() ? ai.model.trim().slice(0, 80) : base.ai.model,
            context: typeof ai.context === 'string' ? ai.context.slice(0, 4000) : '',
            useProducts: ai.useProducts !== false,
        },
        replyCooldownMs: Math.min(60000, Math.max(0, Number(input.replyCooldownMs) || base.replyCooldownMs)),
        perUserCooldownMs: Math.min(600000, Math.max(0, Number(input.perUserCooldownMs) || base.perUserCooldownMs)),
        signApiKey: typeof input.signApiKey === 'string' ? input.signApiKey.trim().slice(0, 200) : '',
        hostUsername: typeof input.hostUsername === 'string' ? input.hostUsername.trim().replace(/^@/, '').slice(0, 80) : '',
    };
}
// Chat settings are per-account (each shop account has its own keyword rules and
// BYOK AI key), lazily loaded from disk and cached here.
const chatConfigs = new Map();
function getChatConfig(accountId) {
    const id = normalizeAccountId(accountId);
    let config = chatConfigs.get(id);
    if (!config) {
        try {
            config = sanitizeChatConfig(JSON.parse((0, node_fs_1.readFileSync)(chatConfigPath(id), 'utf8')));
        }
        catch {
            config = (0, chat_engine_1.defaultChatConfig)();
        }
        chatConfigs.set(id, config);
    }
    return config;
}
function saveChatConfig(accountId, value) {
    const id = normalizeAccountId(accountId);
    const config = sanitizeChatConfig(value);
    chatConfigs.set(id, config);
    const filePath = chatConfigPath(id);
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(filePath), { recursive: true });
    (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(config), { encoding: 'utf8', mode: 0o600 });
    // If this account's chat is already live, apply the new settings without reconnecting.
    if (peekStreamSession(id)?.room)
        (0, chat_engine_1.updateChatConfig)(id, config);
    return config;
}
function emitChatEvent(accountId, event) {
    mainWindow?.webContents.send('chat:event', { accountId: normalizeAccountId(accountId), event });
}
// LINE notification config is workspace-level (one setting for the whole app), not per
// account, so it lives in a single file and a single cached value.
let lineConfigCache = null;
function lineConfigPath() {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'line-config.json');
}
function getLineConfig() {
    if (!lineConfigCache) {
        try {
            lineConfigCache = (0, notify_1.sanitizeLineConfig)(JSON.parse((0, node_fs_1.readFileSync)(lineConfigPath(), 'utf8')));
        }
        catch {
            lineConfigCache = (0, notify_1.defaultLineConfig)();
        }
    }
    return lineConfigCache;
}
function saveLineConfig(value) {
    const config = (0, notify_1.sanitizeLineConfig)(value);
    lineConfigCache = config;
    const filePath = lineConfigPath();
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(filePath), { recursive: true });
    (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(config), { encoding: 'utf8', mode: 0o600 });
    return config;
}
const HISTORY_LIMIT = 200;
let historyCache = null;
function historyPath() {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'live-history.json');
}
function getHistory() {
    if (!historyCache) {
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(historyPath(), 'utf8'));
            historyCache = Array.isArray(parsed) ? parsed : [];
        }
        catch {
            historyCache = [];
        }
    }
    return historyCache;
}
function writeHistory(entries) {
    historyCache = entries.slice(-HISTORY_LIMIT);
    const filePath = historyPath();
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(filePath), { recursive: true });
    (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(historyCache), { encoding: 'utf8', mode: 0o600 });
}
// Append a history entry when a live run ends (naturally/stopped) or errors out. Only
// records sessions that actually reached air, or a starting session that errored.
function recordHistoryTransition(sessionState, previous, next) {
    const wasLive = previous.state === 'live' || previous.state === 'stopping';
    const endedNow = next.state === 'idle' && wasLive;
    const erroredNow = next.state === 'error' && previous.state !== 'error';
    if (!endedNow && !erroredNow)
        return;
    if (erroredNow && previous.state !== 'live' && previous.state !== 'starting' && previous.state !== 'stopping')
        return;
    const endedAt = Date.now();
    const startedAt = previous.startedAt ?? endedAt;
    const entry = {
        id: (0, node_crypto_1.randomUUID)(),
        accountId: sessionState.accountId,
        title: sessionState.liveTitle.trim() || sessionState.accountId,
        startedAt,
        endedAt,
        durationSec: Math.max(0, Math.round((endedAt - startedAt) / 1000)),
        reason: erroredNow ? 'error' : 'ended',
        message: next.message,
        ...(sessionState.tech ? { tech: sessionState.tech } : {}),
    };
    writeHistory([...getHistory(), entry]);
    mainWindow?.webContents.send('history:changed');
    // Then try to attach TikTok's figures. Deliberately after the write: the history entry is
    // the record that a live happened, and it must not depend on the console still being
    // reachable. If the read works, patch the entry in place and tell the dashboard.
    void (async () => {
        try {
            const stats = (await runInLiveConsole(sessionState.accountId, liveStatsScript()));
            if (stats?.gmv === null && stats?.itemsSold === null)
                return;
            const history = getHistory();
            const index = history.findIndex((item) => item.id === entry.id);
            if (index === -1)
                return;
            history[index] = {
                ...history[index],
                ...(typeof stats.gmv === 'number' ? { gmv: stats.gmv } : {}),
                ...(typeof stats.itemsSold === 'number' ? { itemsSold: stats.itemsSold } : {}),
            };
            writeHistory(history);
            mainWindow?.webContents.send('history:changed');
        }
        catch {
            // The console may already be gone; the live itself is still recorded.
        }
    })();
}
function defaultPinConfig() {
    return { enabled: false, intervalMinutes: 5, includeCoupon: false, products: [] };
}
function pinConfigPath(accountId) {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'pin-config', `${normalizeAccountId(accountId)}.json`);
}
function sanitizePinConfig(value) {
    const base = defaultPinConfig();
    if (!value || typeof value !== 'object')
        return base;
    const input = value;
    const products = Array.isArray(input.products)
        ? input.products
            .filter((item) => Boolean(item && typeof item === 'object'))
            .map((item) => ({
            id: typeof item.id === 'string' && item.id ? item.id : (0, node_crypto_1.randomUUID)(),
            name: typeof item.name === 'string' ? item.name.slice(0, 200) : '',
            enabled: item.enabled !== false,
            // https only, and stored as a plain URL — the thumbnail is fetched by the
            // renderer when it paints the row, so anything else here would be a way to
            // point the app at a local file or a script URL.
            ...(typeof item.image === 'string' && /^https:\/\//.test(item.image)
                ? { image: item.image.slice(0, 500) }
                : {}),
        }))
            .filter((item) => item.name)
            // Reject container blobs left behind by the extraction bug above — a name carrying
            // the list header or the filter bar is not a product, and pinning it hits the
            // pin-whole-list control.
            .filter((item) => item.name.length <= 120 && !/Product list in this LIVE|All categories|All stock/i.test(item.name))
            .slice(0, 50)
        : base.products;
    return {
        enabled: input.enabled === true,
        // One minute is the floor: TikTok needs a moment to settle after a pin, and a faster
        // cycle would spend the live re-pinning rather than selling.
        intervalMinutes: Math.min(120, Math.max(1, Math.round(Number(input.intervalMinutes) || base.intervalMinutes))),
        includeCoupon: input.includeCoupon === true,
        products,
    };
}
const pinConfigs = new Map();
function getPinConfig(accountId) {
    const id = normalizeAccountId(accountId);
    let config = pinConfigs.get(id);
    if (!config) {
        try {
            config = sanitizePinConfig(JSON.parse((0, node_fs_1.readFileSync)(pinConfigPath(id), 'utf8')));
        }
        catch {
            config = defaultPinConfig();
        }
        pinConfigs.set(id, config);
    }
    return config;
}
function savePinConfig(accountId, value) {
    const id = normalizeAccountId(accountId);
    const config = sanitizePinConfig(value);
    pinConfigs.set(id, config);
    const filePath = pinConfigPath(id);
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(filePath), { recursive: true });
    (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(config), { encoding: 'utf8', mode: 0o600 });
    // Apply immediately to a live that is already running, the way chat settings do.
    restartPinRotation(id);
    return config;
}
// Read the product list out of the LIVE console. Separate from the diagnostic scan because
// this one has to be stable enough to drive a feature: name, price and stock only.
function liveProductsScript() {
    return `(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const cap = (s, n) => (s || '').replace(/\\s+/g, ' ').trim().slice(0, n)
    const seen = (el) => {
      if (!el.getClientRects || el.getClientRects().length === 0) return false
      const style = window.getComputedStyle(el)
      return style.visibility !== 'hidden' && style.display !== 'none'
    }
    // Exact label, not a substring. "\\bpin\\b" also matched stray prose, and it MISSED
    // "Unpin" — so a product that was already pinned vanished from the list entirely.
    const isPin = (el) => /^(pin|unpin|ปัก|เลิกปัก)$/i.test(cap(el.textContent, 20))
    // Walk UP from the Pin button to its product card. Scanning every div for one that
    // holds both the stock line and a single Pin picked the innermost wrapper — which has
    // "In stock: 18.9K … Pin" but not the product name, so every card came back nameless
    // and nothing could be matched later. The card is the first ancestor that carries a
    // price AND the stock line: that pair only appears once the name is inside too.
    const cardFor = (button) => {
      let node = button.parentElement
      for (let i = 0; node && node !== document.body && i < 8; i += 1) {
        const t = cap(node.textContent, 400)
        // Price and stock line are necessary but nowhere near sufficient: the container
        // holding the whole product column has both, and walking up to it produced a
        // "product" named "AllAll categoriesAll stockProduct list in this LIVE+11Pin…"
        // whose Pin button was the PIN-WHOLE-LIST control. Rotating onto that name pinned
        // the entire list on a real broadcast. A product card contains exactly one Pin.
        const owned = [...node.querySelectorAll('button, [role="button"]')].filter(isPin).length
        if (owned > 1) return null
        if (owned === 1 && /[฿$]/.test(t) && /In stock|คงเหลือ|Requested demo/i.test(t) && t.length >= 40) {
          return node
        }
        node = node.parentElement
      }
      return null
    }
    const cards = []
    const usedCards = []
    const seenNames = []
    // Counters, so an empty result can say WHY. The first version returned an empty list
    // and nothing else, which on a real broadcast meant the button appeared to do nothing
    // and left no way to tell a wrong page from a changed layout from a naming miss.
    const why = { pinButtons: 0, noCard: 0, duplicate: 0, noName: 0, passes: 0 }

    // The element that scrolls the product column, found via a real product card.
    const scroller = () => {
      const anchor = [...document.querySelectorAll('button, [role="button"]')]
        .filter((el) => seen(el) && isPin(el))
        .map(cardFor)
        .filter(Boolean)[0]
      let node = anchor
      for (let i = 0; node && i < 8; i += 1) {
        if (node.scrollHeight > node.clientHeight + 40) return node
        node = node.parentElement
      }
      return null
    }

    const collect = () => {
    for (const button of [...document.querySelectorAll('button, [role="button"]')]) {
      if (!seen(button) || !isPin(button)) continue
      why.pinButtons += 1
      const card = cardFor(button)
      // No card means this Pin belongs to something else — the "Product list in this LIVE"
      // control, or a coupon — and is not a product row.
      if (!card) {
        why.noCard += 1
        continue
      }
      if (usedCards.indexOf(card) !== -1) {
        why.duplicate += 1
        continue
      }
      usedCards.push(card)
      const text = cap(card.textContent, 300)
      const name = cap(text.split(/LIVE only|LIVE Specials|Hot deals|฿/)[0], 160)
      if (!name) {
        why.noName += 1
        continue
      }
      // The card's own thumbnail. srcset first — TikTok serves a sharper variant there —
      // then src. Anything that is not an https URL is dropped rather than passed on.
      let image = ''
      const img = card.querySelector('img')
      if (img) {
        const srcset = (img.getAttribute('srcset') || '').split(',')[0].trim().split(' ')[0]
        const candidate = srcset || img.getAttribute('src') || img.src || ''
        // Plain prefix test, not a regex: this string is emitted into a template literal,
        // which eats the backslashes in /^https:\\/\\// and leaves /^https:/// — a regex
        // that closes early and turns the rest of the line into a comment, breaking the
        // whole script with a SyntaxError the page never reports back.
        if (candidate.indexOf('https://') === 0) image = candidate
      }
      if (seenNames.indexOf(name) !== -1) {
        why.duplicate += 1
        continue
      }
      seenNames.push(name)
      cards.push({ name, text, image, pinned: /unpin|เลิกปัก/i.test(cap(button.textContent, 40)) })
      if (cards.length >= 40) break
    }
    }

    // The console keeps only the visible slice of a long product list in the DOM, so a
    // single pass sees whatever happens to be on screen — a seller with 6 products got 5,
    // with 5 got 4, and with 15 got 4. Scroll the column and collect again until nothing
    // new turns up, the same way pinning already scrolls to reach its target.
    collect()
    const box = scroller()
    if (box) {
      const previousTop = box.scrollTop
      box.scrollTop = 0
      await sleep(200)
      collect()
      for (let step = 0; step < 15; step += 1) {
        const before = cards.length
        const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 4
        box.scrollTop = Math.min(box.scrollHeight, box.scrollTop + box.clientHeight * 0.75)
        await sleep(200)
        why.passes += 1
        collect()
        if (atBottom && cards.length === before) break
      }
      // Put the seller's own scroll position back; this is a read, and it should not leave
      // their product list somewhere they did not put it.
      box.scrollTop = previousTop
    }

    return {
      ok: true,
      url: location.href,
      title: cap(document.title, 120),
      // A console that has not finished rendering its product column looks identical to a
      // console on the wrong page unless we say how much of the page we could see.
      buttons: document.querySelectorAll('button, [role="button"]').length,
      why,
      products: cards,
    }
  })()`;
}
// Click the Pin button on the card whose name matches. The console virtualises its product
// list, so the target may not be mounted: scroll the scroller that holds the cards and look
// again before giving up. Clicks exactly one button, chosen by the card it belongs to —
// never "the last button on screen", which is how the chat composer once nearly hit Mute.
function pinProductScript(name) {
    return `(async () => {
    const wanted = ${JSON.stringify(name)}
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase()
    const cap = (s, n) => (s || '').replace(/\\s+/g, ' ').trim().slice(0, n)
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const seen = (el) => {
      if (!el.getClientRects || el.getClientRects().length === 0) return false
      const st = window.getComputedStyle(el)
      return st.visibility !== 'hidden' && st.display !== 'none'
    }
    // Exact label, not a substring. "\\bpin\\b" also matched stray prose, and it MISSED
    // "Unpin" — so a product that was already pinned vanished from the list entirely.
    const isPin = (el) => /^(pin|unpin|ปัก|เลิกปัก)$/i.test(cap(el.textContent, 20))

    // Same card resolution as the product listing: up from the button, not down from the
    // page, so the container actually contains the product name we are matching against.
    const cardFor = (button) => {
      let node = button.parentElement
      for (let i = 0; node && node !== document.body && i < 8; i += 1) {
        const t = cap(node.textContent, 400)
        // Price and stock line are necessary but nowhere near sufficient: the container
        // holding the whole product column has both, and walking up to it produced a
        // "product" named "AllAll categoriesAll stockProduct list in this LIVE+11Pin…"
        // whose Pin button was the PIN-WHOLE-LIST control. Rotating onto that name pinned
        // the entire list on a real broadcast. A product card contains exactly one Pin.
        const owned = [...node.querySelectorAll('button, [role="button"]')].filter(isPin).length
        if (owned > 1) return null
        if (owned === 1 && /[฿$]/.test(t) && /In stock|คงเหลือ|Requested demo/i.test(t) && t.length >= 40) {
          return node
        }
        node = node.parentElement
      }
      return null
    }
    const findCard = () => {
      for (const button of [...document.querySelectorAll('button, [role="button"]')]) {
        if (!seen(button) || !isPin(button)) continue
        const card = cardFor(button)
        if (!card) continue
        if (norm(cap(card.textContent, 300)).includes(norm(wanted).slice(0, 40))) {
          return { card, button }
        }
      }
      return null
    }

    // The element that actually scrolls the product column.
    const scroller = () => {
      const anchor = [...document.querySelectorAll('button, [role="button"]')]
        .filter((el) => seen(el) && isPin(el))
        .map(cardFor)
        .filter(Boolean)[0]
      let node = anchor
      for (let i = 0; node && i < 8; i += 1) {
        if (node.scrollHeight > node.clientHeight + 40) return node
        node = node.parentElement
      }
      return null
    }

    let hit = findCard()
    if (!hit) {
      const box = scroller()
      if (box) {
        for (let step = 0; step < 12 && !hit; step += 1) {
          box.scrollTop = Math.min(box.scrollHeight, box.scrollTop + box.clientHeight * 0.8)
          await sleep(220)
          hit = findCard()
        }
      }
    }
    if (!hit) return { ok: false, reason: 'not-found' }
    if (/unpin|เลิกปัก/i.test(cap(hit.button.textContent, 40))) return { ok: true, already: true }
    if (hit.button.disabled || hit.button.getAttribute('aria-disabled') === 'true') {
      return { ok: false, reason: 'disabled' }
    }
    hit.button.scrollIntoView({ block: 'center' })
    await sleep(120)
    hit.button.click()
    await sleep(900)
    return { ok: true, already: false, label: cap(hit.button.textContent, 40) }
  })()`;
}
async function runInLiveConsole(accountId, script) {
    const id = normalizeAccountId(accountId);
    await warmChatSenderWindow(id);
    const window = chatSenderWindow(id);
    if (window.webContents.isLoading()) {
        await new Promise((resolve) => window.webContents.once('did-stop-loading', () => resolve()));
    }
    return window.webContents.executeJavaScript(script, true);
}
// One rotation timer per account, alive only while that account is live.
const pinTimers = new Map();
const pinCursors = new Map();
function stopPinRotation(accountId) {
    const id = normalizeAccountId(accountId);
    const timer = pinTimers.get(id);
    if (timer)
        clearInterval(timer);
    pinTimers.delete(id);
    pinCursors.delete(id);
}
async function pinNextProduct(accountId) {
    const id = normalizeAccountId(accountId);
    const config = getPinConfig(id);
    const products = config.products.filter((product) => product.enabled);
    // The coupon is one more stop in the same cycle rather than a second timer — two timers
    // pinning into one console would fight over what is on screen.
    const queue = config.includeCoupon ? [...products, 'coupon'] : [...products];
    if (!queue.length)
        return;
    const cursor = pinCursors.get(id) ?? 0;
    const stop = queue[cursor % queue.length];
    pinCursors.set(id, (cursor + 1) % queue.length);
    if (stop === 'coupon') {
        try {
            const result = (await runInLiveConsole(id, couponScript('pin')));
            const text = result?.ok
                ? result.already
                    ? ''
                    : `ปักคูปอง "${(result.text ?? '').slice(0, 60)}" แล้ว`
                : `ปักคูปองไม่สำเร็จ — ${result?.reason === 'no-coupon' ? 'ไม่พบคูปองในไลฟ์นี้' : 'ปุ่มกดไม่ได้'}`;
            if (text)
                emitChatEvent(id, { kind: 'system', id: (0, node_crypto_1.randomUUID)(), text, at: Date.now() });
        }
        catch (error) {
            emitChatEvent(id, { kind: 'system', id: (0, node_crypto_1.randomUUID)(), text: `ปักคูปองไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`, at: Date.now() });
        }
        return;
    }
    const target = stop;
    try {
        const result = (await runInLiveConsole(id, pinProductScript(target.name)));
        if (result?.ok) {
            if (!result.already) {
                emitChatEvent(id, { kind: 'system', id: (0, node_crypto_1.randomUUID)(), text: `ปักสินค้า "${target.name}" แล้ว`, at: Date.now() });
            }
            return;
        }
        // A failure here must never take the live down with it — say what happened and let the
        // next tick try the next product.
        const why = result?.reason === 'not-found'
            ? 'ไม่พบสินค้านี้ในรายการของไลฟ์'
            : result?.reason === 'disabled'
                ? 'ปุ่มปักยังกดไม่ได้'
                : 'ปักไม่สำเร็จ';
        emitChatEvent(id, { kind: 'system', id: (0, node_crypto_1.randomUUID)(), text: `ปักสินค้า "${target.name}" ไม่สำเร็จ — ${why}`, at: Date.now() });
    }
    catch (error) {
        emitChatEvent(id, {
            kind: 'system',
            id: (0, node_crypto_1.randomUUID)(),
            text: `ปักสินค้าไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`,
            at: Date.now(),
        });
    }
}
// Read the live's product list and hand it to the chat engine, so AI replies quote real
// names, prices and stock instead of guessing. Best-effort: a failure here must not stop a
// live or a rotation.
async function refreshChatProducts(accountId) {
    const id = normalizeAccountId(accountId);
    const config = getChatConfig(id);
    if (!config.enabled || !config.ai.enabled || !config.ai.useProducts)
        return;
    try {
        const result = (await runInLiveConsole(id, liveProductsScript()));
        const lines = (result?.products ?? [])
            .map((product) => (product.text ?? '').replace(/\s*Pin$/i, '').trim())
            .filter(Boolean);
        if (lines.length)
            (0, chat_engine_1.setChatProducts)(id, lines);
    }
    catch {
        // Console unreachable; the model just works from the shop context alone.
    }
}
function restartPinRotation(accountId) {
    const id = normalizeAccountId(accountId);
    stopPinRotation(id);
    const config = getPinConfig(id);
    if (!config.enabled)
        return;
    // Only rotate while this account is actually broadcasting; the Pin controls do not exist
    // on the console otherwise.
    if (!peekStreamSession(id)?.room)
        return;
    const everyMs = config.intervalMinutes * 60000;
    void pinNextProduct(id);
    const timer = setInterval(() => void pinNextProduct(id), everyMs);
    timer.unref();
    pinTimers.set(id, timer);
}
// Coupons sit in the same column as the products but are a different shape: a discount
// line ("20% off") over a condition ("on orders over ฿300.00") with its own Pin, and no
// stock line — which is exactly what tells them apart from a product card. TikTok shows
// one coupon card at a time, so there is nothing to rotate; pinning it is a single action
// the seller triggers, or the rotation can carry it as one more stop.
function couponScript(action) {
    return `(async () => {
    const mode = ${JSON.stringify(action)}
    const cap = (s, n) => (s || '').replace(/\\s+/g, ' ').trim().slice(0, n)
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const seen = (el) => {
      if (!el.getClientRects || el.getClientRects().length === 0) return false
      const st = window.getComputedStyle(el)
      return st.visibility !== 'hidden' && st.display !== 'none'
    }
    const isPin = (el) => /^(pin|unpin|ปัก|เลิกปัก)$/i.test(cap(el.textContent, 20))

    // Up from the Pin button to the smallest box that reads like a coupon: an order
    // threshold, a price, no stock line, and exactly one Pin of its own.
    const couponFor = (button) => {
      let node = button.parentElement
      for (let i = 0; node && node !== document.body && i < 8; i += 1) {
        const t = cap(node.textContent, 300)
        const owned = [...node.querySelectorAll('button, [role="button"]')].filter(isPin).length
        if (owned > 1) return null
        if (/In stock|คงเหลือ|Requested demo/i.test(t)) return null
        if (owned === 1 && /orders over|ขั้นต่ำ|เมื่อซื้อครบ/i.test(t) && /[฿$]/.test(t)) return node
        node = node.parentElement
      }
      return null
    }

    let found = null
    for (const button of [...document.querySelectorAll('button, [role="button"]')]) {
      if (!seen(button) || !isPin(button)) continue
      const card = couponFor(button)
      if (card) {
        found = { card, button }
        break
      }
    }
    if (!found) return { ok: false, reason: 'no-coupon' }

    const text = cap(found.card.textContent, 200)
    const pinned = /^(unpin|เลิกปัก)$/i.test(cap(found.button.textContent, 20))
    if (mode === 'read') return { ok: true, text, pinned }
    if (pinned) return { ok: true, text, pinned: true, already: true }
    if (found.button.disabled || found.button.getAttribute('aria-disabled') === 'true') {
      return { ok: false, reason: 'disabled' }
    }
    found.button.scrollIntoView({ block: 'center' })
    await sleep(120)
    found.button.click()
    await sleep(900)
    return { ok: true, text, pinned: true, already: false }
  })()`;
}
// The LIVE analytics panel, read straight off the console. These are TikTok's own numbers
// for this broadcast, which is what the seller compares against — but they are live totals
// that do not yet account for cancellations, so the dashboard keeps the CSV import as the
// figure of record and shows these as the running total.
function liveStatsScript() {
    return `(() => {
    const cap = (s, n) => (s || '').replace(/\\s+/g, ' ').trim().slice(0, n)
    const seen = (el) => {
      if (!el.getClientRects || el.getClientRects().length === 0) return false
      const st = window.getComputedStyle(el)
      return st.visibility !== 'hidden' && st.display !== 'none'
    }
    const num = (raw) => {
      if (!raw) return null
      const digits = raw.replace(/[^0-9.]/g, '')
      if (!digits) return null
      const value = Number(digits)
      return Number.isFinite(value) ? value : null
    }
    const wanted = [
      { key: 'gmv', match: /attributed gmv|ยอดขาย/i },
      { key: 'itemsSold', match: /attributed items sold|จำนวนที่ขาย/i },
      { key: 'viewers', match: /current viewers|ผู้ชมขณะนี้/i },
      { key: 'productClicks', match: /product clicks/i },
    ]
    const out = { ok: true, gmv: null, itemsSold: null, viewers: null, productClicks: null }
    for (const el of [...document.querySelectorAll('div, span, p, strong')]) {
      if (!seen(el) || el.children.length > 0) continue
      const value = cap(el.textContent, 30)
      if (!value || !/^[฿$]?\\s*[\\d.,]+\\s*%?$/.test(value)) continue
      let node = el.parentElement
      for (let i = 0; node && node !== document.body && i < 4; i += 1) {
        const label = cap(node.textContent, 200).replace(value, '').replace(/[฿$]/g, '').trim()
        if (label && label.length <= 40) {
          const hit = wanted.find((w) => w.match.test(label))
          if (hit && out[hit.key] === null) out[hit.key] = num(value)
          break
        }
        node = node.parentElement
      }
    }
    return out
  })()`;
}
let salesCache = null;
function salesPath() {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'sales.json');
}
function getSales() {
    if (!salesCache) {
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(salesPath(), 'utf8'));
            salesCache = {
                records: Array.isArray(parsed.records) ? parsed.records : [],
                batches: Array.isArray(parsed.batches) ? parsed.batches : [],
            };
        }
        catch {
            salesCache = { records: [], batches: [] };
        }
    }
    return salesCache;
}
function writeSales(store) {
    salesCache = store;
    const filePath = salesPath();
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(filePath), { recursive: true });
    (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(store), { encoding: 'utf8', mode: 0o600 });
}
// RFC4180-ish reader: handles quoted fields, escaped quotes and CRLF. Delimiter is
// sniffed from the header row because exports ship as comma, semicolon or TSV.
function parseDelimited(text) {
    const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const headerLine = body.slice(0, body.search(/\r?\n/) === -1 ? body.length : body.search(/\r?\n/));
    const counts = [
        { d: ',', n: (headerLine.match(/,/g) ?? []).length },
        { d: '\t', n: (headerLine.match(/\t/g) ?? []).length },
        { d: ';', n: (headerLine.match(/;/g) ?? []).length },
    ].sort((a, b) => b.n - a.n);
    const delimiter = counts[0].n > 0 ? counts[0].d : ',';
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < body.length; i += 1) {
        const char = body[i];
        if (quoted) {
            if (char === '"') {
                if (body[i + 1] === '"') {
                    field += '"';
                    i += 1;
                }
                else {
                    quoted = false;
                }
            }
            else {
                field += char;
            }
            continue;
        }
        if (char === '"') {
            quoted = true;
        }
        else if (char === delimiter) {
            row.push(field);
            field = '';
        }
        else if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        }
        else if (char !== '\r') {
            field += char;
        }
    }
    if (field || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((entry) => entry.some((cell) => cell.trim()));
}
// Money cells arrive as "฿1,234.50", "1.234,50", "THB 89.00" — strip everything that is
// not part of the number, then decide which separator is the decimal one.
function parseAmount(raw) {
    const cleaned = raw.replace(/[^\d.,-]/g, '').trim();
    if (!cleaned)
        return null;
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    let normalized = cleaned;
    if (lastComma > lastDot) {
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
    }
    else {
        normalized = cleaned.replace(/,/g, '');
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}
function parseTimestamp(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    // "2026-08-23 14:22:45" and ISO parse natively; "23/08/2026 14:22" needs reordering.
    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(trimmed);
    if (dmy) {
        const [, d, m, y, hh = '0', mm = '0', ss = '0'] = dmy;
        const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
        return Number.isNaN(date.getTime()) ? null : date.getTime();
    }
    const parsed = Date.parse(trimmed.replace(' ', 'T'));
    if (!Number.isNaN(parsed))
        return parsed;
    const fallback = Date.parse(trimmed);
    return Number.isNaN(fallback) ? null : fallback;
}
// Header keywords per field, best match first. Matching is case-insensitive substring
// so "SKU Subtotal After Discount" and "ยอดรวมคำสั่งซื้อ" both land.
const SALES_COLUMN_HINTS = {
    orderId: ['order id', 'order no', 'order number', 'orderid', 'หมายเลขคำสั่งซื้อ', 'รหัสคำสั่งซื้อ'],
    amount: [
        'sku subtotal after discount',
        'subtotal after seller discounts',
        'order amount',
        'grand total',
        'total amount',
        'payment amount',
        'ยอดรวมสุทธิ',
        'ยอดชำระ',
        'ยอดรวม',
        'total',
    ],
    time: ['paid time', 'payment time', 'created time', 'order time', 'create time', 'เวลาชำระเงิน', 'เวลาสั่งซื้อ', 'วันที่'],
    status: ['order status', 'order substatus', 'status', 'สถานะ'],
};
function detectColumn(headers, field) {
    const lower = headers.map((header) => header.trim().toLowerCase());
    for (const hint of SALES_COLUMN_HINTS[field]) {
        const exact = lower.indexOf(hint);
        if (exact !== -1)
            return exact;
    }
    for (const hint of SALES_COLUMN_HINTS[field]) {
        const partial = lower.findIndex((header) => header.includes(hint));
        if (partial !== -1)
            return partial;
    }
    return -1;
}
// Cancelled/refunded rows sit in the same export as completed ones. Counting them would
// overstate revenue, which is the exact failure this whole CSV-only approach exists to
// avoid — so they are dropped, and the UI reports how many.
const EXCLUDED_STATUS_HINTS = [
    'cancel', 'refund', 'return', 'unpaid', 'failed', 'closed',
    'ยกเลิก', 'คืนเงิน', 'คืนสินค้า', 'ยังไม่ชำระ', 'ไม่สำเร็จ',
];
function isExcludedStatus(status) {
    const value = status.trim().toLowerCase();
    if (!value)
        return false;
    return EXCLUDED_STATUS_HINTS.some((hint) => value.includes(hint));
}
// Parsed rows wait here between preview and commit so the user can confirm (or fix the
// column mapping) before anything touches the store.
let pendingSalesImport = null;
function buildSalesPreview(mapping) {
    const pending = pendingSalesImport;
    if (!pending)
        throw new Error('ไม่พบไฟล์ที่กำลังนำเข้า กรุณาเลือกไฟล์ใหม่');
    const warnings = [];
    if (mapping.amount < 0)
        warnings.push('ยังไม่ได้เลือกคอลัมน์ "ยอดเงิน" — กรุณาเลือกเอง');
    if (mapping.time < 0)
        warnings.push('หาคอลัมน์วันเวลาไม่เจอ — กราฟรายวันจะใช้วันที่นำเข้าแทน');
    if (mapping.orderId < 0)
        warnings.push('หาคอลัมน์เลขคำสั่งซื้อไม่เจอ — จะกันข้อมูลซ้ำไม่ได้');
    let total = 0;
    let parsedCount = 0;
    let unparsedAmounts = 0;
    let excluded = 0;
    const sample = [];
    for (const row of pending.rows) {
        const amount = mapping.amount >= 0 ? parseAmount(row[mapping.amount] ?? '') : null;
        if (amount === null) {
            unparsedAmounts += 1;
            continue;
        }
        if (mapping.status >= 0 && isExcludedStatus(row[mapping.status] ?? '')) {
            excluded += 1;
            continue;
        }
        parsedCount += 1;
        total += amount;
        if (sample.length < 5) {
            sample.push({
                orderId: mapping.orderId >= 0 ? (row[mapping.orderId] ?? '').trim() : '',
                amount,
                at: mapping.time >= 0 ? parseTimestamp(row[mapping.time] ?? '') : null,
                status: mapping.status >= 0 ? (row[mapping.status] ?? '').trim() : '',
            });
        }
    }
    if (unparsedAmounts)
        warnings.push(`มี ${unparsedAmounts} แถวที่อ่านยอดเงินไม่ได้ และจะถูกข้าม`);
    if (excluded)
        warnings.push(`ไม่นับ ${excluded} รายการที่ยกเลิก/คืนเงิน/ยังไม่ชำระ`);
    if (mapping.status < 0)
        warnings.push('ไม่ได้เลือกคอลัมน์สถานะ — รายการที่ยกเลิกหรือคืนเงินจะถูกนับรวมด้วย');
    return {
        token: pending.token,
        fileName: pending.fileName,
        headers: pending.headers,
        mapping,
        rowCount: pending.rows.length,
        parsedCount,
        total,
        sample,
        warnings,
    };
}
let libraryCache = null;
function libraryPath() {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'video-library.json');
}
function getLibrary() {
    if (!libraryCache) {
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(libraryPath(), 'utf8'));
            libraryCache = Array.isArray(parsed) ? parsed : [];
        }
        catch {
            libraryCache = [];
        }
    }
    return libraryCache;
}
function writeLibrary(entries) {
    libraryCache = entries;
    const filePath = libraryPath();
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(filePath), { recursive: true });
    (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(libraryCache), { encoding: 'utf8', mode: 0o600 });
}
// Return library entries with a freshly-minted media URL so the renderer can preview each
// clip (media tokens are per-run, so they must be re-issued on every list).
function libraryForRenderer() {
    return getLibrary().map((entry) => ({ ...entry, mediaUrl: mediaUrl(entry.path) }));
}
function addLibraryEntry(filePath) {
    if (typeof filePath !== 'string' || !(0, node_fs_1.existsSync)(filePath))
        return getLibrary();
    const entries = getLibrary();
    // De-dupe by path: re-adding an existing clip just keeps the current list.
    if (entries.some((entry) => entry.path === filePath))
        return entries;
    const next = [...entries, { id: (0, node_crypto_1.randomUUID)(), path: filePath, name: node_path_1.default.basename(filePath), addedAt: Date.now() }];
    writeLibrary(next);
    return next;
}
function removeLibraryEntry(id) {
    const next = getLibrary().filter((entry) => entry.id !== id);
    writeLibrary(next);
    return next;
}
// Build the "check live via LINE" summary: current state of every account that has a
// session, so the user can pull status into their LINE chat on demand.
function liveStatusSummary() {
    const lines = [];
    for (const sessionState of streamSessions.values()) {
        const label = sessionState.liveTitle.trim() || sessionState.accountId;
        const state = sessionState.status.state;
        const icon = state === 'live' ? '🟢' : state === 'starting' ? '🟡' : state === 'error' ? '🔴' : '⚪️';
        const word = state === 'live' ? 'กำลังไลฟ์' : state === 'starting' ? 'กำลังเริ่ม' : state === 'error' ? 'ผิดพลาด' : 'ไม่ได้ไลฟ์';
        if (state !== 'idle')
            lines.push(`${icon} ${label}: ${word}`);
    }
    const liveNow = activeStreamCount();
    const header = `📊 สถานะไลฟ์ (${liveNow}/${maxConcurrentStreams()})\n${nowText()}`;
    return lines.length ? `${header}\n\n${lines.join('\n')}` : `${header}\n\nยังไม่มีบัญชีที่กำลังไลฟ์`;
}
// roomId is null for Stream-Key (manual) lives: TikTok created that room for the user
// outside the app, so the chat engine resolves it from the configured @username instead.
// ── Replying through our own TikTok window ────────────────────────────────────────
//
// tiktok-live-connector can only send chat via Euler Stream's paid relay, which also
// means shipping the seller's TikTok session cookie to a third party. Instead we drive
// the LIVE Manager page the app already signs into: the credentials never leave this
// machine and no per-seat subscription is required. The trade-off is that this depends
// on TikTok's page markup, so every failure path below reports something actionable
// rather than silently dropping the reply.
const LIVE_MANAGER_URL = 'https://shop.tiktok.com/streamer/live/product/dashboard';
const chatSenderWindows = new Map();
function chatSenderWindow(accountId) {
    const existing = chatSenderWindows.get(accountId);
    if (existing && !existing.isDestroyed())
        return existing;
    const window = createTikTokWindow(accountId, 'shop', false);
    // Hidden by default — the seller is already watching LIVE Manager in the browser;
    // this one only exists to host the composer.
    window.hide();
    chatSenderWindows.set(accountId, window);
    window.on('closed', () => {
        if (chatSenderWindows.get(accountId) === window)
            chatSenderWindows.delete(accountId);
    });
    void window.loadURL(LIVE_MANAGER_URL);
    return window;
}
// Open (and finish loading) the hidden LIVE Manager page. Testing showed chat only reads
// reliably while that page is open — without it TikTok answers the webcast WebSocket
// upgrade with a plain page, which surfaced as "Unexpected server response: 200". It also
// means the first reply doesn't have to wait for a cold page load.
async function warmChatSenderWindow(accountId) {
    const window = chatSenderWindow(accountId);
    if (!window.webContents.isLoading())
        return;
    await new Promise((resolve) => {
        const done = () => resolve();
        window.webContents.once('did-stop-loading', done);
        // Never block starting the live on this: a slow or stalled load should still let the
        // read connection try, since it may well work without the page on some accounts.
        setTimeout(done, 15000).unref();
    });
}
function closeChatSenderWindow(accountId) {
    const window = chatSenderWindows.get(accountId);
    chatSenderWindows.delete(accountId);
    if (window && !window.isDestroyed())
        window.destroy();
}
// Runs inside the LIVE Manager page. Finds the chat composer, types through the native
// value setter (React ignores a plain .value assignment) and submits.
function composerScript(text) {
    return `(async () => {
    const text = ${JSON.stringify(text)}
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    // Composers are wide; send controls are usually small icon buttons, so they need a
    // much lower bar than the text field or the fallback click never finds them.
    const visible = (el) => {
      const rect = el.getBoundingClientRect()
      return rect.width > 40 && rect.height > 8
    }
    const clickable = (el) => {
      const rect = el.getBoundingClientRect()
      return rect.width >= 10 && rect.height >= 10
    }
    const hints = ['type something', 'send a message', 'comment', 'พิมพ์', 'ข้อความ', 'แสดงความคิดเห็น']
    const matches = (el) => {
      const label = ((el.getAttribute && (el.getAttribute('placeholder') || el.getAttribute('aria-label'))) || '').toLowerCase()
      return hints.some((hint) => label.includes(hint))
    }
    const candidates = [...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]')].filter(visible)
    const target = candidates.find(matches) || candidates[candidates.length - 1]
    if (!target) return { ok: false, reason: 'no-composer' }
    // LIVE Manager keeps the composer mounted but disabled until the room is actually
    // live, so typing into it would fail in a confusing way.
    if (target.disabled || target.getAttribute('aria-disabled') === 'true') {
      return { ok: false, reason: 'composer-disabled' }
    }
    const held = () => (target.isContentEditable ? target.textContent : target.value).trim()

    if (target.isContentEditable) {
      target.focus()
      document.execCommand('selectAll', false, undefined)
      document.execCommand('insertText', false, text)
    } else {
      // React tracks its own value; a plain assignment gets reverted, so go through the
      // prototype setter and then fire the events React listens for.
      const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      target.focus()
      setter.call(target, text)
      target.dispatchEvent(new Event('input', { bubbles: true }))
      target.dispatchEvent(new Event('change', { bubbles: true }))
    }
    if (held() !== text) return { ok: false, reason: 'not-typed' }

    const key = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }
    target.dispatchEvent(new KeyboardEvent('keydown', key))
    target.dispatchEvent(new KeyboardEvent('keypress', key))
    target.dispatchEvent(new KeyboardEvent('keyup', key))
    // Composers usually clear asynchronously, so settle before judging the result.
    await sleep(350)
    if (held() !== text) return { ok: true, reason: '' }

    // Enter did not submit. Look for a send control, but only one that is clearly the
    // send button inside the composer's own container — clicking an arbitrary button on
    // LIVE Manager could trigger something unrelated, which is worse than not replying.
    const scope = target.closest('form') || target.parentElement?.parentElement
    if (!scope) return { ok: false, reason: 'not-sent' }
    const sendWords = ['send', 'submit', 'ส่ง', 'โพสต์', 'post']
    let button = [...scope.querySelectorAll('button, [role="button"]')].find((el) => {
      if (el.disabled || !clickable(el)) return false
      const label = (el.innerText + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.title || '')).toLowerCase()
      return sendWords.some((word) => label.includes(word))
    })
    // LIVE Manager's send control is a bare 16px <svg> with no text, title or aria-label,
    // so nothing above matches it. Fall back to an icon inside the composer's own wrapper
    // — and only when there is exactly one, so we still never click a control we did not
    // positively identify.
    if (!button) {
      const wrapper = target.parentElement
      const icons = wrapper
        ? [...wrapper.querySelectorAll('svg, button, [role="button"]')].filter((el) => {
            const rect = el.getBoundingClientRect()
            return !el.disabled && rect.width >= 8 && rect.height >= 8
          })
        : []
      if (icons.length === 1) button = icons[0].closest('button, [role="button"]') || icons[0].parentElement || icons[0]
    }
    if (!button) return { ok: false, reason: 'no-send-button' }
    button.click()
    await sleep(350)
    return held() !== text ? { ok: true, reason: '' } : { ok: false, reason: 'not-sent' }
  })()`;
}
// Read-only reconnaissance of the LIVE console page. Runs in the hidden LIVE Manager
// window we already keep open during a broadcast. It NEVER clicks, types, submits, or
// mutates anything — TikTok's own controls are the seller's to press, and a probe that
// could fire one by accident during a live broadcast is not worth the convenience.
//
// The point is to learn the page's real structure (what the Pin controls are called, how
// the analytics tiles are labelled, how a product card is put together) before writing
// code that depends on any of it. Guessing selectors from a screenshot is how the chat
// composer ended up nearly clicking Mute.
function liveConsoleScanScript() {
    return `(() => {
    const cap = (s, n) => (s || '').replace(/\\s+/g, ' ').trim().slice(0, n)
    // "Is this actually rendered", not "is it big". Requiring a positive width filtered out
    // legitimately visible elements whose measured width is 0 (a zero-width containing
    // block still lays text out and still gets a client rect), which silently emptied the
    // whole report. getClientRects covers display:none; visibility is checked separately
    // because a hidden element still has rects.
    const seen = (el) => {
      if (!el.getClientRects || el.getClientRects().length === 0) return false
      const style = window.getComputedStyle(el)
      return style.visibility !== 'hidden' && style.display !== 'none'
    }
    // A short, human-readable path so a selector can be written against it later.
    const where = (el) => {
      const parts = []
      let node = el
      for (let i = 0; node && i < 4; i += 1) {
        let step = node.tagName ? node.tagName.toLowerCase() : '?'
        const id = node.getAttribute && node.getAttribute('id')
        const cls = node.getAttribute && node.getAttribute('class')
        if (id) step += '#' + cap(id, 40)
        else if (cls) step += '.' + cap(String(cls).split(' ').filter(Boolean).slice(0, 2).join('.'), 60)
        parts.unshift(step)
        node = node.parentElement
      }
      return parts.join(' > ')
    }
    // Nearest ancestor big enough to be "the card this control belongs to".
    // The smallest ancestor that says more than the button itself. The bar was 40 chars,
    // which a short coupon card ("15% off / on orders over ฿300.00 / Pin") never clears —
    // the walk then ran all the way to <body> and reported the whole page as context.
    const card = (el) => {
      let node = el.parentElement
      for (let i = 0; node && node !== document.body && i < 6; i += 1) {
        const t = cap(node.textContent, 400)
        if (t.length >= 12) return t
        node = node.parentElement
      }
      return cap(el.textContent, 200)
    }

    const clickable = [...document.querySelectorAll('button, [role="button"], a')].filter(seen)

    // 1) Every Pin-ish control, with the card it sits in so the three kinds (coupon,
    //    whole product list, single product) can be told apart.
    const pins = clickable
      .filter((el) => /\\bpin\\b|ปัก/i.test(cap(el.textContent, 60) + ' ' + ((el.getAttribute('aria-label') || ''))))
      .slice(0, 25)
      .map((el) => ({
        label: cap(el.textContent, 60),
        aria: cap(el.getAttribute('aria-label'), 60),
        disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
        context: card(el),
        path: where(el),
      }))

    // 2) Anything that looks like a metric tile: a short label sitting next to a number or
    //    a baht amount. Kept deliberately loose because the real labels are unknown.
    const metrics = []
    for (const el of [...document.querySelectorAll('div, span, p, strong, h1, h2, h3, h4')]) {
      if (!seen(el) || el.children.length > 0) continue
      const value = cap(el.textContent, 30)
      if (!value || !/^[฿$]?\\s*[\\d.,]+\\s*[%KMkm]?$/.test(value)) continue
      // Walk up for the label instead of reading only the immediate parent. The first real
      // scan missed Attributed GMV entirely because TikTok splits the amount across spans
      // ("฿" in one, "0" in the next): the sibling text was then just the currency symbol,
      // which the old price guard threw away. An ancestor two or three levels up still
      // carries the tile's actual name.
      let label = ''
      let node = el.parentElement
      for (let i = 0; node && node !== document.body && i < 4; i += 1) {
        // Strip the currency symbol the split-span layout leaves behind, so the label reads
        // "Attributed GMV" rather than "Attributed GMV฿".
        const rest = cap(node.textContent, 200).replace(value, '').replace(/[฿$]/g, '').trim()
        // Real words, and short enough to be a tile name rather than a whole card.
        if (/[A-Za-z\\u0E00-\\u0E7F]{2,}/.test(rest) && rest.length <= 40) {
          label = rest
          break
        }
        node = node.parentElement
      }
      if (!label) continue
      metrics.push({ label, value, path: where(el) })
      if (metrics.length >= 60) break
    }

    // 3) Product rows: a card that has both a price and its own Pin control.
    const products = []
    for (const el of [...document.querySelectorAll('div, li')]) {
      if (!seen(el) || products.length >= 15) continue
      const text = cap(el.textContent, 300)
      // Currency symbol OR a plain price-looking number: the baht sign is the obvious
      // marker but it is one glyph away from breaking on any encoding surprise.
      if (!/[฿$]|THB|\\d[\\d,]*\\.\\d{2}/.test(text)) continue
      const ownPins = [...el.querySelectorAll('button, [role="button"]')].filter((b) =>
        /\\bpin\\b|ปัก/i.test(cap(b.textContent, 40)),
      )
      if (ownPins.length !== 1) continue
      // Only the innermost such card — otherwise every ancestor matches too.
      if (el.querySelector('div, li') && [...el.querySelectorAll('div, li')].some((c) =>
        /[฿$]|THB|\\d[\\d,]*\\.\\d{2}/.test(cap(c.textContent, 300)) &&
        [...c.querySelectorAll('button, [role="button"]')].filter((b) => /\\bpin\\b|ปัก/i.test(cap(b.textContent, 40))).length === 1
      )) continue
      products.push({ text, path: where(el) })
    }

    // Where this page can go, and what it says. The first scan came back from
    // business.tiktokshop.com/us/creator/live with 23 clickable elements and a promo
    // carousel — an entry page, not the console — and there was no way to tell from the
    // report how to reach the real one. These two fields answer that.
    const links = [...document.querySelectorAll('a[href]')]
      .filter(seen)
      .map((a) => ({ text: cap(a.textContent, 50), href: cap(a.getAttribute('href'), 120) }))
      .filter((l) => l.text)
      .slice(0, 40)
    const sample = cap(document.body ? document.body.innerText : '', 4000)

    return {
      ok: true,
      url: location.href,
      title: cap(document.title, 120),
      links,
      sample,
      liveish: /live/i.test(document.title) || Boolean(document.querySelector('[class*="live" i]')),
      counts: { clickable: clickable.length, pins: pins.length, metrics: metrics.length, products: products.length },
      pins,
      metrics,
      products,
    }
  })()`;
}
async function sendChatViaWindow(accountId, text) {
    const window = chatSenderWindow(accountId);
    if (window.webContents.isLoading()) {
        await new Promise((resolve) => window.webContents.once('did-stop-loading', () => resolve()));
    }
    const result = (await window.webContents.executeJavaScript(composerScript(text), true));
    if (result?.ok)
        return;
    const reasons = {
        'no-composer': 'ไม่พบช่องแชทในหน้า LIVE Manager — ตรวจว่าล็อกอิน TikTok แล้วและกำลังไลฟ์อยู่',
        'composer-disabled': 'ช่องแชทใน LIVE Manager ยังปิดอยู่ — TikTok จะเปิดให้พิมพ์เมื่อเริ่มไลฟ์จริงแล้ว',
        'not-typed': 'พิมพ์ข้อความลงช่องแชทไม่ได้ — TikTok อาจเปลี่ยนหน้าเว็บ',
        'no-send-button': 'พิมพ์ได้แต่หาปุ่มส่งไม่เจอ — TikTok อาจเปลี่ยนหน้าเว็บ',
    };
    throw new Error(reasons[result?.reason] ?? 'ส่งข้อความไม่สำเร็จ — TikTok อาจเปลี่ยนหน้าเว็บ');
}
// Turn the library's raw connect failures into something a seller can act on. The
// webcast handshake in particular surfaces as "Unexpected server response: 200", which
// means TikTok answered the WebSocket upgrade with an ordinary page — almost always
// transient, and meaningless to anyone reading the chat panel.
function describeChatConnectError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/isn't online|user_offline/i.test(message)) {
        return 'ยังไม่พบห้องไลฟ์ — TikTok จะเปิดให้อ่านแชทเมื่อไลฟ์ขึ้นจริงแล้ว';
    }
    if (/Unexpected server response/i.test(message)) {
        return `TikTok ปฏิเสธการเชื่อมต่อแชทชั่วคราว (${message})`;
    }
    if (/rate.?limit|429/i.test(message)) {
        return 'ตัวช่วยเชื่อมต่อแชทถูกจำกัดจำนวนครั้งชั่วคราว — รอสักครู่แล้วระบบจะลองใหม่';
    }
    return message;
}
// Chat connect is retried in the background: a live runs for hours, and giving up after
// the first failure left the whole session with no chat at all. Delays are deliberately
// long — Euler Stream's free sign tier allows only ~5 requests/minute, so retrying fast
// would rate-limit us into a worse failure than the one being retried.
const CHAT_RETRY_DELAYS_MS = [8000, 20000, 45000, 90000, 180000];
const chatRetryTimers = new Map();
function cancelChatRetry(accountId) {
    const timer = chatRetryTimers.get(accountId);
    if (timer)
        clearTimeout(timer);
    chatRetryTimers.delete(accountId);
}
async function startRoomChat(accountId, roomId, attempt = 0) {
    const config = getChatConfig(accountId);
    if (!config.enabled)
        return;
    cancelChatRetry(accountId);
    try {
        // Must happen before connecting, not lazily on the first reply — see
        // warmChatSenderWindow for why the read connection depends on this page being open.
        await warmChatSenderWindow(accountId);
        const tikTokSession = electron_1.session.fromPartition(tikTokPartition(accountId), { cache: true });
        const cookie = await tikTokCookieHeader(tikTokSession);
        await (0, chat_engine_1.startChatEngine)({
            accountId,
            roomId,
            cookie,
            config,
            emit: (event) => emitChatEvent(accountId, event),
            send: (text) => sendChatViaWindow(accountId, text),
        });
    }
    catch (error) {
        const detail = describeChatConnectError(error);
        const delay = CHAT_RETRY_DELAYS_MS[attempt];
        if (delay === undefined) {
            emitChatEvent(accountId, {
                kind: 'system',
                id: (0, node_crypto_1.randomUUID)(),
                text: `เปิดระบบตอบแชทไม่สำเร็จ: ${detail} — หยุดลองใหม่แล้ว (กดหยุดไลฟ์แล้วเริ่มใหม่เพื่อลองอีกครั้ง)`,
                at: Date.now(),
            });
            return;
        }
        emitChatEvent(accountId, {
            kind: 'system',
            id: (0, node_crypto_1.randomUUID)(),
            text: `${detail} — จะลองเชื่อมต่อใหม่ใน ${Math.round(delay / 1000)} วินาที (ครั้งที่ ${attempt + 1}/${CHAT_RETRY_DELAYS_MS.length})`,
            at: Date.now(),
        });
        const timer = setTimeout(() => {
            chatRetryTimers.delete(accountId);
            void startRoomChat(accountId, roomId, attempt + 1);
        }, delay);
        timer.unref();
        chatRetryTimers.set(accountId, timer);
    }
}
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1080,
        minHeight: 720,
        title: 'Rerun Studio',
        backgroundColor: '#0B0D12',
        // แถบบนหน้าต่างวาดเองใน renderer (UI v11 แบบ B) จึงปิด frame + เมนูของ Windows
        frame: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl)
        void mainWindow.loadURL(devUrl);
    else
        void mainWindow.loadFile(node_path_1.default.join(__dirname, '../dist/index.html'));
    const sendWindowState = () => {
        if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('window:state', { maximized: mainWindow.isMaximized() });
    };
    mainWindow.on('maximize', sendWindowState);
    mainWindow.on('unmaximize', sendWindowState);
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function createTikTokWindow(accountId, target, autoLoad = true) {
    const partition = tikTokPartition(accountId);
    const tikTokSession = electron_1.session.fromPartition(partition, { cache: true });
    const title = target === 'login'
        ? 'เข้าสู่ระบบ TikTok'
        : target === 'shop'
            ? 'TikTok Shop — ตัวจัดการ LIVE'
            : 'TikTok';
    const targetUrl = target === 'login'
        ? 'https://www.tiktok.com/live'
        : target === 'shop'
            ? 'https://shop.tiktok.com/streamer/live/product/dashboard'
            : 'https://www.tiktok.com/';
    const window = new electron_1.BrowserWindow({
        width: 1080,
        height: 760,
        title,
        autoHideMenuBar: true,
        webPreferences: {
            partition,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            safeDialogs: true,
        },
    });
    tikTokSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
        callback(false);
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
        let hostname = '';
        try {
            hostname = new URL(url).hostname;
        }
        catch {
            return { action: 'deny' };
        }
        const allowedHosts = ['tiktok.com', 'google.com', 'facebook.com', 'apple.com'];
        const allowed = allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
        return {
            action: allowed ? 'allow' : 'deny',
            overrideBrowserWindowOptions: {
                autoHideMenuBar: true,
                webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true },
            },
        };
    });
    window.on('page-title-updated', (event) => {
        if (target === 'shop')
            event.preventDefault();
    });
    if (autoLoad)
        void window.loadURL(targetUrl);
    return window;
}
async function hasTikTokLogin(tikTokSession) {
    const [sessionId, multiSids] = await Promise.all([
        tikTokSession.cookies.get({ name: 'sessionid' }),
        tikTokSession.cookies.get({ name: 'multi_sids' }),
    ]);
    return sessionId.some((cookie) => Boolean(cookie.value)) && multiSids.some((cookie) => Boolean(cookie.value));
}
function waitForTikTokLogin(loginWindow, tikTokSession, accountId) {
    return new Promise((resolve) => {
        let settled = false;
        let checking = false;
        let captured = false;
        const filter = { urls: ['*://*.tiktok.com/*'] };
        const capture = (details) => {
            if (settled || captured)
                return;
            const headers = details.requestHeaders ?? {};
            const cookie = headers.Cookie ?? headers.cookie ?? '';
            if (!/sessionid=[^;\s]/.test(cookie) || !/multi_sids=[^;\s]/.test(cookie))
                return;
            const snapshot = {
                version: 1,
                requestUrl: details.url,
                userAgent: headers['User-Agent'] ?? headers['user-agent'] ?? loginWindow.webContents.getUserAgent(),
                referer: headers.Referer ?? headers.referer ?? 'https://www.tiktok.com/',
                capturedAt: Date.now(),
            };
            saveTikTokAuth(accountId, snapshot);
            captured = true;
        };
        tikTokSession.webRequest.onSendHeaders(filter, capture);
        const finish = (saved) => {
            if (settled)
                return;
            settled = true;
            clearInterval(timer);
            tikTokSession.webRequest.onSendHeaders(filter, null);
            resolve(saved);
        };
        const check = async (closeOnSuccess) => {
            if (settled || checking)
                return;
            checking = true;
            try {
                if (!(await hasTikTokLogin(tikTokSession)) || (!captured && !loadTikTokAuth(accountId)))
                    return;
                await tikTokSession.flushStorageData();
                finish(true);
                if (closeOnSuccess && !loginWindow.isDestroyed()) {
                    loginWindow.setTitle('เชื่อมต่อ TikTok สำเร็จ');
                    setTimeout(() => {
                        for (const childWindow of loginWindow.getChildWindows())
                            childWindow.close();
                        if (!loginWindow.isDestroyed())
                            loginWindow.close();
                    }, 650);
                }
            }
            finally {
                checking = false;
            }
        };
        const timer = setInterval(() => void check(true), 750);
        void loginWindow.loadURL('https://www.tiktok.com/live');
        void check(true);
        loginWindow.once('closed', () => {
            if (settled)
                return;
            clearInterval(timer);
            void hasTikTokLogin(tikTokSession)
                .then(async (saved) => {
                const ready = saved && Boolean(loadTikTokAuth(accountId));
                if (ready)
                    await tikTokSession.flushStorageData();
                finish(ready);
            })
                .catch(() => finish(false));
        });
    });
}
function findApiValue(value, keys, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 8)
        return undefined;
    const record = value;
    for (const key of keys) {
        if (record[key] !== undefined && record[key] !== null && record[key] !== '')
            return record[key];
    }
    for (const nested of Object.values(record)) {
        const found = findApiValue(nested, keys, depth + 1);
        if (found !== undefined)
            return found;
    }
    return undefined;
}
function apiString(value, keys) {
    const found = findApiValue(value, keys);
    return typeof found === 'string' || typeof found === 'number' ? String(found) : '';
}
async function tikTokCookieHeader(tikTokSession) {
    const cookies = await tikTokSession.cookies.get({});
    return cookies
        .filter((cookie) => String(cookie.domain).replace(/^\./, '').endsWith('tiktok.com') && Boolean(cookie.value))
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ');
}
function tikTokRequestUrl(snapshot, pathname) {
    let requestUrl;
    try {
        requestUrl = new URL(snapshot.requestUrl);
    }
    catch {
        requestUrl = new URL('https://www.tiktok.com/live');
    }
    requestUrl.protocol = 'https:';
    requestUrl.hostname = 'webcast.tiktokv.com';
    requestUrl.port = '';
    requestUrl.pathname = pathname;
    requestUrl.hash = '';
    return requestUrl.toString();
}
async function tikTokControlRequest(accountId, pathname, form) {
    const normalizedId = normalizeAccountId(accountId);
    const tikTokSession = electron_1.session.fromPartition(tikTokPartition(normalizedId), { cache: true });
    if (!(await hasTikTokLogin(tikTokSession))) {
        throw new Error('TikTok session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    const snapshot = loadTikTokAuth(normalizedId);
    if (!snapshot) {
        throw new Error('ยังไม่มีข้อมูลยืนยัน Streamer Desktop กรุณาเข้าสู่ระบบ TikTok ใหม่ 1 ครั้ง');
    }
    const cookie = await tikTokCookieHeader(tikTokSession);
    const body = form.toString();
    // Use a main-process ClientRequest (net.request) instead of session.fetch.
    // fetch enforces renderer-style CORS, so this cross-origin credentialed call
    // (www.tiktok.com -> webcast.tiktokv.com) was blocked with net::ERR_FAILED
    // because the native webcast endpoint returns no CORS headers. net.request
    // is not subject to CORS while still using the session's network stack.
    const { status, responseText } = await new Promise((resolve, reject) => {
        const request = electron_1.net.request({
            method: 'POST',
            url: tikTokRequestUrl(snapshot, pathname),
            session: tikTokSession,
        });
        // net.request has no built-in timeout: a stalled TLS handshake or a silently
        // dropped webcast request emits neither 'response' nor 'error', so without this
        // guard the whole stream:start IPC hangs forever and the UI spins indefinitely.
        let settled = false;
        const finish = (fn, arg) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            fn(arg);
        };
        const timer = setTimeout(() => {
            try {
                request.abort();
            }
            catch {
                // The request may already be torn down; abort is best-effort.
            }
            finish(reject, new Error('TikTok ไม่ตอบภายใน 15 วินาที — ตรวจอินเทอร์เน็ต/VPN หรือเข้าสู่ระบบ TikTok ใหม่ 1 ครั้ง'));
        }, 15000);
        request.setHeader('Accept', 'application/json, text/plain, */*');
        request.setHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        request.setHeader('Cookie', cookie);
        request.setHeader('Origin', 'https://www.tiktok.com');
        request.setHeader('Referer', snapshot.referer || 'https://www.tiktok.com/');
        request.setHeader('User-Agent', snapshot.userAgent);
        request.setHeader('sdk_aid', '8311');
        request.setHeader('x-ss-stub', (0, node_crypto_1.createHash)('md5').update(body).digest('hex').toUpperCase());
        request.on('response', (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk.toString();
            });
            response.on('end', () => finish(resolve, { status: response.statusCode, responseText: data }));
            response.on('error', (error) => finish(reject, error));
        });
        // Chromium's raw net:: codes mean nothing to a seller. ERR_BLOCKED_BY_CLIENT in
        // particular is not a network fault at all — something on their own machine (AV,
        // firewall, or a DNS/ad blocker; several public blocklists include tiktokv.com)
        // refused the call, so the fix is on that machine, not with the internet or TikTok.
        request.on('error', (error) => {
            const raw = error instanceof Error ? error.message : String(error);
            if (/ERR_BLOCKED_BY_CLIENT/i.test(raw)) {
                finish(reject, new Error('การเชื่อมต่อ TikTok ถูกบล็อกจากโปรแกรมในเครื่องนี้ — ปิดแอนตี้ไวรัส/ตัวบล็อกโฆษณา/VPN ' +
                    'หรืออนุญาต Rerun Studio ในไฟร์วอลล์ แล้วลองใหม่'));
                return;
            }
            if (/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/i.test(raw)) {
                finish(reject, new Error(`เชื่อมต่ออินเทอร์เน็ตไม่ได้ (${raw})`));
                return;
            }
            finish(reject, error);
        });
        request.on('abort', () => finish(reject, new Error('คำขอ TikTok ถูกยกเลิก (timeout)')));
        request.write(body);
        request.end();
    });
    let payload;
    try {
        payload = JSON.parse(responseText);
    }
    catch {
        throw new Error(`TikTok ตอบกลับไม่ถูกต้อง (HTTP ${status})`);
    }
    if (status < 200 || status >= 300)
        throw new Error(`TikTok Streamer Desktop ติดต่อไม่สำเร็จ (HTTP ${status})`);
    const statusCode = apiString(payload, ['status_code']);
    if (statusCode && statusCode !== '0') {
        const statusMessage = apiString(payload, ['status_msg', 'message', 'prompts']);
        throw new Error(statusMessage || `TikTok ปฏิเสธคำขอ (status ${statusCode})`);
    }
    return payload;
}
async function createTikTokRoom(accountId, title) {
    const form = new URLSearchParams();
    form.set('studiolive', '1');
    form.set('gen_replay', 'true');
    form.set('close_room_when_close_stream', 'false');
    form.set('cover_uri', '');
    form.set('title', title.trim().slice(0, 64) || 'Rerun LIVE');
    form.set('multi_stream_scene', '1');
    form.set('is_group_live_session', 'true');
    form.set('multi_stream_source', '1');
    const payload = await tikTokControlRequest(accountId, '/webcast/room/create/', form);
    const roomId = apiString(payload, ['room_id_str', 'room_id']);
    const streamId = apiString(payload, ['stream_id_str', 'stream_id']);
    const rtmpPushUrl = apiString(payload, ['rtmp_push_url']);
    if (!roomId || !streamId || !/^rtmps?:\/\//i.test(rtmpPushUrl)) {
        throw new Error('TikTok สร้างห้องแล้วแต่ไม่ส่ง RTMP URL กลับมา บัญชีอาจยังไม่มีสิทธิ์ Streamer Desktop');
    }
    return {
        accountId: normalizeAccountId(accountId),
        roomId,
        streamId,
        rtmpPushUrl,
        keepAliveTimer: null,
        keepAliveFailures: 0,
    };
}
// The actual end-live call. ping/anchor with status=4 only tells TikTok the anchor's
// state; it does not close the room — the seller pressed stop, ffmpeg exited, and the
// broadcast sat "live" on TikTok until its own no-data timeout minutes later, looking
// exactly like the stop button doing nothing.
async function finishTikTokRoom(room) {
    const form = new URLSearchParams();
    form.set('room_id', room.roomId);
    form.set('stream_id', room.streamId);
    await tikTokControlRequest(room.accountId, '/webcast/room/finish/', form);
}
async function pingTikTokRoom(room, status) {
    const form = new URLSearchParams();
    form.set('status', String(status));
    form.set('room_id', room.roomId);
    form.set('stream_id', room.streamId);
    await tikTokControlRequest(room.accountId, '/webcast/room/ping/anchor/', form);
}
function startTikTokKeepAlive(sessionState, room) {
    room.keepAliveTimer = setInterval(() => {
        void pingTikTokRoom(room, 2)
            .then(() => {
            room.keepAliveFailures = 0;
        })
            .catch(() => {
            room.keepAliveFailures += 1;
            if (room.keepAliveFailures >= 3 && sessionState.room === room && sessionState.status.state === 'live') {
                updateStatus(sessionState, { state: 'error', message: 'TikTok ไม่ตอบรับ keepalive กรุณาหยุดไลฟ์และเข้าสู่ระบบใหม่' });
            }
        });
    }, 5000);
    room.keepAliveTimer.unref();
}
async function finishRoom(sessionState) {
    // Stop the chat engine before the room guard: Stream-Key (manual) lives have no room
    // of ours but may still have a chat connection that must not outlive the stream.
    // Pending connect retries have to be dropped too, or one would fire after the live
    // ended and quietly reopen a chat connection for a stream that no longer exists.
    cancelChatRetry(sessionState.accountId);
    stopPinRotation(sessionState.accountId);
    if ((0, chat_engine_1.isChatEngineRunning)(sessionState.accountId))
        void (0, chat_engine_1.stopChatEngine)(sessionState.accountId);
    closeChatSenderWindow(sessionState.accountId);
    const room = sessionState.room;
    if (!room)
        return;
    sessionState.room = null;
    if (room.keepAliveTimer)
        clearInterval(room.keepAliveTimer);
    room.keepAliveTimer = null;
    try {
        await pingTikTokRoom(room, 4);
    }
    catch {
        // Informational only; the finish call below is what actually closes the room.
    }
    try {
        await finishTikTokRoom(room);
    }
    catch (error) {
        // Failing to close the room is the one failure the seller must hear about — their
        // broadcast is still visibly live on TikTok. Swallowing it here is how "stop did
        // nothing" went undiagnosed.
        emitChatEvent(sessionState.accountId, {
            kind: 'system',
            id: (0, node_crypto_1.randomUUID)(),
            text: `สั่งปิดห้องไลฟ์กับ TikTok ไม่สำเร็จ (${error instanceof Error ? error.message : String(error)}) — ` +
                'ถ้าไลฟ์ยังค้างอยู่ ให้กด End LIVE ในแอป TikTok หรือหน้า LIVE Manager หนึ่งครั้ง',
            at: Date.now(),
        });
    }
}
async function tikTokConnectionStatus(accountId) {
    const normalizedId = normalizeAccountId(accountId);
    const tikTokSession = electron_1.session.fromPartition(tikTokPartition(normalizedId), { cache: true });
    const connected = await hasTikTokLogin(tikTokSession);
    return { connected, streamerReady: connected && Boolean(loadTikTokAuth(normalizedId)) };
}
async function logoutTikTokAccount(accountId) {
    const normalizedId = normalizeAccountId(accountId);
    if (peekStreamSession(normalizedId)?.room) {
        throw new Error('กรุณาหยุดไลฟ์ของบัญชีนี้ก่อนออกจากระบบ');
    }
    const tikTokSession = electron_1.session.fromPartition(tikTokPartition(normalizedId), { cache: true });
    for (const window of electron_1.BrowserWindow.getAllWindows()) {
        if (window !== mainWindow && window.webContents.session === tikTokSession && !window.isDestroyed())
            window.close();
    }
    await tikTokSession.clearStorageData();
    await tikTokSession.clearCache();
    await tikTokSession.flushStorageData();
    try {
        (0, node_fs_1.unlinkSync)(tikTokAuthPath(normalizedId));
    }
    catch {
        // The account may predate Streamer Desktop capture and have no snapshot file.
    }
    return { signedOut: !(await hasTikTokLogin(tikTokSession)) };
}
// Clip length, used to wrap the resume offset after a reconnect. Cached per path because
// it is probed on every (re)start and the file does not change mid-live.
const durationCache = new Map();
async function fileDurationSec(filePath) {
    const cached = durationCache.get(filePath);
    if (cached !== undefined)
        return cached;
    const ffmpegPath = unpackedBinary(ffmpeg_static_1.default);
    if (!ffmpegPath)
        return 0;
    const seconds = await new Promise((resolve) => {
        const probe = (0, node_child_process_1.spawn)(ffmpegPath, ['-hide_banner', '-i', filePath, '-t', '0', '-f', 'null', '-']);
        let metadata = '';
        let done = false;
        const settle = (result) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            resolve(result);
        };
        const parse = () => {
            const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(metadata);
            if (!match)
                return 0;
            return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
        };
        const timer = setTimeout(() => {
            try {
                probe.kill('SIGKILL');
            }
            catch {
                // Probe may already have exited; kill is best-effort.
            }
            settle(parse());
        }, 8000);
        probe.stderr.on('data', (chunk) => {
            metadata += String(chunk);
        });
        probe.on('error', () => settle(0));
        probe.on('close', () => settle(parse()));
    });
    durationCache.set(filePath, seconds);
    return seconds;
}
// The clip whose encode will cost the most, approximated as bytes per second — heavier
// codecs/resolutions pack more bits into each second. Used as the benchmark sample so a
// light first clip can't make the whole playlist look cheaper than it is. Falls back to
// the first clip when probing fails (missing file, zero duration).
async function pickHeaviestClip(clipPaths) {
    if (clipPaths.length <= 1)
        return clipPaths[0];
    let best = clipPaths[0];
    let bestRate = -1;
    for (const clipPath of clipPaths) {
        try {
            const bytes = (0, node_fs_1.statSync)(clipPath).size;
            const seconds = await fileDurationSec(clipPath);
            const rate = seconds > 0 ? bytes / seconds : 0;
            if (rate > bestRate) {
                bestRate = rate;
                best = clipPath;
            }
        }
        catch {
            // Unreadable clip: FFmpeg will surface the real error at stream start.
        }
    }
    return best;
}
async function fileHasAudio(filePath) {
    const ffmpegPath = unpackedBinary(ffmpeg_static_1.default);
    if (!ffmpegPath)
        return false;
    return new Promise((resolve) => {
        const probe = (0, node_child_process_1.spawn)(ffmpegPath, ['-hide_banner', '-i', filePath, '-t', '0', '-f', 'null', '-']);
        let metadata = '';
        let done = false;
        const settle = (result) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            resolve(result);
        };
        // Never let the audio probe block stream startup indefinitely.
        const timer = setTimeout(() => {
            try {
                probe.kill('SIGKILL');
            }
            catch {
                // Probe may already have exited; kill is best-effort.
            }
            settle(/Stream #.*: Audio:/i.test(metadata));
        }, 8000);
        probe.stderr.on('data', (chunk) => {
            metadata += String(chunk);
        });
        probe.on('error', () => settle(false));
        probe.on('close', () => settle(/Stream #.*: Audio:/i.test(metadata)));
    });
}
const clipInfoCache = new Map();
async function probeClip(filePath) {
    const cached = clipInfoCache.get(filePath);
    if (cached !== undefined)
        return cached;
    const ffmpegPath = unpackedBinary(ffmpeg_static_1.default);
    if (!ffmpegPath)
        return null;
    const info = await new Promise((resolve) => {
        const probe = (0, node_child_process_1.spawn)(ffmpegPath, ['-hide_banner', '-i', filePath]);
        let text = '';
        let done = false;
        const settle = (value) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            resolve(value);
        };
        const parse = () => {
            const video = /Stream #[^\n]*: Video: (\w+)[^\n]*?, (\d+)x(\d+)[^\n]*/.exec(text);
            if (!video)
                return null;
            const fps = Number(/([\d.]+) fps/.exec(text)?.[1] ?? 0);
            // Prefer the stream's own bitrate; fall back to the container's.
            const streamRate = Number(/Video:[^\n]*?, (\d+) kb\/s/.exec(text)?.[1] ?? 0);
            const containerRate = Number(/bitrate: (\d+) kb\/s/.exec(text)?.[1] ?? 0);
            return {
                videoCodec: video[1].toLowerCase(),
                width: Number(video[2]),
                height: Number(video[3]),
                fps,
                bitrateKbps: streamRate || containerRate,
                audioCodec: (/Stream #[^\n]*: Audio: (\w+)/.exec(text)?.[1] ?? '').toLowerCase(),
                sampleRate: Number(/Audio: \w+[^\n]*?, (\d+) Hz/.exec(text)?.[1] ?? 0),
            };
        };
        const timer = setTimeout(() => {
            try {
                probe.kill('SIGKILL');
            }
            catch {
                // Already gone.
            }
            settle(parse());
        }, 8000);
        probe.stderr.on('data', (chunk) => {
            text += String(chunk);
        });
        probe.on('error', () => settle(null));
        probe.on('close', () => settle(parse()));
    });
    clipInfoCache.set(filePath, info);
    return info;
}
// Every clip has to qualify, and they all have to match each other: the concat demuxer
// cannot copy across clips whose codec parameters differ.
async function passthroughVerdict(config, downscale) {
    if (config.overlays.length || config.clocks.length || config.texts.length) {
        return { ok: false, reason: 'มีภาพหรือข้อความซ้อนบนวิดีโอ' };
    }
    if (config.camera.zoom > 1.001 || config.camera.mirror)
        return { ok: false, reason: 'มีการปรับกล้อง (ซูม/กลับด้าน)' };
    if (downscale)
        return { ok: false, reason: 'ระบบย่อขนาดภาพให้เครื่องอยู่' };
    const infos = [];
    for (const clipPath of config.videoPaths) {
        const info = await probeClip(clipPath);
        if (!info)
            return { ok: false, reason: 'อ่านข้อมูลคลิปไม่ได้' };
        if (info.videoCodec !== 'h264')
            return { ok: false, reason: `คลิปไม่ใช่ H.264 (${info.videoCodec})` };
        if (info.width !== 1080 || info.height !== 1920) {
            return { ok: false, reason: `ขนาดคลิปไม่ใช่ 1080x1920 (${info.width}x${info.height})` };
        }
        // Above 30fps TikTok gets more frames than the live is configured for, and the file is
        // carrying roughly double the data it needs to.
        if (info.fps > 31)
            return { ok: false, reason: `คลิปเป็น ${Math.round(info.fps)}fps (ต้องไม่เกิน 30)` };
        if (info.audioCodec && info.audioCodec !== 'aac')
            return { ok: false, reason: `เสียงไม่ใช่ AAC (${info.audioCodec})` };
        // Sending the file untouched means sending its own bitrate, so it has to fit the
        // seller's chosen ceiling rather than the other way round.
        if (info.bitrateKbps > config.bitrateKbps * 1.15) {
            return { ok: false, reason: `คลิปบิตเรตสูงเกินที่ตั้งไว้ (${info.bitrateKbps} > ${config.bitrateKbps} kbps)` };
        }
        infos.push(info);
    }
    if (!infos.length)
        return { ok: false, reason: 'ไม่มีคลิป' };
    const first = infos[0];
    const mixed = infos.some((info) => info.width !== first.width || info.height !== first.height || info.audioCodec !== first.audioCodec);
    if (mixed)
        return { ok: false, reason: 'คลิปหลายตัวมีสเปคไม่ตรงกัน' };
    return { ok: true, reason: '', info: first };
}
// Clips played through the concat demuxer have to match. Tested with the seller's own two
// files — 1080x1920/30fps/48kHz and 1080x1920/60fps/44.1kHz — the video stops dead after
// the first clip: 2201 frames produced where 4800 were due, with the muxer reporting
// non-monotonic DTS and "DTS out of order" at the boundary. The same file listed three
// times produces all 4800. No input flag fixes it: +genpts, +igndts, avoid_negative_ts,
// -fps_mode cfr and aresample=async were all tried and all still lost the same 2599
// frames. The demuxer simply is not built for heterogeneous inputs, so the honest move is
// to catch it before the seller is live rather than let a broadcast freeze mid-way.
function describeClip(info) {
    return `${info.width}x${info.height} · ${Math.round(info.fps)}fps · เสียง ${info.audioCodec || 'ไม่มี'}`;
}
// The concat demuxer cannot play heterogeneous clips — measured with the seller's own
// files (30fps/48kHz next to 60fps/44.1kHz), video stops dead after the first clip and no
// input flag rescues it. The seller's requirement is the opposite of a restriction: any
// mix of clips must just work. So when the chosen clips differ, each nonconforming one is
// transcoded ONCE to a canonical spec (1080x1920 · 30fps · AAC 44.1kHz stereo) into a
// cache keyed by the source file's identity, and the playlist is built from the
// conformed copies. Matching clips are never touched, and a second live with the same
// clips reuses the cache instantly.
const CANONICAL_CLIP = { width: 1080, height: 1920, fps: 30, sampleRate: 44100 };
function conformedClipPath(sourcePath) {
    const stat = (0, node_fs_1.statSync)(sourcePath);
    const key = (0, node_crypto_1.createHash)('sha1').update(`${sourcePath}|${stat.size}|${Math.round(stat.mtimeMs)}`).digest('hex');
    const dir = node_path_1.default.join(electron_1.app.getPath('userData'), 'normalized-clips');
    (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    return node_path_1.default.join(dir, `${key}.mp4`);
}
function clipIsCanonical(info) {
    return (info.videoCodec === 'h264' &&
        info.width === CANONICAL_CLIP.width &&
        info.height === CANONICAL_CLIP.height &&
        Math.round(info.fps) === CANONICAL_CLIP.fps &&
        info.audioCodec === 'aac' &&
        info.sampleRate === CANONICAL_CLIP.sampleRate);
}
// One transcode process per account at most, so a stop can kill it.
const conformChildren = new Map();
function conformClip(accountId, sourcePath, outPath, hasAudioTrack) {
    const ffmpegPath = unpackedBinary(ffmpeg_static_1.default);
    if (!ffmpegPath)
        return Promise.reject(new Error('ไม่พบ FFmpeg ในชุดติดตั้ง'));
    const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', sourcePath];
    // A clip with no audio gets a silent track: entries with and without audio streams are
    // just as fatal to the demuxer as mismatched sample rates.
    if (!hasAudioTrack)
        args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
    args.push('-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black', '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '6000k', '-maxrate', '6480k', '-bufsize', '6000k', '-pix_fmt', 'yuv420p', '-g', '60', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2');
    if (!hasAudioTrack)
        args.push('-map', '0:v:0', '-map', '1:a:0', '-shortest');
    args.push(outPath);
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)(ffmpegPath, args);
        conformChildren.set(accountId, child);
        let stderrText = '';
        child.stderr?.on('data', (chunk) => {
            stderrText = (stderrText + String(chunk)).slice(-2000);
        });
        child.on('error', (error) => {
            conformChildren.delete(accountId);
            reject(error);
        });
        child.on('close', (code) => {
            conformChildren.delete(accountId);
            if (code === 0)
                resolve();
            else {
                // A half-written file must not be mistaken for a cached success next time.
                try {
                    (0, node_fs_1.unlinkSync)(outPath);
                }
                catch {
                    // Never got created.
                }
                reject(new Error(`ปรับคลิปไม่สำเร็จ (${stderrText.trim().split('\n').pop() || `exit ${code}`})`));
            }
        });
    });
}
// Returns the paths the playlist should actually use. Identity when the clips already
// match each other; conformed copies otherwise.
async function conformClipsIfNeeded(sessionState, clipPaths, startedInGeneration) {
    const infos = [];
    for (const clipPath of clipPaths)
        infos.push(await probeClip(clipPath));
    // An unreadable clip is FFmpeg's error to report at stream start, not ours to guess at.
    if (infos.some((info) => !info))
        return clipPaths;
    const known = infos;
    const first = known[0];
    const mismatched = known.some((info) => info.width !== first.width ||
        info.height !== first.height ||
        Math.round(info.fps) !== Math.round(first.fps) ||
        info.audioCodec !== first.audioCodec ||
        info.sampleRate !== first.sampleRate ||
        info.videoCodec !== first.videoCodec);
    if (!mismatched)
        return clipPaths;
    const out = [];
    for (let i = 0; i < clipPaths.length; i += 1) {
        if (sessionState.stopGeneration !== startedInGeneration) {
            throw new Error('หยุดไลฟ์แล้ว — ยกเลิกการเตรียมคลิป');
        }
        const info = known[i];
        if (clipIsCanonical(info)) {
            out.push(clipPaths[i]);
            continue;
        }
        const cached = conformedClipPath(clipPaths[i]);
        if (!(0, node_fs_1.existsSync)(cached)) {
            updateStatus(sessionState, {
                state: 'starting',
                message: `กำลังปรับคลิปให้สเปคตรงกัน (${i + 1}/${clipPaths.length}): ${node_path_1.default.basename(clipPaths[i])} — ทำครั้งเดียว ครั้งหน้าจะเริ่มได้ทันที`,
                startedAt: sessionState.status.startedAt,
            });
            await conformClip(sessionState.accountId, clipPaths[i], cached, info.audioCodec !== '');
        }
        out.push(cached);
    }
    return out;
}
// ── Multi-clip rerun playlist (anti-fingerprint rotation) ──────────────────────────
//
// A single clip looped byte-for-byte is a trivial, exact-repeating pattern for TikTok's
// duplicate/rerun detection to fingerprint. When the user selects more than one clip we
// instead build a long concat-demuxer playlist that reshuffles the clip order on every
// pass through the list, so the broadcast does not repeat one fixed sequence.
//
// The playlist is a plain text file (thousands of `file '...'` lines is a few hundred KB
// at most) generated ONCE per live and wrapped in FFmpeg's own `-stream_loop -1`, so a
// live that somehow outlasts every pre-shuffled repetition just repeats that same giant
// shuffle rather than the app needing to detect end-of-playlist and respawn — verified
// against the bundled FFmpeg that -stream_loop correctly loops a concat-demuxer input as
// a whole, and that -ss before -i seeks accurately into the concatenated virtual
// timeline (so the existing drop/reconnect resume logic keeps working unchanged).
const PLAYLIST_TARGET_HOURS = 48;
const PLAYLIST_MIN_REPEATS = 20;
const PLAYLIST_MAX_REPEATS = 3000;
function shuffledCopy(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = (0, node_crypto_1.randomInt)(i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
// The concat demuxer's own line format: single-quoted, with embedded quotes escaped by
// closing/re-opening the quote (the standard trick, not shell-specific).
function concatPlaylistLine(filePath) {
    return `file '${filePath.replace(/'/g, "'\\''")}'`;
}
// ── Continue-from-next-clip on mid-live updates ───────────────────────────────────
//
// Applying a clip change rebuilds the playlist, and a rebuilt playlist used to start from
// its first entry — the seller adds clip 4 while clip 1 plays, and the broadcast jumps
// back to clip 1's opening. What they expect is a queue: the update lands, and playback
// carries on with whatever was NEXT. So before the old stream is killed, we work out which
// entry it is currently inside (position = spawn offset + elapsed, walked through the old
// playlist's entries), take the entry after it, and hand the rebuilt playlist that clip as
// its starting point. Rotation, not truncation — the cycle order the seller arranged is
// preserved exactly, just entered at a different point.
function parseConcatPlaylist(text) {
    const entries = [];
    for (const line of text.split('\n')) {
        const match = /^file '(.*)'$/.exec(line.trim());
        if (match)
            entries.push(match[1].replace(/'\\''/g, "'"));
    }
    return entries;
}
function entryIndexAtPosition(entries, durations, position) {
    let cursor = 0;
    for (let i = 0; i < entries.length; i += 1) {
        cursor += durations.get(entries[i]) ?? 0;
        if (position < cursor)
            return i;
    }
    return entries.length - 1;
}
function nextInCycle(list, current) {
    const index = list.indexOf(current);
    if (index === -1)
        return null;
    return list[(index + 1) % list.length];
}
// Where the queue stands: the clip the NEW list should open with, and how many seconds the
// entry on screen has left. remainingSec lets the switch wait for the clip boundary — the
// seller's requirement is that the playing clip finishes; cutting it mid-way to jump to
// the "next" one reads as the update skipping their content. Best-effort by design: every
// failure path degrades to { null, null }, i.e. switch immediately from the list head,
// which is just the old behaviour, never anything worse.
async function clipToResumeFrom(sessionState, newPaths) {
    const nothing = { startWith: null, remainingSec: null };
    const retry = sessionState.retry;
    if (!retry)
        return nothing;
    const oldPaths = retry.config.videoPaths;
    try {
        // Which ORIGINAL clip is on screen right now, and how far into it are we?
        let currentOriginal = null;
        let nextOriginal = null;
        let remainingSec = null;
        if (retry.playlistFile && retry.durationSec > 0) {
            const entries = parseConcatPlaylist((0, node_fs_1.readFileSync)(retry.playlistFile, 'utf8'));
            if (!entries.length)
                return nothing;
            const durations = new Map();
            for (const entry of [...new Set(entries)])
                durations.set(entry, await fileDurationSec(entry));
            const position = ((retry.offsetSec + (Date.now() - retry.spawnedAt) / 1000) % retry.durationSec + retry.durationSec) %
                retry.durationSec;
            const index = entryIndexAtPosition(entries, durations, position);
            let entryStart = 0;
            for (let i = 0; i < index; i += 1)
                entryStart += durations.get(entries[i]) ?? 0;
            const entryLength = durations.get(entries[index]) ?? 0;
            if (entryLength > 0)
                remainingSec = Math.max(0, entryStart + entryLength - position);
            // Playlist entries may be conformed cache copies; map them back to the seller's own
            // paths, which are what the new list is expressed in.
            const toOriginal = new Map();
            for (const original of oldPaths) {
                toOriginal.set(original, original);
                try {
                    toOriginal.set(conformedClipPath(original), original);
                }
                catch {
                    // Source file gone; identity mapping above still stands.
                }
            }
            currentOriginal = toOriginal.get(entries[index]) ?? null;
            nextOriginal = toOriginal.get(entries[(index + 1) % entries.length]) ?? null;
        }
        else {
            // Old live was a single clip: it is trivially the current one, looping on its own
            // duration.
            currentOriginal = oldPaths[0] ?? null;
            if (retry.durationSec > 0) {
                const position = ((retry.offsetSec + (Date.now() - retry.spawnedAt) / 1000) % retry.durationSec + retry.durationSec) %
                    retry.durationSec;
                remainingSec = Math.max(0, retry.durationSec - position);
            }
        }
        // Prefer what the old arrangement would have played next (this honours shuffle order
        // too); fall back to "the clip after the current one in the new list".
        const startWith = nextOriginal && newPaths.includes(nextOriginal)
            ? nextOriginal
            : currentOriginal
                ? nextInCycle(newPaths, currentOriginal)
                : null;
        return { startWith, remainingSec };
    }
    catch {
        return nothing;
    }
}
function rotated(items, startIndex) {
    if (startIndex <= 0)
        return items;
    return [...items.slice(startIndex), ...items.slice(0, startIndex)];
}
async function buildPlaylist(accountId, clipPaths, shuffle, 
// When set (mid-live updates), the playlist OPENS with this clip. The cycle is rotated,
// not reordered: the arrangement the seller made is preserved, entered mid-way.
startWith) {
    const durations = await Promise.all(clipPaths.map((clipPath) => fileDurationSec(clipPath)));
    const cycleDurationSec = durations.reduce((sum, seconds) => sum + seconds, 0) || 1;
    const lines = [];
    let totalDurationSec = cycleDurationSec;
    if (shuffle) {
        // More repeats for a short clip set, fewer for a long one — either way the playlist
        // covers roughly PLAYLIST_TARGET_HOURS before it would ever need to repeat a shuffle.
        const repeats = Math.min(PLAYLIST_MAX_REPEATS, Math.max(PLAYLIST_MIN_REPEATS, Math.ceil((PLAYLIST_TARGET_HOURS * 3600) / cycleDurationSec)));
        for (let pass = 0; pass < repeats; pass += 1) {
            let order = shuffledCopy(clipPaths);
            // Only the opening pass honours startWith — later passes stay fully random.
            if (pass === 0 && startWith) {
                const index = order.indexOf(startWith);
                if (index > 0)
                    order = rotated(order, index);
            }
            for (const clipPath of order)
                lines.push(concatPlaylistLine(clipPath));
        }
        totalDurationSec = cycleDurationSec * repeats;
    }
    else {
        // Shuffle off: one pass through in the given order is enough — the caller wraps the
        // whole concat input in -stream_loop -1, which repeats this exact fixed sequence
        // forever (verified against the bundled FFmpeg), so no repeat-count trick is needed.
        const index = startWith ? clipPaths.indexOf(startWith) : -1;
        for (const clipPath of rotated(clipPaths, Math.max(0, index)))
            lines.push(concatPlaylistLine(clipPath));
    }
    const dir = node_path_1.default.join(electron_1.app.getPath('temp'), 'rerun-studio-playlists');
    (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    const filePath = node_path_1.default.join(dir, `${normalizeAccountId(accountId)}-${(0, node_crypto_1.randomUUID)()}.txt`);
    (0, node_fs_1.writeFileSync)(filePath, lines.join('\n'), 'utf8');
    return { filePath, totalDurationSec };
}
// Best-effort: the playlist is a temp file, so a failed delete is not worth surfacing.
function cleanupPlaylistFile(sessionState) {
    const filePath = sessionState.retry?.playlistFile;
    if (!filePath)
        return;
    try {
        (0, node_fs_1.unlinkSync)(filePath);
    }
    catch {
        // Already removed, or never got written.
    }
}
function sanitizeCamera(value) {
    const input = (value && typeof value === 'object' ? value : {});
    return {
        zoom: Math.min(3, Math.max(1, Number(input.zoom) || 1)),
        panX: Math.min(1, Math.max(-1, Number(input.panX) || 0)),
        panY: Math.min(1, Math.max(-1, Number(input.panY) || 0)),
        mirror: input.mirror === true,
    };
}
function validateConfig(value) {
    if (!value || typeof value !== 'object')
        throw new Error('ข้อมูลสตรีมไม่ถูกต้อง');
    const input = value;
    const videoPaths = Array.isArray(input.videoPaths)
        ? input.videoPaths.filter((item) => typeof item === 'string' && item.length > 0).slice(0, 30)
        : [];
    if (!videoPaths.length)
        throw new Error('กรุณาเลือกวิดีโออย่างน้อย 1 คลิป');
    const targetMode = input.targetMode === 'manual' ? 'manual' : 'tiktok';
    const rtmpServer = typeof input.rtmpServer === 'string' ? input.rtmpServer.trim() : '';
    const streamKey = typeof input.streamKey === 'string' ? input.streamKey.trim() : '';
    if (targetMode === 'manual') {
        if (!rtmpServer)
            throw new Error('กรุณากรอก RTMP server');
        if (!/^rtmps?:\/\//i.test(rtmpServer))
            throw new Error('RTMP server ต้องขึ้นต้นด้วย rtmp:// หรือ rtmps://');
        if (!streamKey)
            throw new Error('กรุณากรอก stream key');
    }
    const overlays = Array.isArray(input.overlays)
        ? input.overlays
            .filter((item) => {
            return Boolean(item && typeof item.path === 'string' && typeof item.x === 'number' && typeof item.y === 'number');
        })
            .map((item) => ({ ...item, effect: sanitizeEffect(item.effect) }))
        : [];
    const clocks = Array.isArray(input.clocks)
        ? input.clocks
            .filter((item) => Boolean(item && typeof item.x === 'number' && typeof item.y === 'number'))
            .map((raw, index) => ({
            id: typeof raw.id === 'string' ? raw.id : `clock-${index}`,
            x: Math.round(Math.min(1060, Math.max(-300, raw.x))),
            y: Math.round(Math.min(1900, Math.max(-100, raw.y))),
            fontSize: Math.round(Math.min(180, Math.max(24, Number(raw.fontSize) || 72))),
            opacity: Math.min(1, Math.max(0.1, Number(raw.opacity) || 1)),
            format: sanitizeClockFormat(raw.format),
            color: sanitizeColor(raw.color),
            font: sanitizeFont(raw.font),
            design: sanitizeDesign(raw.design),
            effect: sanitizeEffect(raw.effect),
        }))
            .slice(0, 6)
        : [];
    const texts = Array.isArray(input.texts)
        ? input.texts
            .filter((item) => Boolean(item && typeof item.text === 'string' && typeof item.x === 'number' && typeof item.y === 'number'))
            .map((raw, index) => ({
            id: typeof raw.id === 'string' ? raw.id : `text-${index}`,
            x: Math.round(Math.min(1060, Math.max(-1080, raw.x))),
            y: Math.round(Math.min(1900, Math.max(-100, raw.y))),
            fontSize: Math.round(Math.min(200, Math.max(18, Number(raw.fontSize) || 56))),
            opacity: Math.min(1, Math.max(0.1, Number(raw.opacity) || 1)),
            text: String(raw.text).slice(0, 200),
            color: sanitizeColor(raw.color),
            font: sanitizeFont(raw.font),
            design: sanitizeDesign(raw.design),
            mode: raw.mode === 'marquee' ? 'marquee' : 'static',
            speed: Math.min(400, Math.max(20, Number(raw.speed) || 120)),
            effect: sanitizeEffect(raw.effect),
        }))
            .slice(0, 8)
        : [];
    return {
        videoPaths,
        shuffleEnabled: input.shuffleEnabled !== false,
        camera: sanitizeCamera(input.camera),
        overlays: overlays.slice(0, 12),
        clocks,
        texts,
        targetMode,
        accountId: normalizeAccountId(input.accountId),
        liveTitle: typeof input.liveTitle === 'string' ? input.liveTitle.trim().slice(0, 64) : 'Rerun LIVE',
        rtmpServer,
        streamKey,
        loop: input.loop !== false,
        bitrateKbps: Math.min(10000, Math.max(1500, Number(input.bitrateKbps) || 6000)),
    };
}
function sanitizeEffect(value) {
    return value === 'blink' || value === 'pulse' || value === 'float' ? value : 'none';
}
function sanitizeClockFormat(value) {
    const allowed = ['time', 'time-short', 'time-12h', 'date', 'datetime', 'weekday'];
    return allowed.includes(value) ? value : 'time';
}
function sanitizeColor(value) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : '#ffffff';
}
function sanitizeFont(value) {
    const allowed = [
        'sans', 'modern', 'bold', 'poster', 'classic', 'heavy', 'mono', 'serif',
        'lcd', 'lcd-alpha', 'techno', 'pixel', 'terminal',
    ];
    return allowed.includes(value) ? value : 'sans';
}
function sanitizeDesign(value) {
    const allowed = ['solid-dark', 'solid-accent', 'outline', 'shadow', 'plain'];
    return allowed.includes(value) ? value : 'solid-dark';
}
function ffColor(hex) {
    return `0x${hex.replace('#', '')}`;
}
// Per-font candidate files, most-preferred first. macOS ships Thai-capable faces
// (Thonburi/Sukhumvit/Silom/…); Windows/Linux fall back to their closest system font.
// TODO: bundle a Thai font asset so these render identically on machines lacking them.
const FONT_CANDIDATES = {
    sans: ['/System/Library/Fonts/Thonburi.ttc', 'C:/Windows/Fonts/tahoma.ttf', '/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf'],
    modern: ['/System/Library/Fonts/Supplemental/SukhumvitSet.ttc', 'C:/Windows/Fonts/leelawui.ttf', '/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf'],
    bold: ['/System/Library/Fonts/Supplemental/Silom.ttf', 'C:/Windows/Fonts/leelawuib.ttf', '/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf'],
    poster: ['/System/Library/Fonts/Supplemental/Krungthep.ttf', 'C:/Windows/Fonts/tahomabd.ttf', '/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf'],
    classic: ['/System/Library/Fonts/Supplemental/Ayuthaya.ttf', 'C:/Windows/Fonts/angsa.ttf', '/usr/share/fonts/truetype/tlwg/Norasi.ttf'],
    heavy: ['/System/Library/Fonts/Supplemental/Sathu.ttf', 'C:/Windows/Fonts/leelawuib.ttf', '/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf'],
    mono: ['/System/Library/Fonts/Menlo.ttc', 'C:/Windows/Fonts/consola.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'],
    serif: ['/System/Library/Fonts/Supplemental/Georgia.ttf', 'C:/Windows/Fonts/georgia.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'],
};
// Prefer a font that covers both Thai and Latin so date/weekday clocks and typed
// Thai text render as real glyphs instead of tofu boxes.
function overlayFont() {
    const candidates = process.platform === 'darwin'
        ? ['/System/Library/Fonts/Thonburi.ttc', '/Library/Fonts/Arial Unicode.ttf', '/System/Library/Fonts/Helvetica.ttc']
        : process.platform === 'win32'
            ? ['C:/Windows/Fonts/tahoma.ttf', 'C:/Windows/Fonts/leelawui.ttf', 'C:/Windows/Fonts/arial.ttf']
            : ['/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'];
    return candidates.find((candidate) => (0, node_fs_1.existsSync)(candidate)) ?? candidates[candidates.length - 1];
}
// Display fonts shipped inside the app (all SIL OFL), so the LCD/techno/pixel clock
// looks render identically on every machine. Digit/Latin-only — Thai text and Thai
// dates should stay on the system fonts above.
const BUNDLED_FONT_FILES = {
    lcd: 'DSEG7Classic-Bold.ttf',
    'lcd-alpha': 'DSEG14Classic-Regular.ttf',
    techno: 'Audiowide-Regular.ttf',
    pixel: 'PressStart2P-Regular.ttf',
    terminal: 'VT323-Regular.ttf',
};
// Packaged builds copy src/assets/fonts into Resources/fonts via electron-builder
// extraResources; dev runs read them straight out of the repo.
function bundledFontPath(fileName) {
    const dir = electron_1.app.isPackaged
        ? node_path_1.default.join(process.resourcesPath, 'fonts')
        : node_path_1.default.join(electron_1.app.getAppPath(), 'src', 'assets', 'fonts');
    return node_path_1.default.join(dir, fileName);
}
// Resolve a per-layer font choice to an existing file, falling back to the shared
// Thai-capable font so a missing face never breaks the render.
function resolveFont(fontId) {
    const bundled = BUNDLED_FONT_FILES[fontId];
    if (bundled) {
        const filePath = bundledFontPath(bundled);
        if ((0, node_fs_1.existsSync)(filePath))
            return filePath;
    }
    const found = (FONT_CANDIDATES[fontId] ?? []).find((candidate) => (0, node_fs_1.existsSync)(candidate));
    return found ?? overlayFont();
}
function designParts(design, opacity) {
    const op = Math.min(1, Math.max(0.1, opacity));
    switch (design) {
        case 'solid-accent':
            return ['box=1', `boxcolor=0xff5a1f@${(op * 0.9).toFixed(2)}`, 'boxborderw=16'];
        case 'outline':
            return [`bordercolor=black@${op.toFixed(2)}`, 'borderw=6'];
        case 'shadow':
            return [`shadowcolor=black@${(op * 0.7).toFixed(2)}`, 'shadowx=5', 'shadowy=5'];
        case 'plain':
            return [];
        case 'solid-dark':
        default:
            return ['box=1', `boxcolor=black@${(op * 0.62).toFixed(2)}`, 'boxborderw=14'];
    }
}
function escapeFilterPath(filePath) {
    return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
}
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
function pad2(value) {
    return String(value).padStart(2, '0');
}
// FFmpeg can render a clock by itself via the localtime expansion, which needs no file,
// no writer timer, and no per-frame reload. Only the formats carrying Thai month or day
// names fall outside what strftime can produce in the C locale, so only those still need a
// file behind them. Colons and backslashes are escaped for the filter parser.
function localtimeClockExpr(format) {
    switch (format) {
        case 'time':
            return '%{localtime\\:%H\\\\\\:%M\\\\\\:%S}';
        case 'time-short':
            return '%{localtime\\:%H\\\\\\:%M}';
        case 'time-12h':
            return '%{localtime\\:%I\\\\\\:%M\\\\\\:%S %p}';
        default:
            // date / datetime / weekday need THAI_MONTHS or THAI_DAYS.
            return null;
    }
}
function formatClock(format, date = new Date()) {
    const h = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();
    const hhmmss = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    const hhmm = `${pad2(h)}:${pad2(m)}`;
    const dateText = `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
    switch (format) {
        case 'time-short':
            return hhmm;
        case 'time-12h': {
            const period = h < 12 ? 'AM' : 'PM';
            const hour12 = h % 12 === 0 ? 12 : h % 12;
            return `${pad2(hour12)}:${pad2(m)}:${pad2(s)} ${period}`;
        }
        case 'date':
            return dateText;
        case 'datetime':
            return `${dateText} ${hhmmss}`;
        case 'weekday':
            return `${THAI_DAYS[date.getDay()]} ${hhmm}`;
        default:
            return hhmmss;
    }
}
function stopOverlayText(sessionState) {
    sessionState.clockTimers.forEach((timer) => clearInterval(timer));
    sessionState.clockTimers = [];
    sessionState.clockTextPaths.forEach((filePath) => {
        try {
            (0, node_fs_1.unlinkSync)(filePath);
        }
        catch {
            // The temporary overlay file may already be gone during app shutdown.
        }
    });
    sessionState.clockTextPaths = [];
}
// Clocks refresh their text file on a timer (drawtext reload=1); typed/marquee text
// is written once. Both live under userData and are cleaned up on stop.
function startOverlayText(sessionState, clocks, texts) {
    stopOverlayText(sessionState);
    const dir = electron_1.app.getPath('userData');
    const clockFiles = clocks.map((clock) => {
        // Clocks FFmpeg can draw on its own need no file and no timer at all — skip both, and
        // keep the array position so buildFilter's index still lines up with `clocks`.
        if (localtimeClockExpr(clock.format))
            return '';
        const filePath = node_path_1.default.join(dir, `live-clock-${sessionState.accountId}-${(0, node_crypto_1.randomUUID)()}.txt`);
        sessionState.clockTextPaths.push(filePath);
        const write = () => {
            if (!sessionState.clockTextPaths.includes(filePath))
                return;
            try {
                (0, node_fs_1.writeFileSync)(filePath, formatClock(clock.format), 'utf8');
            }
            catch {
                // FFmpeg will keep showing the last successfully written value.
            }
        };
        write();
        // These formats carry Thai date or weekday text, which changes once a minute at the
        // fastest, so a 250ms rewrite was 240x more often than needed.
        sessionState.clockTimers.push(setInterval(write, 1000));
        return filePath;
    });
    const textFiles = texts.map((text) => {
        const filePath = node_path_1.default.join(dir, `live-text-${sessionState.accountId}-${(0, node_crypto_1.randomUUID)()}.txt`);
        sessionState.clockTextPaths.push(filePath);
        try {
            (0, node_fs_1.writeFileSync)(filePath, text.text.length ? text.text : ' ', 'utf8');
        }
        catch {
            // Fall back to an empty overlay if the file cannot be written.
        }
        return filePath;
    });
    return { clockFiles, textFiles };
}
// Builds a drawtext filter node reading its content from a text file, applying the
// selected animation via drawtext's alpha/y expressions (evaluated per frame on t).
function drawtextChain(input, output, options) {
    const op = Math.min(1, Math.max(0.1, options.opacity));
    const opFixed = op.toFixed(2);
    const fontSize = Math.round(Math.min(200, Math.max(18, options.fontSize)));
    const baseY = Math.round(options.baseY);
    let alpha = opFixed;
    let yArg = `${baseY}`;
    if (options.effect === 'blink') {
        alpha = `'if(lt(mod(t,1.4),0.7),${opFixed},0.12)'`;
    }
    else if (options.effect === 'pulse') {
        alpha = `'${(op * 0.65).toFixed(2)}+${(op * 0.35).toFixed(2)}*sin(2*PI*t/2.4)'`;
    }
    else if (options.effect === 'float') {
        yArg = `'${baseY}+14*sin(2*PI*t/3)'`;
    }
    const parts = [`fontfile='${options.font}'`];
    if (options.text !== undefined) {
        parts.push(`text='${options.text}'`);
    }
    else {
        parts.push(`textfile='${escapeFilterPath(options.textfile ?? '')}'`);
        // drawtext's `reload` is a FRAME INTERVAL, not a boolean: reload=1 re-opened and
        // re-parsed the file on every single frame, i.e. 30 file opens per second per clock,
        // for the whole broadcast. Harmless on macOS where the page cache absorbs it, but on
        // Windows every open goes through the antivirus filter driver, and a seller testing
        // with and without a clock saw exactly that difference. Ten frames (3x a second) is
        // still faster than any text here changes.
        if (options.reloadEveryFrames)
            parts.push(`reload=${options.reloadEveryFrames}`);
    }
    parts.push(`x=${options.x}`, `y=${yArg}`, `fontsize=${fontSize}`, `fontcolor=${ffColor(options.color)}`, `alpha=${alpha}`, ...designParts(options.design, op));
    return `[${input}]drawtext=${parts.join(':')}[${output}]`;
}
// Builds the [base] stage: fit-with-letterbox exactly as before, then (only when the
// camera control is actually touched) an optional mirror and a zoom+pan crop within that
// already-padded frame. Order matters: mirror happens before the crop so panX/panY keep
// the same "which side you're revealing" meaning regardless of mirror state. Skips the
// zoom/crop entirely at zoom<=1 so an unadjusted camera produces the identical filter
// string as before this feature existed.
function buildBaseFilter(camera) {
    const steps = [
        'scale=1080:1920:force_original_aspect_ratio=decrease',
        'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black',
        'setsar=1',
    ];
    if (camera.mirror)
        steps.push('hflip');
    const zoom = Math.min(3, Math.max(1, camera.zoom));
    if (zoom > 1.001) {
        const panX = Math.min(1, Math.max(-1, camera.panX));
        const panY = Math.min(1, Math.max(-1, camera.panY));
        const scaledW = Math.round(1080 * zoom);
        const scaledH = Math.round(1920 * zoom);
        const offsetX = Math.round(((scaledW - 1080) / 2) * (1 + panX));
        const offsetY = Math.round(((scaledH - 1920) / 2) * (1 + panY));
        steps.push(`scale=${scaledW}:${scaledH}`, `crop=1080:1920:${offsetX}:${offsetY}`);
    }
    return `[0:v]${steps.join(',')}[base]`;
}
function buildFilter(camera, overlays, clocks, texts, clockFiles, textFiles, 
// Applied last, after everything is composited, so overlay/clock/text coordinates stay
// in the 1080x1920 space they were authored in. Only set when the machine can't sustain
// realtime at full size (see detectEncoderPlan).
downscale = null) {
    const filters = [buildBaseFilter(camera)];
    let previous = 'base';
    overlays.forEach((overlay, index) => {
        const width = Math.round(Math.min(1080, Math.max(32, overlay.width || 240)));
        const opacity = Math.min(1, Math.max(0.05, overlay.opacity || 1)).toFixed(2);
        const x = Math.round(Math.min(1080 - 16, Math.max(-width + 16, overlay.x)));
        const baseY = Math.round(Math.min(1920 - 16, Math.max(-1920 + 16, overlay.y)));
        const yArg = overlay.effect === 'float' ? `'${baseY}+12*sin(2*PI*t/3)'` : `${baseY}`;
        filters.push(`[${index + 1}:v]format=rgba,colorchannelmixer=aa=${opacity},scale=${width}:-1[overlay${index}]`);
        const output = `composed${index}`;
        filters.push(`[${previous}][overlay${index}]overlay=x=${x}:y=${yArg}:format=auto[${output}]`);
        previous = output;
    });
    clocks.forEach((clock, index) => {
        const expr = localtimeClockExpr(clock.format);
        const file = clockFiles[index];
        if (!expr && !file)
            return;
        const output = `clock${index}`;
        filters.push(drawtextChain(previous, output, {
            font: escapeFilterPath(resolveFont(clock.font)),
            ...(expr ? { text: expr } : { textfile: file, reloadEveryFrames: CLOCK_RELOAD_FRAMES }),
            x: `${Math.round(clock.x)}`,
            baseY: clock.y,
            fontSize: clock.fontSize,
            color: clock.color,
            design: clock.design,
            opacity: clock.opacity,
            effect: clock.effect,
        }));
        previous = output;
    });
    texts.forEach((text, index) => {
        const file = textFiles[index];
        if (!file)
            return;
        const output = `text${index}`;
        const xArg = text.mode === 'marquee'
            ? `'w-mod(t*${Math.round(text.speed)},w+tw)'`
            : `${Math.round(text.x)}`;
        filters.push(drawtextChain(previous, output, {
            font: escapeFilterPath(resolveFont(text.font)),
            textfile: file,
            x: xArg,
            baseY: text.y,
            fontSize: text.fontSize,
            color: text.color,
            design: text.design,
            opacity: text.opacity,
            effect: text.effect,
        }));
        previous = output;
    });
    const finalScale = downscale ? `,scale=${downscale.width}:${downscale.height}` : '';
    filters.push(`[${previous}]format=yuv420p${finalScale}[outv]`);
    return filters.join(';');
}
async function startFfmpeg(sessionState, config, outputUrl) {
    if (sessionState.ffmpegProcess)
        throw new Error('บัญชีนี้กำลังไลฟ์อยู่แล้ว');
    // See stopGeneration on the session: everything between here and spawn() can take
    // seconds, and a stop pressed during it must win over this start.
    const startedInGeneration = sessionState.stopGeneration;
    const ffmpegPath = unpackedBinary(ffmpeg_static_1.default);
    if (!ffmpegPath)
        throw new Error('ไม่พบ FFmpeg ในชุดติดตั้ง');
    // sessionState.retry only exists once this live has spawned FFmpeg before, so its
    // presence is exactly "this call is a reconnect". A reconnect reuses the already-built
    // playlist/duration/audio decision instead of re-shuffling or re-probing every clip on
    // each of up to 12 retries — and, for a multi-clip live, resumes into the SAME order
    // rather than a new shuffle appearing mid-broadcast.
    const isReconnect = Boolean(sessionState.retry);
    let playlistFile;
    let totalDurationSec;
    let hasAudio;
    // A reconnect may only reuse the retry snapshot when it still fits this config: applying
    // a changed clip list clears playlistFile, and reusing a null playlist here would leave
    // a multi-clip live playing only its first clip forever.
    const snapshotUsable = isReconnect && (config.videoPaths.length <= 1 || sessionState.retry.playlistFile !== null);
    if (snapshotUsable && isReconnect && config.videoPaths.length > 1) {
        playlistFile = sessionState.retry.playlistFile;
        totalDurationSec = sessionState.retry.durationSec;
        hasAudio = sessionState.retry.hasAudio;
    }
    else if (snapshotUsable && isReconnect && sessionState.retry.durationSec > 0) {
        playlistFile = null;
        totalDurationSec = sessionState.retry.durationSec;
        hasAudio = sessionState.retry.hasAudio;
    }
    else if (config.videoPaths.length > 1) {
        const playPaths = await conformClipsIfNeeded(sessionState, config.videoPaths, startedInGeneration);
        // Translate the requested opening clip through the conform mapping: playPaths is
        // index-aligned with videoPaths, so the seller's path becomes whichever copy plays.
        const requested = sessionState.retry?.startWithClip;
        const requestedIndex = requested ? config.videoPaths.indexOf(requested) : -1;
        if (sessionState.retry)
            sessionState.retry.startWithClip = undefined;
        const built = await buildPlaylist(sessionState.accountId, playPaths, config.shuffleEnabled, requestedIndex >= 0 ? playPaths[requestedIndex] : undefined);
        playlistFile = built.filePath;
        totalDurationSec = built.totalDurationSec;
        hasAudio = (await Promise.all(playPaths.map((clipPath) => fileHasAudio(clipPath)))).every(Boolean);
    }
    else {
        playlistFile = null;
        totalDurationSec = await fileDurationSec(config.videoPaths[0]);
        hasAudio = await fileHasAudio(config.videoPaths[0]);
    }
    const { clockFiles, textFiles } = startOverlayText(sessionState, config.clocks, config.texts);
    const args = ['-hide_banner', '-loglevel', 'warning', '-re'];
    // Each -stream_loop pass restarts timestamps at zero. Regenerating PTS is cheap
    // insurance against the non-monotonic DTS that can make an RTMP server drop the
    // publish mid-loop; a short synthetic clip loops fine either way, so this is defensive
    // rather than a confirmed fix for any particular file. It also correctly wraps a
    // multi-clip concat playlist as a single unit (verified against the bundled FFmpeg).
    if (config.loop)
        args.push('-stream_loop', '-1', '-fflags', '+genpts');
    // Pick the rerun back up where a dropped run left off. -ss before -i seeks accurately
    // into a concat playlist's virtual timeline too (verified), so later loops/clips still
    // play whole — without this, a live that drops every few minutes never gets past the
    // opening clip.
    const resumeOffset = sessionState.retry?.offsetSec ?? 0;
    if (resumeOffset >= 1)
        args.push('-ss', resumeOffset.toFixed(2));
    if (playlistFile) {
        args.push('-f', 'concat', '-safe', '0', '-i', playlistFile);
    }
    else {
        args.push('-i', config.videoPaths[0]);
    }
    config.overlays.forEach((overlay) => args.push('-loop', '1', '-i', overlay.path));
    let silentAudioIndex = -1;
    if (!hasAudio) {
        silentAudioIndex = config.overlays.length + 1;
        args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
    }
    const maxrate = Math.round(config.bitrateKbps * 1.08);
    // bufsize was 2x the bitrate — a two-second VBV window, which lets the encoder emit a
    // burst at twice the nominal rate. On a home uplink that is already near capacity those
    // bursts queue, the RTMP write stalls, and TikTok drops the publish; the seller sees a
    // live that is fine at first and then keeps reconnecting. One second is the standard
    // live setting (what OBS uses for CBR) and keeps the output paced.
    const encoderRate = { bitrateKbps: config.bitrateKbps, maxrateKbps: maxrate, bufsizeKbps: config.bitrateKbps };
    // A fresh user-initiated start gets a clean slate; reconnects keep whatever level the
    // watchdog already had to reach, so a degraded live doesn't stutter all over again.
    if (!isReconnect)
        sessionState.degradeLevel = 0;
    // Benchmark the heaviest clip in the playlist (file size per second is a cheap proxy
    // for decode+scale cost) — the old code measured clip #1 only, so a light first clip
    // followed by a heavy 4K one passed the benchmark and then stuttered mid-live.
    const samplePath = await pickHeaviestClip(config.videoPaths);
    // Machine capability is measured once per app run; the PLAN is re-derived per live,
    // because lives running concurrently share the same CPU/GPU — a benchmark taken on an
    // idle machine says nothing about the third simultaneous stream.
    // Decided before the benchmark: a passthrough live never encodes, so measuring how fast
    // this machine encodes would only delay going live.
    const passthrough = await passthroughVerdict(config, null);
    const measurements = passthrough.ok
        ? { hardware: null, softwareSpeed: 99, hardwareSpeed: 0 }
        : await (0, encoder_1.detectEncoderMeasurements)(ffmpegPath, samplePath, encoderRate);
    // Now that a real measurement exists, let it replace the logical-core estimate that
    // maxConcurrentStreams falls back to before the first live.
    measuredStreamCapacity = (0, encoder_1.sustainableStreamCount)(measurements);
    let concurrent = 1;
    for (const other of streamSessions.values()) {
        if (other !== sessionState && other.ffmpegProcess)
            concurrent += 1;
    }
    // Charge for the filter graph THIS live will actually run. A bare stream and one with a
    // dozen image overlays cost very different amounts, and a flat factor under-served the
    // decorated case badly.
    const filterCost = (0, encoder_1.overlayCost)({
        images: config.overlays.length,
        clocks: config.clocks.length,
        texts: config.texts.length,
        zoomed: config.camera.zoom > 1.001,
    });
    const planOpts = { concurrent, degradeLevel: sessionState.degradeLevel, filterCost };
    const plan = (0, encoder_1.planFromMeasurements)(measurements, planOpts);
    const canDegradeMore = (0, encoder_1.canDegradeFurther)(measurements, planOpts);
    // A smaller frame gets a smaller bitrate. Keeping the full rate at 540x960 spent bits on
    // detail the downscale already threw away, and — the reason it matters here — sent just
    // as many bytes as before, so a live dropping because the uplink is saturated was helped
    // not at all by degrading. Now one ladder relieves both the CPU and the connection.
    const ladderBitrate = (0, encoder_1.bitrateForFrame)(config.bitrateKbps, plan.downscale);
    const ladderRate = {
        bitrateKbps: ladderBitrate,
        maxrateKbps: Math.round(ladderBitrate * 1.08),
        bufsizeKbps: ladderBitrate,
    };
    const encoder = plan.encoder;
    // Not sent to the renderer (nothing there needs it, and this is diagnostic-only) — just
    // stderr, same as the ffmpeg output below, so it shows up if we ever need to ask a
    // tester to run the packaged app from a terminal to see what got picked.
    const frameLabel = plan.downscale ? `${plan.downscale.width}x${plan.downscale.height}` : '1080x1920';
    sessionState.tech =
        (passthrough.ok
            ? 'ส่งตรงไม่เข้ารหัส'
            : `เข้ารหัสใหม่ (${passthrough.reason}) · ${encoder} · ${frameLabel} · ${ladderBitrate} kbps · วัดได้ ${plan.measuredSpeed.toFixed(2)}x`) +
            ` · ${concurrent} ไลฟ์พร้อมกัน · ${node_os_1.default.cpus()?.length || 0} core · RAM ${Math.round(node_os_1.default.totalmem() / 1024 ** 3)} GB`;
    process.stderr.write(`[encoder] account=${sessionState.accountId} selected=${encoder} preset=${plan.preset} ` +
        `frame=${frameLabel} bitrate=${ladderBitrate}k measured=${plan.measuredSpeed.toFixed(2)}x ` +
        `concurrent=${concurrent} degrade=${sessionState.degradeLevel} ` +
        `mode=${passthrough.ok ? 'passthrough' : 'reencode'}${passthrough.ok ? '' : ` (${passthrough.reason})`}\n`);
    // Quality was reduced to keep the stream real-time — say so rather than letting the
    // seller wonder why this live looks softer than the last one.
    if (plan.preset === 'fast' || plan.downscale) {
        const parts = [plan.preset === 'fast' ? 'ลดความละเอียดการบีบอัด' : '', plan.downscale ? `ย่อภาพเป็น ${frameLabel}` : '']
            .filter(Boolean)
            .join(' และ ');
        emitChatEvent(sessionState.accountId, {
            kind: 'system',
            id: (0, node_crypto_1.randomUUID)(),
            text: `เครื่องนี้เข้ารหัสได้ ${plan.measuredSpeed.toFixed(2)}x ซึ่งไม่พอสำหรับไลฟ์ — ระบบ${parts}ให้อัตโนมัติ ` +
                `เพื่อไม่ให้ภาพกระตุกหรือหลุด` +
                (ladderBitrate < config.bitrateKbps ? ` (ลดบิตเรตเป็น ${ladderBitrate} kbps ตามขนาดภาพด้วย)` : ''),
            at: Date.now(),
        });
    }
    // Tell the seller which mode they got, and what is costing them the cheap one. The
    // difference is not subtle — 15s of their own clip measured 11.45s of CPU re-encoded
    // against 0.01s passed through — so a clip exported at 60fps instead of 30 is worth
    // knowing about.
    emitChatEvent(sessionState.accountId, {
        kind: 'system',
        id: (0, node_crypto_1.randomUUID)(),
        text: passthrough.ok
            ? 'ส่งวิดีโอตรงไปยัง TikTok โดยไม่เข้ารหัสใหม่ — เครื่องแทบไม่ต้องทำงาน ภาพคมเท่าไฟล์ต้นฉบับ'
            : `กำลังเข้ารหัสวิดีโอใหม่เพราะ ${passthrough.reason} — ถ้าเอาเหตุนี้ออกได้ เครื่องจะเบาลงมาก`,
        at: Date.now(),
    });
    if (passthrough.ok) {
        // Nothing to draw and the file already matches: mux it straight through. No decode, no
        // filter graph, no encode — this is what makes a modest machine keep up.
        args.push('-map', '0:v:0');
        if (hasAudio)
            args.push('-map', '0:a:0', '-c:a', 'copy');
        else
            args.push('-map', `${silentAudioIndex}:a:0`, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2');
        args.push('-c:v', 'copy', '-flvflags', 'no_duration_filesize', '-progress', 'pipe:2', '-nostats');
    }
    else {
        args.push('-filter_complex', buildFilter(config.camera, config.overlays, config.clocks, config.texts, clockFiles, textFiles, plan.downscale), '-map', '[outv]', '-map', hasAudio ? '0:a:0' : `${silentAudioIndex}:a:0`, ...(0, encoder_1.videoEncoderArgs)(encoder, ladderRate, plan.preset), '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-flvflags', 'no_duration_filesize', '-progress', 'pipe:2', '-nostats');
    }
    if (!config.loop)
        args.push('-shortest');
    args.push('-f', 'flv', outputUrl);
    // Carrying startedAt keeps the on-air clock (and eventual history duration) counting
    // from the original start when this call is a reconnect rather than a fresh live.
    updateStatus(sessionState, {
        state: 'starting',
        message: 'กำลังเชื่อมต่อ RTMP…',
        startedAt: sessionState.status.startedAt,
    });
    // Remember how to respawn this exact stream; attempts carry over across restarts.
    if (sessionState.stopGeneration !== startedInGeneration) {
        throw new Error('หยุดไลฟ์แล้ว — ยกเลิกการเริ่มสตรีมที่ค้างอยู่');
    }
    sessionState.retry = {
        config,
        outputUrl,
        attempts: sessionState.retry?.attempts ?? 0,
        everLive: sessionState.retry?.everLive ?? false,
        offsetSec: resumeOffset,
        spawnedAt: Date.now(),
        durationSec: totalDurationSec,
        hasAudio,
        playlistFile,
        timer: null,
        settleTimer: null,
    };
    const child = (0, node_child_process_1.spawn)(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    sessionState.ffmpegProcess = child;
    let stderr = '';
    let becameLive = false;
    // If FFmpeg never emits progress it is stuck opening the input or completing the
    // RTMP publish handshake (TikTok not accepting the stream). Without this watchdog
    // the UI sits on "กำลังเชื่อมต่อ" forever because errors only surface on close.
    const connectWatchdog = setTimeout(() => {
        if (becameLive || sessionState.ffmpegProcess !== child)
            return;
        // Mid-reconnect, don't flash an error status: the close handler will schedule the
        // next attempt and keep the "กำลังต่อใหม่" message. A transient error state here
        // would fire a LINE error push and write a history row for every failed attempt.
        const willRetry = sessionState.retry?.everLive && sessionState.retry.attempts < MAX_RESTART_ATTEMPTS;
        if (!willRetry) {
            const lastLine = stderr.trim().split('\n').filter(Boolean).pop() || '';
            updateStatus(sessionState, {
                state: 'error',
                message: `FFmpeg ต่อ RTMP ไม่สำเร็จใน 25 วินาที — TikTok อาจไม่รับสตรีม${lastLine ? ` (${lastLine})` : ''}`,
            });
        }
        try {
            child.kill('SIGKILL');
        }
        catch {
            // Process may already be gone; kill is best-effort.
        }
    }, 25000);
    connectWatchdog.unref();
    let lastHealthAt = 0;
    // Consecutive below-realtime health samples (they arrive ~1/s). The benchmark is a
    // 5-second guess; the live itself is the ground truth. When the encode stays under
    // pace long enough to be a trend rather than a blip, respawn FFmpeg one degrade level
    // down — a smooth softer stream beats a stuttering sharp one, and the watchdog only
    // fires while planFromMeasurements still has a genuinely faster option to offer.
    let lowSpeedStreak = 0;
    child.stderr.on('data', (chunk) => {
        const text = String(chunk);
        // -progress emits key=value lines; report at most once a second so the renderer is
        // not flooded while FFmpeg reports several times per second.
        if (text.includes('speed=') && Date.now() - lastHealthAt > 1000) {
            const read = (key) => {
                const match = new RegExp(`${key}=\\s*([0-9.]+)`).exec(text);
                return match ? Number(match[1]) : NaN;
            };
            const speed = read('speed');
            if (Number.isFinite(speed)) {
                lastHealthAt = Date.now();
                const health = {
                    speed,
                    fps: read('fps') || 0,
                    bitrateKbps: Math.round(read('bitrate') || 0),
                    dropped: read('drop_frames') || 0,
                    duplicated: read('dup_frames') || 0,
                };
                mainWindow?.webContents.send('stream:health', { accountId: sessionState.accountId, health });
                // -re paces the input at wall clock, so a HEALTHY live reports ~0.95-1.02x no
                // matter how fast the machine is — a box measured at 13.6x in the benchmark reads
                // 0.955x here. The old 0.95 threshold sat inside that normal band, so ordinary
                // jitter could trip the watchdog and SIGKILL a perfectly good stream. A machine
                // that genuinely cannot keep up reads far lower (the failing tester was at 0.56x),
                // so the bar belongs well below the healthy band, held for longer.
                lowSpeedStreak = speed < LIVE_SPEED_FLOOR ? lowSpeedStreak + 1 : 0;
                if (lowSpeedStreak >= LIVE_SPEED_STREAK && becameLive && canDegradeMore && !sessionState.degradeRestartPending) {
                    sessionState.degradeRestartPending = true;
                    sessionState.degradeLevel += 1;
                    emitChatEvent(sessionState.accountId, {
                        kind: 'system',
                        id: (0, node_crypto_1.randomUUID)(),
                        text: `เครื่องเข้ารหัสตามไลฟ์ไม่ทัน (${speed.toFixed(2)}x ต่อเนื่อง) — กำลังลดคุณภาพภาพลงหนึ่งขั้นแล้วต่อสตรีมอัตโนมัติ เพื่อให้ไลฟ์หายกระตุก`,
                        at: Date.now(),
                    });
                    try {
                        child.kill('SIGKILL');
                    }
                    catch {
                        // Already exited; the close handler still sees degradeRestartPending.
                    }
                }
            }
        }
        // Surface FFmpeg output so launching the app from a terminal reveals the exact
        // RTMP connect/handshake error (input open, Connection refused, TLS, etc.).
        process.stderr.write(`[ffmpeg] ${text}`);
        stderr = (stderr + text).slice(-4000);
        if (!becameLive && /progress=continue|out_time_ms=[1-9]/.test(text)) {
            becameLive = true;
            clearTimeout(connectWatchdog);
            updateStatus(sessionState, {
                state: 'live',
                message: 'กำลังไลฟ์',
                startedAt: sessionState.status.startedAt ?? Date.now(),
            });
            // Once it has held up for a while, treat the stream as healthy again so a later
            // blip gets the full retry budget rather than the leftovers from an earlier one.
            const retry = sessionState.retry;
            if (retry) {
                retry.everLive = true;
                retry.settleTimer = setTimeout(() => {
                    if (sessionState.ffmpegProcess === child && sessionState.retry)
                        sessionState.retry.attempts = 0;
                }, RESTART_HEALTHY_AFTER_MS);
                retry.settleTimer.unref();
            }
        }
    });
    child.on('error', (error) => {
        clearTimeout(connectWatchdog);
        sessionState.degradeRestartPending = false;
        sessionState.ffmpegProcess = null;
        stopOverlayText(sessionState);
        cancelRestart(sessionState);
        void finishRoom(sessionState);
        updateStatus(sessionState, { state: 'error', message: `เปิด FFmpeg ไม่สำเร็จ: ${error.message}` });
    });
    child.on('close', (code) => {
        clearTimeout(connectWatchdog);
        sessionState.ffmpegProcess = null;
        stopOverlayText(sessionState);
        const retry = sessionState.retry;
        if (retry?.settleTimer) {
            clearTimeout(retry.settleTimer);
            retry.settleTimer = null;
        }
        const stoppedByUser = sessionState.status.state === 'stopping';
        if (stoppedByUser || code === 0) {
            sessionState.degradeRestartPending = false;
            cleanupPlaylistFile(sessionState);
            sessionState.retry = null;
            void finishRoom(sessionState);
            updateStatus(sessionState, { state: 'idle', message: 'หยุดไลฟ์แล้ว' });
            return;
        }
        // The watchdog killed this FFmpeg on purpose to respawn it one degrade level down.
        // Same resume mechanics as a connection retry (offset carried forward, room and chat
        // stay up), but it neither consumes a retry attempt nor reports a scary "connection
        // lost" — the network did nothing wrong.
        if (sessionState.degradeRestartPending && retry) {
            sessionState.degradeRestartPending = false;
            const delayMs = 1000;
            if (retry.durationSec > 0) {
                const playedSec = retry.offsetSec + (Date.now() - retry.spawnedAt + delayMs) / 1000;
                retry.offsetSec = playedSec % retry.durationSec;
            }
            const applied = sessionState.applyRestartPending;
            sessionState.applyRestartPending = false;
            updateStatus(sessionState, {
                state: 'starting',
                message: applied
                    ? 'กำลังใช้การตั้งค่าใหม่กับไลฟ์นี้ — อีกสักครู่ภาพจะกลับมา'
                    : 'กำลังปรับคุณภาพวิดีโอให้เหมาะกับเครื่อง แล้วต่อไลฟ์ต่ออัตโนมัติ',
                startedAt: sessionState.status.startedAt,
            });
            retry.timer = setTimeout(() => {
                // The handle is spent the moment this runs; leaving it set made a stale timer look
                // like a pending reconnect to anyone checking retry.timer later.
                retry.timer = null;
                if (sessionState.ffmpegProcess)
                    return;
                void startFfmpeg(sessionState, retry.config, retry.outputUrl).catch((error) => {
                    // A start aborted because the seller pressed stop mid-preamble is not a failure;
                    // stop already put the session in its final idle state, and painting an error
                    // over it would tell them the stop went wrong when it went exactly right.
                    if (!sessionState.retry)
                        return;
                    updateStatus(sessionState, {
                        state: 'error',
                        message: `ต่อใหม่ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`,
                    });
                });
            }, delayMs);
            retry.timer.unref();
            return;
        }
        // A bad file or rejected stream key will fail identically on every retry, so those
        // stop immediately instead of hammering TikTok for a minute.
        const fatal = /No such file or directory/i.test(stderr)
            ? 'ไม่พบไฟล์วิดีโอหรือ overlay'
            : /Connection refused/i.test(stderr)
                ? 'RTMP server ปฏิเสธการเชื่อมต่อ กรุณาตรวจ server และ stream key'
                : null;
        if (!fatal && retry?.everLive && retry.attempts < MAX_RESTART_ATTEMPTS) {
            retry.attempts += 1;
            const delayMs = Math.min(30000, 3000 * retry.attempts);
            // -re makes playback run at wall-clock speed, so elapsed time is how far into the
            // clip we got. Add the gap itself so the rerun stays roughly in sync with the clock,
            // then wrap around the clip length.
            if (retry.durationSec > 0) {
                const playedSec = retry.offsetSec + (Date.now() - retry.spawnedAt + delayMs) / 1000;
                retry.offsetSec = playedSec % retry.durationSec;
            }
            // Repeated drops on a stream the encoder is keeping up with mean the uplink cannot
            // carry this bitrate — the seller's connection is the bottleneck, not their CPU, and
            // no amount of reconnecting fixes that. Back the bitrate off so the next attempt asks
            // less of the network. Viewers watch on phones, so a lower bitrate that stays
            // connected beats a higher one that keeps buffering.
            if (retry.attempts >= NETWORK_BACKOFF_AFTER_DROPS && retry.config.bitrateKbps > MIN_BACKOFF_BITRATE_KBPS) {
                const reduced = Math.max(MIN_BACKOFF_BITRATE_KBPS, Math.round((retry.config.bitrateKbps * 0.75) / 250) * 250);
                if (reduced < retry.config.bitrateKbps) {
                    emitChatEvent(sessionState.accountId, {
                        kind: 'system',
                        id: (0, node_crypto_1.randomUUID)(),
                        text: `ไลฟ์หลุดซ้ำ ${retry.attempts} ครั้งทั้งที่เครื่องเข้ารหัสทัน — น่าจะเป็นที่ความเร็วเน็ตอัปโหลด ` +
                            `ระบบลดบิตเรตจาก ${retry.config.bitrateKbps} เป็น ${reduced} kbps อัตโนมัติเพื่อให้ไลฟ์ไม่หลุดอีก`,
                        at: Date.now(),
                    });
                    retry.config = { ...retry.config, bitrateKbps: reduced };
                }
            }
            // Say WHY it dropped. Without this the seller only ever sees "การเชื่อมต่อหลุด" and
            // has nothing to report back, which is exactly the position we were in diagnosing it.
            const reason = stderr.trim().split('\n').filter(Boolean).pop() || '';
            updateStatus(sessionState, {
                state: 'starting',
                message: `การเชื่อมต่อหลุด — กำลังต่อใหม่อัตโนมัติ (ครั้งที่ ${retry.attempts}/${MAX_RESTART_ATTEMPTS})` +
                    (reason ? ` · สาเหตุ: ${reason.slice(0, 160)}` : ''),
                startedAt: sessionState.status.startedAt,
            });
            // The TikTok room and chat connection stay up across the gap, so the live itself
            // survives; only the FFmpeg publish is rebuilt.
            retry.timer = setTimeout(() => {
                // The handle is spent the moment this runs; leaving it set made a stale timer look
                // like a pending reconnect to anyone checking retry.timer later.
                retry.timer = null;
                if (sessionState.ffmpegProcess)
                    return;
                void startFfmpeg(sessionState, retry.config, retry.outputUrl).catch((error) => {
                    // A start aborted because the seller pressed stop mid-preamble is not a failure;
                    // stop already put the session in its final idle state, and painting an error
                    // over it would tell them the stop went wrong when it went exactly right.
                    if (!sessionState.retry)
                        return;
                    updateStatus(sessionState, {
                        state: 'error',
                        message: `ต่อใหม่ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`,
                    });
                });
            }, delayMs);
            retry.timer.unref();
            return;
        }
        cleanupPlaylistFile(sessionState);
        sessionState.retry = null;
        void finishRoom(sessionState);
        const lastLine = stderr.trim().split('\n').filter(Boolean).pop() || '';
        const detail = lastLine ? ` (${lastLine})` : '';
        const message = fatal ??
            (retry?.everLive
                ? `ไลฟ์หลุดและต่อใหม่ไม่สำเร็จ ${MAX_RESTART_ATTEMPTS} ครั้ง${detail}`
                : `FFmpeg ต่อ RTMP ไม่สำเร็จ กรุณาตรวจ server และ stream key${detail}`);
        updateStatus(sessionState, { state: 'error', message });
    });
    return sessionState.status;
}
async function startStream(config) {
    const sessionState = getStreamSession(config.accountId);
    // retry?.timer covers the reconnect backoff window, where ffmpegProcess is momentarily
    // null but the live is still considered running.
    if (sessionState.ffmpegProcess || sessionState.room || sessionState.retry?.timer) {
        throw new Error('บัญชีนี้กำลังไลฟ์อยู่แล้ว');
    }
    const limit = maxConcurrentStreams();
    if (activeStreamCount() >= limit) {
        throw new Error(`เครื่องนี้รองรับไลฟ์พร้อมกันได้สูงสุด ${limit} บัญชี — กรุณาหยุดบางบัญชีก่อนเริ่มเพิ่ม`);
    }
    sessionState.liveTitle = config.liveTitle;
    if (config.targetMode === 'manual') {
        const outputUrl = `${config.rtmpServer.replace(/\/+$/, '')}/${config.streamKey.replace(/^\/+/, '')}`;
        const status = await startFfmpeg(sessionState, config, outputUrl);
        // No room of our own here — the chat engine finds the live by @username.
        void startRoomChat(config.accountId, null);
        restartPinRotation(config.accountId);
        void refreshChatProducts(config.accountId);
        return status;
    }
    updateStatus(sessionState, { state: 'starting', message: 'กำลังสร้างห้อง TikTok Streamer Desktop…' });
    const room = await createTikTokRoom(config.accountId, config.liveTitle);
    sessionState.room = room;
    startTikTokKeepAlive(sessionState, room);
    try {
        const status = await startFfmpeg(sessionState, config, room.rtmpPushUrl);
        void startRoomChat(room.accountId, room.roomId);
        restartPinRotation(room.accountId);
        void refreshChatProducts(room.accountId);
        return status;
    }
    catch (error) {
        await finishRoom(sessionState);
        throw error;
    }
}
// Drop any scheduled auto-restart. Needed before every deliberate stop, because during
// the backoff window ffmpegProcess is already null and a pending timer would otherwise
// bring the stream back up after the user asked it to end.
function cancelRestart(sessionState) {
    const retry = sessionState.retry;
    if (!retry)
        return;
    if (retry.timer)
        clearTimeout(retry.timer);
    if (retry.settleTimer)
        clearTimeout(retry.settleTimer);
    cleanupPlaylistFile(sessionState);
    sessionState.retry = null;
}
async function stopFfmpeg(accountId) {
    const sessionState = getStreamSession(accountId);
    // Kill any start still in its pre-spawn phase before anything else — cancelRestart only
    // clears timers that have not fired yet, not a startFfmpeg already past its timer.
    sessionState.stopGeneration += 1;
    if (sessionState.applySwitchTimer) {
        clearTimeout(sessionState.applySwitchTimer);
        sessionState.applySwitchTimer = null;
    }
    const conforming = conformChildren.get(sessionState.accountId);
    if (conforming) {
        try {
            conforming.kill('SIGKILL');
        }
        catch {
            // Already finished.
        }
    }
    const wasReconnecting = Boolean(sessionState.retry?.timer) || Boolean(sessionState.retry);
    cancelRestart(sessionState);
    if (!sessionState.ffmpegProcess) {
        await finishRoom(sessionState);
        if (wasReconnecting) {
            // The live was still running (mid-reconnect), so pass through 'stopping' like a
            // normal stop: that edge is what fires the LINE end notification and records the
            // live in history — jumping starting → idle would silently drop both.
            updateStatus(sessionState, {
                state: 'stopping',
                message: 'กำลังหยุดไลฟ์…',
                startedAt: sessionState.status.startedAt,
            });
        }
        return updateStatus(sessionState, {
            state: 'idle',
            message: wasReconnecting ? 'หยุดไลฟ์แล้ว' : 'ไม่มีสตรีมที่กำลังทำงาน',
        });
    }
    // startedAt rides along so the history entry written at close still knows the real
    // start time — without it, user-stopped lives were recorded with a zero duration.
    updateStatus(sessionState, {
        state: 'stopping',
        message: 'กำลังหยุดไลฟ์…',
        startedAt: sessionState.status.startedAt,
    });
    sessionState.ffmpegProcess.stdin.write('q\n');
    const processToStop = sessionState.ffmpegProcess;
    setTimeout(() => {
        if (sessionState.ffmpegProcess === processToStop)
            processToStop.kill('SIGTERM');
    }, 5000).unref();
    return sessionState.status;
}
// --- License gate ----------------------------------------------------------
//
// Set this to the deployed AdminWEB/License API URL. The app
// authenticates customer code + username + password against it, stores a rolling
// session token encrypted at rest, and re-validates on launch + hourly. A short
// offline grace window keeps working users unlocked during brief outages.
const LICENSE_API_BASE = 'http://localhost:4140';
const OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
// While developing before the license Worker is deployed, allow logging in without a
// backend. This is gated to dev builds AND the un-configured placeholder URL, so a
// packaged/production build always authenticates against the real Worker.
function licenseDevBypass() {
    return !electron_1.app.isPackaged && LICENSE_API_BASE.includes('example.workers.dev');
}
function machineIdPath() {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'machine-id');
}
function getMachineId() {
    try {
        const existing = (0, node_fs_1.readFileSync)(machineIdPath(), 'utf8').trim();
        if (existing)
            return existing;
    }
    catch {
        // First run — mint and persist a stable per-install id below.
    }
    const id = (0, node_crypto_1.createHash)('sha256').update(`${(0, node_crypto_1.randomUUID)()}:${node_os_1.default.hostname()}`).digest('hex').slice(0, 32);
    try {
        (0, node_fs_1.writeFileSync)(machineIdPath(), id, { encoding: 'utf8', mode: 0o600 });
    }
    catch {
        // Non-fatal; a transient id still lets this session authenticate.
    }
    return id;
}
function licenseStatePath() {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'license.bin');
}
function saveLicenseState(state) {
    const serialized = JSON.stringify(state);
    const buffer = electron_1.safeStorage.isEncryptionAvailable()
        ? electron_1.safeStorage.encryptString(serialized)
        : Buffer.from(serialized, 'utf8');
    (0, node_fs_1.writeFileSync)(licenseStatePath(), buffer, { mode: 0o600 });
}
function loadLicenseState() {
    try {
        const buffer = (0, node_fs_1.readFileSync)(licenseStatePath());
        const serialized = electron_1.safeStorage.isEncryptionAvailable()
            ? electron_1.safeStorage.decryptString(buffer)
            : buffer.toString('utf8');
        const parsed = JSON.parse(serialized);
        if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number')
            return null;
        return {
            token: parsed.token,
            username: typeof parsed.username === 'string' ? parsed.username : '',
            displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
            plan: typeof parsed.plan === 'string' ? parsed.plan : 'standard',
            expiresAt: parsed.expiresAt,
            validatedAt: typeof parsed.validatedAt === 'number' ? parsed.validatedAt : 0,
        };
    }
    catch {
        return null;
    }
}
function clearLicenseState() {
    try {
        (0, node_fs_1.unlinkSync)(licenseStatePath());
    }
    catch {
        // Already absent — nothing to clear.
    }
}
async function licenseApiRequest(pathname, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const response = await fetch(`${LICENSE_API_BASE}${pathname}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({})));
        return { ok: response.ok, status: response.status, data };
    }
    finally {
        clearTimeout(timer);
    }
}
async function licenseLogin(username, password, customerCode) {
    if (licenseDevBypass()) {
        const state = {
            token: 'dev-local',
            username: username || 'dev',
            displayName: username || 'Dev User',
            plan: 'dev',
            expiresAt: Date.now() + OFFLINE_GRACE_MS,
            validatedAt: Date.now(),
        };
        saveLicenseState(state);
        return { licensed: true, displayName: state.displayName, plan: state.plan, expiresAt: state.expiresAt };
    }
    try {
        const { ok, data } = await licenseApiRequest('/api/login', {
            username,
            password,
            customerCode,
            licenseKey: customerCode,
            machineId: getMachineId(),
        });
        if (!ok || data.ok !== true) {
            return { licensed: false, error: typeof data.error === 'string' ? data.error : 'เข้าสู่ระบบไม่สำเร็จ' };
        }
        const state = {
            token: String(data.token || ''),
            username,
            displayName: typeof data.displayName === 'string' ? data.displayName : username,
            plan: typeof data.plan === 'string' ? data.plan : 'standard',
            expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : 0,
            validatedAt: Date.now(),
        };
        saveLicenseState(state);
        return { licensed: true, displayName: state.displayName, plan: state.plan, expiresAt: state.expiresAt };
    }
    catch {
        return { licensed: false, error: 'เชื่อมต่อเซิร์ฟเวอร์ยืนยันสิทธิ์ไม่ได้ กรุณาตรวจอินเทอร์เน็ต' };
    }
}
async function licenseStatus() {
    const state = loadLicenseState();
    if (!state)
        return { licensed: false };
    if (licenseDevBypass()) {
        return { licensed: true, offline: true, displayName: state.displayName, plan: state.plan, expiresAt: state.expiresAt };
    }
    try {
        const { ok, status, data } = await licenseApiRequest('/api/validate', {
            token: state.token,
            machineId: getMachineId(),
        });
        if (ok && data.ok === true) {
            const next = {
                ...state,
                token: typeof data.token === 'string' ? data.token : state.token,
                displayName: typeof data.displayName === 'string' ? data.displayName : state.displayName,
                plan: typeof data.plan === 'string' ? data.plan : state.plan,
                expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : state.expiresAt,
                validatedAt: Date.now(),
            };
            saveLicenseState(next);
            return { licensed: true, displayName: next.displayName, plan: next.plan, expiresAt: next.expiresAt };
        }
        // The server explicitly rejected (revoked/expired/disabled) — force re-login.
        if (status === 401 || status === 403) {
            clearLicenseState();
            return { licensed: false, error: typeof data.error === 'string' ? data.error : 'สิทธิ์ใช้งานหมดอายุ' };
        }
        throw new Error('server-unavailable');
    }
    catch {
        // Offline / server down: keep the user working within the grace window if the
        // last successful validation is recent and the token itself hasn't expired.
        const withinGrace = Date.now() - state.validatedAt < OFFLINE_GRACE_MS;
        if (withinGrace && state.expiresAt > Date.now()) {
            return { licensed: true, offline: true, displayName: state.displayName, plan: state.plan, expiresAt: state.expiresAt };
        }
        return { licensed: false, error: 'ตรวจสอบสิทธิ์ไม่ได้ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วเข้าสู่ระบบใหม่' };
    }
}
// Keep the last good feed so a brief outage doesn't blank the ticker.
let announcementCache = [];
async function fetchAnnouncements() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(`${LICENSE_API_BASE}/api/announcements`, { signal: controller.signal });
        const data = (await response.json().catch(() => ({})));
        if (Array.isArray(data.items)) {
            announcementCache = data.items;
        }
        return announcementCache;
    }
    catch {
        return announcementCache;
    }
    finally {
        clearTimeout(timer);
    }
}
// In-memory only — cleared on quit. Never persisted, never exposed to renderer.
let adminToken = '';
function adminUnlocked() {
    return licenseDevBypass() || adminToken.length > 0;
}
// A stable, human-readable key: RERUN-XXXX-XXXX-XXXX-XXXX (Crockford-ish alphabet,
// no easily-confused chars). Uses crypto randomInt for unbiased selection.
function generateLicenseKey() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const block = () => Array.from({ length: 4 }, () => alphabet[(0, node_crypto_1.randomInt)(alphabet.length)]).join('');
    return `RERUN-${block()}-${block()}-${block()}-${block()}`;
}
function adminLocalStorePath() {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'admin-users.json');
}
function loadAdminLocal() {
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(adminLocalStorePath(), 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function saveAdminLocal(list) {
    (0, node_fs_1.writeFileSync)(adminLocalStorePath(), JSON.stringify(list, null, 2), { encoding: 'utf8', mode: 0o600 });
}
async function adminApiRequest(method, pathname, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const response = await fetch(`${LICENSE_API_BASE}${pathname}`, {
            method,
            headers: {
                Authorization: `Bearer ${adminToken}`,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({})));
        return { ok: response.ok, status: response.status, data };
    }
    finally {
        clearTimeout(timer);
    }
}
function expiresAtFromDays(days) {
    return days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : null;
}
async function adminIssueKey(input) {
    const username = input.username.trim().toLowerCase();
    if (!username)
        return { ok: false, error: 'ต้องระบุชื่อผู้ใช้' };
    if (!input.password)
        return { ok: false, error: 'ต้องตั้งรหัสผ่านให้ผู้ใช้ใหม่' };
    const licenseKey = generateLicenseKey();
    const expiresAt = expiresAtFromDays(input.expiresDays);
    const machineLimit = input.machineLimit > 0 ? Math.floor(input.machineLimit) : 1;
    const plan = input.plan.trim() || 'standard';
    const displayName = input.displayName.trim() || username;
    if (licenseDevBypass()) {
        const list = loadAdminLocal();
        if (list.some((u) => u.username === username)) {
            return { ok: false, error: 'มีผู้ใช้ชื่อนี้อยู่แล้ว' };
        }
        const record = {
            username, displayName, plan, licenseKey, expiresAt, machineLimit, disabled: false, createdAt: Date.now(),
        };
        list.unshift(record);
        saveAdminLocal(list);
        return { ok: true, user: record, dev: true };
    }
    try {
        const { ok, data } = await adminApiRequest('PUT', '/api/admin/user', {
            username,
            password: input.password,
            licenseKey,
            plan,
            displayName,
            expiresAt,
            machineLimit,
        });
        if (!ok || data.ok !== true) {
            return { ok: false, error: typeof data.error === 'string' ? data.error : 'ออกคีย์ไม่สำเร็จ (ตรวจ ADMIN TOKEN)' };
        }
        // Worker returns the record without the licenseKey echoed for GET, but PUT
        // returns the saved record which includes it; surface the key we generated.
        return { ok: true, user: { username, displayName, plan, licenseKey, expiresAt, machineLimit, disabled: false, createdAt: Date.now() } };
    }
    catch {
        return { ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์แอดมินไม่ได้' };
    }
}
async function adminLookupUser(username) {
    const name = username.trim().toLowerCase();
    if (!name)
        return { ok: false, error: 'ต้องระบุชื่อผู้ใช้' };
    if (licenseDevBypass()) {
        const found = loadAdminLocal().find((u) => u.username === name);
        return found ? { ok: true, user: found, dev: true } : { ok: false, error: 'ไม่พบผู้ใช้' };
    }
    try {
        const { ok, data } = await adminApiRequest('GET', `/api/admin/user?username=${encodeURIComponent(name)}`);
        if (!ok || data.ok !== true || !data.user) {
            return { ok: false, error: typeof data.error === 'string' ? data.error : 'ไม่พบผู้ใช้' };
        }
        const u = data.user;
        return {
            ok: true,
            user: {
                username: String(u.username || name),
                displayName: String(u.displayName || name),
                plan: String(u.plan || 'standard'),
                licenseKey: String(u.licenseKey || ''),
                expiresAt: typeof u.expiresAt === 'number' ? u.expiresAt : null,
                machineLimit: typeof u.machineLimit === 'number' ? u.machineLimit : 1,
                disabled: Boolean(u.disabled),
            },
        };
    }
    catch {
        return { ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์แอดมินไม่ได้' };
    }
}
async function adminRevokeUser(username) {
    const name = username.trim().toLowerCase();
    if (!name)
        return { ok: false, error: 'ต้องระบุชื่อผู้ใช้' };
    if (licenseDevBypass()) {
        const list = loadAdminLocal().filter((u) => u.username !== name);
        saveAdminLocal(list);
        return { ok: true, users: list, dev: true };
    }
    try {
        const { ok, data } = await adminApiRequest('DELETE', `/api/admin/user?username=${encodeURIComponent(name)}`);
        if (!ok || data.ok !== true) {
            return { ok: false, error: typeof data.error === 'string' ? data.error : 'ถอนสิทธิ์ไม่สำเร็จ' };
        }
        return { ok: true };
    }
    catch {
        return { ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์แอดมินไม่ได้' };
    }
}
async function adminListKeys() {
    if (licenseDevBypass())
        return { ok: true, users: loadAdminLocal(), dev: true };
    try {
        const { ok, data } = await adminApiRequest('GET', '/api/admin/users');
        if (!ok || data.ok !== true || !Array.isArray(data.users)) {
            return { ok: false, error: typeof data.error === 'string' ? data.error : 'ดึงรายการคีย์ไม่สำเร็จ' };
        }
        const users = data.users.map((u) => ({
            username: String(u.username || ''),
            displayName: String(u.displayName || ''),
            plan: String(u.plan || 'standard'),
            licenseKey: String(u.licenseKey || ''),
            expiresAt: typeof u.expiresAt === 'number' ? u.expiresAt : null,
            machineLimit: typeof u.machineLimit === 'number' ? u.machineLimit : 1,
            disabled: Boolean(u.disabled),
        }));
        return { ok: true, users };
    }
    catch {
        return { ok: false, error: 'เชื่อมต่อเซิร์ฟเวอร์แอดมินไม่ได้' };
    }
}
function registerIpc() {
    electron_1.ipcMain.handle('media:choose-video', async (event) => {
        assertTrustedSender(event);
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: 'เลือกวิดีโอสำหรับไลฟ์',
            properties: ['openFile'],
            filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm', 'm4v'] }],
        });
        if (result.canceled || !result.filePaths[0])
            return null;
        const filePath = result.filePaths[0];
        // Remember every chosen clip so it shows up in คลังวิดีโอ for quick re-use.
        addLibraryEntry(filePath);
        return { path: filePath, name: node_path_1.default.basename(filePath), mediaUrl: mediaUrl(filePath) };
    });
    // Two-step import: choose+parse returns a preview the user confirms, so a mis-detected
    // money column is caught before any revenue number is stored.
    electron_1.ipcMain.handle('sales:choose-file', async (event) => {
        assertTrustedSender(event);
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: 'เลือกไฟล์ออร์เดอร์จาก TikTok Shop',
            properties: ['openFile'],
            filters: [{ name: 'Order export', extensions: ['csv', 'tsv', 'txt'] }],
        });
        if (result.canceled || !result.filePaths[0])
            return null;
        const filePath = result.filePaths[0];
        const rows = parseDelimited((0, node_fs_1.readFileSync)(filePath, 'utf8'));
        if (rows.length < 2)
            throw new Error('ไฟล์นี้ไม่มีข้อมูลออร์เดอร์');
        const headers = rows[0].map((header) => header.trim());
        pendingSalesImport = { token: (0, node_crypto_1.randomUUID)(), fileName: node_path_1.default.basename(filePath), headers, rows: rows.slice(1) };
        return buildSalesPreview({
            orderId: detectColumn(headers, 'orderId'),
            amount: detectColumn(headers, 'amount'),
            time: detectColumn(headers, 'time'),
            status: detectColumn(headers, 'status'),
        });
    });
    // Re-preview with a mapping the user corrected by hand.
    electron_1.ipcMain.handle('sales:preview', async (event, mapping) => {
        assertTrustedSender(event);
        const value = (mapping && typeof mapping === 'object' ? mapping : {});
        const toIndex = (input) => (typeof input === 'number' && Number.isInteger(input) ? input : -1);
        return buildSalesPreview({
            orderId: toIndex(value.orderId),
            amount: toIndex(value.amount),
            time: toIndex(value.time),
            status: toIndex(value.status),
        });
    });
    electron_1.ipcMain.handle('sales:commit', async (event, payload) => {
        assertTrustedSender(event);
        const value = (payload && typeof payload === 'object' ? payload : {});
        const pending = pendingSalesImport;
        if (!pending || value.token !== pending.token)
            throw new Error('ไฟล์ที่นำเข้าหมดอายุแล้ว กรุณาเลือกไฟล์ใหม่');
        const accountId = normalizeAccountId(typeof value.accountId === 'string' ? value.accountId : '');
        const mappingInput = (value.mapping && typeof value.mapping === 'object' ? value.mapping : {});
        const toIndex = (input) => (typeof input === 'number' && Number.isInteger(input) ? input : -1);
        const mapping = {
            orderId: toIndex(mappingInput.orderId),
            amount: toIndex(mappingInput.amount),
            time: toIndex(mappingInput.time),
            status: toIndex(mappingInput.status),
        };
        if (mapping.amount < 0)
            throw new Error('ต้องเลือกคอลัมน์ยอดเงินก่อนบันทึก');
        const store = getSales();
        // Re-importing an overlapping export must not double-count, so orders already
        // stored for this account win over the incoming row.
        const seen = new Set(store.records.filter((record) => record.accountId === accountId && record.orderId).map((record) => record.orderId));
        const batchId = (0, node_crypto_1.randomUUID)();
        const importedAt = Date.now();
        const fresh = [];
        let duplicates = 0;
        let excluded = 0;
        for (const row of pending.rows) {
            const amount = parseAmount(row[mapping.amount] ?? '');
            if (amount === null)
                continue;
            // Same exclusion the preview showed, so the stored total matches what was confirmed.
            if (mapping.status >= 0 && isExcludedStatus(row[mapping.status] ?? '')) {
                excluded += 1;
                continue;
            }
            const orderId = mapping.orderId >= 0 ? (row[mapping.orderId] ?? '').trim() : '';
            if (orderId && seen.has(orderId)) {
                duplicates += 1;
                continue;
            }
            if (orderId)
                seen.add(orderId);
            fresh.push({
                id: (0, node_crypto_1.randomUUID)(),
                accountId,
                orderId,
                amount,
                at: (mapping.time >= 0 ? parseTimestamp(row[mapping.time] ?? '') : null) ?? importedAt,
                status: mapping.status >= 0 ? (row[mapping.status] ?? '').trim() : '',
                batchId,
            });
        }
        const total = fresh.reduce((sum, record) => sum + record.amount, 0);
        const batch = {
            id: batchId,
            accountId,
            fileName: pending.fileName,
            importedAt,
            orderCount: fresh.length,
            total,
        };
        writeSales({ records: [...store.records, ...fresh], batches: [...store.batches, batch] });
        pendingSalesImport = null;
        return { imported: fresh.length, duplicates, excluded, total, accountId };
    });
    electron_1.ipcMain.handle('sales:list', async (event) => {
        assertTrustedSender(event);
        return getSales();
    });
    electron_1.ipcMain.handle('sales:remove-batch', async (event, batchId) => {
        assertTrustedSender(event);
        const id = typeof batchId === 'string' ? batchId : '';
        const store = getSales();
        writeSales({
            records: store.records.filter((record) => record.batchId !== id),
            batches: store.batches.filter((batch) => batch.id !== id),
        });
        return getSales();
    });
    electron_1.ipcMain.handle('media:choose-overlay', async (event) => {
        assertTrustedSender(event);
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: 'เลือกภาพ Overlay',
            properties: ['openFile'],
            filters: [{ name: 'Image', extensions: ['png', 'webp', 'jpg', 'jpeg'] }],
        });
        if (result.canceled || !result.filePaths[0])
            return null;
        const filePath = result.filePaths[0];
        return { path: filePath, name: node_path_1.default.basename(filePath), mediaUrl: mediaUrl(filePath) };
    });
    electron_1.ipcMain.handle('license:login', async (event, payload) => {
        assertTrustedSender(event);
        const value = (payload && typeof payload === 'object' ? payload : {});
        const username = typeof value.username === 'string' ? value.username.trim() : '';
        const password = typeof value.password === 'string' ? value.password : '';
        const customerCode = typeof value.customerCode === 'string'
            ? value.customerCode.trim()
            : typeof value.licenseKey === 'string' ? value.licenseKey.trim() : '';
        if (!customerCode || !username || !password) {
            return { licensed: false, error: 'กรุณากรอกรหัสลูกค้า Username และ Password ให้ครบ' };
        }
        return licenseLogin(username, password, customerCode);
    });
    electron_1.ipcMain.handle('license:status', async (event) => {
        assertTrustedSender(event);
        return licenseStatus();
    });
    electron_1.ipcMain.handle('license:logout', async (event) => {
        assertTrustedSender(event);
        clearLicenseState();
        return { licensed: false };
    });
    electron_1.ipcMain.handle('update:get-status', async (event) => {
        assertTrustedSender(event);
        return latestUpdateStatus;
    });
    electron_1.ipcMain.handle('update:install', async (event) => {
        assertTrustedSender(event);
        if (!electron_1.app.isPackaged)
            return;
        electron_updater_1.autoUpdater.quitAndInstall();
    });
    electron_1.ipcMain.handle('update:check', async (event) => {
        assertTrustedSender(event);
        if (!electron_1.app.isPackaged) {
            // Dev build has no publish feed; report so the UI can explain instead of hanging.
            broadcastUpdateStatus({ state: 'error', message: 'ตรวจอัปเดตได้เฉพาะเวอร์ชันที่ติดตั้งแล้ว (เวอร์ชัน dev ข้ามการตรวจ)' });
            return latestUpdateStatus;
        }
        try {
            // Manual check should download even if auto-download is off, so the user can apply it.
            electron_updater_1.autoUpdater.autoDownload = true;
            await electron_updater_1.autoUpdater.checkForUpdates();
        }
        catch (error) {
            broadcastUpdateStatus({ state: 'error', message: error instanceof Error ? error.message : 'ตรวจอัปเดตไม่สำเร็จ' });
        }
        finally {
            electron_updater_1.autoUpdater.autoDownload = autoUpdatePref;
        }
        return latestUpdateStatus;
    });
    electron_1.ipcMain.handle('update:get-config', async (event) => {
        assertTrustedSender(event);
        return { autoUpdate: autoUpdatePref };
    });
    electron_1.ipcMain.handle('update:set-config', async (event, payload) => {
        assertTrustedSender(event);
        const value = (payload && typeof payload === 'object' ? payload : {});
        if (typeof value.autoUpdate === 'boolean') {
            autoUpdatePref = value.autoUpdate;
            saveUpdateConfig();
            if (electron_1.app.isPackaged)
                electron_updater_1.autoUpdater.autoDownload = autoUpdatePref;
        }
        return { autoUpdate: autoUpdatePref };
    });
    // Opens a link in the user's real browser. Allow-listed on purpose: the renderer must
    // not be able to hand the OS an arbitrary URL (file://, custom protocol handlers), so
    // only https links to hosts we actually link to are passed through.
    electron_1.ipcMain.handle('shell:open-external', async (event, rawUrl) => {
        assertTrustedSender(event);
        const value = typeof rawUrl === 'string' ? rawUrl : '';
        let parsed;
        try {
            parsed = new URL(value);
        }
        catch {
            return { opened: false };
        }
        const allowedHosts = ['youtube.com', 'youtu.be', 'www.youtube.com'];
        const allowed = parsed.protocol === 'https:' &&
            allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
        if (!allowed)
            return { opened: false };
        await electron_1.shell.openExternal(parsed.toString());
        return { opened: true };
    });
    electron_1.ipcMain.handle('announcements:get', async (event) => {
        assertTrustedSender(event);
        return fetchAnnouncements();
    });
    electron_1.ipcMain.handle('admin:unlock', async (event, payload) => {
        assertTrustedSender(event);
        const value = (payload && typeof payload === 'object' ? payload : {});
        const token = typeof value.token === 'string' ? value.token.trim() : '';
        if (licenseDevBypass())
            return { ok: true, dev: true, unlocked: true };
        if (!token)
            return { ok: false, error: 'กรุณากรอก ADMIN TOKEN' };
        adminToken = token;
        return { ok: true, dev: false, unlocked: true };
    });
    electron_1.ipcMain.handle('admin:status', async (event) => {
        assertTrustedSender(event);
        return { unlocked: adminUnlocked(), dev: licenseDevBypass() };
    });
    electron_1.ipcMain.handle('admin:lock', async (event) => {
        assertTrustedSender(event);
        adminToken = '';
        return { ok: true };
    });
    electron_1.ipcMain.handle('admin:issue-key', async (event, payload) => {
        assertTrustedSender(event);
        if (!adminUnlocked())
            return { ok: false, error: 'ยังไม่ได้ปลดล็อกโหมดแอดมิน' };
        const value = (payload && typeof payload === 'object' ? payload : {});
        return adminIssueKey({
            username: typeof value.username === 'string' ? value.username : '',
            displayName: typeof value.displayName === 'string' ? value.displayName : '',
            password: typeof value.password === 'string' ? value.password : '',
            plan: typeof value.plan === 'string' ? value.plan : '',
            expiresDays: typeof value.expiresDays === 'number' ? value.expiresDays : 0,
            machineLimit: typeof value.machineLimit === 'number' ? value.machineLimit : 1,
        });
    });
    electron_1.ipcMain.handle('admin:lookup', async (event, username) => {
        assertTrustedSender(event);
        if (!adminUnlocked())
            return { ok: false, error: 'ยังไม่ได้ปลดล็อกโหมดแอดมิน' };
        return adminLookupUser(typeof username === 'string' ? username : '');
    });
    electron_1.ipcMain.handle('admin:revoke', async (event, username) => {
        assertTrustedSender(event);
        if (!adminUnlocked())
            return { ok: false, error: 'ยังไม่ได้ปลดล็อกโหมดแอดมิน' };
        return adminRevokeUser(typeof username === 'string' ? username : '');
    });
    electron_1.ipcMain.handle('admin:list', async (event) => {
        assertTrustedSender(event);
        if (!adminUnlocked())
            return { ok: false, error: 'ยังไม่ได้ปลดล็อกโหมดแอดมิน' };
        return adminListKeys();
    });
    electron_1.ipcMain.handle('tiktok:login', async (event, accountId) => {
        assertTrustedSender(event);
        const normalizedId = normalizeAccountId(accountId);
        const tikTokSession = electron_1.session.fromPartition(tikTokPartition(normalizedId), { cache: true });
        const loginWindow = createTikTokWindow(normalizedId, 'login', false);
        const saved = await waitForTikTokLogin(loginWindow, tikTokSession, normalizedId);
        return { saved, streamerReady: saved };
    });
    electron_1.ipcMain.handle('tiktok:status', async (event, accountId) => {
        assertTrustedSender(event);
        return tikTokConnectionStatus(normalizeAccountId(accountId));
    });
    electron_1.ipcMain.handle('tiktok:logout', async (event, accountId) => {
        assertTrustedSender(event);
        return logoutTikTokAccount(normalizeAccountId(accountId));
    });
    electron_1.ipcMain.handle('tiktok:open', async (event, accountId) => {
        assertTrustedSender(event);
        createTikTokWindow(normalizeAccountId(accountId), 'home');
    });
    electron_1.ipcMain.handle('tiktok:open-shop', async (event, accountId) => {
        assertTrustedSender(event);
        createTikTokWindow(normalizeAccountId(accountId), 'shop');
    });
    electron_1.ipcMain.handle('stream:start', async (event, value) => {
        assertTrustedSender(event);
        return startStream(validateConfig(value));
    });
    electron_1.ipcMain.handle('stream:stop', async (event, accountId) => {
        assertTrustedSender(event);
        return await stopFfmpeg(normalizeAccountId(accountId));
    });
    electron_1.ipcMain.handle('stream:status', (event, accountId) => {
        assertTrustedSender(event);
        return peekStreamSession(normalizeAccountId(accountId))?.status ?? idleStatus();
    });
    // ปุ่มย่อ/ขยาย/ปิด บนแถบบนที่ renderer วาดเอง
    electron_1.ipcMain.handle('window:minimize', (event) => {
        assertTrustedSender(event);
        mainWindow?.minimize();
    });
    electron_1.ipcMain.handle('window:toggle-maximize', (event) => {
        assertTrustedSender(event);
        if (!mainWindow)
            return { maximized: false };
        if (mainWindow.isMaximized())
            mainWindow.unmaximize();
        else
            mainWindow.maximize();
        return { maximized: mainWindow.isMaximized() };
    });
    electron_1.ipcMain.handle('window:close', (event) => {
        assertTrustedSender(event);
        mainWindow?.close();
    });
    electron_1.ipcMain.handle('window:is-maximized', (event) => {
        assertTrustedSender(event);
        return { maximized: Boolean(mainWindow?.isMaximized()) };
    });
    electron_1.ipcMain.handle('app:info', (event) => {
        assertTrustedSender(event);
        return {
            version: electron_1.app.getVersion(),
            ffmpegReady: Boolean(unpackedBinary(ffmpeg_static_1.default)),
            maxConcurrentStreams: maxConcurrentStreams(),
        };
    });
    // Run the same benchmark a live would run, so the seller can find out what their machine
    // is capable of BEFORE a customer is watching — rather than discovering it as a stuttering
    // broadcast. Reuses the live path's own measurement (cached per app run), so a later
    // "go live" costs nothing extra.
    electron_1.ipcMain.handle('system:benchmark', async (event, videoPath) => {
        assertTrustedSender(event);
        const ffmpegPath = unpackedBinary(ffmpeg_static_1.default);
        if (!ffmpegPath)
            throw new Error('ไม่พบ FFmpeg ในชุดติดตั้ง');
        // Prefer the seller's own clip — decode cost varies enormously between a phone
        // recording and a 4K export, and measuring the wrong one gives a number they cannot
        // act on. Fall back to any clip in their library so the button still works before a
        // clip is chosen.
        const sample = typeof videoPath === 'string' && videoPath && (0, node_fs_1.existsSync)(videoPath)
            ? videoPath
            : getLibrary().find((item) => (0, node_fs_1.existsSync)(item.path))?.path;
        if (!sample)
            throw new Error('ยังไม่มีคลิปให้ทดสอบ — เลือกคลิปในขั้นตอน "วิดีโอ" ก่อน');
        const rate = { bitrateKbps: 6000, maxrateKbps: 6480, bufsizeKbps: 12000 };
        const measurements = await (0, encoder_1.detectEncoderMeasurements)(ffmpegPath, sample, rate);
        measuredStreamCapacity = (0, encoder_1.sustainableStreamCount)(measurements);
        const single = (0, encoder_1.planFromMeasurements)(measurements, { concurrent: 1, degradeLevel: 0 });
        const dual = (0, encoder_1.planFromMeasurements)(measurements, { concurrent: 2, degradeLevel: 0 });
        const describe = (plan) => plan.downscale ? `${plan.downscale.width}x${plan.downscale.height}` : '1080x1920';
        return {
            hardwareEncoder: measurements.hardware,
            softwareSpeed: measurements.softwareSpeed,
            hardwareSpeed: measurements.hardwareSpeed,
            maxStreams: maxConcurrentStreams(),
            singleQuality: describe(single),
            dualQuality: describe(dual),
            totalMemoryGb: Math.round(node_os_1.default.totalmem() / 1024 ** 3),
            cores: node_os_1.default.cpus()?.length || 0,
        };
    });
    // Read-only. Opens (or reuses) the hidden LIVE Manager window and reports what the page
    // actually contains, so pin/coupon/GMV work can be written against verified structure
    // instead of a screenshot. Clicks nothing.
    electron_1.ipcMain.handle('tiktok:scan-live-console', async (event, accountId) => {
        assertTrustedSender(event);
        const id = normalizeAccountId(accountId);
        await warmChatSenderWindow(id);
        const window = chatSenderWindow(id);
        if (window.webContents.isLoading()) {
            await new Promise((resolve) => window.webContents.once('did-stop-loading', () => resolve()));
        }
        return (await window.webContents.executeJavaScript(liveConsoleScanScript(), true));
    });
    electron_1.ipcMain.handle('pin:get-config', (event, accountId) => {
        assertTrustedSender(event);
        return getPinConfig(normalizeAccountId(accountId));
    });
    electron_1.ipcMain.handle('pin:set-config', (event, accountId, config) => {
        assertTrustedSender(event);
        return savePinConfig(normalizeAccountId(accountId), config);
    });
    // Read-only: pulls the current product list out of the LIVE console so the seller can
    // pick and order them without retyping names.
    electron_1.ipcMain.handle('pin:list-products', async (event, accountId) => {
        assertTrustedSender(event);
        const id = normalizeAccountId(accountId);
        const result = (await runInLiveConsole(id, liveProductsScript()));
        // The seller just told us what is in the cart; the chat model should know too.
        const lines = (result?.products ?? [])
            .map((product) => (product.text ?? '').replace(/\s*Pin$/i, '').trim())
            .filter(Boolean);
        if (lines.length)
            (0, chat_engine_1.setChatProducts)(id, lines);
        return result;
    });
    // Pin one product now. Exposed on its own so the seller can prove a pin works before
    // handing the rotation the keys.
    electron_1.ipcMain.handle('pin:pin-now', async (event, accountId, name) => {
        assertTrustedSender(event);
        if (typeof name !== 'string' || !name.trim())
            throw new Error('ไม่ได้ระบุชื่อสินค้า');
        return (await runInLiveConsole(normalizeAccountId(accountId), pinProductScript(name.trim())));
    });
    // Coupon: read what is offered, or pin it. Same click discipline as products.
    electron_1.ipcMain.handle('pin:coupon', async (event, accountId, action) => {
        assertTrustedSender(event);
        const mode = action === 'pin' ? 'pin' : 'read';
        return (await runInLiveConsole(normalizeAccountId(accountId), couponScript(mode)));
    });
    // Live analytics straight off the console — read-only.
    electron_1.ipcMain.handle('pin:live-stats', async (event, accountId) => {
        assertTrustedSender(event);
        return (await runInLiveConsole(normalizeAccountId(accountId), liveStatsScript()));
    });
    // Clip specs for the picker, so a mismatch is visible when clips are chosen rather than
    // when the live refuses to start.
    electron_1.ipcMain.handle('media:probe-clips', async (event, paths) => {
        assertTrustedSender(event);
        if (!Array.isArray(paths))
            return [];
        const out = [];
        for (const value of paths.slice(0, 30)) {
            if (typeof value !== 'string')
                continue;
            const info = await probeClip(value);
            if (!info)
                continue;
            out.push({ path: value, label: describeClip(info), width: info.width, height: info.height, fps: Math.round(info.fps) });
        }
        return out;
    });
    // Rebuild a running live with new settings. Overlays, clips and camera are baked into
    // the FFmpeg command at spawn, so there is no way to change them in place — but the
    // reconnect path already respawns cleanly, carrying the playback offset and leaving the
    // TikTok room and chat untouched. This reuses it, which costs a second or two of video
    // rather than ending the broadcast.
    electron_1.ipcMain.handle('stream:apply-config', async (event, value) => {
        assertTrustedSender(event);
        const config = validateConfig(value);
        const sessionState = getStreamSession(config.accountId);
        if (!sessionState.retry || !sessionState.ffmpegProcess) {
            throw new Error('ยังไม่ได้ไลฟ์อยู่ — กดเริ่มไลฟ์ได้เลย');
        }
        // A changed clip list needs a fresh playlist; dropping it makes startFfmpeg rebuild.
        const clipsChanged = JSON.stringify(sessionState.retry.config.videoPaths) !== JSON.stringify(config.videoPaths) ||
            sessionState.retry.config.shuffleEnabled !== config.shuffleEnabled;
        const switchNow = () => {
            const retry = sessionState.retry;
            if (!retry || !sessionState.ffmpegProcess)
                return;
            sessionState.applyRestartPending = true;
            sessionState.degradeRestartPending = true;
            try {
                sessionState.ffmpegProcess.kill('SIGKILL');
            }
            catch {
                // Already exiting; the close handler still sees the pending flag.
            }
        };
        // A second apply while one is waiting replaces it — the newest list wins.
        if (sessionState.applySwitchTimer) {
            clearTimeout(sessionState.applySwitchTimer);
            sessionState.applySwitchTimer = null;
        }
        if (!clipsChanged) {
            // Overlays/camera: apply straight away, as before.
            sessionState.retry.config = config;
            emitChatEvent(config.accountId, {
                kind: 'system',
                id: (0, node_crypto_1.randomUUID)(),
                text: 'กำลังอัปเดตการตั้งค่าให้ไลฟ์นี้ — ภาพจะสะดุดสั้นๆ แล้วต่อเอง',
                at: Date.now(),
            });
            switchNow();
            return { applied: true, clipsChanged };
        }
        // Conform any new clip FIRST, while the old stream keeps playing — a fresh clip that
        // needs the one-time spec transcode can take a minute, and doing it after the kill
        // would leave the broadcast black for that whole minute.
        if (config.videoPaths.length > 1) {
            await conformClipsIfNeeded(sessionState, config.videoPaths, sessionState.stopGeneration);
        }
        // Only after conforming (it can take a while) work out where the queue stands, so the
        // remaining time is measured from now, not from before the transcode.
        const { startWith, remainingSec } = await clipToResumeFrom(sessionState, config.videoPaths);
        const oldPlaylist = sessionState.retry.playlistFile;
        if (startWith)
            sessionState.retry.startWithClip = startWith;
        sessionState.retry.playlistFile = null;
        sessionState.retry.offsetSec = 0;
        // Zero also disables the close-handler's offset recompute (gated on durationSec > 0),
        // which would otherwise resume a brand-new clip list from the old list's elapsed time.
        sessionState.retry.durationSec = 0;
        sessionState.retry.config = config;
        // The seller's requirement: the clip on screen finishes before the new list takes
        // over. So the switch is scheduled for the clip boundary rather than fired now —
        // which also puts the respawn blink at the join, where a cut is least visible. A
        // moment of lead keeps the old stream from starting the next clip first and playing
        // its opening twice. Unknown remaining time falls back to switching immediately.
        const waitSec = remainingSec !== null ? Math.max(0, remainingSec - 1.5) : 0;
        const generationAtApply = sessionState.stopGeneration;
        const processAtApply = sessionState.ffmpegProcess;
        const fire = () => {
            sessionState.applySwitchTimer = null;
            // A stop pressed while we waited wins; so does a live that already died on its own.
            if (sessionState.stopGeneration !== generationAtApply)
                return;
            // If the process changed underneath us (a natural drop reconnected mid-wait), the
            // respawn already picked up the new list — killing the fresh stream again would just
            // add a second blink for nothing.
            if (sessionState.ffmpegProcess !== processAtApply)
                return;
            if (oldPlaylist) {
                try {
                    (0, node_fs_1.unlinkSync)(oldPlaylist);
                }
                catch {
                    // Already gone.
                }
            }
            switchNow();
        };
        emitChatEvent(config.accountId, {
            kind: 'system',
            id: (0, node_crypto_1.randomUUID)(),
            text: waitSec > 3
                ? `อัปเดตรายการคลิปแล้ว — จะสลับเข้ารายการใหม่เมื่อคลิปปัจจุบันจบ (อีกประมาณ ${Math.round(waitSec)} วินาที)`
                : 'อัปเดตรายการคลิปแล้ว — กำลังสลับเข้ารายการใหม่',
            at: Date.now(),
        });
        if (waitSec > 3) {
            sessionState.applySwitchTimer = setTimeout(fire, waitSec * 1000);
            sessionState.applySwitchTimer.unref();
        }
        else {
            fire();
        }
        return { applied: true, clipsChanged, waitSec };
    });
    electron_1.ipcMain.handle('chat:get-config', (event, accountId) => {
        assertTrustedSender(event);
        return getChatConfig(normalizeAccountId(accountId));
    });
    electron_1.ipcMain.handle('chat:set-config', (event, accountId, value) => {
        assertTrustedSender(event);
        return saveChatConfig(normalizeAccountId(accountId), value);
    });
    electron_1.ipcMain.handle('line:get-config', (event) => {
        assertTrustedSender(event);
        return getLineConfig();
    });
    electron_1.ipcMain.handle('line:set-config', (event, value) => {
        assertTrustedSender(event);
        return saveLineConfig(value);
    });
    // Send a test message using the token/target the user just typed (not yet saved).
    electron_1.ipcMain.handle('line:test', async (event, value) => {
        assertTrustedSender(event);
        return (0, notify_1.sendLineMessage)((0, notify_1.sanitizeLineConfig)(value), `✅ ทดสอบการแจ้งเตือนจาก Rerun Studio\n${nowText()}`);
    });
    // "Check live via LINE": push the current status of all accounts on demand.
    electron_1.ipcMain.handle('line:push-status', async (event) => {
        assertTrustedSender(event);
        return (0, notify_1.sendLineMessage)(getLineConfig(), liveStatusSummary());
    });
    electron_1.ipcMain.handle('history:list', (event) => {
        assertTrustedSender(event);
        // Newest first for display.
        return [...getHistory()].reverse();
    });
    electron_1.ipcMain.handle('history:clear', (event) => {
        assertTrustedSender(event);
        writeHistory([]);
        return [];
    });
    electron_1.ipcMain.handle('library:list', (event) => {
        assertTrustedSender(event);
        return libraryForRenderer();
    });
    electron_1.ipcMain.handle('library:add', async (event) => {
        assertTrustedSender(event);
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: 'เพิ่มวิดีโอเข้าคลัง',
            properties: ['openFile'],
            filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm', 'm4v'] }],
        });
        if (result.canceled || !result.filePaths[0])
            return libraryForRenderer();
        addLibraryEntry(result.filePaths[0]);
        return libraryForRenderer();
    });
    // รับ path จากการลากไฟล์วาง (ไม่เปิด dialog) — addLibraryEntry ตรวจว่าไฟล์มีจริงและกันซ้ำให้อยู่แล้ว
    electron_1.ipcMain.handle('library:add-paths', (event, paths) => {
        assertTrustedSender(event);
        if (Array.isArray(paths)) {
            for (const value of paths.slice(0, 30)) {
                if (typeof value === 'string' && /\.(mp4|mov|mkv|webm|m4v)$/i.test(value))
                    addLibraryEntry(value);
            }
        }
        return libraryForRenderer();
    });
    electron_1.ipcMain.handle('library:remove', (event, id) => {
        assertTrustedSender(event);
        removeLibraryEntry(id);
        return libraryForRenderer();
    });
}
let latestUpdateStatus = { state: 'none' };
function broadcastUpdateStatus(status) {
    latestUpdateStatus = status;
    if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('update:status', status);
}
// User-facing auto-update preference. When on, new versions download automatically
// in the background; when off, the user checks + downloads manually from Settings.
// Either way the "อัปเดตเลย" button applies a downloaded update.
let autoUpdatePref = true;
function updateConfigPath() {
    return node_path_1.default.join(electron_1.app.getPath('userData'), 'update-config.json');
}
function loadUpdateConfig() {
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(updateConfigPath(), 'utf8'));
        if (parsed && typeof parsed.autoUpdate === 'boolean')
            autoUpdatePref = parsed.autoUpdate;
    }
    catch {
        // No saved preference yet — keep the default (auto-update on).
    }
}
function saveUpdateConfig() {
    try {
        (0, node_fs_1.writeFileSync)(updateConfigPath(), JSON.stringify({ autoUpdate: autoUpdatePref }), { encoding: 'utf8', mode: 0o600 });
    }
    catch {
        // Non-fatal; the preference just won't persist across restarts.
    }
}
function setupAutoUpdater() {
    loadUpdateConfig();
    // electron-updater only works from a packaged build with a publish feed; skip in dev.
    if (!electron_1.app.isPackaged)
        return;
    electron_updater_1.autoUpdater.autoDownload = autoUpdatePref;
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
    electron_updater_1.autoUpdater.on('checking-for-update', () => broadcastUpdateStatus({ state: 'checking' }));
    electron_updater_1.autoUpdater.on('update-available', (info) => broadcastUpdateStatus({ state: 'available', version: info.version }));
    electron_updater_1.autoUpdater.on('update-not-available', () => broadcastUpdateStatus({ state: 'none' }));
    electron_updater_1.autoUpdater.on('download-progress', (progress) => broadcastUpdateStatus({ state: 'downloading', percent: Math.round(progress.percent) }));
    electron_updater_1.autoUpdater.on('update-downloaded', (info) => broadcastUpdateStatus({ state: 'ready', version: info.version }));
    electron_updater_1.autoUpdater.on('error', (error) => broadcastUpdateStatus({ state: 'error', message: error instanceof Error ? error.message : 'update error' }));
    const check = () => {
        electron_updater_1.autoUpdater.checkForUpdates().catch(() => undefined);
    };
    check();
    setInterval(check, 60 * 60 * 1000);
}
electron_1.app.whenReady().then(() => {
    electron_1.protocol.handle('rerun-media', (request) => {
        const requestUrl = new URL(request.url);
        const token = requestUrl.pathname.replace(/^\//, '');
        const filePath = mediaTokens.get(token);
        if (!filePath || !node_path_1.default.isAbsolute(filePath))
            return new Response('Invalid media token', { status: 404 });
        let size;
        try {
            size = (0, node_fs_1.statSync)(filePath).size;
        }
        catch {
            return new Response('Not found', { status: 404 });
        }
        const contentType = mediaMimeType(filePath);
        // The <video> preview seeks and loops, which needs HTTP Range (206) support.
        // net.fetch(file://) ignores the Range header and always returns the whole file,
        // so the player had to buffer the entire clip before the first frame — it looked
        // frozen. Serve byte ranges from an fs stream instead.
        const rangeHeader = request.headers.get('Range');
        const match = rangeHeader ? /bytes=(\d*)-(\d*)/.exec(rangeHeader) : null;
        if (match) {
            const start = match[1] ? Number(match[1]) : 0;
            const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
            if (Number.isNaN(start) || start > end || start >= size) {
                return new Response('Range not satisfiable', {
                    status: 416,
                    headers: { 'Content-Range': `bytes */${size}` },
                });
            }
            const body = node_stream_1.Readable.toWeb((0, node_fs_1.createReadStream)(filePath, { start, end }));
            return new Response(body, {
                status: 206,
                headers: {
                    'Content-Type': contentType,
                    'Content-Range': `bytes ${start}-${end}/${size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': String(end - start + 1),
                },
            });
        }
        const body = node_stream_1.Readable.toWeb((0, node_fs_1.createReadStream)(filePath));
        return new Response(body, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Content-Length': String(size),
            },
        });
    });
    electron_1.Menu.setApplicationMenu(null);
    registerIpc();
    createMainWindow();
    setupAutoUpdater();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createMainWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('before-quit', () => {
    for (const sessionState of streamSessions.values()) {
        if (sessionState.ffmpegProcess)
            sessionState.ffmpegProcess.kill('SIGTERM');
        stopOverlayText(sessionState);
    }
});
