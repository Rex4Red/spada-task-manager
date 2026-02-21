import { Router } from 'express';
import { adminLogin, verifyAdminToken } from '../controllers/adminAuthController';
import {
    getStats,
    getUsers,
    getUserDetail,
    deleteUser,
    getRecentActivity,
    cleanupOrphanData,
    getAdminSettings,
    updateAdminSettings,
    testAdminNotification
} from '../controllers/adminController';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();

// Auth routes (no middleware required)
router.post('/auth/login', adminLogin);

// Protected routes (require admin token)
router.get('/auth/verify', adminAuth, verifyAdminToken);
router.get('/stats', adminAuth, getStats);
router.get('/users', adminAuth, getUsers);
router.get('/users/:id', adminAuth, getUserDetail);
router.delete('/users/:id', adminAuth, deleteUser);
router.get('/activity', adminAuth, getRecentActivity);
router.post('/cleanup', adminAuth, cleanupOrphanData);

// Admin settings routes
router.get('/settings', adminAuth, getAdminSettings);
router.put('/settings', adminAuth, updateAdminSettings);
router.post('/settings/test-notification', adminAuth, testAdminNotification);

export default router;


