"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const scraperController_1 = require("../controllers/scraperController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
// Define routes
router.post('/test-login', authMiddleware_1.protect, scraperController_1.testScraping);
router.post('/sync', authMiddleware_1.protect, scraperController_1.syncCourses);
router.post('/course', authMiddleware_1.protect, scraperController_1.scrapeSpecificCourse);
exports.default = router;
