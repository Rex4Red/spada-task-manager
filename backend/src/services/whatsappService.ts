/**
 * WhatsApp Service - Built-in WhatsApp client using Baileys
 * Runs directly in the backend, no external service needed.
 * QR code available via API for authentication.
 */

import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    WASocket,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import pino from 'pino';

type WAStatus = 'disconnected' | 'qr' | 'connecting' | 'connected';

export class WhatsAppService {
    private socket: WASocket | null = null;
    private qrCode: string | null = null; // base64 data URL
    private status: WAStatus = 'disconnected';
    private authDir: string;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private logger: any;

    constructor() {
        this.authDir = path.join(process.cwd(), 'whatsapp-auth');
        // Ensure auth directory exists
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
        this.logger = pino({ level: 'silent' }); // Suppress baileys verbose logs
        console.log('WhatsApp Service initialized (built-in Baileys client)');
    }

    /**
     * Initialize the WhatsApp client connection
     */
    async initClient(): Promise<void> {
        if (this.status === 'connecting' || this.status === 'connected') {
            console.log(`[WhatsApp] Already ${this.status}, skipping init`);
            return;
        }

        try {
            this.status = 'connecting';
            console.log('[WhatsApp] Initializing Baileys client...');

            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            const { version } = await fetchLatestBaileysVersion();

            this.socket = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, this.logger),
                },
                printQRInTerminal: true, // Also print in terminal for backup
                logger: this.logger,
                browser: ['SPADA Task Manager', 'Chrome', '120.0.0'],
                generateHighQualityLinkPreview: false,
                markOnlineOnConnect: false,
            });

            // Handle connection updates
            this.socket.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    // Generate QR code as base64 data URL
                    try {
                        this.qrCode = await QRCode.toDataURL(qr, {
                            width: 300,
                            margin: 2,
                            color: { dark: '#000000', light: '#ffffff' },
                        });
                        this.status = 'qr';
                        console.log('[WhatsApp] QR code generated - scan from Settings page');
                    } catch (err) {
                        console.error('[WhatsApp] Failed to generate QR:', err);
                    }
                }

                if (connection === 'close') {
                    this.qrCode = null;
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    console.log(`[WhatsApp] Connection closed. Status: ${statusCode}, Reconnect: ${shouldReconnect}`);

                    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        this.status = 'disconnected';
                        console.log(`[WhatsApp] Reconnecting... attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                        setTimeout(() => this.initClient(), 5000);
                    } else {
                        this.status = 'disconnected';
                        this.socket = null;
                        if (statusCode === DisconnectReason.loggedOut) {
                            console.log('[WhatsApp] Logged out. Clearing auth state...');
                            this.clearAuthState();
                        }
                    }
                }

                if (connection === 'open') {
                    this.status = 'connected';
                    this.qrCode = null;
                    this.reconnectAttempts = 0;
                    console.log('[WhatsApp] ✅ Connected successfully!');
                }
            });

            // Handle credential updates (save session)
            this.socket.ev.on('creds.update', saveCreds);

        } catch (error) {
            console.error('[WhatsApp] Init error:', error);
            this.status = 'disconnected';
        }
    }

    /**
     * Get current connection status and QR code
     */
    getConnectionInfo(): { status: WAStatus; qrCode: string | null } {
        return {
            status: this.status,
            qrCode: this.status === 'qr' ? this.qrCode : null,
        };
    }

    /**
     * Logout and clear session
     */
    async logout(): Promise<void> {
        try {
            if (this.socket) {
                await this.socket.logout();
            }
        } catch (e) {
            console.error('[WhatsApp] Logout error:', e);
        }
        this.socket = null;
        this.qrCode = null;
        this.status = 'disconnected';
        this.clearAuthState();
        console.log('[WhatsApp] Logged out and session cleared');
    }

    /**
     * Clear auth state files
     */
    private clearAuthState(): void {
        try {
            if (fs.existsSync(this.authDir)) {
                fs.rmSync(this.authDir, { recursive: true, force: true });
                fs.mkdirSync(this.authDir, { recursive: true });
            }
        } catch (e) {
            console.error('[WhatsApp] Error clearing auth state:', e);
        }
    }

    /**
     * Format phone number for WhatsApp JID
     */
    private formatJid(phoneNumber: string): string {
        // Remove non-digits
        let phone = phoneNumber.replace(/\D/g, '');
        // Remove leading + if any
        if (phone.startsWith('+')) phone = phone.substring(1);
        // Ensure it ends with @s.whatsapp.net
        return `${phone}@s.whatsapp.net`;
    }

    /**
     * Send a text message
     */
    public async sendMessage(
        phoneNumber: string,
        message: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!phoneNumber) {
            return { success: false, error: 'Phone number not provided' };
        }

        if (this.status !== 'connected' || !this.socket) {
            return { success: false, error: 'WhatsApp not connected. Please scan QR code first.' };
        }

        try {
            const jid = this.formatJid(phoneNumber);
            console.log(`[WhatsApp] Sending message to ${jid}...`);

            await this.socket.sendMessage(jid, { text: message });
            console.log('✅ WhatsApp message sent');
            return { success: true };
        } catch (error: any) {
            console.error('[WhatsApp] Send error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send an image with caption
     */
    public async sendImage(
        phoneNumber: string,
        base64Image: string,
        caption: string,
        mimetype: string = 'image/png'
    ): Promise<{ success: boolean; error?: string }> {
        if (!phoneNumber) {
            return { success: false, error: 'Phone number not provided' };
        }

        if (this.status !== 'connected' || !this.socket) {
            return { success: false, error: 'WhatsApp not connected' };
        }

        try {
            const jid = this.formatJid(phoneNumber);
            console.log(`[WhatsApp] Sending image to ${jid}...`);

            // Convert base64 to buffer
            const imageBuffer = Buffer.from(base64Image, 'base64');

            await this.socket.sendMessage(jid, {
                image: imageBuffer,
                caption,
                mimetype: mimetype as any,
            });

            console.log('✅ WhatsApp image sent');
            return { success: true };
        } catch (error: any) {
            console.error('[WhatsApp] Send image error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check bot status (compatible with old API)
     */
    public async checkStatus(): Promise<{ ok: boolean; status?: string; error?: string }> {
        return {
            ok: this.status === 'connected',
            status: this.status,
        };
    }
}
