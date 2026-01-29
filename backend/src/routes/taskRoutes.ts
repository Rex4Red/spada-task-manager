import { Router } from 'express';
import { deleteTask } from '../controllers/taskController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

// Apply auth middleware to all routes
router.use(protect);

router.delete('/:id', deleteTask);

export default router;
