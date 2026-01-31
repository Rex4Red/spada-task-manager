"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const taskController_1 = require("../controllers/taskController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// Apply auth middleware to all routes
router.use(authMiddleware_1.protect);
router.delete('/:id', taskController_1.deleteTask);
exports.default = router;
