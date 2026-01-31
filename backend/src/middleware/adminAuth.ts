import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AdminJwtPayload {
    id: string;
    username: string;
    role: string;
}

export interface AdminRequest extends Request {
    admin?: AdminJwtPayload;
}

export const adminAuth = (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Admin authentication required'
            });
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET || 'your-secret-key'
            ) as AdminJwtPayload;

            // Verify this is an admin token
            if (decoded.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            req.admin = decoded;
            next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired admin token'
            });
        }
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
