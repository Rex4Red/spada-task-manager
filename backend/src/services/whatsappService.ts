/**
 * WhatsApp Service - Send notifications via WhatsApp Bot
 * Uses Vercel proxy to forward requests to Koyeb-hosted WhatsApp bot
 */

export class WhatsAppService {
    private botUrl: string;
    private apiKey: string;
    private proxyUrl: string | null;
    private proxySecret: string | null;

    constructor() {
        this.botUrl = process.env.WHATSAPP_BOT_URL || 'https://very-ardith-bot-wa-absen-spada-69b791b2.koyeb.app';
        this.apiKey = process.env.WHATSAPP_API_KEY || '123230161';

        // Use WhatsApp proxy or fall back to Telegram proxy URL pattern
        const telegramProxy = process.env.TELEGRAM_PROXY_URL || '';
        this.proxyUrl = process.env.WHATSAPP_PROXY_URL ||
            (telegramProxy ? telegramProxy.replace('/api/telegram-proxy', '/api/whatsapp-proxy') : null);
        this.proxySecret = process.env.WHATSAPP_PROXY_SECRET || process.env.TELEGRAM_PROXY_SECRET || null;

        console.log(`WhatsApp Service initialized${this.proxyUrl ? ' (with proxy)' : ' (direct)'}`);
    }

    /**
     * Send a message to WhatsApp via proxy
     */
    private async sendViaProxy(
        phoneNumber: string,
        message: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!this.proxyUrl) {
            return { success: false, error: 'No proxy URL configured' };
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (this.proxySecret) {
            headers['X-Proxy-Secret'] = this.proxySecret;
        }

        const response = await fetch(this.proxyUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ to: phoneNumber, message }),
        });

        if (response.ok) {
            return { success: true };
        }

        const errorText = await response.text();
        return { success: false, error: `Proxy error: ${response.status} - ${errorText}` };
    }

    /**
     * Send a message directly to WhatsApp bot
     */
    private async sendDirect(
        phoneNumber: string,
        message: string
    ): Promise<{ success: boolean; error?: string }> {
        const response = await fetch(`${this.botUrl}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey,
            },
            body: JSON.stringify({ to: phoneNumber, message }),
        });

        if (response.ok) {
            return { success: true };
        }

        const errorText = await response.text();
        return { success: false, error: `Direct error: ${response.status} - ${errorText}` };
    }

    /**
     * Send a message to WhatsApp
     */
    public async sendMessage(
        phoneNumber: string,
        message: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!phoneNumber) {
            return { success: false, error: 'Phone number not provided' };
        }

        // Normalize phone number (remove + and spaces)
        const normalizedPhone = phoneNumber.replace(/[+\s-]/g, '');

        console.log(`[WhatsApp] Sending to ${normalizedPhone}...`);

        // Try via proxy first
        if (this.proxyUrl) {
            try {
                const result = await this.sendViaProxy(normalizedPhone, message);
                if (result.success) {
                    console.log('✅ WhatsApp sent via proxy');
                    return result;
                }
                console.log('Proxy failed:', result.error);
            } catch (e: any) {
                console.log('Proxy exception:', e.message);
            }
        }

        // Fall back to direct
        try {
            const result = await this.sendDirect(normalizedPhone, message);
            if (result.success) {
                console.log('✅ WhatsApp sent directly');
                return result;
            }
            return result;
        } catch (e: any) {
            console.error('WhatsApp send error:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Check bot status
     */
    public async checkStatus(): Promise<{ ok: boolean; status?: string; error?: string }> {
        try {
            const response = await fetch(`${this.botUrl}/status`);

            if (response.ok) {
                const data = await response.json();
                return { ok: true, status: data.status || 'connected' };
            }

            return { ok: false, error: 'Bot not connected' };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    }
}
