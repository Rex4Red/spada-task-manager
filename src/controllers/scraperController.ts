import { Request, Response } from 'express';
import { SpadaApiService } from '../services/spadaApiService';
import prisma from '../config/database';
import { saveCoursesToDb } from '../services/courseService';
import { encrypt, decrypt } from '../utils/encryption';


export const testScraping = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ message: 'Username and password are required' });
        return;
    }

    try {
        const api = new SpadaApiService();
        const success = await api.login(username, password);

        if (success) {
            res.status(200).json({ message: 'Login successful!' });
        } else {
            res.status(401).json({ message: 'Login failed' });
        }
    } catch (error: any) {
        res.status(500).json({ message: 'Login test error', error: error.message });
    }
};

export const syncCourses = async (req: Request, res: Response) => {
    const { username, password } = req.body || {};
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
            res.status(400).json({
                message: 'SPADA credentials not configured. Please add your username and password in Settings.',
                code: 'CREDENTIALS_MISSING'
            });
            return;
        }
    }

    try {
        console.log('Starting sync process via API...');
        const api = new SpadaApiService();
        const isLoggedIn = await api.login(u, p);

        if (!isLoggedIn) {
            res.status(401).json({
                message: 'Login to SPADA failed. Please check your username and password in Settings.',
                code: 'LOGIN_FAILED'
            });
            return;
        }

        // Fetch all in-progress courses from SPADA (manual sync = discovery)
        const courses = await api.getCourses();
        console.log(`Got ${courses.length} in-progress courses from API`);

        if (courses.length === 0) {
            res.status(200).json({
                message: 'No in-progress courses found in your SPADA account.',
                code: 'NO_COURSES',
                data: []
            });
            return;
        }

        const coursesWithAssignments = [];

        for (const course of courses) {
            console.log(`Fetching assignments for: ${course.fullname} (${course.id})`);
            const assignments = await api.getAssignments(String(course.id));
            coursesWithAssignments.push({
                id: String(course.id),
                name: course.fullname,
                url: course.viewurl || `https://spada.upnyk.ac.id/course/view.php?id=${course.id}`,
                assignments
            });
        }

        // Save to Database
        await saveCoursesToDb(userId, coursesWithAssignments);

        res.status(200).json({
            message: `Successfully synced ${coursesWithAssignments.length} courses from SPADA`,
            code: 'SUCCESS',
            data: coursesWithAssignments
        });

    } catch (error: any) {
        console.error('Sync error:', error);
        res.status(500).json({
            message: 'Sync error: ' + error.message,
            code: 'SYNC_ERROR',
            error: error.message
        });
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
        // Extract course ID from URL
        const idMatch = courseUrl.match(/id=(\d+)/);
        if (!idMatch) {
            res.status(400).json({ message: 'Invalid course URL — could not extract course ID' });
            return;
        }
        const courseId = idMatch[1];

        console.log(`Starting sync for course ${courseId} via API...`);
        const api = new SpadaApiService();
        const isLoggedIn = await api.login(username, password);

        if (!isLoggedIn) {
            res.status(401).json({ message: 'Login failed. Please check your credentials.' });
            return;
        }

        // Get course info from course list
        const allCourses = await api.getCourses();
        const courseInfo = allCourses.find(c => String(c.id) === courseId);
        const courseName = courseInfo?.fullname || `Course ${courseId}`;

        // Get assignments
        const assignments = await api.getAssignments(courseId);

        const courseData = {
            id: courseId,
            name: courseName,
            url: courseUrl,
            assignments
        };

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

        // Save Course to Database
        await saveCoursesToDb(userId, [courseData]);

        res.status(200).json({
            message: 'Course synced & saved successfully. Auto-sync enabled.',
            data: courseData
        });

    } catch (error: any) {
        console.error('Manual sync error:', error);
        res.status(500).json({ message: 'Sync error', error: error.message });
    }
};
