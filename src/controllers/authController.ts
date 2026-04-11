import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database';
import { encrypt } from '../utils/encryption';
import { whatsappService } from '../app';

const generateToken = (id: number) => {
    return jwt.sign({ id }, process.env.JWT_SECRET as string, {
        expiresIn: (process.env.JWT_EXPIRES_IN || '30d') as any,
    });
};

// Rate limiting for forgot password (in-memory)
const resetAttempts = new Map<string, { count: number; resetAt: number }>();

const checkRateLimit = (email: string): boolean => {
    const key = email.toLowerCase();
    const now = Date.now();
    const entry = resetAttempts.get(key);

    if (entry && now < entry.resetAt) {
        if (entry.count >= 5) return false; // Blocked
        entry.count++;
        return true;
    }

    // Reset or create new entry (1 hour window)
    resetAttempts.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
};

// Generate 6-digit OTP
const generateOtp = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Hash OTP with SHA-256
const hashOtp = (otp: string): string => {
    return crypto.createHash('sha256').update(otp).digest('hex');
};

// Generate short-lived reset token
const generateResetToken = (userId: number): string => {
    return jwt.sign(
        { id: userId, purpose: 'password-reset' },
        process.env.JWT_SECRET as string,
        { expiresIn: '5m' }
    );
};

// Mask phone number: 628123456789 → 628***6789
const maskPhone = (phone: string): string => {
    if (phone.length <= 6) return phone;
    return phone.slice(0, 3) + '***' + phone.slice(-4);
};

