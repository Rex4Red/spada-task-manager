import { Router } from 'express';
import { deleteTask, updateTaskDeadline } from '../controllers/taskController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

// Apply auth middleware to all routes
router.use(protect);

router.delete('/:id', deleteTask);
router.patch('/:id/deadline', updateTaskDeadline);

export default router;
