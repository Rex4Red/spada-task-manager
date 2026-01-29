import { Request, Response } from 'express';
import { ScraperService } from '../services/scraperService';
import prisma from '../config/database';
import { saveCoursesToDb } from '../services/courseService';
import { encrypt, decrypt } from '../utils/encryption';


const scraperService = new ScraperService();

export const testScraping = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ message: 'Username and password are required' });
        return;
    }

    try {
        const success = await scraperService.login(username, password);
        await scraperService.close();

        if (success) {
            res.status(200).json({ message: 'Login successful!' });
        } else {
            res.status(401).json({ message: 'Login failed' });
        }
    } catch (error: any) {
        await scraperService.close();
        res.status(500).json({ message: 'Scraping error', error: error.message });
    }
};

export const syncCourses = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const userId = (req as any).user.id;

    // Use stored credentials if not provided
    let u = username;
    let p = password;

    if (!u || !p) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user && user.spadaUsername && user.spadaPassword) {
            u = user.spadaUsername;
            p = decrypt(user.spadaPassword);
        } else {
            res.status(400).json({ message: 'Credentials required' });
            return;
        }
    }

    try {
        console.log('Starting sync process...');
        const isLoggedIn = await scraperService.login(u, p);

        if (!isLoggedIn) {
            res.status(401).json({ message: 'Login failed' });
            return;
        }

        const courses = await scraperService.scrapeCourses();
        console.log(`Scraped ${courses.length} courses`);

        const coursesWithAssignments = [];
        const coursesToScrape = courses; // No limit

        for (const course of coursesToScrape) {
            console.log(`Scraping assignments for course: ${course.name}`);
            const assignments = await scraperService.scrapeAssignments(course.id);
            coursesWithAssignments.push({
                ...course,
                assignments
            });
        }

        await scraperService.close();

        // Save to Database
        await saveCoursesToDb(userId, coursesWithAssignments);

        res.status(200).json({
            message: 'Sync successful & saved to database',
            data: coursesWithAssignments
        });

    } catch (error: any) {
        console.error('Sync error:', error);
        await scraperService.close();
        res.status(500).json({ message: 'Sync error', error: error.message });
    }
};

export const scrapeSpecificCourse = async (req: Request, res: Response) => {
    let { username, password, courseUrl } = req.body;
    const userId = (req as any).user.id;

    if (!courseUrl) {
        res.status(400).json({ message: 'Course URL is required' });
        return;
    }

    // Fallback to stored credentials if not provided
    if (!username || !password) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user && user.spadaUsername && user.spadaPassword) {
            username = user.spadaUsername;
            password = decrypt(user.spadaPassword);
        } else {
            res.status(400).json({
                message: 'Credentials required',
                code: 'CREDENTIALS_REQUIRED'
            });
            return;
        }
    }

    try {
        console.log(`Starting manual scrape for: ${courseUrl}`);
        const isLoggedIn = await scraperService.login(username, password);

        if (!isLoggedIn) {
            res.status(401).json({ message: 'Login failed. Please check your credentials.' });
            return;
        }

        const courseData = await scraperService.scrapeCourseByUrl(courseUrl);
        await scraperService.close();

        // Only update DB credentials if they were provided in the request (meaning new/updated)
        if (req.body.username && req.body.password) {
            const encryptedPassword = encrypt(password);
            await prisma.user.update({
                where: { id: userId },
                data: {
                    spadaUsername: username,
                    spadaPassword: encryptedPassword
                }
            });
        }

        // 2. Save Course to Database
        await saveCoursesToDb(userId, [courseData]);

        res.status(200).json({
            message: 'Course scraped & saved successfully. Auto-sync enabled.',
            data: courseData
        });

    } catch (error: any) {
        console.error('Manual scrape error:', error);
        await scraperService.close();
        res.status(500).json({ message: 'Scraping error', error: error.message });
    }
};
