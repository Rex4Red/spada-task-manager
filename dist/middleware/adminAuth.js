"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const adminAuth = (req, res, next) => {
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
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            // Verify this is an admin token
            if (decoded.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }
            req.admin = decoded;
            next();
        }
        catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired admin token'
            });
        }
    }
    catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.adminAuth = adminAuth;
