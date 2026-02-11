import cron from 'node-cron';
import prisma from '../config/database';
import { TelegramService } from './telegramService';
import { DiscordService, DiscordColors } from './discordService';
import { WhatsAppService } from './whatsappService';
import { AttendanceService } from './attendanceService';
import { ScraperService } from './scraperService';
import { saveCoursesToDb } from './courseService';
import { decrypt } from '../utils/encryption';
import { formatDistanceToNow } from 'date-fns';

export class SchedulerService {
    private telegramService: TelegramService;
    private discordService: DiscordService;
    private whatsappService: WhatsAppService;
    private isSyncing = false;

    constructor(telegramService: TelegramService, discordService?: DiscordService, whatsappService?: WhatsAppService) {
        this.telegramService = telegramService;
        this.discordService = discordService || new DiscordService();
        this.whatsappService = whatsappService || new WhatsAppService();
    }

    public init() {
        console.log('Initializing Scheduler Service...');

        // 1. Deadline Check: Every hour at minute 0
        cron.schedule('0 * * * *', async () => {
            console.log('Running scheduled deadline check...');
            await this.checkDeadlines();
        });

        // 2. Auto-Sync: Every 30 minutes (reduced from 10 to prevent resource exhaustion)
        cron.schedule('*/30 * * * *', async () => {
            console.log('Running scheduled auto-sync...');
            await this.syncAllUsers();
        });

        // 3. Attendance Check: Every minute
        cron.schedule('* * * * *', async () => {
            if (!this.isSyncing) {
                await this.checkAttendanceSchedules();
            }
        });

        // 4. WhatsApp Bot Keep-Alive: Every 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            await this.pingWhatsAppBot();
        });

        console.log('Scheduler started: Deadline Check (hourly), Auto-Sync (30 mins), Attendance (every min), WhatsApp Keep-Alive (5 mins)');
    }

    /**
     * Ping WhatsApp bot to keep it alive on Koyeb free tier
     */
    private async pingWhatsAppBot() {
        const botUrl = process.env.WHATSAPP_BOT_URL || 'https://very-ardith-bot-wa-absen-spada-69b791b2.koyeb.app';

        try {
            const response = await fetch(`${botUrl}/status`, {
                method: 'GET',
                headers: {
                    'X-API-Key': process.env.WHATSAPP_API_KEY || '123230161'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`[WhatsApp Keep-Alive] Bot status: ${data.status || 'connected'}`);
            } else {
                console.log(`[WhatsApp Keep-Alive] Ping response: ${response.status}`);
            }
        } catch (error: any) {
            console.log(`[WhatsApp Keep-Alive] Ping failed: ${error.message}`);
        }
    }

    /**
     * Check and run attendance schedules
     */
    private async checkAttendanceSchedules() {
        try {
            const now = new Date();

            // Find schedules that are due
            const dueSchedules = await prisma.attendanceSchedule.findMany({
                where: {
                    isActive: true,
                    nextRunAt: { lte: now }
                },
                include: {
                    course: {
                        include: {
                            user: {
                                include: {
                                    telegramConfig: true,
                                    discordConfig: true,
                                    whatsappConfig: true
                                }
                            }
                        }
                    }
                }
            });

            if (dueSchedules.length === 0) return;

            console.log(`[Attendance Scheduler] Found ${dueSchedules.length} due schedules`);

            for (const schedule of dueSchedules) {
                const user = schedule.course.user;
                if (!user.spadaUsername || !user.spadaPassword) {
                    console.log(`[Attendance] Skipping ${schedule.course.name}: No SPADA credentials`);
                    continue;
                }

                // Run attendance attempt
                await this.runAttendanceWithRetry(schedule, user, 1);
            }
        } catch (error) {
            console.error('[Attendance Scheduler] Error:', error);
        }
    }

    /**
     * Run attendance with retry logic
     */
    private async runAttendanceWithRetry(
        schedule: any,
        user: any,
        attemptNumber: number
    ) {
        const attendanceService = new AttendanceService();

        try {
            console.log(`[Attendance] Running for ${schedule.course.name} (attempt ${attemptNumber}/${schedule.maxRetries})`);

            const decryptedPassword = decrypt(user.spadaPassword);
            const result = await attendanceService.runAttendance(
                schedule.course.url,
                user.spadaUsername,
                decryptedPassword
            );

            // Log the attempt
            await prisma.attendanceLog.create({
                data: {
                    scheduleId: schedule.id,
                    attemptNumber,
                    status: result.status,
                    message: result.message,
                    screenshotUrl: result.screenshotPath
                }
            });

            // Send Telegram notification
            if (user.telegramConfig?.isActive && user.telegramConfig?.chatId) {
                const botToken = schedule.useSeparateTelegram && schedule.customBotToken
                    ? schedule.customBotToken
                    : user.telegramConfig.botToken;

                await attendanceService.sendNotification(
                    this.telegramService,
                    user.telegramConfig.chatId,
                    botToken,
                    schedule.course.name,
                    result
                );
            }

            // Send Discord notification
            if (user.discordConfig?.isActive && user.discordConfig?.webhookUrl) {
                await attendanceService.sendDiscordNotification(
                    this.discordService,
                    user.discordConfig.webhookUrl,
                    schedule.course.name,
                    result
                );
            }

            // Send WhatsApp notification
            if (user.whatsappConfig?.isActive && user.whatsappConfig?.phoneNumber) {
                await attendanceService.sendWhatsAppNotification(
                    this.whatsappService,
                    user.whatsappConfig.phoneNumber,
                    schedule.course.name,
                    result
                );
            }

            // Update lastRunAt
            await prisma.attendanceSchedule.update({
                where: { id: schedule.id },
                data: { lastRunAt: new Date() }
            });

            // Always calculate next week's run (no retry)
            const nextRun = this.calculateNextRun(schedule);
            await prisma.attendanceSchedule.update({
                where: { id: schedule.id },
                data: { nextRunAt: nextRun }
            });

            if (result.success || result.status === 'SUCCESS') {
                console.log(`[Attendance] ✅ Success for ${schedule.course.name}`);
            } else {
                console.log(`[Attendance] ⏭️ Skipped to next week for ${schedule.course.name} (${result.status})`);
            }

        } catch (error) {
            console.error(`[Attendance] Error for ${schedule.course.name}:`, error);

            // Log the error
            await prisma.attendanceLog.create({
                data: {
                    scheduleId: schedule.id,
                    attemptNumber,
                    status: 'ERROR',
                    message: `Error: ${error}`
                }
            });
        }
    }

    /**
     * Calculate next run time for a schedule
     * Uses WIB timezone (UTC+7) for Indonesia
     */
    private calculateNextRun(schedule: any): Date {
        // WIB offset in milliseconds (UTC+7)
        const WIB_OFFSET = 7 * 60 * 60 * 1000;

        if (schedule.scheduleType === 'SIMPLE' && schedule.dayOfWeek !== null && schedule.timeOfDay) {
            const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);

            // Get current time in WIB
            const nowUTC = new Date();
            const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET);

            // Find next occurrence of the target day (next week)
            let daysUntilTarget = schedule.dayOfWeek - nowWIB.getUTCDay();
            if (daysUntilTarget <= 0) daysUntilTarget += 7;

            // Create target date in WIB
            const targetWIB = new Date(nowWIB);
            targetWIB.setUTCDate(nowWIB.getUTCDate() + daysUntilTarget);
            targetWIB.setUTCHours(hours, minutes, 0, 0);

            // Convert back to UTC for storage
            return new Date(targetWIB.getTime() - WIB_OFFSET);
        }

        // Default: next week same time
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }



    private async syncAllUsers() {
        // Prevent overlapping syncs
        if (this.isSyncing) {
            console.log('[Auto-Sync] Sync already in progress, skipping...');
            return;
        }

        this.isSyncing = true;
        try {
            // Find users with SPADA credentials
            const users = await prisma.user.findMany({
                where: {
                    spadaUsername: { not: null },
                    spadaPassword: { not: null }
                }
            });

            console.log(`[Auto-Sync] Found ${users.length} users enabled for auto-sync.`);

            for (const user of users) {
                if (!user.spadaUsername || !user.spadaPassword) continue;

                console.log(`[Auto-Sync] Syncing data for user: ${user.email}`);
                const scraper = new ScraperService();

                try {
                    const decryptedPassword = decrypt(user.spadaPassword);
                    const loggedIn = await scraper.login(user.spadaUsername, decryptedPassword);

                    if (loggedIn) {
                        // Only sync courses that the user has added to the DB
                        const savedCourses = await prisma.course.findMany({
                            where: { userId: user.id }
                        });

                        console.log(`[Auto-Sync] Syncing ${savedCourses.length} saved courses for user: ${user.email}`);

                        const coursesWithAssignments = [];

                        // Iterate saved courses and scrape assignments
                        for (const course of savedCourses) {
                            // Throttle between courses
                            await new Promise(r => setTimeout(r, 2000));
                            console.log(`[Auto-Sync] Scraping assignments for course: ${course.name} (${course.sourceId})`);

                            try {
                                const assignments = await scraper.scrapeAssignments(course.sourceId);
                                coursesWithAssignments.push({
                                    id: course.sourceId,
                                    name: course.name,
                                    url: course.url,
                                    assignments
                                });
                            } catch (err) {
                                console.error(`[Auto-Sync] Failed to scrape course ${course.id}:`, err);
                            }
                        }

                        // Save using shared service
                        await saveCoursesToDb(user.id, coursesWithAssignments);
                        console.log(`[Auto-Sync] Sync complete for user: ${user.email}`);
                    } else {
                        console.error(`[Auto-Sync] Login failed for user: ${user.email}`);
                    }
                } catch (error) {
                    console.error(`[Auto-Sync] Error syncing user ${user.email}:`, error);
                } finally {
                    // Ensure browser is closed before moving to next user
                    await scraper.close();
                    // Wait 5 seconds between users to let processes fully terminate
                    await new Promise(r => setTimeout(r, 5000));
                }
            }
        } catch (error) {
            console.error('[Auto-Sync] Global error in syncAllUsers:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async checkDeadlines() {
        try {
            // 1. Get users with active Telegram or Discord config
            const users = await prisma.user.findMany({
                where: {
                    OR: [
                        { telegramConfig: { isActive: true } },
                        { discordConfig: { isActive: true } }
                    ]
                },
                include: {
                    telegramConfig: true,
                    discordConfig: true,
                    notificationSettings: true,
                    tasks: {
                        where: {
                            status: { not: 'COMPLETED' },
                            isDeleted: false,
                            deadline: {
                                gte: new Date(),
                                lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // Next 3 days
                            }
                        }
                    }
                }
            });

            for (const user of users) {
                for (const task of user.tasks) {
                    if (!task.deadline) continue;

                    const timeText = formatDistanceToNow(new Date(task.deadline), { addSuffix: true });
                    const message = `⚠️ Deadline Reminder ⚠️\n\nTask: ${task.title}\nDue: ${timeText}\n\nDon't forget to submit!`;

                    // Send Telegram notification
                    if (user.telegramConfig?.isActive && user.telegramConfig?.chatId) {
                        const lastTelegramNotif = await prisma.notification.findFirst({
                            where: {
                                taskId: task.id,
                                type: 'telegram',
                                sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                            }
                        });

                        if (!lastTelegramNotif) {
                            const sent = await this.telegramService.sendMessage(
                                user.telegramConfig.chatId,
                                message,
                                user.telegramConfig.botToken
                            );
                            if (sent.success) {
                                await prisma.notification.create({
                                    data: { taskId: task.id, message, type: 'telegram', isDelivered: true }
                                });
                                console.log(`[Notification] Telegram sent to ${user.email} for task ${task.id}`);
                            }
                        }
                    }

                    // Send Discord notification
                    if (user.discordConfig?.isActive && user.discordConfig?.webhookUrl) {
                        const lastDiscordNotif = await prisma.notification.findFirst({
                            where: {
                                taskId: task.id,
                                type: 'discord',
                                sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                            }
                        });

                        if (!lastDiscordNotif) {
                            const sent = await this.discordService.sendEmbed(user.discordConfig.webhookUrl, {
                                title: '⚠️ Deadline Reminder',
                                description: `**${task.title}**`,
                                color: DiscordColors.WARNING,
                                fields: [
                                    { name: '⏰ Due', value: timeText, inline: true }
                                ],
                                footer: { text: "Don't forget to submit!" },
                                timestamp: new Date().toISOString()
                            });
                            if (sent.success) {
                                await prisma.notification.create({
                                    data: { taskId: task.id, message, type: 'discord', isDelivered: true }
                                });
                                console.log(`[Notification] Discord sent to ${user.email} for task ${task.id}`);
                            }
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error in checkDeadlines:', error);
        }
    }
}
