"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const settingsController_1 = require("../controllers/settingsController");
const router = express_1.default.Router();
router.get('/', authMiddleware_1.protect, settingsController_1.getSettings);
router.put('/telegram', authMiddleware_1.protect, settingsController_1.updateTelegramSettings);
router.post('/telegram/test', authMiddleware_1.protect, settingsController_1.testTelegramNotification);
router.put('/spada', authMiddleware_1.protect, settingsController_1.updateSpadaSettings);
exports.default = router;
