import express from 'express';
import { protect } from '../middlewares/authMiddleware';
import {
    getSchedule,
    updateSchedule,
    deleteSchedule,
    testAttendance,
    getLogs
} from '../controllers/attendanceController';

const router = express.Router();

// All routes require authentication
router.get('/:courseId', protect, getSchedule);
router.put('/:courseId', protect, updateSchedule);
router.delete('/:courseId', protect, deleteSchedule);
router.post('/:courseId/test', protect, testAttendance);
router.get('/:courseId/logs', protect, getLogs);

export default router;
