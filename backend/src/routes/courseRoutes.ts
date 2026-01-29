import express from 'express';
import { getCourses, getTasks, deleteCourse } from '../controllers/courseController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/', protect, getCourses);
router.get('/tasks', protect, getTasks);
router.delete('/:id', protect, deleteCourse);

export default router;
