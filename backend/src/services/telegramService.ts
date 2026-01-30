/**
 * Telegram Service - Uses Vercel Proxy
 * Since HF blocks outbound connections, we route through Vercel serverless function
 */

export class TelegramService {
    private token: string;
    private proxyUrl: string;

    constructor(token: string) {
        this.token = token;
        // The Vercel frontend URL + /api/telegram-proxy
        this.proxyUrl = process.env.TELEGRAM_PROXY_URL || '';

        if (this.token && this.token !== 'optional-default-bot-token') {
            console.log('Telegram Service initialized (using Vercel proxy)');
        } else {
            console.warn('Telegram Bot Token not provided. Notifications will be disabled.');
        }
    }

    public async sendMessage(chatId: string, message: string, userBotToken?: string): Promise<{ success: boolean; error?: string }> {
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
                const result = await this.sendViaProxy(tokenToUse, chatId, escapedMessage);
                if (result.success) {
                    console.log('✅ Telegram sent via Vercel proxy');
                    return result;
                }
                console.log('Vercel proxy failed:', result.error);
            } catch (e: any) {
                console.log('Vercel proxy exception:', e.message);
            }
        }

        // Fallback: Try direct (probably won't work on HF, but worth trying)
        try {
            console.log('Trying direct connection...');
            const tgUrl = `https://api.telegram.org/bot${tokenToUse}/sendMessage`;
            const response = await fetch(tgUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: escapedMessage,
                    parse_mode: 'HTML',
                }),
            });
            const data = await response.json();
            if (data.ok) {
                console.log('✅ Telegram sent directly');
                return { success: true };
            }
            return { success: false, error: data.description || 'Telegram API error' };
        } catch (e: any) {
            return { success: false, error: `All methods failed: ${e.message}` };
        }
    }

    private async sendViaProxy(botToken: string, chatId: string, text: string): Promise<{ success: boolean; error?: string }> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Proxy-Secret': process.env.TELEGRAM_PROXY_SECRET || '',
                },
                body: JSON.stringify({ botToken, chatId, text }),
                signal: controller.signal,
            });

            const data = await response.json();

            if (data.ok) {
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Proxy returned error' };
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

    private escapeHtml(text: string): string {
        if (!text) return "";
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
    public async sendPhoto(chatId: string, photoPath: string, userBotToken?: string, caption?: string): Promise<{ success: boolean; error?: string }> {
        const tokenToUse = (userBotToken && userBotToken.trim() !== '') ? userBotToken : this.token;

        if (!tokenToUse || tokenToUse === 'optional-default-bot-token') {
            console.log('[TG Photo] No bot token provided');
            return { success: false, error: 'Bot token not provided' };
        }

        try {
            const fs = await import('fs');
            const path = await import('path');

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
                const response = await fetch(photoProxyUrl, {
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

                const data = await response.json();

                if (data.ok) {
                    console.log('[TG Photo] ✅ Photo sent via Vercel proxy');
                    return { success: true };
                } else {
                    console.log('[TG Photo] ❌ Proxy failed:', data.error);
                    return { success: false, error: data.error || 'Proxy returned error' };
                }
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.error('[TG Photo] Timeout');
                return { success: false, error: 'Photo upload timeout' };
            }
            console.error('[TG Photo] Error:', e.message);
            return { success: false, error: e.message };
        }
    }
}
