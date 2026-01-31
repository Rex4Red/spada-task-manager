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
exports.getRecentActivity = exports.deleteUser = exports.getUserDetail = exports.getUsers = exports.getStats = void 0;
const database_1 = __importDefault(require("../config/database"));
/**
 * Get dashboard statistics
 */
const getStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [userCount, courseCount, assignmentCount, scheduleCount] = yield Promise.all([
            database_1.default.user.count(),
            database_1.default.course.count(),
            database_1.default.task.count(),
            database_1.default.attendanceSchedule.count({ where: { isActive: true } })
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
    }
    catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to get statistics' });
    }
});
exports.getStats = getStats;
/**
 * Get all users with pagination
 */
const getUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;
        const where = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ]
        } : {};
        const [users, total] = yield Promise.all([
            database_1.default.user.findMany({
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
                            courses: true,
                            tasks: true
                        }
                    }
                }
            }),
            database_1.default.user.count({ where })
        ]);
        // Get telegram config separately
        const usersWithTelegram = yield Promise.all(users.map((user) => __awaiter(void 0, void 0, void 0, function* () {
            const telegramConfig = yield database_1.default.telegramConfig.findUnique({
                where: { userId: user.id },
                select: { chatId: true }
            });
            return Object.assign(Object.assign({}, user), { telegramChatId: (telegramConfig === null || telegramConfig === void 0 ? void 0 : telegramConfig.chatId) || null });
        })));
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
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Failed to get users' });
    }
});
exports.getUsers = getUsers;
/**
 * Get single user with all details
 */
const getUserDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const idParam = req.params.id;
        const id = parseInt(idParam);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }
        const user = yield database_1.default.user.findUnique({
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
                    select: {
                        id: true,
                        name: true,
                        sourceId: true,
                        url: true,
                        lastSynced: true,
                        tasks: {
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
    }
    catch (error) {
        console.error('Get user detail error:', error);
        res.status(500).json({ success: false, message: 'Failed to get user details' });
    }
});
exports.getUserDetail = getUserDetail;
/**
 * Delete a user (cascade deletes courses, tasks, schedules)
 */
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const idParam = req.params.id;
        const id = parseInt(idParam);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }
        // Check if user exists
        const user = yield database_1.default.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Delete user (cascades to courses, tasks, etc.)
        yield database_1.default.user.delete({ where: { id } });
        res.json({
            success: true,
            message: `User ${user.email} deleted successfully`
        });
    }
    catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});
exports.deleteUser = deleteUser;
/**
 * Get recent activity/logs
 */
const getRecentActivity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const limitStr = req.query.limit;
        const limit = limitStr ? parseInt(limitStr) : 10;
        const recentLogs = yield database_1.default.attendanceLog.findMany({
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
    }
    catch (error) {
        console.error('Get recent activity error:', error);
        res.status(500).json({ success: false, message: 'Failed to get activity' });
    }
});
exports.getRecentActivity = getRecentActivity;
