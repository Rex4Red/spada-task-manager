"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const attendanceController_1 = require("../controllers/attendanceController");
const router = express_1.default.Router();
// All routes require authentication
router.get('/:courseId', authMiddleware_1.protect, attendanceController_1.getSchedule);
router.put('/:courseId', authMiddleware_1.protect, attendanceController_1.updateSchedule);
router.delete('/:courseId', authMiddleware_1.protect, attendanceController_1.deleteSchedule);
router.post('/:courseId/test', authMiddleware_1.protect, attendanceController_1.testAttendance);
router.get('/:courseId/logs', authMiddleware_1.protect, attendanceController_1.getLogs);
exports.default = router;
