/**
 * WhatsApp Service - Send notifications via WhatsApp Bot
 * Uses the Koyeb-hosted WhatsApp bot API
 */

export class WhatsAppService {
    private botUrl: string;
    private apiKey: string;

    constructor() {
        this.botUrl = process.env.WHATSAPP_BOT_URL || 'https://very-ardith-bot-wa-absen-spada-69b791b2.koyeb.app';
        this.apiKey = process.env.WHATSAPP_API_KEY || '123230161';

        console.log('WhatsApp Service initialized');
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

        try {
            console.log(`[WhatsApp] Sending to ${normalizedPhone}...`);

            const response = await fetch(`${this.botUrl}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                },
                body: JSON.stringify({
                    to: normalizedPhone,
                    message: message,
                }),
            });

            if (response.ok) {
                console.log('✅ WhatsApp message sent');
                return { success: true };
            }

            const errorText = await response.text();
            console.error('WhatsApp API error:', response.status, errorText);
            return { success: false, error: `WhatsApp API error: ${response.status} - ${errorText}` };
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
