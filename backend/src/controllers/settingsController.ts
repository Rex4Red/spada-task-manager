import { Request, Response } from 'express';
import prisma from '../config/database';
import { telegramService, discordService } from '../app';

export const updateTelegramSettings = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { chatId, botToken, isActive } = req.body;

    try {
        const config = await prisma.telegramConfig.upsert({
            where: { userId },
            update: {
                chatId,
                botToken: botToken || '',
                isActive
            },
            create: {
                userId,
                chatId,
                botToken: botToken || '',
                isActive: isActive ?? true
            }
        });

        res.json({ message: 'Telegram settings updated', data: config });
    } catch (error) {
        console.error('Error updating Telegram settings:', error);
        res.status(500).json({ message: 'Failed to update settings' });
    }
};

export const getSettings = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                telegramConfig: true,
                discordConfig: true,
                notificationSettings: true
            }
        });

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        res.json({
            data: {
                name: user.name,
                email: user.email,
                spadaUsername: user.spadaUsername,
                hasStoredPassword: !!user.spadaPassword,
                telegramConfig: user.telegramConfig,
                discordConfig: user.discordConfig,
                notificationSettings: user.notificationSettings
            }
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Failed to fetch settings' });
    }
}

export const testTelegramNotification = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    // Prefer values from request body (for testing before saving), otherwise fetch from DB
    const { chatId: bodyChatId, botToken: bodyBotToken } = req.body;

    try {
        let targetChatId = bodyChatId;
        let targetBotToken = bodyBotToken;

        if (!targetChatId) {
            const config = await prisma.telegramConfig.findUnique({ where: { userId } });
            if (!config || !config.chatId) {
                res.status(400).json({ message: 'Telegram Chat ID not provided and not configured' });
                return;
            }
            targetChatId = config.chatId;
            targetBotToken = targetBotToken || config.botToken;
        }

        const result = await telegramService.sendMessage(
            targetChatId,
            '🔔 *Test Notification*\n\nThis is a test message from SPADA Task Manager. If you see this, your integration is working! 🚀',
            targetBotToken
        );

        if (result.success) {
            res.json({ message: 'Test notification sent successfully' });
        } else {
            res.status(500).json({ message: `Failed: ${result.error}` });
        }

    } catch (error) {
        console.error('Error testing notification:', error);
        res.status(500).json({ message: 'Error testing notification' });
    }
};

export const updateSpadaSettings = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ message: 'Username and password are required' });
        return;
    }

    try {
        const { encrypt } = require('../utils/encryption');
        const encryptedPassword = encrypt(password);

        await prisma.user.update({
            where: { id: userId },
            data: {
                spadaUsername: username,
                spadaPassword: encryptedPassword
            }
        });

        res.json({ message: 'SPADA credentials updated successfully' });
    } catch (error) {
        console.error('Error updating SPADA settings:', error);
        res.status(500).json({ message: 'Failed to update SPADA settings' });
    }
};

// Discord Settings
export const updateDiscordSettings = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { webhookUrl, isActive } = req.body;

    if (!webhookUrl) {
        res.status(400).json({ message: 'Webhook URL is required' });
        return;
    }

    try {
        const config = await prisma.discordConfig.upsert({
            where: { userId },
            update: {
                webhookUrl,
                isActive: isActive ?? true
            },
            create: {
                userId,
                webhookUrl,
                isActive: isActive ?? true
            }
        });

        res.json({ message: 'Discord settings updated', data: config });
    } catch (error) {
        console.error('Error updating Discord settings:', error);
        res.status(500).json({ message: 'Failed to update Discord settings' });
    }
};

export const testDiscordNotification = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { webhookUrl: bodyWebhookUrl } = req.body || {};

    try {
        let targetWebhookUrl = bodyWebhookUrl;

        if (!targetWebhookUrl) {
            const config = await prisma.discordConfig.findUnique({ where: { userId } });
            if (!config || !config.webhookUrl) {
                res.status(400).json({ message: 'Discord Webhook URL not provided and not configured' });
                return;
            }
            targetWebhookUrl = config.webhookUrl;
        }

        const result = await discordService.sendEmbed(targetWebhookUrl, {
            title: '🔔 Test Notification',
            description: 'This is a test message from **SPADA Task Manager**.\n\nIf you see this, your Discord integration is working! 🚀',
            color: 0x5865F2, // Discord blurple
            footer: { text: 'SPADA Task Manager' },
            timestamp: new Date().toISOString()
        });

        if (result.success) {
            res.json({ message: 'Test notification sent to Discord!' });
        } else {
            res.status(500).json({ message: `Failed: ${result.error}` });
        }
    } catch (error) {
        console.error('Error testing Discord notification:', error);
        res.status(500).json({ message: 'Error testing Discord notification' });
    }
};
