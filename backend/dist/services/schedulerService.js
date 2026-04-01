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
exports.SchedulerService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = __importDefault(require("../config/database"));
const discordService_1 = require("./discordService");
const whatsappService_1 = require("./whatsappService");
const attendanceService_1 = require("./attendanceService");
const scraperService_1 = require("./scraperService");
const courseService_1 = require("./courseService");
const encryption_1 = require("../utils/encryption");
const date_fns_1 = require("date-fns");
class SchedulerService {
    constructor(telegramService, discordService, whatsappService) {
        this.isSyncing = false;
        this.isCheckingAttendance = false;
        this.lastSyncIndex = 0;
        this.telegramService = telegramService;
        this.discordService = discordService || new discordService_1.DiscordService();
        this.whatsappService = whatsappService || new whatsappService_1.WhatsAppService();
    }
    init() {
        console.log('Initializing Scheduler Service...');
        // 1. Deadline Check: Every hour at minute 0
        node_cron_1.default.schedule('0 * * * *', () => __awaiter(this, void 0, void 0, function* () {
            console.log('Running scheduled deadline check...');
            yield this.checkDeadlines();
        }));
        // 2. Auto-Sync: Every 10 minutes
        node_cron_1.default.schedule('*/10 * * * *', () => __awaiter(this, void 0, void 0, function* () {
            console.log('Running scheduled auto-sync...');
            yield this.syncAllUsers();
        }));
        // 3. Attendance Check: Every minute
        node_cron_1.default.schedule('* * * * *', () => __awaiter(this, void 0, void 0, function* () {
            if (!this.isSyncing && !this.isCheckingAttendance) {
                yield this.checkAttendanceSchedules();
            }
        }));
        console.log('Scheduler started: Deadline Check (hourly), Auto-Sync (10 mins), Attendance (every min)');
    }
    /**
     * Kill zombie Chrome processes to prevent resource exhaustion
     */
    killZombieChrome() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { execSync } = require('child_process');
                execSync('pkill -9 -f chrome 2>/dev/null || true', { timeout: 5000 });
                yield new Promise(r => setTimeout(r, 2000));
            }
            catch (e) {
                // Ignore - no Chrome processes to kill
            }
        });
    }
    /**
     * Check and run attendance schedules
     */
    checkAttendanceSchedules() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isCheckingAttendance = true;
            try {
                const now = new Date();
                // Find schedules that are due
                const dueSchedules = yield database_1.default.attendanceSchedule.findMany({
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
                if (dueSchedules.length === 0)
                    return;
                console.log(`[Attendance Scheduler] Found ${dueSchedules.length} due schedules`);
                // Kill zombie Chrome once before starting all schedules
                yield this.killZombieChrome();
                for (const schedule of dueSchedules) {
                    const user = schedule.course.user;
                    if (!user.spadaUsername || !user.spadaPassword) {
                        console.log(`[Attendance] Skipping ${schedule.course.name}: No SPADA credentials`);
                        continue;
                    }
                    // Run attendance attempt
                    yield this.runAttendanceWithRetry(schedule, user, 1);
                    // Wait 10s between schedules to let Chrome fully die
                    yield new Promise(r => setTimeout(r, 10000));
                }
            }
            catch (error) {
                console.error('[Attendance Scheduler] Error:', error);
            }
            finally {
                yield this.killZombieChrome();
                this.isCheckingAttendance = false;
            }
        });
    }
    /**
     * Run attendance with retry logic
     */
    runAttendanceWithRetry(schedule, user, attemptNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const attendanceService = new attendanceService_1.AttendanceService();
            try {
                console.log(`[Attendance] Running for ${schedule.course.name} (attempt ${attemptNumber}/${schedule.maxRetries})`);
                const decryptedPassword = (0, encryption_1.decrypt)(user.spadaPassword);
                const result = yield attendanceService.runAttendance(schedule.course.url, user.spadaUsername, decryptedPassword);
                // Log the attempt
                yield database_1.default.attendanceLog.create({
                    data: {
                        scheduleId: schedule.id,
                        attemptNumber,
                        status: result.status,
                        message: result.message,
                        screenshotUrl: result.screenshotPath
                    }
                });
                // Send Telegram notification
                if (((_a = user.telegramConfig) === null || _a === void 0 ? void 0 : _a.isActive) && ((_b = user.telegramConfig) === null || _b === void 0 ? void 0 : _b.chatId)) {
                    const botToken = schedule.useSeparateTelegram && schedule.customBotToken
                        ? schedule.customBotToken
                        : user.telegramConfig.botToken;
                    yield attendanceService.sendNotification(this.telegramService, user.telegramConfig.chatId, botToken, schedule.course.name, result);
                }
                // Send Discord notification
                if (((_c = user.discordConfig) === null || _c === void 0 ? void 0 : _c.isActive) && ((_d = user.discordConfig) === null || _d === void 0 ? void 0 : _d.webhookUrl)) {
                    yield attendanceService.sendDiscordNotification(this.discordService, user.discordConfig.webhookUrl, schedule.course.name, result);
                }
                // Send WhatsApp notification
                if (((_e = user.whatsappConfig) === null || _e === void 0 ? void 0 : _e.isActive) && ((_f = user.whatsappConfig) === null || _f === void 0 ? void 0 : _f.phoneNumber)) {
                    yield attendanceService.sendWhatsAppNotification(this.whatsappService, user.whatsappConfig.phoneNumber, schedule.course.name, result);
                }
                // Update lastRunAt
                yield database_1.default.attendanceSchedule.update({
                    where: { id: schedule.id },
                    data: { lastRunAt: new Date() }
                });
                // Always calculate next week's run (no retry)
                const nextRun = this.calculateNextRun(schedule);
                yield database_1.default.attendanceSchedule.update({
                    where: { id: schedule.id },
                    data: { nextRunAt: nextRun }
                });
                if (result.success || result.status === 'SUCCESS') {
                    console.log(`[Attendance] ✅ Success for ${schedule.course.name}`);
                }
                else {
                    console.log(`[Attendance] ⏭️ Skipped to next week for ${schedule.course.name} (${result.status})`);
                }
            }
            catch (error) {
                console.error(`[Attendance] Error for ${schedule.course.name}:`, error);
                // Log the error
                yield database_1.default.attendanceLog.create({
                    data: {
                        scheduleId: schedule.id,
                        attemptNumber,
                        status: 'ERROR',
                        message: `Error: ${error}`
                    }
                });
            }
        });
    }
    /**
     * Calculate next run time for a schedule
     * Uses WIB timezone (UTC+7) for Indonesia
     */
    calculateNextRun(schedule) {
        // WIB offset in milliseconds (UTC+7)
        const WIB_OFFSET = 7 * 60 * 60 * 1000;
        if (schedule.scheduleType === 'SIMPLE' && schedule.dayOfWeek !== null && schedule.timeOfDay) {
            const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);
            // Get current time in WIB
            const nowUTC = new Date();
            const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET);
            // Find next occurrence of the target day (next week)
            let daysUntilTarget = schedule.dayOfWeek - nowWIB.getUTCDay();
            if (daysUntilTarget <= 0)
                daysUntilTarget += 7;
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
    syncAllUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            // Prevent overlapping syncs
            if (this.isSyncing) {
                console.log('[Auto-Sync] Sync already in progress, skipping...');
                return;
            }
            this.isSyncing = true;
            try {
                // Kill any zombie Chrome processes before starting
                yield this.killZombieChrome();
                // Find users with SPADA credentials
                const users = yield database_1.default.user.findMany({
                    where: {
                        spadaUsername: { not: null },
                        spadaPassword: { not: null }
                    }
                });
                if (users.length === 0)
                    return;
                // Limit to max 3 users per sync cycle to prevent resource exhaustion
                const MAX_USERS_PER_CYCLE = 3;
                const startIdx = this.lastSyncIndex % users.length;
                const usersToSync = [];
                for (let i = 0; i < Math.min(MAX_USERS_PER_CYCLE, users.length); i++) {
                    usersToSync.push(users[(startIdx + i) % users.length]);
                }
                this.lastSyncIndex = (startIdx + usersToSync.length) % users.length;
                console.log(`[Auto-Sync] Syncing ${usersToSync.length}/${users.length} users (batch starting at index ${startIdx})`);
                let consecutiveFailures = 0;
                for (const user of usersToSync) {
                    if (!user.spadaUsername || !user.spadaPassword)
                        continue;
                    // Fail-fast: if 2 consecutive users fail to launch Chrome, stop
                    if (consecutiveFailures >= 2) {
                        console.log('[Auto-Sync] Too many Chrome launch failures, stopping this cycle');
                        break;
                    }
                    // Kill Chrome before each user to ensure clean slate
                    yield this.killZombieChrome();
                    console.log(`[Auto-Sync] Syncing data for user: ${user.email}`);
                    const scraper = new scraperService_1.ScraperService();
                    try {
                        const decryptedPassword = (0, encryption_1.decrypt)(user.spadaPassword);
                        const loggedIn = yield scraper.login(user.spadaUsername, decryptedPassword);
                        if (loggedIn) {
                            consecutiveFailures = 0; // Reset on success
                            // Only sync courses that the user has added to the DB
                            const savedCourses = yield database_1.default.course.findMany({
                                where: { userId: user.id }
                            });
                            console.log(`[Auto-Sync] Syncing ${savedCourses.length} saved courses for user: ${user.email}`);
                            const coursesWithAssignments = [];
                            // Iterate saved courses and scrape assignments
                            for (const course of savedCourses) {
                                // Throttle between courses
                                yield new Promise(r => setTimeout(r, 2000));
                                console.log(`[Auto-Sync] Scraping assignments for course: ${course.name} (${course.sourceId})`);
                                try {
                                    const assignments = yield scraper.scrapeAssignments(course.sourceId);
                                    coursesWithAssignments.push({
                                        id: course.sourceId,
                                        name: course.name,
                                        url: course.url,
                                        assignments
                                    });
                                }
                                catch (err) {
                                    console.error(`[Auto-Sync] Failed to scrape course ${course.id}:`, err);
                                }
                            }
                            // Save using shared service
                            yield (0, courseService_1.saveCoursesToDb)(user.id, coursesWithAssignments);
                            console.log(`[Auto-Sync] Sync complete for user: ${user.email}`);
                        }
                        else {
                            console.error(`[Auto-Sync] Login failed for user: ${user.email}`);
                            consecutiveFailures++;
                        }
                    }
                    catch (error) {
                        console.error(`[Auto-Sync] Error syncing user ${user.email}:`, error.message || error);
                        consecutiveFailures++;
                    }
                    finally {
                        // Ensure browser is closed before moving to next user
                        yield scraper.close();
                        // Wait 10 seconds between users to let processes fully terminate
                        yield new Promise(r => setTimeout(r, 10000));
                    }
                }
            }
            catch (error) {
                console.error('[Auto-Sync] Global error in syncAllUsers:', error);
            }
            finally {
                // Final cleanup
                yield this.killZombieChrome();
                this.isSyncing = false;
            }
        });
    }
    checkDeadlines() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                // 1. Get users with active Telegram or Discord config
                const users = yield database_1.default.user.findMany({
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
                        if (!task.deadline)
                            continue;
                        const timeText = (0, date_fns_1.formatDistanceToNow)(new Date(task.deadline), { addSuffix: true });
                        const message = `⚠️ Deadline Reminder ⚠️\n\nTask: ${task.title}\nDue: ${timeText}\n\nDon't forget to submit!`;
                        // Send Telegram notification
                        if (((_a = user.telegramConfig) === null || _a === void 0 ? void 0 : _a.isActive) && ((_b = user.telegramConfig) === null || _b === void 0 ? void 0 : _b.chatId)) {
                            const lastTelegramNotif = yield database_1.default.notification.findFirst({
                                where: {
                                    taskId: task.id,
                                    type: 'telegram',
                                    sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                                }
                            });
                            if (!lastTelegramNotif) {
                                const sent = yield this.telegramService.sendMessage(user.telegramConfig.chatId, message, user.telegramConfig.botToken);
                                if (sent.success) {
                                    yield database_1.default.notification.create({
                                        data: { taskId: task.id, message, type: 'telegram', isDelivered: true }
                                    });
                                    console.log(`[Notification] Telegram sent to ${user.email} for task ${task.id}`);
                                }
                            }
                        }
                        // Send Discord notification
                        if (((_c = user.discordConfig) === null || _c === void 0 ? void 0 : _c.isActive) && ((_d = user.discordConfig) === null || _d === void 0 ? void 0 : _d.webhookUrl)) {
                            const lastDiscordNotif = yield database_1.default.notification.findFirst({
                                where: {
                                    taskId: task.id,
                                    type: 'discord',
                                    sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                                }
                            });
                            if (!lastDiscordNotif) {
                                const sent = yield this.discordService.sendEmbed(user.discordConfig.webhookUrl, {
                                    title: '⚠️ Deadline Reminder',
                                    description: `**${task.title}**`,
                                    color: discordService_1.DiscordColors.WARNING,
                                    fields: [
                                        { name: '⏰ Due', value: timeText, inline: true }
                                    ],
                                    footer: { text: "Don't forget to submit!" },
                                    timestamp: new Date().toISOString()
                                });
                                if (sent.success) {
                                    yield database_1.default.notification.create({
                                        data: { taskId: task.id, message, type: 'discord', isDelivered: true }
                                    });
                                    console.log(`[Notification] Discord sent to ${user.email} for task ${task.id}`);
                                }
                            }
                        }
                    }
                }
            }
            catch (error) {
                console.error('Error in checkDeadlines:', error);
            }
        });
    }
}
exports.SchedulerService = SchedulerService;
