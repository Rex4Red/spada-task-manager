import cron from 'node-cron';
import prisma from '../config/database';
import { TelegramService } from './telegramService';
import { AttendanceService } from './attendanceService';
import { ScraperService } from './scraperService';
import { saveCoursesToDb } from './courseService';
import { decrypt } from '../utils/encryption';
import { formatDistanceToNow } from 'date-fns';

export class SchedulerService {
    private telegramService: TelegramService;

    constructor(telegramService: TelegramService) {
        this.telegramService = telegramService;
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
            console.log('Running scheduled auto-sync...');
            await this.syncAllUsers();
        });

        // 3. Attendance Check: Every minute
        cron.schedule('* * * * *', async () => {
            await this.checkAttendanceSchedules();
        });

        console.log('Scheduler started: Deadline Check (hourly), Auto-Sync (10 mins), Attendance (every min)');
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
                                include: { telegramConfig: true }
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

            // Update lastRunAt
            await prisma.attendanceSchedule.update({
                where: { id: schedule.id },
                data: { lastRunAt: new Date() }
            });

            if (result.success || result.status === 'SUCCESS') {
                // Success! Calculate next week's run
                const nextRun = this.calculateNextRun(schedule);
                await prisma.attendanceSchedule.update({
                    where: { id: schedule.id },
                    data: { nextRunAt: nextRun }
                });
                console.log(`[Attendance] ✅ Success for ${schedule.course.name}`);
            } else if (result.status === 'NOT_AVAILABLE' && attemptNumber < schedule.maxRetries) {
                // Schedule retry
                const retryTime = new Date(Date.now() + schedule.retryIntervalMinutes * 60 * 1000);
                await prisma.attendanceSchedule.update({
                    where: { id: schedule.id },
                    data: { nextRunAt: retryTime }
                });
                console.log(`[Attendance] Retry scheduled for ${schedule.course.name} at ${retryTime.toISOString()}`);
            } else {
                // Max retries reached or failed permanently
                const nextRun = this.calculateNextRun(schedule);
                await prisma.attendanceSchedule.update({
                    where: { id: schedule.id },
                    data: { nextRunAt: nextRun }
                });
                console.log(`[Attendance] ❌ Failed/exhausted retries for ${schedule.course.name}`);
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
     */
    private calculateNextRun(schedule: any): Date {
        const now = new Date();

        if (schedule.scheduleType === 'SIMPLE' && schedule.dayOfWeek !== null && schedule.timeOfDay) {
            const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);
            const targetDate = new Date(now);

            // Find next occurrence of the target day (next week)
            let daysUntilTarget = schedule.dayOfWeek - now.getDay();
            if (daysUntilTarget <= 0) daysUntilTarget += 7;

            targetDate.setDate(now.getDate() + daysUntilTarget);
            targetDate.setHours(hours, minutes, 0, 0);
            return targetDate;
        }

        // Default: next week same time
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    private async syncAllUsers() {
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
                        // FIX: Only sync courses that the user has added to the DB
                        const savedCourses = await prisma.course.findMany({
                            where: { userId: user.id }
                        });

                        console.log(`[Auto-Sync] Syncing ${savedCourses.length} saved courses for user: ${user.email}`);

                        const coursesWithAssignments = [];

                        // Iterate saved courses and scrape assignments
                        for (const course of savedCourses) {
                            // Basic throttle
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
                    await scraper.close();
                }
            }
        } catch (error) {
            console.error('[Auto-Sync] Global error in syncAllUsers:', error);
        }
    }

    private async checkDeadlines() {
        try {
            // 1. Get users with active Telegram config
            const users = await prisma.user.findMany({
                where: {
                    telegramConfig: { isActive: true }
                },
                include: {
                    telegramConfig: true,
                    notificationSettings: true,
                    tasks: {
                        where: {
                            status: { not: 'COMPLETED' },
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
                }
            }

        } catch (error) {
            console.error('Error in checkDeadlines:', error);
        }
    }
}

