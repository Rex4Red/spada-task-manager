import { Request, Response } from 'express';
import prisma from '../config/database';
import { telegramService } from '../app';

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
                telegramConfig: user.telegramConfig,
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

    try {
        const config = await prisma.telegramConfig.findUnique({ where: { userId } });

        if (!config || !config.chatId) {
            res.status(400).json({ message: 'Telegram Chat ID not configured' });
            return;
        }

        const success = await telegramService.sendMessage(
            config.chatId,
            '🔔 *Test Notification*\n\nThis is a test message from SPADA Task Manager. If you see this, your integration is working! 🚀',
            config.botToken
        );

        if (success) {
            res.json({ message: 'Test notification sent successfully' });
        } else {
            res.status(500).json({ message: 'Failed to send notification via Telegram' });
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
