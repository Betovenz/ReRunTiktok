"use strict";
// chat-engine.ts — reads incoming TikTok LIVE comments for our own rerun room and
// auto-replies as the host. Two reply strategies, checked in order:
//   A. keyword rules  — free, instant, for known FAQs (price, shipping, COD…)
//   B. AI (Anthropic)  — BYOK: the user supplies their own API key, so there is no
//      API cost to us. Only used when no rule matches, to keep call volume (and cost) low.
//
// Reading goes through tiktok-live-connector (v2), which handles the webcast protobuf
// decode; we connect by roomId (or the host @username for Stream-Key lives), seeded with
// the host's captured session cookie. Sending does NOT use that library: its only send
// route is Euler Stream's paid relay, so the caller injects a `send` function instead.
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultChatConfig = defaultChatConfig;
exports.isChatEngineRunning = isChatEngineRunning;
exports.setChatProducts = setChatProducts;
exports.updateChatConfig = updateChatConfig;
exports.startChatEngine = startChatEngine;
exports.stopChatEngine = stopChatEngine;
const electron_1 = require("electron");
let libraryPromise = null;
function loadLibrary() {
    if (!libraryPromise)
        libraryPromise = import('tiktok-live-connector');
    return libraryPromise;
}
function defaultChatConfig() {
    return {
        enabled: false,
        rules: [],
        ai: {
            enabled: false,
            provider: 'gemini',
            apiKey: '',
            model: 'gemini-2.0-flash',
            context: '',
            useProducts: true,
        },
        replyCooldownMs: 4000,
        perUserCooldownMs: 30000,
        signApiKey: '',
        hostUsername: '',
    };
}
// Pull a single cookie value out of the "name=value; name2=value2" header string.
function cookieValue(cookie, name) {
    const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(cookie);
    return match ? match[1] : '';
}
const randomId = () => Math.random().toString(36).slice(2, 10);
// How long to wait for a sent reply to echo back through the read connection before
// concluding it never actually posted. The webcast relay is normally sub-second to a
// couple of seconds, so this is a generous margin, not a tight one.
const CONFIRM_TIMEOUT_MS = 8000;
function system(text) {
    return { kind: 'system', id: randomId(), text, at: Date.now() };
}
// One ChatSession per TikTok account, so every live room reads/replies with its own
// connection, config, cooldown timers and self-echo suppression set. Concurrent lives
// no longer share (and clobber) a single module-level connection.
class ChatSession {
    // Product lines for the prompt, pushed in from the main process — the chat engine has no
    // access to the LIVE console itself, and should not grow one.
    products = [];
    connection = null;
    config;
    emit;
    send;
    lastGlobalReplyAt = 0;
    lastUserReplyAt = new Map();
    // Texts we just sent, so the echo of our own reply in the chat stream is ignored
    // (prevents the bot replying to itself).
    recentlySent = new Set();
    // Sent texts still waiting to see their own echo — the ONLY real proof TikTok's
    // backend actually posted the reply. The composer only proves the input field cleared,
    // and some web UIs clear it optimistically even when the backend silently drops or
    // rate-limits the post, which would otherwise look like a successful reply that never
    // actually reaches viewers.
    pendingConfirmations = new Map();
    constructor(config, emit, send) {
        this.config = config;
        this.emit = emit;
        this.send = send;
    }
    isRunning() {
        return this.connection !== null;
    }
    // Live-editable: settings changed from the UI take effect without reconnecting.
    updateConfig(config) {
        this.config = config;
    }
    async start(roomId, cookie) {
        const { TikTokLiveConnection, ControlEvent, WebcastEvent } = await loadLibrary();
        // Stream-Key lives give us no roomId, so we connect by the host's @username and let
        // the library look the live room up (which is what fetchRoomInfoOnConnect does).
        const hostUsername = this.config.hostUsername.trim().replace(/^@/, '');
        if (!roomId && !hostUsername) {
            throw new Error('โหมด Stream Key ต้องกรอก @username ของบัญชีโฮสต์ก่อนจึงจะตอบแชทได้');
        }
        const conn = new TikTokLiveConnection(hostUsername || 'rerunstudio', {
            session: {
                cookie: {
                    type: 'cookie',
                    value: {
                        sessionId: cookieValue(cookie, 'sessionid'),
                        ttTargetIdc: cookieValue(cookie, 'tt-target-idc'),
                    },
                },
            },
            // Deliberately not passing authenticateWs: the library only forwards it to the
            // signed-websocket route when useMobile is set, and that path additionally demands
            // an Euler Stream whitelist env var we don't have — so it was a no-op that only
            // made this call look like it did something. Reading public chat needs no WS auth.
            signApiKey: this.config.signApiKey || undefined,
            fetchRoomInfoOnConnect: !roomId,
            processInitialData: false,
        });
        this.connection = conn;
        this.connection.on(ControlEvent.DISCONNECTED, () => this.emit(system('การเชื่อมต่อแชทหลุด')));
        this.connection.on(ControlEvent.ERROR, (payload) => {
            const detail = payload?.exception ?? payload;
            const message = detail instanceof Error ? detail.message : String(payload?.info ?? detail);
            this.emit(system(`แชท error: ${message}`));
        });
        this.connection.on(WebcastEvent.CHAT, (message) => {
            void this.handleChat(message);
        });
        await this.connection.connect(roomId ?? undefined);
        this.emit(system('เชื่อมต่อแชทสำเร็จ — กำลังอ่านคอมเมนต์'));
    }
    async stop() {
        const active = this.connection;
        this.connection = null;
        if (active) {
            try {
                await active.disconnect();
            }
            catch {
                // Already closed or never fully connected; nothing to clean up.
            }
        }
    }
    async handleChat(message) {
        const config = this.config;
        if (!config.enabled || !this.connection)
            return;
        const text = (message.content ?? '').trim();
        if (!text)
            return;
        // Ignore the echo of our own replies (they come back through the chat stream) —
        // and if something is waiting to confirm this exact text was actually delivered,
        // this echo is that confirmation.
        if (this.recentlySent.has(text)) {
            this.pendingConfirmations.get(text)?.();
            this.pendingConfirmations.delete(text);
            return;
        }
        const user = message.user?.nickname || message.user?.displayId || 'ผู้ชม';
        const userId = message.user?.id || user;
        this.emit({ kind: 'incoming', id: randomId(), user, text, at: Date.now() });
        const rule = config.rules.find((candidate) => candidate.enabled &&
            candidate.keyword.trim() &&
            text.toLowerCase().includes(candidate.keyword.trim().toLowerCase()));
        // Check the cooldowns BEFORE generating. They used to be checked after, so every
        // comment that arrived inside a cooldown still cost a paid API call whose answer was
        // then discarded — on a busy live that is most of them.
        const now = Date.now();
        if (now - this.lastGlobalReplyAt < config.replyCooldownMs)
            return;
        if (now - (this.lastUserReplyAt.get(userId) ?? 0) < config.perUserCooldownMs)
            return;
        let replyText = null;
        let via = 'rule';
        if (rule) {
            replyText = rule.reply.trim() || null;
            via = 'rule';
        }
        else if (config.ai.enabled && config.ai.apiKey.trim()) {
            replyText = await generateAiReply(text, config.ai, this.products, (message) => this.emit(system(message)));
            via = 'ai';
        }
        if (!replyText)
            return;
        // Stamp only once a reply actually exists, so a failed generation does not spend the
        // cooldown and mute the next viewer.
        this.lastGlobalReplyAt = Date.now();
        this.lastUserReplyAt.set(userId, Date.now());
        const finalText = replyText;
        this.recentlySent.add(finalText);
        setTimeout(() => this.recentlySent.delete(finalText), 60000);
        try {
            await this.send(finalText);
        }
        catch (error) {
            this.emit(system(`ส่งคำตอบไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`));
            return;
        }
        // The composer cleared, which only proves our side worked — wait for the message to
        // echo back through the read connection before calling it a real success, since a
        // cleared input does not guarantee TikTok's backend actually posted it.
        const confirmed = await new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.pendingConfirmations.delete(finalText);
                resolve(false);
            }, CONFIRM_TIMEOUT_MS);
            this.pendingConfirmations.set(finalText, () => {
                clearTimeout(timer);
                resolve(true);
            });
        });
        if (confirmed) {
            this.emit({ kind: 'reply', id: randomId(), user, text: finalText, via, at: now });
        }
        else {
            const preview = finalText.length > 30 ? `${finalText.slice(0, 30)}…` : finalText;
            this.emit(system(`ส่งข้อความ "${preview}" แล้วแต่ไม่เห็นขึ้นในแชทจริง — TikTok อาจบล็อกหรือจำกัดการส่ง`));
        }
    }
}
const chatSessions = new Map();
function isChatEngineRunning(accountId) {
    return chatSessions.get(accountId)?.isRunning() ?? false;
}
// Live-editable: settings changed from the UI take effect without reconnecting.
// Push the account's product list into a running chat session. Called when a live starts
// and whenever the seller re-pulls products, so the model answers from what is actually in
// the cart rather than from whatever was there when the live began.
function setChatProducts(accountId, lines) {
    const chat = chatSessions.get(accountId);
    if (!chat)
        return;
    chat.products = lines.filter(Boolean).map((line) => ({ line }));
}
function updateChatConfig(accountId, config) {
    chatSessions.get(accountId)?.updateConfig(config);
}
async function startChatEngine({ accountId, roomId, cookie, config, emit, send }) {
    await stopChatEngine(accountId);
    const chat = new ChatSession(config, emit, send);
    chatSessions.set(accountId, chat);
    try {
        await chat.start(roomId, cookie);
    }
    catch (error) {
        chatSessions.delete(accountId);
        throw error;
    }
}
async function stopChatEngine(accountId) {
    const chat = chatSessions.get(accountId);
    if (!chat)
        return;
    chatSessions.delete(accountId);
    await chat.stop();
}
// BYOK Anthropic call from the main process (net.request is not subject to CORS and
// keeps the key out of the renderer). Returns null on any failure so a bad key or
// network blip degrades to "no reply" instead of crashing the chat loop.
// What the model is told about this shop before it sees a single comment. Kept in one
// place so both providers get exactly the same instructions — a reply that changes
// character because the seller switched provider would be a support problem, not a
// feature.
function buildSystemPrompt(ai, products) {
    const lines = [
        'คุณเป็นผู้ช่วยแม่ค้าไลฟ์ขายของบน TikTok ตอบคอมเมนต์ผู้ชมแบบสั้น กระชับ สุภาพ เป็นกันเอง',
        'ภาษาไทย ไม่เกิน 1-2 ประโยค ห้ามขึ้นต้นด้วยเครื่องหมายคำพูด ห้ามใส่ชื่อผู้ใช้',
        // Without this the model invents prices, which is worse than not answering.
        'ถ้าไม่มีข้อมูลสินค้าที่ลูกค้าถาม ให้บอกว่าเดี๋ยวแม่ค้าตอบให้ ห้ามเดาราคาหรือรายละเอียดเอง',
        '',
        `ข้อมูลร้าน/โปรโมชัน:\n${ai.context.trim() || '(ไม่มีข้อมูลเพิ่มเติม)'}`,
    ];
    if (ai.useProducts && products.length) {
        lines.push('', 'สินค้าที่กำลังขายในไลฟ์นี้ (ใช้ราคาตามนี้เท่านั้น):', ...products.slice(0, 20).map((product, index) => `${index + 1}. ${product.line}`));
    }
    return lines.join('\n');
}
// Google's Generative Language API. Shape differs from Anthropic's in every part that
// matters: the key rides on the query string, the system prompt is its own field, and the
// answer is nested under candidates[].content.parts[].
function geminiRequest(comment, ai, products) {
    const model = (ai.model || 'gemini-2.0-flash').trim();
    return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
            `:generateContent?key=${encodeURIComponent(ai.apiKey.trim())}`,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: buildSystemPrompt(ai, products) }] },
            contents: [{ role: 'user', parts: [{ text: comment }] }],
            generationConfig: { maxOutputTokens: 160, temperature: 0.7 },
        }),
        pick: (parsed) => {
            const data = parsed;
            return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() || null;
        },
    };
}
function claudeRequest(comment, ai, products) {
    return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
            'content-type': 'application/json',
            'x-api-key': ai.apiKey.trim(),
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: (ai.model || 'claude-haiku-4-5').trim(),
            max_tokens: 160,
            system: buildSystemPrompt(ai, products),
            messages: [{ role: 'user', content: comment }],
        }),
        pick: (parsed) => {
            const data = parsed;
            return data.content?.[0]?.text?.trim() || null;
        },
    };
}
// Returns null on any failure so a bad key, a wrong model name or a network blip degrades
// to "no reply" rather than taking the chat loop down. The reason is reported separately
// through onError so it is not silent.
async function generateAiReply(comment, ai, products, onError) {
    const spec = ai.provider === 'claude' ? claudeRequest(comment, ai, products) : geminiRequest(comment, ai, products);
    return new Promise((resolve) => {
        const request = electron_1.net.request({ method: 'POST', url: spec.url });
        for (const [name, value] of Object.entries(spec.headers))
            request.setHeader(name, value);
        let data = '';
        let status = 0;
        let done = false;
        const settle = (value) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            resolve(value);
        };
        const timer = setTimeout(() => {
            try {
                request.abort();
            }
            catch {
                // Best-effort abort.
            }
            onError?.('AI ตอบไม่ทันใน 12 วินาที');
            settle(null);
        }, 12000);
        request.on('response', (response) => {
            status = response.statusCode;
            response.on('data', (chunk) => {
                data += chunk.toString();
            });
            response.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (status >= 400) {
                        // Surface the provider's own message: a wrong model name or an expired key is
                        // something the seller can fix, but only if they are told which it is.
                        const detail = parsed.error?.message ?? `HTTP ${status}`;
                        onError?.(`AI ตอบไม่สำเร็จ (${detail})`.slice(0, 300));
                        settle(null);
                        return;
                    }
                    const text = spec.pick(parsed);
                    if (!text)
                        onError?.('AI ไม่ได้ส่งข้อความกลับมา');
                    settle(text);
                }
                catch {
                    onError?.(`AI ส่งข้อมูลกลับมาอ่านไม่ได้ (HTTP ${status})`);
                    settle(null);
                }
            });
            response.on('error', () => settle(null));
        });
        request.on('error', (error) => {
            onError?.(`ต่อ AI ไม่ได้: ${error.message}`);
            settle(null);
        });
        request.write(spec.body);
        request.end();
    });
}
