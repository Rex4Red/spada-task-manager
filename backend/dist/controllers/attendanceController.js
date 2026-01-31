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
exports.getLogs = exports.testAttendance = exports.deleteSchedule = exports.updateSchedule = exports.getSchedule = void 0;
const database_1 = __importDefault(require("../config/database"));
const attendanceService_1 = require("../services/attendanceService");
const app_1 = require("../app");
const encryption_1 = require("../utils/encryption");
/**
 * Get attendance schedule for a course
 */
const getSchedule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const courseId = parseInt(req.params.courseId);
    try {
        // Verify course belongs to user
        const course = yield database_1.default.course.findFirst({
            where: { id: courseId, userId },
            include: { attendanceSchedule: true }
        });
        if (!course) {
            res.status(404).json({ message: 'Course not found' });
            return;
        }
        res.json({ data: course.attendanceSchedule });
    }
    catch (error) {
        console.error('Error getting attendance schedule:', error);
        res.status(500).json({ message: 'Failed to get attendance schedule' });
    }
});
exports.getSchedule = getSchedule;
/**
 * Create or update attendance schedule for a course
 */
const updateSchedule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const courseId = parseInt(req.params.courseId);
    const { scheduleType, dayOfWeek, timeOfDay, cronExpression, maxRetries, retryIntervalMinutes, isActive, useSeparateTelegram, customBotToken } = req.body;
    try {
        // Verify course belongs to user
        const course = yield database_1.default.course.findFirst({
            where: { id: courseId, userId }
        });
        if (!course) {
            res.status(404).json({ message: 'Course not found' });
            return;
        }
        // Calculate next run time
        const nextRunAt = calculateNextRun(scheduleType, dayOfWeek, timeOfDay, cronExpression);
        const schedule = yield database_1.default.attendanceSchedule.upsert({
            where: { courseId },
            update: {
                scheduleType: scheduleType || 'SIMPLE',
                dayOfWeek,
                timeOfDay,
                cronExpression,
                maxRetries: maxRetries !== null && maxRetries !== void 0 ? maxRetries : 6,
                retryIntervalMinutes: retryIntervalMinutes !== null && retryIntervalMinutes !== void 0 ? retryIntervalMinutes : 5,
                isActive: isActive !== null && isActive !== void 0 ? isActive : true,
                useSeparateTelegram: useSeparateTelegram !== null && useSeparateTelegram !== void 0 ? useSeparateTelegram : false,
                customBotToken: useSeparateTelegram ? customBotToken : null,
                nextRunAt
            },
            create: {
                courseId,
                scheduleType: scheduleType || 'SIMPLE',
                dayOfWeek,
                timeOfDay,
                cronExpression,
                maxRetries: maxRetries !== null && maxRetries !== void 0 ? maxRetries : 6,
                retryIntervalMinutes: retryIntervalMinutes !== null && retryIntervalMinutes !== void 0 ? retryIntervalMinutes : 5,
                isActive: isActive !== null && isActive !== void 0 ? isActive : true,
                useSeparateTelegram: useSeparateTelegram !== null && useSeparateTelegram !== void 0 ? useSeparateTelegram : false,
                customBotToken: useSeparateTelegram ? customBotToken : null,
                nextRunAt
            }
        });
        res.json({ message: 'Schedule updated successfully', data: schedule });
    }
    catch (error) {
        console.error('Error updating attendance schedule:', error);
        res.status(500).json({ message: 'Failed to update attendance schedule' });
    }
});
exports.updateSchedule = updateSchedule;
/**
 * Delete attendance schedule for a course
 */
const deleteSchedule = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const courseId = parseInt(req.params.courseId);
    try {
        // Verify course belongs to user
        const course = yield database_1.default.course.findFirst({
            where: { id: courseId, userId },
            include: { attendanceSchedule: true }
        });
        if (!course) {
            res.status(404).json({ message: 'Course not found' });
            return;
        }
        if (!course.attendanceSchedule) {
            res.status(404).json({ message: 'No schedule found for this course' });
            return;
        }
        yield database_1.default.attendanceSchedule.delete({
            where: { courseId }
        });
        res.json({ message: 'Schedule deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting attendance schedule:', error);
        res.status(500).json({ message: 'Failed to delete attendance schedule' });
    }
});
exports.deleteSchedule = deleteSchedule;
/**
 * Test attendance now (manual trigger)
 */
const testAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const userId = req.user.id;
    const courseId = parseInt(req.params.courseId);
    try {
        // Get course and user info
        const course = yield database_1.default.course.findFirst({
            where: { id: courseId, userId },
            include: { attendanceSchedule: true }
        });
        if (!course) {
            res.status(404).json({ message: 'Course not found' });
            return;
        }
        const user = yield database_1.default.user.findUnique({
            where: { id: userId },
            include: { telegramConfig: true }
        });
        if (!(user === null || user === void 0 ? void 0 : user.spadaUsername) || !(user === null || user === void 0 ? void 0 : user.spadaPassword)) {
            res.status(400).json({ message: 'SPADA credentials not configured. Please set up in Settings.' });
            return;
        }
        // Run attendance
        const attendanceService = new attendanceService_1.AttendanceService();
        const decryptedPassword = (0, encryption_1.decrypt)(user.spadaPassword);
        console.log(`[Test Attendance] Running for course: ${course.name}`);
        const result = yield attendanceService.runAttendance(course.url, user.spadaUsername, decryptedPassword);
        // Log the attempt
        let scheduleId = (_a = course.attendanceSchedule) === null || _a === void 0 ? void 0 : _a.id;
        if (!scheduleId) {
            // Create a temporary schedule for logging
            const schedule = yield database_1.default.attendanceSchedule.create({
                data: {
                    courseId,
                    scheduleType: 'SIMPLE',
                    isActive: false
                }
            });
            scheduleId = schedule.id;
        }
        yield database_1.default.attendanceLog.create({
            data: {
                scheduleId,
                attemptNumber: 1,
                status: result.status,
                message: result.message,
                screenshotUrl: result.screenshotPath
            }
        });
        // Send Telegram notification if configured
        if (((_b = user.telegramConfig) === null || _b === void 0 ? void 0 : _b.isActive) && ((_c = user.telegramConfig) === null || _c === void 0 ? void 0 : _c.chatId)) {
            const botToken = ((_d = course.attendanceSchedule) === null || _d === void 0 ? void 0 : _d.useSeparateTelegram) && ((_e = course.attendanceSchedule) === null || _e === void 0 ? void 0 : _e.customBotToken)
                ? course.attendanceSchedule.customBotToken
                : user.telegramConfig.botToken;
            yield attendanceService.sendNotification(app_1.telegramService, user.telegramConfig.chatId, botToken, course.name, result);
        }
        res.json({
            message: result.success ? 'Attendance completed successfully!' : 'Attendance attempt completed',
            data: result
        });
    }
    catch (error) {
        console.error('Error testing attendance:', error);
        res.status(500).json({ message: 'Failed to run attendance test' });
    }
});
exports.testAttendance = testAttendance;
/**
 * Get attendance logs for a course
 */
const getLogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const courseId = parseInt(req.params.courseId);
    const limit = parseInt(req.query.limit) || 10;
    try {
        // Verify course belongs to user
        const course = yield database_1.default.course.findFirst({
            where: { id: courseId, userId },
            include: { attendanceSchedule: true }
        });
        if (!course || !course.attendanceSchedule) {
            res.json({ data: [] });
            return;
        }
        const logs = yield database_1.default.attendanceLog.findMany({
            where: { scheduleId: course.attendanceSchedule.id },
            orderBy: { attemptedAt: 'desc' },
            take: limit
        });
        res.json({ data: logs });
    }
    catch (error) {
        console.error('Error getting attendance logs:', error);
        res.status(500).json({ message: 'Failed to get attendance logs' });
    }
});
exports.getLogs = getLogs;
/**
 * Helper: Calculate next run time based on schedule
 * Uses WIB timezone (UTC+7) for Indonesia
 */
function calculateNextRun(scheduleType, dayOfWeek, timeOfDay, cronExpression) {
    // WIB offset in milliseconds (UTC+7)
    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    if (scheduleType === 'SIMPLE' && dayOfWeek !== undefined && timeOfDay) {
        const [hours, minutes] = timeOfDay.split(':').map(Number);
        // Get current time in WIB
        const nowUTC = new Date();
        const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET);
        // Calculate in WIB timezone
        const currentDayWIB = nowWIB.getUTCDay();
        const currentHourWIB = nowWIB.getUTCHours();
        const currentMinuteWIB = nowWIB.getUTCMinutes();
        let daysUntilTarget = dayOfWeek - currentDayWIB;
        if (daysUntilTarget < 0)
            daysUntilTarget += 7;
        if (daysUntilTarget === 0) {
            // Same day, check if time has passed
            const targetTime = hours * 60 + minutes;
            const currentTime = currentHourWIB * 60 + currentMinuteWIB;
            if (currentTime >= targetTime) {
                daysUntilTarget = 7; // Next week
            }
        }
        // Create target date in WIB
        const targetWIB = new Date(nowWIB);
        targetWIB.setUTCDate(nowWIB.getUTCDate() + daysUntilTarget);
        targetWIB.setUTCHours(hours, minutes, 0, 0);
        // Convert back to UTC for storage
        const targetUTC = new Date(targetWIB.getTime() - WIB_OFFSET);
        return targetUTC;
    }
    // For CRON type, we'd need a cron parser - simplified for now
    return null;
}
