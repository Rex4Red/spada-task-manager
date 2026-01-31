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
exports.saveCoursesToDb = void 0;
const database_1 = __importDefault(require("../config/database"));
const app_1 = require("../app");
const saveCoursesToDb = (userId, courses) => __awaiter(void 0, void 0, void 0, function* () {
    // console.log(`Saving ${courses.length} courses to database for user ${userId}...`);
    // 1. Get User's Telegram Config for Notifications
    const user = yield database_1.default.user.findUnique({
        where: { id: userId },
        include: { telegramConfig: true }
    });
    const telegramConfig = user === null || user === void 0 ? void 0 : user.telegramConfig;
    for (const course of courses) {
        // Upsert Course
        const savedCourse = yield database_1.default.course.upsert({
            where: {
                sourceId_userId: {
                    sourceId: course.id,
                    userId: userId
                }
            },
            update: {
                name: course.name,
                url: course.url,
                lastSynced: new Date()
            },
            create: {
                sourceId: course.id,
                name: course.name,
                url: course.url,
                lastSynced: new Date(),
                userId: userId
            }
        });
        // Upsert Assignments (Tasks)
        if (course.assignments && course.assignments.length > 0) {
            // console.log(`Saving ${course.assignments.length} assignments for course ${course.name}...`);
            for (const assignment of course.assignments) {
                let dueDateObj = null;
                if (assignment.dueDate && assignment.dueDate !== 'Unknown') {
                    const parsedDate = new Date(assignment.dueDate);
                    if (!isNaN(parsedDate.getTime())) {
                        dueDateObj = parsedDate;
                    }
                }
                // Check if task already exists to determine if it's NEW
                const existingTask = yield database_1.default.task.findUnique({
                    where: {
                        courseId_title: {
                            courseId: savedCourse.id,
                            title: assignment.name
                        }
                    }
                });
                const savedTask = yield database_1.default.task.upsert({
                    where: {
                        courseId_title: {
                            courseId: savedCourse.id,
                            title: assignment.name
                        }
                    },
                    update: {
                        status: assignment.status === 'Submitted for grading' ? 'COMPLETED' : 'PENDING',
                        deadline: dueDateObj,
                        url: assignment.url,
                        description: `Type: ${assignment.status}`,
                        timeRemaining: assignment.timeRemaining
                    },
                    create: {
                        title: assignment.name,
                        description: `Type: ${assignment.status}`,
                        status: assignment.status === 'Submitted for grading' ? 'COMPLETED' : 'PENDING',
                        deadline: dueDateObj,
                        url: assignment.url,
                        timeRemaining: assignment.timeRemaining,
                        courseId: savedCourse.id,
                        userId: userId,
                        isScraped: true
                    }
                });
                // Send Notification if NEW Task and Telegram is Active
                if (!existingTask && telegramConfig && telegramConfig.isActive && telegramConfig.chatId) {
                    console.log(`New task detected: ${assignment.name}. Sending notification...`);
                    const message = `
🆕 *New Task Detected!*

📚 *Course:* ${course.name}
📝 *Task:* ${assignment.name}
📅 *Deadline:* ${dueDateObj ? dueDateObj.toLocaleString('id-ID') : 'No Deadline'}
🔗 [View Task](${assignment.url})
                    `.trim();
                    // Send asynchronously to not block the sync process too much
                    app_1.telegramService.sendMessage(telegramConfig.chatId, message, telegramConfig.botToken).catch(err => {
                        console.error('Failed to send new task notification:', err);
                    });
                }
            }
        }
    }
});
exports.saveCoursesToDb = saveCoursesToDb;
