/**
 * Admin Notification Service
 * Sends WhatsApp notifications to admin GROUP when system errors occur.
 * Throttled to prevent spam (max 1 per error type per 5 minutes).
 */

import prisma from '../config/database';
import { WhatsAppService } from './whatsappService';

const whatsappService = new WhatsAppService();

// Throttle map: errorType -> last sent timestamp
const throttleMap = new Map<string, number>();
const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export class AdminNotificationService {

    /**
     * Send error notification to admin WhatsApp group
     */
    static async sendErrorNotification(
        errorType: string,
        errorMessage: string,
        context?: string
    ): Promise<void> {
        try {
            // Check throttle
            const lastSent = throttleMap.get(errorType) || 0;
            const now = Date.now();
            if (now - lastSent < THROTTLE_MS) {
                console.log(`[AdminNotif] Throttled: ${errorType} (sent ${Math.round((now - lastSent) / 1000)}s ago)`);
                return;
            }

            // Check if error notification is enabled
            const enabledSetting = await prisma.adminSettings.findUnique({
                where: { key: 'error_notif_enabled' }
            });
            if (enabledSetting?.value !== 'true') {
                return;
            }

            // Get admin WhatsApp group ID (preferred) or phone number (fallback)
            const groupSetting = await prisma.adminSettings.findUnique({
                where: { key: 'admin_whatsapp_group' }
            });
            const phoneSetting = await prisma.adminSettings.findUnique({
                where: { key: 'admin_whatsapp' }
            });

            const groupId = groupSetting?.value;
            const phoneNumber = phoneSetting?.value;

            if (!groupId && !phoneNumber) {
                console.log('[AdminNotif] No admin WhatsApp group or phone configured');
                return;
            }

            // Build message
            const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
            const message = [
                `⚠️ *SPADA Error Alert*`,
                ``,
                `🕐 ${timestamp}`,
                `📋 Type: ${errorType}`,
                `❌ Error: ${errorMessage}`,
                context ? `📝 Context: ${context}` : '',
                ``,
                `_Auto-notification from SPADA Task Manager_`
            ].filter(Boolean).join('\n');

            // Send to group first, fallback to private chat
            let result;
            if (groupId) {
                result = await whatsappService.sendGroupMessage(groupId, message);
            } else {
                result = await whatsappService.sendMessage(phoneNumber!, message);
            }

            if (result.success) {
                throttleMap.set(errorType, now);
                console.log(`[AdminNotif] Sent ${errorType} alert to admin ${groupId ? 'group' : 'chat'}`);
            } else {
                console.error(`[AdminNotif] Failed to send: ${result.error}`);
            }
        } catch (e) {
            console.error('[AdminNotif] Error sending notification:', e);
        }
    }

    /**
     * Send test notification to verify setup (to group or phone)
     */
    static async sendTestNotification(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
        const message = [
            `✅ *SPADA Test Notification*`,
            ``,
            `Notifikasi error admin berhasil dikonfigurasi!`,
            `Kamu akan menerima pesan saat terjadi error di sistem.`,
            ``,
            `_${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}_`
        ].join('\n');

        // If it looks like a group ID (contains @g.us), send as group message
        if (phoneNumber.includes('@g.us')) {
            return await whatsappService.sendGroupMessage(phoneNumber, message);
        }
        return await whatsappService.sendMessage(phoneNumber, message);
    }
}
