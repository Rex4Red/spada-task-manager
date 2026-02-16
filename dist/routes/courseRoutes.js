"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const courseController_1 = require("../controllers/courseController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
router.get('/', authMiddleware_1.protect, courseController_1.getCourses);
router.get('/tasks', authMiddleware_1.protect, courseController_1.getTasks);
router.delete('/:id', authMiddleware_1.protect, courseController_1.deleteCourse);
exports.default = router;
