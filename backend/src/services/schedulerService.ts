import cron from 'node-cron';
import prisma from '../config/database';
import { TelegramService } from './telegramService';
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

        console.log('Scheduler started: Deadline Check (hourly), Auto-Sync (10 mins)');
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
                    telegramConfig: {
                        isActive: true
                    }
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
                if (!user.telegramConfig?.chatId) continue;
                const chatId = user.telegramConfig.chatId;

                for (const task of user.tasks) {
                    // Check if we already sent a notification recently (e.g., today)
                    const lastNotification = await prisma.notification.findFirst({
                        where: {
                            taskId: task.id,
                            type: 'telegram',
                            sentAt: {
                                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                            }
                        }
                    });

                    if (lastNotification) continue; // Already notified today

                    if (task.deadline) {
                        const timeText = formatDistanceToNow(new Date(task.deadline), { addSuffix: true });
                        const message = `⚠️ *Deadline Reminder* ⚠️\n\nTask: *${task.title}*\nDue: ${timeText}\n\nDon't forget to submit!`;

                        const botToken = user.telegramConfig.botToken;
                        const sent = await this.telegramService.sendMessage(chatId, message, botToken);

                        if (sent) {
                            await prisma.notification.create({
                                data: {
                                    taskId: task.id,
                                    message: message,
                                    type: 'telegram',
                                    isDelivered: true
                                }
                            });
                            console.log(`[Notification] Sent to ${user.email} for task ${task.id}`);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error in checkDeadlines:', error);
        }
    }
}
