import { Response } from 'express';
import prisma from '../config/database';
import { AdminRequest } from '../middleware/adminAuth';

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
