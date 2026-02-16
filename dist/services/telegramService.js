"use strict";
/**
 * Telegram Service - Uses Vercel Proxy
 * Since HF blocks outbound connections, we route through Vercel serverless function
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
class TelegramService {
    constructor(token) {
        this.token = token;
        // The Vercel frontend URL + /api/telegram-proxy
        this.proxyUrl = process.env.TELEGRAM_PROXY_URL || '';
        if (this.token && this.token !== 'optional-default-bot-token') {
            console.log('Telegram Service initialized (using Vercel proxy)');
        }
        else {
            console.warn('Telegram Bot Token not provided. Notifications will be disabled.');
        }
    }
    sendMessage(chatId, message, userBotToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenToUse = (userBotToken && userBotToken.trim() !== '') ? userBotToken : this.token;
            if (!tokenToUse || tokenToUse === 'optional-default-bot-token') {
                return { success: false, error: 'Bot token not provided' };
            }
            // Escape HTML for Telegram
            const escapedMessage = this.escapeHtml(message.replace(/\*/g, '').replace(/_/g, ''));
            // Try Vercel Proxy first
            if (this.proxyUrl) {
                try {
                    console.log('Sending via Vercel proxy...');
                    const result = yield this.sendViaProxy(tokenToUse, chatId, escapedMessage);
                    if (result.success) {
                        console.log('✅ Telegram sent via Vercel proxy');
                        return result;
                    }
                    console.log('Vercel proxy failed:', result.error);
                }
                catch (e) {
                    console.log('Vercel proxy exception:', e.message);
                }
            }
            // Fallback: Try direct (probably won't work on HF, but worth trying)
            try {
                console.log('Trying direct connection...');
                const tgUrl = `https://api.telegram.org/bot${tokenToUse}/sendMessage`;
                const response = yield fetch(tgUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: escapedMessage,
                        parse_mode: 'HTML',
                    }),
                });
                const data = yield response.json();
                if (data.ok) {
                    console.log('✅ Telegram sent directly');
                    return { success: true };
                }
                return { success: false, error: data.description || 'Telegram API error' };
            }
            catch (e) {
                return { success: false, error: `All methods failed: ${e.message}` };
            }
        });
    }
    sendViaProxy(botToken, chatId, text) {
        return __awaiter(this, void 0, void 0, function* () {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            try {
                const response = yield fetch(this.proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Proxy-Secret': process.env.TELEGRAM_PROXY_SECRET || '',
                    },
                    body: JSON.stringify({ botToken, chatId, text }),
                    signal: controller.signal,
                });
                const data = yield response.json();
                if (data.ok) {
                    return { success: true };
                }
                else {
                    return { success: false, error: data.error || 'Proxy returned error' };
                }
            }
            catch (e) {
                if (e.name === 'AbortError') {
                    return { success: false, error: 'Proxy request timeout' };
                }
                return { success: false, error: e.message };
            }
            finally {
                clearTimeout(timeoutId);
            }
        });
    }
    escapeHtml(text) {
        if (!text)
            return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    /**
     * Send a photo via Telegram using Vercel proxy (base64)
     */
    sendPhoto(chatId, photoPath, userBotToken, caption) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenToUse = (userBotToken && userBotToken.trim() !== '') ? userBotToken : this.token;
            if (!tokenToUse || tokenToUse === 'optional-default-bot-token') {
                console.log('[TG Photo] No bot token provided');
                return { success: false, error: 'Bot token not provided' };
            }
            try {
                const fs = yield Promise.resolve().then(() => __importStar(require('fs')));
                const path = yield Promise.resolve().then(() => __importStar(require('path')));
                // Check if file exists
                if (!fs.existsSync(photoPath)) {
                    console.log(`[TG Photo] File not found: ${photoPath}`);
                    return { success: false, error: `Screenshot file not found: ${photoPath}` };
                }
                console.log(`[TG Photo] Sending photo via Vercel proxy: ${photoPath}`);
                // Read file as base64
                const fileBuffer = fs.readFileSync(photoPath);
                const photoBase64 = fileBuffer.toString('base64');
                const filename = path.basename(photoPath);
                // Get photo proxy URL
                const photoProxyUrl = this.proxyUrl.replace('/telegram-proxy', '/telegram-photo-proxy');
                if (!photoProxyUrl || !this.proxyUrl) {
                    console.log('[TG Photo] Photo proxy URL not configured');
                    return { success: false, error: 'Photo proxy not configured' };
                }
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                try {
                    const response = yield fetch(photoProxyUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Proxy-Secret': process.env.TELEGRAM_PROXY_SECRET || '',
                        },
                        body: JSON.stringify({
                            botToken: tokenToUse,
                            chatId,
                            photoBase64,
                            caption,
                            filename
                        }),
                        signal: controller.signal,
                    });
                    const data = yield response.json();
                    if (data.ok) {
                        console.log('[TG Photo] ✅ Photo sent via Vercel proxy');
                        return { success: true };
                    }
                    else {
                        console.log('[TG Photo] ❌ Proxy failed:', data.error);
                        return { success: false, error: data.error || 'Proxy returned error' };
                    }
                }
                finally {
                    clearTimeout(timeoutId);
                }
            }
            catch (e) {
                if (e.name === 'AbortError') {
                    console.error('[TG Photo] Timeout');
                    return { success: false, error: 'Photo upload timeout' };
                }
                console.error('[TG Photo] Error:', e.message);
                return { success: false, error: e.message };
            }
        });
    }
}
exports.TelegramService = TelegramService;
