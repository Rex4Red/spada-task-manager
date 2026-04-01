"use strict";
/**
 * WhatsApp Service - Using custom WhatsApp Bot API
 * Direct HTTP calls to bot-whatsapp.podnet.space
 *
 * Flow: HF Backend → Bot API → WhatsApp
 */
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
exports.WhatsAppService = void 0;
class WhatsAppService {
    constructor() {
        this.botUrl = process.env.WHATSAPP_BOT_URL || 'https://bot-whatsapp.podnet.space';
        this.apiKey = process.env.WHATSAPP_API_KEY || '';
        console.log(`WhatsApp Service initialized (Bot API: ${this.botUrl})`);
    }
    /**
     * Send a text message via Bot API
     */
    sendMessage(phoneNumber, message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!phoneNumber) {
                return { success: false, error: 'Phone number not provided' };
            }
            if (!this.apiKey) {
                return { success: false, error: 'WHATSAPP_API_KEY not set' };
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            try {
                console.log(`[WhatsApp] Sending message to ${this.formatPhone(phoneNumber)}...`);
                const response = yield fetch(`${this.botUrl}/api/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                    },
                    body: JSON.stringify({
                        phone: this.formatPhone(phoneNumber),
                        message,
                    }),
                    signal: controller.signal,
                });
                const data = yield response.json();
                if (data.success) {
                    console.log('✅ WhatsApp message sent via Bot API');
                    return { success: true };
                }
                else {
                    const errorMsg = data.error || 'Bot API error';
                    console.log(`[WhatsApp] Bot API error: ${errorMsg}`);
                    return { success: false, error: errorMsg };
                }
            }
            catch (e) {
                if (e.name === 'AbortError') {
                    return { success: false, error: 'Bot API request timeout' };
                }
                return { success: false, error: e.message };
            }
            finally {
                clearTimeout(timeoutId);
            }
        });
    }
    /**
     * Send an image with caption
     * Bot API only supports text, so we send text-only with caption
     */
    sendImage(phoneNumber_1, _base64Image_1, caption_1) {
        return __awaiter(this, arguments, void 0, function* (phoneNumber, _base64Image, caption, _mimetype = 'image/png') {
            // Bot API doesn't support image sending, fall back to text
            console.log('[WhatsApp] Bot API does not support images, sending text-only');
            return yield this.sendMessage(phoneNumber, caption);
        });
    }
    /**
     * Send a message to a WhatsApp group via Bot API
     */
    sendGroupMessage(groupId, message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!groupId) {
                return { success: false, error: 'Group ID not provided' };
            }
            if (!this.apiKey) {
                return { success: false, error: 'WHATSAPP_API_KEY not set' };
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            try {
                console.log(`[WhatsApp] Sending group message to ${groupId}...`);
                const response = yield fetch(`${this.botUrl}/api/send-group`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                    },
                    body: JSON.stringify({
                        groupId,
                        message,
                    }),
                    signal: controller.signal,
                });
                const data = yield response.json();
                if (data.success) {
                    console.log('✅ WhatsApp group message sent via Bot API');
                    return { success: true };
                }
                else {
                    const errorMsg = data.error || 'Bot API group error';
                    console.log(`[WhatsApp] Bot API group error: ${errorMsg}`);
                    return { success: false, error: errorMsg };
                }
            }
            catch (e) {
                if (e.name === 'AbortError') {
                    return { success: false, error: 'Bot API request timeout' };
                }
                return { success: false, error: e.message };
            }
            finally {
                clearTimeout(timeoutId);
            }
        });
    }
    /**
     * Format phone number - ensure it starts with country code
     */
    formatPhone(phone) {
        let cleaned = phone.replace(/[^0-9]/g, '');
        // Convert 08xx to 628xx (Indonesia)
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }
        return cleaned;
    }
    /**
     * Check if service is configured
     */
    checkStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!this.apiKey) {
                return { ok: false, error: 'WhatsApp not configured. Set WHATSAPP_API_KEY.' };
            }
            try {
                const response = yield fetch(`${this.botUrl}/api/status`);
                const data = yield response.json();
                if (data.success && ((_a = data.data) === null || _a === void 0 ? void 0 : _a.status) === 'connected') {
                    return { ok: true, status: `Bot API (${data.data.status})` };
                }
                return { ok: true, status: `Bot API (${((_b = data.data) === null || _b === void 0 ? void 0 : _b.status) || 'unknown'})` };
            }
            catch (e) {
                return { ok: false, error: `Bot API unreachable: ${e.message}` };
            }
        });
    }
}
exports.WhatsAppService = WhatsAppService;
