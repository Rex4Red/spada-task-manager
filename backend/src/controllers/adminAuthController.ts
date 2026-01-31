import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Hardcoded admin credentials
const ADMIN_CREDENTIALS = {
    username: 'Sonia',
    // Pre-hashed password for "Nini123"
    passwordHash: bcrypt.hashSync('Nini123', 10)
};

export const adminLogin = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Check username
        if (username !== ADMIN_CREDENTIALS.username) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, ADMIN_CREDENTIALS.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate admin JWT token
        const token = jwt.sign(
            {
                id: 'admin',
                username: ADMIN_CREDENTIALS.username,
                role: 'admin'
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Admin login successful',
            data: {
                token,
                admin: {
                    username: ADMIN_CREDENTIALS.username,
                    role: 'admin'
                }
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const verifyAdminToken = async (req: Request, res: Response) => {
    try {
        // Token already verified by middleware, just return success
        res.json({
            success: true,
            data: {
                username: 'Sonia',
                role: 'admin'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
