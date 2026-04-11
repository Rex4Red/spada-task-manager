import { Router } from 'express';
import {
    register,
    login,
    getMe,
    forgotPasswordCheckEmail,
    forgotPasswordVerifyWhatsApp,
    forgotPasswordVerifySpada,
    forgotPasswordVerifyOtp,
    forgotPasswordReset,
} from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// Forgot Password routes (no auth required)
router.post('/forgot-password/check-email', forgotPasswordCheckEmail);
router.post('/forgot-password/verify-whatsapp', forgotPasswordVerifyWhatsApp);
router.post('/forgot-password/verify-spada', forgotPasswordVerifySpada);
router.post('/forgot-password/verify-otp', forgotPasswordVerifyOtp);
router.post('/forgot-password/reset', forgotPasswordReset);

export default router;
