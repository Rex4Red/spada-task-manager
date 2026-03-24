// SPADA Task Manager - Task Controller
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

export const updateTaskDeadline = async (req: Request, res: Response) => {
    const taskId = parseInt(req.params.id as string);
    const userId = (req as any).userId;
    const { customDeadline } = req.body;

    if (isNaN(taskId)) {
        res.status(400).json({ message: 'Invalid task ID' });
        return;
    }

    try {
        // Verify task belongs to user
        const task = await prisma.task.findFirst({
            where: { id: taskId, userId }
        });

        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        // Update custom deadline (null to clear)
        const updated = await prisma.task.update({
            where: { id: taskId },
            data: {
                customDeadline: customDeadline ? new Date(customDeadline) : null
            },
            include: { course: true }
        });

        console.log(`[Task] Custom deadline ${customDeadline ? 'set' : 'cleared'} for task ${taskId}: ${customDeadline || 'null'}`);

        res.status(200).json({
            message: customDeadline ? 'Custom deadline set' : 'Custom deadline cleared',
            data: updated
        });
    } catch (error) {
        console.error('Error updating task deadline:', error);
        res.status(500).json({ message: 'Failed to update deadline' });
    }
};
