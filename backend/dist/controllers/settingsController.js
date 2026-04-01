"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testWhatsAppNotification = exports.updateWhatsAppSettings = exports.testDiscordNotification = exports.updateDiscordSettings = exports.updateSpadaSettings = exports.testTelegramNotification = exports.getSettings = exports.updateTelegramSettings = void 0;
const database_1 = __importDefault(require("../config/database"));
const app_1 = require("../app");
const updateTelegramSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const { chatId, botToken, isActive } = req.body;
    try {
        const config = yield database_1.default.telegramConfig.upsert({
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
                isActive: isActive !== null && isActive !== void 0 ? isActive : true
            }
        });
        res.json({ message: 'Telegram settings updated', data: config });
    }
    catch (error) {
        console.error('Error updating Telegram settings:', error);
        res.status(500).json({ message: 'Failed to update settings' });
    }
});
exports.updateTelegramSettings = updateTelegramSettings;
const getSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    try {
        const user = yield database_1.default.user.findUnique({
            where: { id: userId },
            include: {
                telegramConfig: true,
                discordConfig: true,
                whatsappConfig: true,
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
                whatsappConfig: user.whatsappConfig,
                notificationSettings: user.notificationSettings
            }
        });
    }
    catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Failed to fetch settings' });
    }
});
exports.getSettings = getSettings;
const testTelegramNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    // Prefer values from request body (for testing before saving), otherwise fetch from DB
    const { chatId: bodyChatId, botToken: bodyBotToken } = req.body;
    try {
        let targetChatId = bodyChatId;
        let targetBotToken = bodyBotToken;
        if (!targetChatId) {
            const config = yield database_1.default.telegramConfig.findUnique({ where: { userId } });
            if (!config || !config.chatId) {
                res.status(400).json({ message: 'Telegram Chat ID not provided and not configured' });
                return;
            }
            targetChatId = config.chatId;
            targetBotToken = targetBotToken || config.botToken;
        }
        const result = yield app_1.telegramService.sendMessage(targetChatId, '🔔 *Test Notification*\n\nThis is a test message from SPADA Task Manager. If you see this, your integration is working! 🚀', targetBotToken);
        if (result.success) {
            res.json({ message: 'Test notification sent successfully' });
        }
        else {
            res.status(500).json({ message: `Failed: ${result.error}` });
        }
    }
    catch (error) {
        console.error('Error testing notification:', error);
        res.status(500).json({ message: 'Error testing notification' });
    }
});
exports.testTelegramNotification = testTelegramNotification;
const updateSpadaSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({ message: 'Username and password are required' });
        return;
    }
    try {
        const { encrypt } = require('../utils/encryption');
        const encryptedPassword = encrypt(password);
        yield database_1.default.user.update({
            where: { id: userId },
            data: {
                spadaUsername: username,
                spadaPassword: encryptedPassword
            }
        });
        res.json({ message: 'SPADA credentials updated successfully' });
    }
    catch (error) {
        console.error('Error updating SPADA settings:', error);
        res.status(500).json({ message: 'Failed to update SPADA settings' });
    }
});
exports.updateSpadaSettings = updateSpadaSettings;
// Discord Settings
const updateDiscordSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const { webhookUrl, isActive } = req.body;
    if (!webhookUrl) {
        res.status(400).json({ message: 'Webhook URL is required' });
        return;
    }
    try {
        const config = yield database_1.default.discordConfig.upsert({
            where: { userId },
            update: {
                webhookUrl,
                isActive: isActive !== null && isActive !== void 0 ? isActive : true
            },
            create: {
                userId,
                webhookUrl,
                isActive: isActive !== null && isActive !== void 0 ? isActive : true
            }
        });
        res.json({ message: 'Discord settings updated', data: config });
    }
    catch (error) {
        console.error('Error updating Discord settings:', error);
        res.status(500).json({ message: 'Failed to update Discord settings' });
    }
});
exports.updateDiscordSettings = updateDiscordSettings;
const testDiscordNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const { webhookUrl: bodyWebhookUrl } = req.body || {};
    try {
        let targetWebhookUrl = bodyWebhookUrl;
        if (!targetWebhookUrl) {
            const config = yield database_1.default.discordConfig.findUnique({ where: { userId } });
            if (!config || !config.webhookUrl) {
                res.status(400).json({ message: 'Discord Webhook URL not provided and not configured' });
                return;
            }
            targetWebhookUrl = config.webhookUrl;
        }
        const result = yield app_1.discordService.sendEmbed(targetWebhookUrl, {
            title: '🔔 Test Notification',
            description: 'This is a test message from **SPADA Task Manager**.\n\nIf you see this, your Discord integration is working! 🚀',
            color: 0x5865F2, // Discord blurple
            footer: { text: 'SPADA Task Manager' },
            timestamp: new Date().toISOString()
        });
        if (result.success) {
            res.json({ message: 'Test notification sent to Discord!' });
        }
        else {
            res.status(500).json({ message: `Failed: ${result.error}` });
        }
    }
    catch (error) {
        console.error('Error testing Discord notification:', error);
        res.status(500).json({ message: 'Error testing Discord notification' });
    }
});
exports.testDiscordNotification = testDiscordNotification;
// WhatsApp Settings
const updateWhatsAppSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const { phoneNumber, isActive } = req.body;
    if (!phoneNumber) {
        res.status(400).json({ message: 'Phone number is required' });
        return;
    }
    // Normalize phone number (remove + and spaces, keep only digits)
    const normalizedPhone = phoneNumber.replace(/[+\s-]/g, '');
    try {
        const config = yield database_1.default.whatsAppConfig.upsert({
            where: { userId },
            update: {
                phoneNumber: normalizedPhone,
                isActive: isActive !== null && isActive !== void 0 ? isActive : true
            },
            create: {
                userId,
                phoneNumber: normalizedPhone,
                isActive: isActive !== null && isActive !== void 0 ? isActive : true
            }
        });
        res.json({ message: 'WhatsApp settings updated', data: config });
    }
    catch (error) {
        console.error('Error updating WhatsApp settings:', error);
        res.status(500).json({ message: 'Failed to update WhatsApp settings' });
    }
});
exports.updateWhatsAppSettings = updateWhatsAppSettings;
const testWhatsAppNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const { phoneNumber: bodyPhoneNumber } = req.body || {};
    try {
        let targetPhoneNumber = bodyPhoneNumber;
        if (!targetPhoneNumber) {
            const config = yield database_1.default.whatsAppConfig.findUnique({ where: { userId } });
            if (!config || !config.phoneNumber) {
                res.status(400).json({ message: 'WhatsApp phone number not provided and not configured' });
                return;
            }
            targetPhoneNumber = config.phoneNumber;
        }
        const result = yield app_1.whatsappService.sendMessage(targetPhoneNumber, '🔔 *Test Notification*\n\nThis is a test message from SPADA Task Manager. If you see this, your WhatsApp integration is working! 🚀');
        if (result.success) {
            res.json({ message: 'Test notification sent to WhatsApp!' });
        }
        else {
            res.status(500).json({ message: `Failed: ${result.error}` });
        }
    }
    catch (error) {
        console.error('Error testing WhatsApp notification:', error);
        res.status(500).json({ message: 'Error testing WhatsApp notification' });
    }
});
exports.testWhatsAppNotification = testWhatsAppNotification;
