/**
 * WhatsApp Service - Using custom WhatsApp Bot API
 * Direct HTTP calls to bot-whatsapp.podnet.space
 * 
 * Flow: HF Backend → Bot API → WhatsApp
 */

export class WhatsAppService {
    private botUrl: string;
    private apiKey: string;

    constructor() {
        this.botUrl = process.env.WHATSAPP_BOT_URL || 'https://bot-whatsapp.podnet.space';
        this.apiKey = process.env.WHATSAPP_API_KEY || '';

        console.log(`WhatsApp Service initialized (Bot API: ${this.botUrl})`);
    }

    /**
     * Send a text message via Bot API
     */
    public async sendMessage(
        phoneNumber: string,
        message: string
    ): Promise<{ success: boolean; error?: string }> {
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
            const response = await fetch(`${this.botUrl}/api/send`, {
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

            const data = await response.json();

            if (data.success) {
                console.log('✅ WhatsApp message sent via Bot API');
                return { success: true };
            } else {
                const errorMsg = data.error || 'Bot API error';
                console.log(`[WhatsApp] Bot API error: ${errorMsg}`);
                return { success: false, error: errorMsg };
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                return { success: false, error: 'Bot API request timeout' };
            }
            return { success: false, error: e.message };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Send an image with caption
     * Bot API only supports text, so we send text-only with caption
     */
    public async sendImage(
        phoneNumber: string,
        _base64Image: string,
        caption: string,
        _mimetype: string = 'image/png'
    ): Promise<{ success: boolean; error?: string }> {
        // Bot API doesn't support image sending, fall back to text
        console.log('[WhatsApp] Bot API does not support images, sending text-only');
        return await this.sendMessage(phoneNumber, caption);
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
        if (!this.apiKey) {
            return { ok: false, error: 'WhatsApp not configured. Set WHATSAPP_API_KEY.' };
        }

        try {
            const response = await fetch(`${this.botUrl}/api/status`);
            const data = await response.json();
            if (data.success && data.data?.status === 'connected') {
                return { ok: true, status: `Bot API (${data.data.status})` };
            }
            return { ok: true, status: `Bot API (${data.data?.status || 'unknown'})` };
        } catch (e: any) {
            return { ok: false, error: `Bot API unreachable: ${e.message}` };
        }
    }
}
