/**
 * Discord Service - Send notifications via Discord Webhook
 */

export class DiscordService {
    private proxyUrl: string;

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
    public async sendMessage(
        webhookUrl: string,
        message: string,
        username: string = 'SPADA Task Manager'
    ): Promise<{ success: boolean; error?: string }> {
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
                const result = await this.sendViaProxy(webhookUrl, payload);
                if (result.success) {
                    console.log('✅ Discord sent via proxy');
                    return result;
                }
                console.log('Proxy failed:', result.error);
            } catch (e: any) {
                console.log('Proxy exception:', e.message);
            }
        }

        // Fallback: Direct connection
        try {
            console.log('Trying direct Discord connection...');
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok || response.status === 204) {
                console.log('✅ Discord sent directly');
                return { success: true };
            }

            const errorText = await response.text();
            return { success: false, error: `Discord API error: ${response.status} - ${errorText}` };
        } catch (e: any) {
            return { success: false, error: `All methods failed: ${e.message}` };
        }
    }

    /**
     * Send a rich embed to Discord
     */
    public async sendEmbed(
        webhookUrl: string,
        embed: DiscordEmbed,
        username: string = 'SPADA Task Manager'
    ): Promise<{ success: boolean; error?: string }> {
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
                const result = await this.sendViaProxy(webhookUrl, payload);
                if (result.success) return result;
            } catch (e: any) {
                console.log('Proxy exception:', e.message);
            }
        }

        // Fallback: Direct
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok || response.status === 204) {
                return { success: true };
            }

            const errorText = await response.text();
            return { success: false, error: `Discord API error: ${response.status} - ${errorText}` };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    private async sendViaProxy(
        webhookUrl: string,
        payload: any
    ): Promise<{ success: boolean; error?: string }> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Proxy-Secret': process.env.DISCORD_PROXY_SECRET || process.env.TELEGRAM_PROXY_SECRET || '',
                },
                body: JSON.stringify({ webhookUrl, payload }),
                signal: controller.signal,
            });

            const data = await response.json();
            if (data.ok) {
                return { success: true };
            }
            return { success: false, error: data.error || 'Proxy returned error' };
        } catch (e: any) {
            if (e.name === 'AbortError') {
                return { success: false, error: 'Proxy request timeout' };
            }
            return { success: false, error: e.message };
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

// Discord Embed interface
export interface DiscordEmbed {
    title?: string;
    description?: string;
    url?: string;
    color?: number; // Decimal color (e.g., 0x5865F2 for Discord blurple)
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    footer?: {
        text: string;
    };
    timestamp?: string; // ISO8601 timestamp
}

// Color constants for embeds
export const DiscordColors = {
    PRIMARY: 0x5865F2,    // Discord Blurple
    SUCCESS: 0x57F287,    // Green
    WARNING: 0xFEE75C,    // Yellow
    DANGER: 0xED4245,     // Red
    INFO: 0x5BC0EB,       // Light Blue
};
