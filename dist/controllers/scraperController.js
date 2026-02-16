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
exports.scrapeSpecificCourse = exports.syncCourses = exports.testScraping = void 0;
const scraperService_1 = require("../services/scraperService");
const database_1 = __importDefault(require("../config/database"));
const courseService_1 = require("../services/courseService");
const encryption_1 = require("../utils/encryption");
const scraperService = new scraperService_1.ScraperService();
const testScraping = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({ message: 'Username and password are required' });
        return;
    }
    try {
        const success = yield scraperService.login(username, password);
        yield scraperService.close();
        if (success) {
            res.status(200).json({ message: 'Login successful!' });
        }
        else {
            res.status(401).json({ message: 'Login failed' });
        }
    }
    catch (error) {
        yield scraperService.close();
        res.status(500).json({ message: 'Scraping error', error: error.message });
    }
});
exports.testScraping = testScraping;
const syncCourses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    const userId = req.user.id;
    // Use stored credentials if not provided
    let u = username;
    let p = password;
    if (!u || !p) {
        const user = yield database_1.default.user.findUnique({ where: { id: userId } });
        if (user && user.spadaUsername && user.spadaPassword) {
            u = user.spadaUsername;
            p = (0, encryption_1.decrypt)(user.spadaPassword);
        }
        else {
            res.status(400).json({ message: 'Credentials required' });
            return;
        }
    }
    try {
        console.log('Starting sync process...');
        const isLoggedIn = yield scraperService.login(u, p);
        if (!isLoggedIn) {
            res.status(401).json({ message: 'Login failed' });
            return;
        }
        const courses = yield scraperService.scrapeCourses();
        console.log(`Scraped ${courses.length} courses`);
        const coursesWithAssignments = [];
        const coursesToScrape = courses; // No limit
        for (const course of coursesToScrape) {
            console.log(`Scraping assignments for course: ${course.name}`);
            const assignments = yield scraperService.scrapeAssignments(course.id);
            coursesWithAssignments.push(Object.assign(Object.assign({}, course), { assignments }));
        }
        yield scraperService.close();
        // Save to Database
        yield (0, courseService_1.saveCoursesToDb)(userId, coursesWithAssignments);
        res.status(200).json({
            message: 'Sync successful & saved to database',
            data: coursesWithAssignments
        });
    }
    catch (error) {
        console.error('Sync error:', error);
        yield scraperService.close();
        res.status(500).json({ message: 'Sync error', error: error.message });
    }
});
exports.syncCourses = syncCourses;
const scrapeSpecificCourse = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let { username, password, courseUrl } = req.body;
    const userId = req.user.id;
    if (!courseUrl) {
        res.status(400).json({ message: 'Course URL is required' });
        return;
    }
    // Fallback to stored credentials if not provided
    if (!username || !password) {
        const user = yield database_1.default.user.findUnique({ where: { id: userId } });
        if (user && user.spadaUsername && user.spadaPassword) {
            username = user.spadaUsername;
            password = (0, encryption_1.decrypt)(user.spadaPassword);
        }
        else {
            res.status(400).json({
                message: 'Credentials required',
                code: 'CREDENTIALS_REQUIRED'
            });
            return;
        }
    }
    try {
        console.log(`Starting manual scrape for: ${courseUrl}`);
        const isLoggedIn = yield scraperService.login(username, password);
        if (!isLoggedIn) {
            res.status(401).json({ message: 'Login failed. Please check your credentials.' });
            return;
        }
        const courseData = yield scraperService.scrapeCourseByUrl(courseUrl);
        yield scraperService.close();
        // Only update DB credentials if they were provided in the request (meaning new/updated)
        if (req.body.username && req.body.password) {
            const encryptedPassword = (0, encryption_1.encrypt)(password);
            yield database_1.default.user.update({
                where: { id: userId },
                data: {
                    spadaUsername: username,
                    spadaPassword: encryptedPassword
                }
            });
        }
        // 2. Save Course to Database
        yield (0, courseService_1.saveCoursesToDb)(userId, [courseData]);
        res.status(200).json({
            message: 'Course scraped & saved successfully. Auto-sync enabled.',
            data: courseData
        });
    }
    catch (error) {
        console.error('Manual scrape error:', error);
        yield scraperService.close();
        res.status(500).json({ message: 'Scraping error', error: error.message });
    }
});
exports.scrapeSpecificCourse = scrapeSpecificCourse;
