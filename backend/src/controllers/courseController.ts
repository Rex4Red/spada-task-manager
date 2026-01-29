import { Request, Response } from 'express';
import prisma from '../config/database';

export const getCourses = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    try {
        const courses = await prisma.course.findMany({
            where: {
                userId,
                isDeleted: false
            },
            include: {
                tasks: {
                    where: { isDeleted: false },
                    orderBy: {
                        deadline: 'asc'
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        res.status(200).json({
            message: 'Courses retrieved successfully',
            data: courses
        });
    } catch (error: any) {
        console.error('Get courses error:', error);
        res.status(500).json({ message: 'Error retrieving courses', error: error.message });
    }
};

export const getTasks = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    try {
        const tasks = await prisma.task.findMany({
            where: {
                userId,
                isDeleted: false,
                course: {
                    isDeleted: false
                }
            },
            include: {
                course: {
                    select: { name: true, url: true }
                }
            },
            orderBy: {
                deadline: 'asc'
            }
        });

        res.status(200).json({
            message: 'Tasks retrieved successfully',
            data: tasks
        });
    } catch (error: any) {
        console.error('Get tasks error:', error);
        res.status(500).json({ message: 'Error retrieving tasks', error: error.message });
    }
};

export const deleteCourse = async (req: Request, res: Response) => {
    const courseId = parseInt(req.params.id as string);

    if (isNaN(courseId)) {
        res.status(400).json({ message: 'Invalid course ID' });
        return;
    }

    try {
        const updatedCourse = await prisma.course.update({
            where: { id: courseId },
            data: { isDeleted: true }
        });

        res.status(200).json({ message: 'Course deleted successfully', data: updatedCourse });
    } catch (error: any) {
        console.error('Delete course error:', error);
        res.status(500).json({ message: 'Error deleting course', error: error.message });
    }
};
