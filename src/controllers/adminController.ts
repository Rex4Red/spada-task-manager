import { Response } from 'express';
import prisma from '../config/database';
import { AdminRequest } from '../middleware/adminAuth';
import { AdminNotificationService } from '../services/adminNotificationService';

/**
 * Get dashboard statistics
 */
export const getStats = async (req: AdminRequest, res: Response) => {
    try {
        const [userCount, courseCount, assignmentCount, scheduleCount] = await Promise.all([
            prisma.user.count(),
            prisma.course.count({ where: { isDeleted: false } }),
            prisma.task.count({ where: { isDeleted: false } }),
            prisma.attendanceSchedule.count({ where: { isActive: true } })
        ]);

        res.json({
            success: true,
            data: {
                totalUsers: userCount,
                totalCourses: courseCount,
                totalAssignments: assignmentCount,
                activeSchedules: scheduleCount
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to get statistics' });
    }
};

/**
 * Get all users with pagination
 */
export const getUsers = async (req: AdminRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string || '';
        const skip = (page - 1) * limit;

        const where = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } }
            ]
        } : {};

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    spadaUsername: true,
                    createdAt: true,
                    _count: {
                        select: {
                            courses: { where: { isDeleted: false } },
                            tasks: { where: { isDeleted: false } }
                        }
                    }
                }
            }),
            prisma.user.count({ where })
        ]);

        // Get telegram config separately
        const usersWithTelegram = await Promise.all(users.map(async (user) => {
            const telegramConfig = await prisma.telegramConfig.findUnique({
                where: { userId: user.id },
                select: { chatId: true }
            });
            return {
                ...user,
                telegramChatId: telegramConfig?.chatId || null
            };
        }));

        res.json({
            success: true,
            data: {
                users: usersWithTelegram,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Failed to get users' });
    }
};

/**
 * Get single user with all details
 */
export const getUserDetail = async (req: AdminRequest, res: Response) => {
    try {
        const idParam = req.params.id as string;
        const id = parseInt(idParam);

        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                spadaUsername: true,
                createdAt: true,
                telegramConfig: {
                    select: {
                        chatId: true,
                        botToken: true
                    }
                },
                courses: {
                    where: { isDeleted: false },
                    select: {
                        id: true,
                        name: true,
                        sourceId: true,
                        url: true,
                        lastSynced: true,
                        tasks: {
                            where: { isDeleted: false },
                            select: {
                                id: true,
                                title: true,
                                deadline: true,
                                status: true
                            },
                            orderBy: { deadline: 'asc' }
                        },
                        attendanceSchedule: {
                            select: {
                                id: true,
                                isActive: true,
                                scheduleType: true,
                                dayOfWeek: true,
                                timeOfDay: true,
                                nextRunAt: true
                            }
                        }
                    },
                    orderBy: { name: 'asc' }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get user detail error:', error);
        res.status(500).json({ success: false, message: 'Failed to get user details' });
    }
};

/**
 * Delete a user (cascade deletes courses, tasks, schedules)
 */
export const deleteUser = async (req: AdminRequest, res: Response) => {
    try {
        const idParam = req.params.id as string;
        const id = parseInt(idParam);

        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }

        // Check if user exists
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Delete user (cascades to courses, tasks, etc.)
        await prisma.user.delete({ where: { id } });

        res.json({
            success: true,
            message: `User ${user.email} deleted successfully`
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
};

/**
 * Get recent activity/logs
 */
export const getRecentActivity = async (req: AdminRequest, res: Response) => {
    try {
        const limitStr = req.query.limit as string;
        const limit = limitStr ? parseInt(limitStr) : 10;

        const recentLogs = await prisma.attendanceLog.findMany({
            take: limit,
            orderBy: { attemptedAt: 'desc' },
            include: {
                schedule: {
                    include: {
                        course: {
                            select: { name: true }
                        }
                    }
                }
            }
        });

        res.json({
            success: true,
            data: recentLogs
        });
    } catch (error) {
        console.error('Get recent activity error:', error);
        res.status(500).json({ success: false, message: 'Failed to get activity' });
    }
};

/**
 * Cleanup orphan tasks and soft-deleted courses
 * Deletes courses marked as isDeleted and cascades to their tasks
 */
export const cleanupOrphanData = async (req: AdminRequest, res: Response) => {
    try {
        // Find soft-deleted courses
        const deletedCourses = await prisma.course.findMany({
            where: { isDeleted: true },
            select: { id: true, name: true }
        });

        // Hard delete soft-deleted courses (will cascade to tasks)
        const deleteResult = await prisma.course.deleteMany({
            where: { isDeleted: true }
        });

        // Also delete any tasks that are soft-deleted
        const deletedTasks = await prisma.task.deleteMany({
            where: { isDeleted: true }
        });

        res.json({
            success: true,
            message: `Cleanup complete`,
            data: {
                deletedCourses: deleteResult.count,
                deletedTasks: deletedTasks.count,
                courseNames: deletedCourses.map(c => c.name)
            }
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ success: false, message: 'Failed to cleanup orphan data' });
    }
};

/**
 * Get admin settings
 */
export const getAdminSettings = async (req: AdminRequest, res: Response) => {
    try {
        const settings = await prisma.adminSettings.findMany();
        const settingsMap: Record<string, string> = {};
        for (const s of settings) {
            settingsMap[s.key] = s.value;
        }

        res.json({
            success: true,
            data: {
                adminWhatsapp: settingsMap['admin_whatsapp'] || '',
                errorNotifEnabled: settingsMap['error_notif_enabled'] === 'true'
            }
        });
    } catch (error) {
        console.error('Get admin settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to get settings' });
    }
};

/**
 * Update admin settings
 */
export const updateAdminSettings = async (req: AdminRequest, res: Response) => {
    try {
        const { adminWhatsapp, errorNotifEnabled } = req.body;

        // Upsert admin WhatsApp number
        if (adminWhatsapp !== undefined) {
            await prisma.adminSettings.upsert({
                where: { key: 'admin_whatsapp' },
                update: { value: adminWhatsapp },
                create: { key: 'admin_whatsapp', value: adminWhatsapp }
            });
        }

        // Upsert error notification toggle
        if (errorNotifEnabled !== undefined) {
            await prisma.adminSettings.upsert({
                where: { key: 'error_notif_enabled' },
                update: { value: String(errorNotifEnabled) },
                create: { key: 'error_notif_enabled', value: String(errorNotifEnabled) }
            });
        }

        res.json({
            success: true,
            message: 'Admin settings updated'
        });
    } catch (error) {
        console.error('Update admin settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
};

/**
 * Test admin notification
 */
export const testAdminNotification = async (req: AdminRequest, res: Response) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'Phone number required' });
        }

        const result = await AdminNotificationService.sendTestNotification(phoneNumber);
        if (result.success) {
            res.json({ success: true, message: 'Test notification sent!' });
        } else {
            res.status(400).json({ success: false, message: result.error || 'Failed to send' });
        }
    } catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({ success: false, message: 'Failed to send test notification' });
    }
};
