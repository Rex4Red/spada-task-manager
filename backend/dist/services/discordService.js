"use strict";
/**
 * Discord Service - Send notifications via Discord Webhook
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
exports.DiscordColors = exports.DiscordService = void 0;
class DiscordService {
    constructor() {
        // Use DISCORD_PROXY_URL or derive from TELEGRAM_PROXY_URL
        this.proxyUrl = process.env.DISCORD_PROXY_URL || '';
        // If no explicit Discord proxy, derive from Telegram proxy URL
        if (!this.proxyUrl && process.env.TELEGRAM_PROXY_URL) {
            // Replace /api/telegram-proxy with /api/discord-proxy
            this.proxyUrl = process.env.TELEGRAM_PROXY_URL.replace('/telegram-proxy', '/discord-proxy');
        }
        console.log('Discord Service initialized', this.proxyUrl ? '(with proxy)' : '(direct mode)');
    }
    /**
     * Send a message to Discord via webhook
     */
    sendMessage(webhookUrl_1, message_1) {
        return __awaiter(this, arguments, void 0, function* (webhookUrl, message, username = 'SPADA Task Manager') {
            if (!webhookUrl) {
                return { success: false, error: 'Webhook URL not provided' };
            }
            const payload = {
                username,
                content: message,
            };
            // Try via proxy first (for HF compatibility)
            if (this.proxyUrl) {
                try {
                    console.log('Sending Discord via proxy...');
                    const result = yield this.sendViaProxy(webhookUrl, payload);
                    if (result.success) {
                        console.log('✅ Discord sent via proxy');
                        return result;
                    }
                    console.log('Proxy failed:', result.error);
                }
                catch (e) {
                    console.log('Proxy exception:', e.message);
                }
            }
            // Fallback: Direct connection
            try {
                console.log('Trying direct Discord connection...');
                const response = yield fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (response.ok || response.status === 204) {
                    console.log('✅ Discord sent directly');
                    return { success: true };
                }
                const errorText = yield response.text();
                return { success: false, error: `Discord API error: ${response.status} - ${errorText}` };
            }
            catch (e) {
                return { success: false, error: `All methods failed: ${e.message}` };
            }
        });
    }
    /**
     * Send a rich embed to Discord
     */
    sendEmbed(webhookUrl_1, embed_1) {
        return __awaiter(this, arguments, void 0, function* (webhookUrl, embed, username = 'SPADA Task Manager') {
            if (!webhookUrl) {
                return { success: false, error: 'Webhook URL not provided' };
            }
            const payload = {
                username,
                embeds: [embed],
            };
            // Try via proxy first
            if (this.proxyUrl) {
                try {
                    const result = yield this.sendViaProxy(webhookUrl, payload);
                    if (result.success)
                        return result;
                }
                catch (e) {
                    console.log('Proxy exception:', e.message);
                }
            }
            // Fallback: Direct
            try {
                const response = yield fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (response.ok || response.status === 204) {
                    return { success: true };
                }
                const errorText = yield response.text();
                return { success: false, error: `Discord API error: ${response.status} - ${errorText}` };
            }
            catch (e) {
                return { success: false, error: e.message };
            }
        });
    }
    sendViaProxy(webhookUrl, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            try {
                const response = yield fetch(this.proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Proxy-Secret': process.env.DISCORD_PROXY_SECRET || process.env.TELEGRAM_PROXY_SECRET || '',
                    },
                    body: JSON.stringify({ webhookUrl, payload }),
                    signal: controller.signal,
                });
                const data = yield response.json();
                if (data.ok) {
                    return { success: true };
                }
                return { success: false, error: data.error || 'Proxy returned error' };
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
    /**
     * Send embed with image attachment to Discord
     * Uses multipart form-data to attach the image file
     */
    sendEmbedWithImage(webhookUrl_1, embed_1, imagePath_1) {
        return __awaiter(this, arguments, void 0, function* (webhookUrl, embed, imagePath, username = 'SPADA Task Manager') {
            if (!webhookUrl) {
                return { success: false, error: 'Webhook URL not provided' };
            }
            try {
                const fs = yield Promise.resolve().then(() => __importStar(require('fs')));
                const path = yield Promise.resolve().then(() => __importStar(require('path')));
                if (!fs.existsSync(imagePath)) {
                    console.log('Image file not found, sending embed without image');
                    return this.sendEmbed(webhookUrl, embed, username);
                }
                const imageBuffer = fs.readFileSync(imagePath);
                const imageBase64 = imageBuffer.toString('base64');
                const fileName = path.basename(imagePath);
                // Set the image in embed to reference the attachment
                const embedWithImage = Object.assign(Object.assign({}, embed), { image: { url: `attachment://${fileName}` } });
                const payload = {
                    username,
                    embeds: [embedWithImage],
                };
                // Try via proxy first
                if (this.proxyUrl) {
                    try {
                        const result = yield this.sendImageViaProxy(webhookUrl, payload, imageBase64, fileName);
                        if (result.success) {
                            console.log('✅ Discord with image sent via proxy');
                            return result;
                        }
                        console.log('Proxy with image failed:', result.error);
                    }
                    catch (e) {
                        console.log('Proxy with image exception:', e.message);
                    }
                }
                // Fallback: Send without image
                console.log('Falling back to embed without image');
                return this.sendEmbed(webhookUrl, embed, username);
            }
            catch (e) {
                console.error('Error sending embed with image:', e);
                return { success: false, error: e.message };
            }
        });
    }
    sendImageViaProxy(webhookUrl, payload, imageBase64, fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // Longer timeout for images
            try {
                const response = yield fetch(this.proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Proxy-Secret': process.env.DISCORD_PROXY_SECRET || process.env.TELEGRAM_PROXY_SECRET || '',
                    },
                    body: JSON.stringify({
                        webhookUrl,
                        payload,
                        image: {
                            base64: imageBase64,
                            fileName
                        }
                    }),
                    signal: controller.signal,
                });
                const data = yield response.json();
                if (data.ok) {
                    return { success: true };
                }
                return { success: false, error: data.error || 'Proxy returned error' };
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
}
exports.DiscordService = DiscordService;
// Color constants for embeds
exports.DiscordColors = {
    PRIMARY: 0x5865F2, // Discord Blurple
    SUCCESS: 0x57F287, // Green
    WARNING: 0xFEE75C, // Yellow
    DANGER: 0xED4245, // Red
    INFO: 0x5BC0EB, // Light Blue
};
