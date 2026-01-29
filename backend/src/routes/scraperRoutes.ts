import express from 'express';
import { testScraping, syncCourses, scrapeSpecificCourse } from '../controllers/scraperController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

// Define routes
router.post('/test-login', protect, testScraping);
router.post('/sync', protect, syncCourses);
router.post('/course', protect, scrapeSpecificCourse);

export default router;
