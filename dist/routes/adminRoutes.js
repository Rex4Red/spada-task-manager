"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuthController_1 = require("../controllers/adminAuthController");
const adminController_1 = require("../controllers/adminController");
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
// Auth routes (no middleware required)
router.post('/auth/login', adminAuthController_1.adminLogin);
// Protected routes (require admin token)
router.get('/auth/verify', adminAuth_1.adminAuth, adminAuthController_1.verifyAdminToken);
router.get('/stats', adminAuth_1.adminAuth, adminController_1.getStats);
router.get('/users', adminAuth_1.adminAuth, adminController_1.getUsers);
router.get('/users/:id', adminAuth_1.adminAuth, adminController_1.getUserDetail);
router.delete('/users/:id', adminAuth_1.adminAuth, adminController_1.deleteUser);
router.get('/activity', adminAuth_1.adminAuth, adminController_1.getRecentActivity);
exports.default = router;
