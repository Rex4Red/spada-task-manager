import { Request, Response } from 'express';
import prisma from '../config/database';

export const deleteTask = async (req: Request, res: Response) => {
    const taskId = parseInt(req.params.id as string);

    if (isNaN(taskId)) {
        res.status(400).json({ message: 'Invalid task ID' });
        return;
    }

    try {
        // Soft delete the task
        const task = await prisma.task.update({
            where: { id: taskId },
            data: { isDeleted: true }
        });

        res.status(200).json({ message: 'Task deleted successfully', data: task });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Failed to delete task' });
    }
};
