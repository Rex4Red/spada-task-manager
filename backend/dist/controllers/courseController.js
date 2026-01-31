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
exports.deleteCourse = exports.getTasks = exports.getCourses = void 0;
const database_1 = __importDefault(require("../config/database"));
const getCourses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    try {
        const courses = yield database_1.default.course.findMany({
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
    }
    catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ message: 'Error retrieving courses', error: error.message });
    }
});
exports.getCourses = getCourses;
const getTasks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    try {
        const tasks = yield database_1.default.task.findMany({
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
    }
    catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ message: 'Error retrieving tasks', error: error.message });
    }
});
exports.getTasks = getTasks;
const deleteCourse = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const courseId = parseInt(req.params.id);
    if (isNaN(courseId)) {
        res.status(400).json({ message: 'Invalid course ID' });
        return;
    }
    try {
        const updatedCourse = yield database_1.default.course.update({
            where: { id: courseId },
            data: { isDeleted: true }
        });
        res.status(200).json({ message: 'Course deleted successfully', data: updatedCourse });
    }
    catch (error) {
        console.error('Delete course error:', error);
        res.status(500).json({ message: 'Error deleting course', error: error.message });
    }
});
exports.deleteCourse = deleteCourse;
