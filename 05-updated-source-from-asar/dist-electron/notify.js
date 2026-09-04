"use strict";
// notify.ts — LINE push notifications for stream lifecycle events.
//
// Takra Rerun uses Telegram; we use LINE instead because our users live on LINE and want
// to get "live started / stopped / error" alerts and check live status from the LINE chat.
// LINE Notify was shut down in 2025, so we use the LINE Messaging API push endpoint: the
// user creates a Messaging API channel, pastes its channel access token, and gives the
// target id (their own userId, or a groupId the bot has joined). Sending goes through the
// main process (net.request has no CORS and keeps the token out of the renderer).
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLineConfig = defaultLineConfig;
exports.sanitizeLineConfig = sanitizeLineConfig;
exports.sendLineMessage = sendLineMessage;
const electron_1 = require("electron");
function defaultLineConfig() {
    return {
        enabled: false,
        channelAccessToken: '',
        targetId: '',
        notifyOnLive: true,
        notifyOnStop: true,
        notifyOnError: true,
    };
}
function sanitizeLineConfig(value) {
    const base = defaultLineConfig();
    if (!value || typeof value !== 'object')
        return base;
    const input = value;
    return {
        enabled: Boolean(input.enabled),
        channelAccessToken: typeof input.channelAccessToken === 'string' ? input.channelAccessToken : '',
        targetId: typeof input.targetId === 'string' ? input.targetId : '',
        notifyOnLive: input.notifyOnLive !== false,
        notifyOnStop: input.notifyOnStop !== false,
        notifyOnError: input.notifyOnError !== false,
    };
}
// Push a plain-text message. Resolves { ok:false, error } on any failure so a bad token or
// network blip never crashes the stream loop — notifications are best-effort.
function sendLineMessage(config, text) {
    const token = config.channelAccessToken.trim();
    const to = config.targetId.trim();
    if (!token || !to)
        return Promise.resolve({ ok: false, error: 'ยังไม่ได้ตั้งค่า Channel access token หรือปลายทาง' });
    const body = JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 4900) }] });
    return new Promise((resolve) => {
        const request = electron_1.net.request({ method: 'POST', url: 'https://api.line.me/v2/bot/message/push' });
        request.setHeader('content-type', 'application/json');
        request.setHeader('authorization', `Bearer ${token}`);
        let data = '';
        let done = false;
        const settle = (result) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            resolve(result);
        };
        const timer = setTimeout(() => {
            try {
                request.abort();
            }
            catch {
                // Best-effort abort.
            }
            settle({ ok: false, error: 'หมดเวลาเชื่อมต่อ LINE' });
        }, 12000);
        request.on('response', (response) => {
            response.on('data', (chunk) => {
                data += chunk.toString();
            });
            response.on('end', () => {
                if (response.statusCode === 200) {
                    settle({ ok: true });
                    return;
                }
                let message = `LINE ตอบกลับ ${response.statusCode}`;
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.message)
                        message = parsed.message;
                }
                catch {
                    // Non-JSON error body; keep the status-code message.
                }
                settle({ ok: false, error: message });
            });
            response.on('error', () => settle({ ok: false, error: 'อ่านคำตอบจาก LINE ไม่สำเร็จ' }));
        });
        request.on('error', (error) => settle({ ok: false, error: error.message }));
        request.write(body);
        request.end();
    });
}