export const register = async (req: Request, res: Response) => {
    console.log('Register request body:', req.body);
    const { name, email, password, spadaUsername, spadaPassword } = req.body;

    if (!name || !email || !password) {
        console.log('Register failed: Missing fields');
        return res.status(400).json({ message: 'Please provide all fields' });
    }

    try {
        const userExists = await prisma.user.findUnique({
            where: { email },
        });

        if (userExists) {
            console.log('Register failed: User already exists');
            return res.status(400).json({ message: 'User already exists' });
        }

        // Encrypt SPADA password if provided
        const encryptedSpadaPassword = spadaPassword ? encrypt(spadaPassword) : null;

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password,
                spadaUsername,
                spadaPassword: encryptedSpadaPassword
            },
        });

        console.log('Register success:', user.email);

        res.status(201).json({
            id: user.id,
            name: user.name,
            email: user.email,
            token: generateToken(user.id),
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const login = async (req: Request, res: Response) => {
    console.log('Login request body:', req.body);
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (user && password === user.password) {
            console.log('Login success:', user.email);
            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                token: generateToken(user.id),
            });
        } else {
            console.log('Login failed: Invalid credentials for', email);
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};

export const getMe = async (req: Request, res: Response) => {
    res.json(req.user);
};

// ===== FORGOT PASSWORD ENDPOINTS =====

/**
 * Step 1: Check email and determine verification method
 * POST /api/auth/forgot-password/check-email
 */
export const forgotPasswordCheckEmail = async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    if (!checkRateLimit(email)) {
        return res.status(429).json({ message: 'Too many attempts. Please try again later.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: { whatsappConfig: true },
        });

        if (!user) {
            // Don't reveal whether email exists (security) - but for UX, we tell them
            return res.status(404).json({ message: 'Email not registered' });
        }

        const hasWhatsApp = !!(user.whatsappConfig && user.whatsappConfig.isActive && user.whatsappConfig.phoneNumber);

        res.json({
            hasWhatsApp,
            maskedPhone: hasWhatsApp ? maskPhone(user.whatsappConfig!.phoneNumber) : null,
            hasSpadaUsername: !!user.spadaUsername,
        });
    } catch (error) {
        console.error('Forgot password check email error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Step 2a: Verify WhatsApp number and send OTP
 * POST /api/auth/forgot-password/verify-whatsapp
 */
export const forgotPasswordVerifyWhatsApp = async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;

    if (!email || !phoneNumber) {
        return res.status(400).json({ message: 'Email and phone number are required' });
    }

    if (!checkRateLimit(email)) {
        return res.status(429).json({ message: 'Too many attempts. Please try again later.' });
    }

    try {
        // Find user with WhatsApp config
        const user = await prisma.user.findUnique({
            where: { email },
            include: { whatsappConfig: true },
        });

        if (!user || !user.whatsappConfig) {
            return res.status(400).json({ message: 'Verification failed' });
        }

        // Normalize phone numbers for comparison (strip non-digits, convert 08xx to 628xx)
        const normalizePhone = (p: string) => {
            let cleaned = p.replace(/[^0-9]/g, '');
            if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
            return cleaned;
        };

        const inputPhone = normalizePhone(phoneNumber);
        const storedPhone = normalizePhone(user.whatsappConfig.phoneNumber);

        if (inputPhone !== storedPhone) {
            return res.status(400).json({ message: 'Phone number does not match' });
        }

        // Generate OTP
        const otp = generateOtp();
        const otpHash = hashOtp(otp);

        // Invalidate old OTPs for this user
        await prisma.passwordResetOtp.updateMany({
            where: { userId: user.id, used: false },
            data: { used: true },
        });

        // Save new OTP (expires in 5 minutes)
        await prisma.passwordResetOtp.create({
            data: {
                userId: user.id,
                otpHash,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            },
        });

        // Send OTP via WhatsApp
        const message = `🔐 *SPADA Task Manager*\n\nKode verifikasi reset password kamu:\n\n*${otp}*\n\nKode ini berlaku selama 5 menit.\nJangan berikan kode ini kepada siapapun.`;

        const result = await whatsappService.sendMessage(storedPhone, message);

        if (!result.success) {
            console.error('[ForgotPassword] Failed to send OTP via WhatsApp:', result.error);
            return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
        }

        console.log(`[ForgotPassword] OTP sent to ${maskPhone(storedPhone)} for user ${user.email}`);

        res.json({ success: true, message: 'OTP sent to your WhatsApp' });
    } catch (error) {
        console.error('Forgot password verify WhatsApp error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Step 2b: Verify SPADA username (fallback for users without WhatsApp)
 * POST /api/auth/forgot-password/verify-spada
 */
export const forgotPasswordVerifySpada = async (req: Request, res: Response) => {
    const { email, spadaUsername } = req.body;

    if (!email || !spadaUsername) {
        return res.status(400).json({ message: 'Email and SPADA username are required' });
    }

    if (!checkRateLimit(email)) {
        return res.status(429).json({ message: 'Too many attempts. Please try again later.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.spadaUsername) {
            return res.status(400).json({ message: 'Verification failed' });
        }

        if (user.spadaUsername.toLowerCase() !== spadaUsername.toLowerCase()) {
            return res.status(400).json({ message: 'SPADA username does not match' });
        }

        // Verification passed — generate reset token
        const resetToken = generateResetToken(user.id);

        console.log(`[ForgotPassword] SPADA username verified for user ${user.email}`);

        res.json({ success: true, resetToken });
    } catch (error) {
        console.error('Forgot password verify SPADA error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Step 3: Verify OTP (WhatsApp path)
 * POST /api/auth/forgot-password/verify-otp
 */
export const forgotPasswordVerifyOtp = async (req: Request, res: Response) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(400).json({ message: 'Verification failed' });
        }

        // Find the latest unused OTP for this user
        const otpRecord = await prisma.passwordResetOtp.findFirst({
            where: {
                userId: user.id,
                used: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!otpRecord) {
            return res.status(400).json({ message: 'OTP expired or invalid. Please request a new one.' });
        }

        // Check max attempts
        if (otpRecord.attempts >= 5) {
            await prisma.passwordResetOtp.update({
                where: { id: otpRecord.id },
                data: { used: true },
            });
            return res.status(400).json({ message: 'Too many failed attempts. Please request a new OTP.' });
        }

        // Verify OTP
        const inputHash = hashOtp(otp);
        if (inputHash !== otpRecord.otpHash) {
            await prisma.passwordResetOtp.update({
                where: { id: otpRecord.id },
                data: { attempts: otpRecord.attempts + 1 },
            });

            const remaining = 5 - (otpRecord.attempts + 1);
            return res.status(400).json({
                message: `Invalid OTP. ${remaining} attempt(s) remaining.`,
            });
        }

        // OTP valid — mark as used and generate reset token
        await prisma.passwordResetOtp.update({
            where: { id: otpRecord.id },
            data: { used: true },
        });

        const resetToken = generateResetToken(user.id);

        console.log(`[ForgotPassword] OTP verified for user ${user.email}`);

        res.json({ success: true, resetToken });
    } catch (error) {
        console.error('Forgot password verify OTP error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Step 4: Reset password with valid reset token
 * POST /api/auth/forgot-password/reset
 */
export const forgotPasswordReset = async (req: Request, res: Response) => {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
        return res.status(400).json({ message: 'Reset token and new password are required' });
    }

    if (newPassword.length < 4) {
        return res.status(400).json({ message: 'Password must be at least 4 characters' });
    }

    try {
        // Verify reset token
        const decoded = jwt.verify(resetToken, process.env.JWT_SECRET as string) as any;

        if (decoded.purpose !== 'password-reset') {
            return res.status(400).json({ message: 'Invalid reset token' });
        }

        // Update password
        await prisma.user.update({
            where: { id: decoded.id },
            data: { password: newPassword },
        });

        // Clean up all OTP records for this user
        await prisma.passwordResetOtp.deleteMany({
            where: { userId: decoded.id },
        });

        console.log(`[ForgotPassword] Password reset successful for user ID ${decoded.id}`);

        res.json({ success: true, message: 'Password has been reset successfully' });
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ message: 'Reset token expired. Please start over.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ message: 'Invalid reset token' });
        }
        console.error('Forgot password reset error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
