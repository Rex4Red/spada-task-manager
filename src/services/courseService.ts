import prisma from '../config/database';
import { telegramService, discordService, whatsappService } from '../app';
import { DiscordColors } from './discordService';

/**
 * Parse SPADA/Moodle date strings like:
 * - "Wednesday, 26 February 2025, 11:59 PM"
 * - "Rabu, 26 Februari 2025, 23:59"
 * - "26 February 2025, 11:59 PM"
 * - "2025-02-26"
 * 
 * IMPORTANT: SPADA displays dates in WIB (UTC+7).
 * We subtract 7 hours to convert to UTC for storage.
 */
function parseSpadaDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr || dateStr === 'Unknown' || dateStr === '-' || dateStr === 'No date') return null;

    // WIB offset: 7 hours in milliseconds
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

    // Indonesian month names → English
    const idMonths: Record<string, string> = {
        'januari': 'January', 'februari': 'February', 'maret': 'March',
        'april': 'April', 'mei': 'May', 'juni': 'June',
        'juli': 'July', 'agustus': 'August', 'september': 'September',
        'oktober': 'October', 'november': 'November', 'desember': 'December'
    };

    let cleaned = dateStr.trim();

    // Replace Indonesian month names with English
    for (const [id, en] of Object.entries(idMonths)) {
        cleaned = cleaned.replace(new RegExp(id, 'gi'), en);
    }

    // Strip day-of-week prefix (e.g., "Wednesday, " or "Rabu, ")
    cleaned = cleaned.replace(/^[A-Za-z]+,\s*/, '');

    // Helper: convert WIB date to UTC
    const toUTC = (date: Date): Date => new Date(date.getTime() - WIB_OFFSET_MS);

    // Try direct parse first
    let parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
        return toUTC(parsed);
    }

    // Try removing the last comma before time
    const noComma = cleaned.replace(/,\s*(\d{1,2}[:.]\d{2})/, ' $1');
    parsed = new Date(noComma);
    if (!isNaN(parsed.getTime())) {
        return toUTC(parsed);
    }

    // Try regex: "DD Month YYYY, HH:MM" or "DD Month YYYY, HH:MM AM/PM"
    const match = cleaned.match(/(\d{1,2})\s+(\w+)\s+(\d{4}),?\s*(\d{1,2})[:\.](\d{2})\s*(AM|PM)?/i);
    if (match) {
        const [, day, month, year, hours, minutes, ampm] = match;
        let h = parseInt(hours);
        if (ampm) {
            if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
            if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
        }
        const dateString = `${month} ${day}, ${year} ${h.toString().padStart(2, '0')}:${minutes}:00`;
        parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
            return toUTC(parsed);
        }
    }

    console.warn(`[DateParser] Could not parse SPADA date: "${dateStr}"`);
    return null;
}

export const saveCoursesToDb = async (userId: number, courses: any[]) => {
    // console.log(`Saving ${courses.length} courses to database for user ${userId}...`);

    // 1. Get User's Notification Configs
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            telegramConfig: true,
            discordConfig: true,
            whatsappConfig: true
        }
    });
    const telegramConfig = user?.telegramConfig;
    const discordConfig = user?.discordConfig;
    const whatsappConfig = user?.whatsappConfig;


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
                let dueDateObj = parseSpadaDate(assignment.dueDate);

                // Check if task already exists to determine if it's NEW
                const existingTask = await prisma.task.findUnique({
                    where: {
                        courseId_title: {
                            courseId: savedCourse.id,
                            title: assignment.name
                        }
                    }
                });

                const savedTask = await prisma.task.upsert({
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

                    // WhatsApp Notification
                    if (whatsappConfig && whatsappConfig.isActive && whatsappConfig.phoneNumber) {
                        const waMessage = `🆕 *New Task Detected!*

📚 *Course:* ${course.name}
📝 *Task:* ${assignment.name}
📅 *Deadline:* ${deadlineStr}
🔗 *Link:* ${assignment.url}

_SPADA Task Manager_`;
                        whatsappService.sendMessage(whatsappConfig.phoneNumber, waMessage).catch(err => {
                            console.error('Failed to send WhatsApp notification:', err);
                        });
                    }
                }
            }
        }
    }
};
