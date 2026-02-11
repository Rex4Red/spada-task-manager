/**
 * WhatsApp Service - HTTP-based using Fonnte.com API
 * Routes through Vercel proxy (same pattern as Telegram/Discord)
 * 
 * Flow: HF Backend → Vercel Proxy → Fonnte API → WhatsApp
 */

export class WhatsAppService {
    private proxyUrl: string;

    constructor() {
        // Derive from TELEGRAM_PROXY_URL pattern, or use dedicated env var
        this.proxyUrl = process.env.WHATSAPP_PROXY_URL || '';
        if (!this.proxyUrl && process.env.TELEGRAM_PROXY_URL) {
            this.proxyUrl = process.env.TELEGRAM_PROXY_URL.replace('/telegram-proxy', '/whatsapp-proxy');
        }

        console.log(`WhatsApp Service initialized (Fonnte via ${this.proxyUrl ? 'Vercel proxy' : 'direct'})`);
    }

    /**
     * Send a text message via Fonnte API
     */
    public async sendMessage(
        phoneNumber: string,
        message: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!phoneNumber) {
            return { success: false, error: 'Phone number not provided' };
        }

        // Try proxy first, then direct
        if (this.proxyUrl) {
            try {
                console.log('[WhatsApp] Sending via Vercel proxy...');
                const result = await this.sendViaProxy({
                    target: this.formatPhone(phoneNumber),
                    message,
                });
                if (result.success) {
                    console.log('✅ WhatsApp sent via Vercel proxy');
                    return result;
                }
                console.log('[WhatsApp] Proxy failed:', result.error);
            } catch (e: any) {
                console.log('[WhatsApp] Proxy exception:', e.message);
            }
        }

        // Fallback: direct to Fonnte API
        try {
            console.log('[WhatsApp] Trying direct Fonnte API...');
            return await this.sendDirect({
                target: this.formatPhone(phoneNumber),
                message,
            });
        } catch (e: any) {
            return { success: false, error: `All methods failed: ${e.message}` };
        }
    }

    /**
     * Send an image with caption via Fonnte API
     */
    public async sendImage(
        phoneNumber: string,
        base64Image: string,
        caption: string,
        _mimetype: string = 'image/png'
    ): Promise<{ success: boolean; error?: string }> {
        if (!phoneNumber) {
            return { success: false, error: 'Phone number not provided' };
        }

        const payload = {
            target: this.formatPhone(phoneNumber),
            message: caption || '',
            imageBase64: base64Image,
            filename: 'screenshot.png',
        };

        if (this.proxyUrl) {
            try {
                console.log('[WhatsApp] Sending image via Vercel proxy...');
                const result = await this.sendViaProxy(payload);
                if (result.success) {
                    console.log('✅ WhatsApp image sent via Vercel proxy');
                    return result;
                }
                console.log('[WhatsApp] Image proxy failed:', result.error);
            } catch (e: any) {
                console.log('[WhatsApp] Image proxy exception:', e.message);
            }
        }

        // Fallback: send text only (direct Fonnte can't do multipart easily)
        console.log('[WhatsApp] Falling back to text-only message');
        return await this.sendMessage(phoneNumber, caption);
    }

    /**
     * Send via Vercel proxy
     */
    private async sendViaProxy(payload: any): Promise<{ success: boolean; error?: string }> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Proxy-Secret': process.env.WHATSAPP_PROXY_SECRET || process.env.TELEGRAM_PROXY_SECRET || '',
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            const data = await response.json();

            if (data.ok || data.status) {
                return { success: true };
            } else {
                return { success: false, error: data.error || data.reason || 'Proxy returned error' };
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                return { success: false, error: 'Proxy request timeout' };
            }
            return { success: false, error: e.message };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Send directly to Fonnte API (fallback, may not work on HF)
     */
    private async sendDirect(payload: any): Promise<{ success: boolean; error?: string }> {
        const token = process.env.FONNTE_TOKEN || '';
        if (!token) {
            return { success: false, error: 'FONNTE_TOKEN not set' };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            const data = await response.json();

            if (data.status) {
                return { success: true };
            } else {
                return { success: false, error: data.reason || data.detail || 'Fonnte API error' };
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                return { success: false, error: 'Fonnte request timeout' };
            }
            return { success: false, error: e.message };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Format phone number - ensure it starts with country code
     */
    private formatPhone(phone: string): string {
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
    public async checkStatus(): Promise<{ ok: boolean; status?: string; error?: string }> {
        const hasProxy = !!this.proxyUrl;
        const hasToken = !!process.env.FONNTE_TOKEN;

        if (hasProxy || hasToken) {
            return { ok: true, status: `Fonnte (${hasProxy ? 'via proxy' : 'direct'})` };
        }
        return { ok: false, error: 'WhatsApp not configured. Set FONNTE_TOKEN or WHATSAPP_PROXY_URL.' };
    }
}
