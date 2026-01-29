import TelegramBot from 'node-telegram-bot-api';

export class TelegramService {
    private bot: TelegramBot | null = null;
    private token: string;

    constructor(token: string) {
        this.token = token;
        if (this.token && this.token !== 'optional-default-bot-token') {
            this.init();
        } else {
            console.warn('Telegram Bot Token not provided. Notifications will be disabled.');
        }
    }

    private init() {
        try {
            this.bot = new TelegramBot(this.token, { polling: true });
            console.log('Telegram Bot initialized');

            // Handle /start command
            this.bot.onText(/\/start/, (msg) => {
                const chatId = msg.chat.id;
                this.bot?.sendMessage(chatId, `Welcome to SPADA Manager Bot! 🤖\n\nYour Chat ID is: \`${chatId}\`\n\nPlease copy this ID and paste it into your SPADA Manager Settings to enable notifications.`, { parse_mode: 'Markdown' });
            });

            this.bot.on('polling_error', (error) => {
                console.error('Telegram Polling Error:', error.message);
            });

        } catch (error) {
            console.error('Failed to initialize Telegram Bot:', error);
        }
    }

    public async sendMessage(chatId: string, message: string, userBotToken?: string): Promise<boolean> {
        let botToSend = this.bot;

        // If user provides a specific token, use a temporary instance
        if (userBotToken && userBotToken.trim() !== '') {
            try {
                // We create a new instance just for sending. 
                // Note: creating a new instance for every message might be inefficient for high volume,
                // but for this scale (personal task manager), it is acceptable.
                botToSend = new TelegramBot(userBotToken, { polling: false });
            } catch (err) {
                console.error('Failed to create temporary bot instance:', err);
                return false;
            }
        }

        if (!botToSend) {
            console.warn('Telegram Bot not initialized (and no user token provided). Cannot send message.');
            return false;
        }

        try {
            await botToSend.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            return true;
        } catch (error) {
            console.error(`Failed to send Telegram message to ${chatId}:`, error);
            return false;
        }
    }
}
