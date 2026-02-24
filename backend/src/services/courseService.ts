import prisma from '../config/database';
import { telegramService, discordService } from '../app';
import { DiscordColors } from './discordService';

export const saveCoursesToDb = async (userId: number, courses: any[]) => {
    // console.log(`Saving ${courses.length} courses to database for user ${userId}...`);

    // 1. Get User's Notification Configs
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            telegramConfig: true,
            discordConfig: true
        }
    });
    const telegramConfig = user?.telegramConfig;
    const discordConfig = user?.discordConfig;


    for (const course of courses) {
        // Upsert Course
        const savedCourse = await prisma.course.upsert({
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

                // Normalize title: remove trailing " Assignment" suffix that SPADA sometimes adds
                const normalizedTitle = (assignment.name || '')
                    .replace(/\s+Assignment\s*$/i, '')
                    .trim();

                // Strategy 1: Try to find existing task by URL (most reliable, unique per assignment)
                let existingTask = null;
                if (assignment.url) {
                    existingTask = await prisma.task.findFirst({
                        where: {
                            courseId: savedCourse.id,
                            url: assignment.url
                        }
                    });
                }

                // Strategy 2: Try to find by normalized title
                if (!existingTask) {
                    existingTask = await prisma.task.findUnique({
                        where: {
                            courseId_title: {
                                courseId: savedCourse.id,
                                title: normalizedTitle
                            }
                        }
                    });
                }

                // Strategy 3: Try to find by original title (before normalization)
                if (!existingTask && normalizedTitle !== assignment.name) {
                    existingTask = await prisma.task.findUnique({
                        where: {
                            courseId_title: {
                                courseId: savedCourse.id,
                                title: assignment.name
                            }
                        }
                    });
                }

                const taskData = {
                    status: assignment.status === 'Submitted for grading' ? 'COMPLETED' : 'PENDING',
                    deadline: dueDateObj,
                    url: assignment.url,
                    description: `Type: ${assignment.status}`,
                    timeRemaining: assignment.timeRemaining
                };

                let savedTask;
                if (existingTask) {
                    // Update existing task (also normalize the title)
                    savedTask = await prisma.task.update({
                        where: { id: existingTask.id },
                        data: {
                            ...taskData,
                            title: normalizedTitle
                        }
                    });
                } else {
                    // Create new task
                    try {
                        savedTask = await prisma.task.create({
                            data: {
                                title: normalizedTitle,
                                ...taskData,
                                courseId: savedCourse.id,
                                userId: userId,
                                isScraped: true
                            }
                        });
                    } catch (createErr: any) {
                        // Handle race condition: if another sync created it in the meantime
                        if (createErr.code === 'P2002') {
                            console.log(`[CourseService] Duplicate detected for "${normalizedTitle}", updating instead.`);
                            savedTask = await prisma.task.update({
                                where: {
                                    courseId_title: {
                                        courseId: savedCourse.id,
                                        title: normalizedTitle
                                    }
                                },
                                data: taskData
                            });
                        } else {
                            throw createErr;
                        }
                    }
                }

                // Send Notification if NEW Task
                if (!existingTask) {
                    console.log(`New task detected: ${assignment.name}. Sending notifications...`);
                    const deadlineStr = dueDateObj ? dueDateObj.toLocaleString('id-ID') : 'No Deadline';

                    // Telegram Notification
                    if (telegramConfig && telegramConfig.isActive && telegramConfig.chatId) {
                        const message = `
🆕 *New Task Detected!*

📚 *Course:* ${course.name}
📝 *Task:* ${assignment.name}
📅 *Deadline:* ${deadlineStr}
🔗 [View Task](${assignment.url})
                        `.trim();
                        telegramService.sendMessage(telegramConfig.chatId, message, telegramConfig.botToken).catch(err => {
                            console.error('Failed to send Telegram notification:', err);
                        });
                    }

                    // Discord Notification
                    if (discordConfig && discordConfig.isActive && discordConfig.webhookUrl) {
                        discordService.sendEmbed(discordConfig.webhookUrl, {
                            title: '🆕 New Task Detected!',
                            description: `A new assignment has been added to **${course.name}**`,
                            color: DiscordColors.INFO,
                            fields: [
                                { name: '📝 Task', value: assignment.name, inline: true },
                                { name: '📅 Deadline', value: deadlineStr, inline: true },
                                { name: '🔗 Link', value: `[View Task](${assignment.url})` }
                            ],
                            timestamp: new Date().toISOString()
                        }).catch(err => {
                            console.error('Failed to send Discord notification:', err);
                        });
                    }
                }
            }
        }
    }
};
