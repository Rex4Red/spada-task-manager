import cron from 'node-cron';
import prisma from '../config/database';
import { TelegramService } from './telegramService';
import { DiscordService, DiscordColors } from './discordService';
import { WhatsAppService } from './whatsappService';
import { AttendanceService } from './attendanceService';
import { SpadaApiService } from './spadaApiService';
import { saveCoursesToDb } from './courseService';
import { decrypt } from '../utils/encryption';
import { formatDistanceToNow } from 'date-fns';
import { AdminNotificationService } from './adminNotificationService';

export class SchedulerService {
    private telegramService: TelegramService;
    private discordService: DiscordService;
    private whatsappService: WhatsAppService;
    private isSyncing = false;
    private isAttending = false;
    private lastSyncIndex = 0;

    constructor(telegramService: TelegramService, discordService?: DiscordService, whatsappService?: WhatsAppService) {
        this.telegramService = telegramService;
        this.discordService = discordService || new DiscordService();
        this.whatsappService = whatsappService || new WhatsAppService();
    }

    /** Check if any browser operation is in progress */
    private get isBrowserBusy(): boolean {
        return this.isSyncing || this.isAttending;
    }

    public init() {
        console.log('Initializing Scheduler Service...');

        // 1. Deadline Check: Every hour at minute 0
        cron.schedule('0 * * * *', async () => {
            console.log('Running scheduled deadline check...');
            await this.checkDeadlines();
        });

        // 2. Auto-Sync: Every 10 minutes
        cron.schedule('*/10 * * * *', async () => {
            if (this.isAttending) {
                console.log('[Auto-Sync] Attendance in progress, skipping sync...');
                return;
            }
            console.log('Running scheduled auto-sync...');
            await this.syncAllUsers();
        });

        // 3. Attendance Check: Every minute
        cron.schedule('* * * * *', async () => {
            if (!this.isBrowserBusy) {
                await this.checkAttendanceSchedules();
            }
        });

        console.log('Scheduler started: Deadline Check (hourly), Auto-Sync (10 mins), Attendance (every min)');
    }

    /**
     * Kill zombie Chrome processes using Node.js native APIs (no fork needed).
     * This works even when the system is out of process slots.
     */
    private async killZombieChrome() {
        // Never kill Chrome while attendance is running!
        if (this.isAttending) {
            console.log('[Cleanup] Skipping Chrome cleanup - attendance in progress');
            return;
        }

        const fs = require('fs');
        const path = require('path');
        let killed = 0;

        try {
            // Read /proc to find Chrome/Chromium processes without forking
            const procDir = '/proc';
            if (!fs.existsSync(procDir)) return; // Not Linux

            const entries = fs.readdirSync(procDir);

            for (const entry of entries) {
                // Only process numeric directories (PIDs)
                if (!/^\d+$/.test(entry)) continue;
                // Don't kill our own process
                if (parseInt(entry) === process.pid) continue;

                try {
                    const cmdlinePath = path.join(procDir, entry, 'cmdline');
                    if (!fs.existsSync(cmdlinePath)) continue;

                    const cmdline = fs.readFileSync(cmdlinePath, 'utf8').toLowerCase();

                    // Check if this is a Chrome/Chromium related process
                    if (cmdline.includes('chrome') || cmdline.includes('chromium') ||
                        cmdline.includes('headless_shell') || cmdline.includes('type=renderer') ||
                        cmdline.includes('type=gpu') || cmdline.includes('type=utility') ||
                        cmdline.includes('type=zygote')) {

                        const pid = parseInt(entry);
                        try {
                            process.kill(pid, 'SIGKILL');
                            killed++;
                        } catch (killErr: any) {
                            // ESRCH = process already dead, ignore
                            if (killErr.code !== 'ESRCH') {
                                // EPERM = no permission, ignore
                            }
                        }
                    }
                } catch (readErr) {
                    // Process may have exited between readdir and readFile, ignore
                }
            }

            if (killed > 0) {
                console.log(`[Cleanup] Killed ${killed} Chrome zombie processes (native)`);
            }
        } catch (e) {
            console.error('[Cleanup] Error scanning /proc:', e);
        }

        // Clean up Chrome temp files using Node.js fs (no fork needed)
        try {
            const tmpDirs = ['/tmp', '/dev/shm'];
            for (const dir of tmpDirs) {
                if (!fs.existsSync(dir)) continue;
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    if (item.startsWith('.org.chromium.') || item.startsWith('puppeteer_dev_') ||
                        item.startsWith('chrome_crashpad') || item.startsWith('shm-')) {
                        try {
                            fs.rmSync(path.join(dir, item), { recursive: true, force: true });
                        } catch (e) { }
                    }
                }
            }
        } catch (e) { }

