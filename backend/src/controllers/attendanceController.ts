import { Request, Response } from 'express';
import prisma from '../config/database';
import { AttendanceService } from '../services/attendanceService';
import { telegramService, discordService, whatsappService } from '../app';
import { decrypt } from '../utils/encryption';

/**
 * Get attendance schedule for a course
 */
export const getSchedule = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const courseId = parseInt(req.params.courseId as string);

    try {
        // Verify course belongs to user
        const course = await prisma.course.findFirst({
            where: { id: courseId, userId },
            include: { attendanceSchedule: true }
        });

        if (!course) {
            res.status(404).json({ message: 'Course not found' });
            return;
        }

        res.json({ data: course.attendanceSchedule });
    } catch (error) {
        console.error('Error getting attendance schedule:', error);
        res.status(500).json({ message: 'Failed to get attendance schedule' });
    }
};

/**
 * Create or update attendance schedule for a course
 */
export const updateSchedule = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const courseId = parseInt(req.params.courseId as string);
    const {
        scheduleType,
        dayOfWeek,
        timeOfDay,
        cronExpression,
        maxRetries,
        retryIntervalMinutes,
        isActive,
        useSeparateTelegram,
        customBotToken
    } = req.body;

    try {
        // Verify course belongs to user
        const course = await prisma.course.findFirst({
            where: { id: courseId, userId }
        });

        if (!course) {
            res.status(404).json({ message: 'Course not found' });
            return;
        }

        // Calculate next run time
        const nextRunAt = calculateNextRun(scheduleType, dayOfWeek, timeOfDay, cronExpression);

        const schedule = await prisma.attendanceSchedule.upsert({
            where: { courseId },
            update: {
                scheduleType: scheduleType || 'SIMPLE',
                dayOfWeek,
                timeOfDay,
                cronExpression,
                maxRetries: maxRetries ?? 6,
                retryIntervalMinutes: retryIntervalMinutes ?? 5,
                isActive: isActive ?? true,
                useSeparateTelegram: useSeparateTelegram ?? false,
                customBotToken: useSeparateTelegram ? customBotToken : null,
                nextRunAt
            },
            create: {
                courseId,
                scheduleType: scheduleType || 'SIMPLE',
                dayOfWeek,
                timeOfDay,
                cronExpression,
                maxRetries: maxRetries ?? 6,
                retryIntervalMinutes: retryIntervalMinutes ?? 5,
                isActive: isActive ?? true,
                useSeparateTelegram: useSeparateTelegram ?? false,
                customBotToken: useSeparateTelegram ? customBotToken : null,
                nextRunAt
            }
        });

        res.json({ message: 'Schedule updated successfully', data: schedule });
    } catch (error) {
        console.error('Error updating attendance schedule:', error);
        res.status(500).json({ message: 'Failed to update attendance schedule' });
    }
};

/**
 * Delete attendance schedule for a course
 */
export const deleteSchedule = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const courseId = parseInt(req.params.courseId as string);

    try {
        // Verify course belongs to user
        const course = await prisma.course.findFirst({
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

        await prisma.attendanceSchedule.delete({
            where: { courseId }
        });

        res.json({ message: 'Schedule deleted successfully' });
    } catch (error) {
        console.error('Error deleting attendance schedule:', error);
        res.status(500).json({ message: 'Failed to delete attendance schedule' });
    }
};

/**
 * Test attendance now (manual trigger)
 */
export const testAttendance = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const courseId = parseInt(req.params.courseId as string);

    try {
        // Get course and user info
        const course = await prisma.course.findFirst({
            where: { id: courseId, userId },
            include: { attendanceSchedule: true }
        });

        if (!course) {
            res.status(404).json({ message: 'Course not found' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                telegramConfig: true,
                discordConfig: true,
                whatsappConfig: true
            }
        });

        if (!user?.spadaUsername || !user?.spadaPassword) {
            res.status(400).json({ message: 'SPADA credentials not configured. Please set up in Settings.' });
            return;
        }

        // Run attendance
        const attendanceService = new AttendanceService();
        const decryptedPassword = decrypt(user.spadaPassword);

        console.log(`[Test Attendance] Running for course: ${course.name}`);
        const result = await attendanceService.runAttendance(
            course.url,
            user.spadaUsername,
            decryptedPassword
        );

        // Log the attempt
        let scheduleId = course.attendanceSchedule?.id;
        if (!scheduleId) {
            // Create a temporary schedule for logging
            const schedule = await prisma.attendanceSchedule.create({
                data: {
                    courseId,
                    scheduleType: 'SIMPLE',
                    isActive: false
                }
            });
            scheduleId = schedule.id;
        }

        await prisma.attendanceLog.create({
            data: {
                scheduleId,
                attemptNumber: 1,
                status: result.status,
                message: result.message,
                screenshotUrl: result.screenshotPath
            }
        });

        // Send Telegram notification if configured
        if (user.telegramConfig?.isActive && user.telegramConfig?.chatId) {
            const botToken = course.attendanceSchedule?.useSeparateTelegram && course.attendanceSchedule?.customBotToken
                ? course.attendanceSchedule.customBotToken
                : user.telegramConfig.botToken;

            await attendanceService.sendNotification(
                telegramService,
                user.telegramConfig.chatId,
                botToken,
                course.name,
                result
            );
        }

        // Send Discord notification if configured
        if (user.discordConfig?.isActive && user.discordConfig?.webhookUrl) {
            await attendanceService.sendDiscordNotification(
                discordService,
                user.discordConfig.webhookUrl,
                course.name,
                result
            );
        }

        // Send WhatsApp notification if configured
        if (user.whatsappConfig?.isActive && user.whatsappConfig?.phoneNumber) {
            await attendanceService.sendWhatsAppNotification(
                whatsappService,
                user.whatsappConfig.phoneNumber,
                course.name,
                result
            );
        }

        res.json({
            message: result.success ? 'Attendance completed successfully!' : 'Attendance attempt completed',
            data: result
        });

    } catch (error) {
        console.error('Error testing attendance:', error);
        res.status(500).json({ message: 'Failed to run attendance test' });
    }
};

/**
 * Get attendance logs for a course
 */
export const getLogs = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const courseId = parseInt(req.params.courseId as string);
    const limit = parseInt(req.query.limit as string) || 10;

    try {
        // Verify course belongs to user
        const course = await prisma.course.findFirst({
            where: { id: courseId, userId },
            include: { attendanceSchedule: true }
        });

        if (!course || !course.attendanceSchedule) {
            res.json({ data: [] });
            return;
        }

        const logs = await prisma.attendanceLog.findMany({
            where: { scheduleId: course.attendanceSchedule.id },
            orderBy: { attemptedAt: 'desc' },
            take: limit
        });

        res.json({ data: logs });
    } catch (error) {
        console.error('Error getting attendance logs:', error);
        res.status(500).json({ message: 'Failed to get attendance logs' });
    }
};

/**
 * Helper: Calculate next run time based on schedule
 * Uses WIB timezone (UTC+7) for Indonesia
 */
function calculateNextRun(
    scheduleType: string,
    dayOfWeek?: number,
    timeOfDay?: string,
    cronExpression?: string
): Date | null {
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
        if (daysUntilTarget < 0) daysUntilTarget += 7;
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
