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

                // Extract SPADA assignment ID from URL for robust matching
                // URL format: https://spada.upnyk.ac.id/mod/assign/view.php?id=764029
                const spadaIdMatch = assignment.url?.match(/[?&]id=(\d+)/);
                const spadaAssignId = spadaIdMatch ? spadaIdMatch[1] : null;

                // Strategy 1: Find by URL (handles renamed assignments)
                let existingTask = null;
                if (assignment.url) {
                    existingTask = await prisma.task.findFirst({
                        where: {
                            courseId: savedCourse.id,
                            url: assignment.url
                        }
                    });
                }

                // Strategy 1b: Find by SPADA assignment ID in URL (more lenient URL matching)
                if (!existingTask && spadaAssignId) {
                    existingTask = await prisma.task.findFirst({
                        where: {
                            courseId: savedCourse.id,
                            url: { contains: `id=${spadaAssignId}` }
                        }
                    });
                }

                // Strategy 2: Find by normalized title
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

                // Strategy 3: Find by original title (before normalization)
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

                // Determine status based on submission status AND timeRemaining
                let taskStatus = 'PENDING';
                const timeStr = (assignment.timeRemaining || '').toLowerCase();
                if (assignment.status === 'Submitted for grading') {
                    if (timeStr.includes('late')) {
                        taskStatus = 'LATE';
                    } else {
                        taskStatus = 'COMPLETED'; // submitted early or on time
                    }
                } else if (timeStr.includes('overdue')) {
                    taskStatus = 'OVERDUE';
                }

                const taskData = {
                    status: taskStatus,
                    deadline: dueDateObj,
                    url: assignment.url,
                    description: `Type: ${assignment.status}`,
                    timeRemaining: assignment.timeRemaining
                };

                let savedTask;
                if (existingTask) {
                    // If title changed (lecturer renamed), handle potential unique constraint conflict
                    if (existingTask.title !== normalizedTitle) {
                        console.log(`[CourseService] Task renamed: "${existingTask.title}" → "${normalizedTitle}"`);

                        // Check if there's a conflicting task with the new title
                        const conflicting = await prisma.task.findUnique({
                            where: {
                                courseId_title: {
                                    courseId: savedCourse.id,
                                    title: normalizedTitle
                                }
                            }
                        });
                        if (conflicting && conflicting.id !== existingTask.id) {
                            console.log(`[CourseService] Removing conflicting task: "${conflicting.title}" (id=${conflicting.id})`);
                            await prisma.task.delete({ where: { id: conflicting.id } });
                        }
                    }

                    // Update existing task with new title and data
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
                    const deadlineStr = dueDateObj ? dueDateObj.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : 'No Deadline';

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

    // Cleanup: Remove duplicate tasks across all user's courses
    // Find tasks with same URL but different titles (leftovers from before normalization)
    const allUserTasks = await prisma.task.findMany({
        where: { userId, isDeleted: false },
        orderBy: { createdAt: 'asc' }
    });

    // Group by URL
    const tasksByUrl = new Map<string, typeof allUserTasks>();
    for (const task of allUserTasks) {
        if (!task.url) continue;
        const existing = tasksByUrl.get(task.url) || [];
        existing.push(task);
        tasksByUrl.set(task.url, existing);
    }

    // Delete duplicates: keep the NEWEST task (most recently synced = latest name from SPADA)
    for (const [url, duplicates] of tasksByUrl) {
        if (duplicates.length <= 1) continue;

        // Sort by ID descending: highest ID = most recently created/synced = latest name
        duplicates.sort((a, b) => b.id - a.id);

        const keep = duplicates[0];
        const toDelete = duplicates.slice(1);

        for (const dup of toDelete) {
            console.log(`[CourseService] Deleting duplicate task: "${dup.title}" (id=${dup.id}), keeping: "${keep.title}" (id=${keep.id})`);
            await prisma.task.delete({ where: { id: dup.id } });
        }
    }
};