        // Wait for OS to reclaim resources
        await new Promise(r => setTimeout(r, 2000));
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

            // Set attending flag to block sync/cleanup
            this.isAttending = true;
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
        } finally {
            this.isAttending = false;
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

            if (users.length === 0) return;

            // Sync ALL users per cycle (API is lightweight, no Chrome needed)
            const MAX_USERS_PER_CYCLE = 5;
            const startIdx = this.lastSyncIndex % users.length;
            const usersToSync = [];
            for (let i = 0; i < Math.min(MAX_USERS_PER_CYCLE, users.length); i++) {
                usersToSync.push(users[(startIdx + i) % users.length]);
            }
            this.lastSyncIndex = (startIdx + usersToSync.length) % users.length;

            console.log(`[Auto-Sync] Syncing ${usersToSync.length}/${users.length} users via API (batch starting at index ${startIdx})`);

            let consecutiveFailures = 0;

            for (const user of usersToSync) {
                if (!user.spadaUsername || !user.spadaPassword) continue;

                if (consecutiveFailures >= 3) {
                    console.log('[Auto-Sync] Too many consecutive API failures, stopping this cycle');
                    AdminNotificationService.sendErrorNotification(
                        'API_CONSECUTIVE_FAILURES',
                        'Too many consecutive API failures, sync cycle stopped',
                        `Failed at user batch starting index ${startIdx}`
                    );
                    break;
                }

                console.log(`[Auto-Sync] Syncing data for user: ${user.email}`);
                const api = new SpadaApiService();

                try {
                    const decryptedPassword = decrypt(user.spadaPassword);
                    const loggedIn = await api.login(user.spadaUsername, decryptedPassword);

                    if (loggedIn) {
                        consecutiveFailures = 0;

                        // Only sync courses that the user has added to the DB (exclude deleted ones)
                        const savedCourses = await prisma.course.findMany({
                            where: { userId: user.id, isDeleted: false }
                        });

                        console.log(`[Auto-Sync] Syncing ${savedCourses.length} saved courses for user: ${user.email}`);

                        const coursesWithAssignments = [];

                        for (const course of savedCourses) {
                            console.log(`[Auto-Sync] Fetching assignments for course: ${course.name} (${course.sourceId})`);

                            try {
                                const assignments = await api.getAssignments(course.sourceId);
                                coursesWithAssignments.push({
                                    id: course.sourceId,
                                    name: course.name,
                                    url: course.url,
                                    assignments
                                });
                            } catch (err) {
                                console.error(`[Auto-Sync] Failed to fetch course ${course.id}:`, err);
                            }
                        }

                        // Save using shared service
                        await saveCoursesToDb(user.id, coursesWithAssignments);
                        console.log(`[Auto-Sync] Sync complete for user: ${user.email}`);
                    } else {
                        console.error(`[Auto-Sync] Login failed for user: ${user.email}`);
                        consecutiveFailures++;
                        AdminNotificationService.sendErrorNotification(
                            'SYNC_LOGIN_FAILED',
                            `Login failed for user: ${user.email}`,
                            `Consecutive failures: ${consecutiveFailures}`
                        );
                    }
                } catch (error: any) {
                    console.error(`[Auto-Sync] Error syncing user ${user.email}:`, error.message || error);
                    consecutiveFailures++;
                    AdminNotificationService.sendErrorNotification(
                        'SYNC_ERROR',
                        error.message || String(error),
                        `User: ${user.email}`
                    );
                }
                // Small delay between users to be polite to the API
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (error: any) {
            console.error('[Auto-Sync] Global error in syncAllUsers:', error);
            AdminNotificationService.sendErrorNotification(
                'SYNC_GLOBAL_ERROR',
                error.message || String(error),
                'Global error in syncAllUsers'
            );
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
