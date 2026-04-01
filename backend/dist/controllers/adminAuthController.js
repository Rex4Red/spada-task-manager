"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAdminToken = exports.adminLogin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
// Rate limiting: track failed login attempts per IP
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
// Admin credentials from environment (fallback to defaults for dev)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
// Pre-hash the password at startup
let adminPasswordHash;
try {
    adminPasswordHash = bcrypt_1.default.hashSync(ADMIN_PASSWORD, 10);
}
catch (_a) {
    adminPasswordHash = bcrypt_1.default.hashSync('admin123', 10);
}
/**
 * Clean up old entries from the rate limit map (every 30 minutes)
 */
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of loginAttempts.entries()) {
        if (now - data.lastAttempt > BLOCK_DURATION_MS) {
            loginAttempts.delete(ip);
        }
    }
}, 30 * 60 * 1000);
const adminLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, password } = req.body;
        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
        // Check rate limit
        const attempts = loginAttempts.get(clientIp);
        if (attempts && attempts.count >= MAX_ATTEMPTS) {
            const timeSinceBlock = Date.now() - attempts.lastAttempt;
            if (timeSinceBlock < BLOCK_DURATION_MS) {
                const remainingMin = Math.ceil((BLOCK_DURATION_MS - timeSinceBlock) / 60000);
                console.log(`[AdminAuth] IP ${clientIp} blocked for ${remainingMin} more minutes`);
                return res.status(429).json({
                    success: false,
                    message: `Too many failed attempts. Try again in ${remainingMin} minutes.`
                });
            }
            else {
                // Block expired, reset
                loginAttempts.delete(clientIp);
            }
        }
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }
        // Check username
        if (username !== ADMIN_USERNAME) {
            // Track failed attempt
            const current = loginAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
            loginAttempts.set(clientIp, { count: current.count + 1, lastAttempt: Date.now() });
            console.log(`[AdminAuth] Failed login from ${clientIp} (attempt ${current.count + 1}/${MAX_ATTEMPTS})`);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        // Check password
        const isPasswordValid = yield bcrypt_1.default.compare(password, adminPasswordHash);
        if (!isPasswordValid) {
            // Track failed attempt
            const current = loginAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
            loginAttempts.set(clientIp, { count: current.count + 1, lastAttempt: Date.now() });
            console.log(`[AdminAuth] Failed login from ${clientIp} (attempt ${current.count + 1}/${MAX_ATTEMPTS})`);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        // Successful login - reset attempts
        loginAttempts.delete(clientIp);
        // Generate admin JWT token
        const token = jsonwebtoken_1.default.sign({
            id: 'admin',
            username: ADMIN_USERNAME,
            role: 'admin'
        }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
        console.log(`[AdminAuth] Successful login from ${clientIp}`);
        res.json({
            success: true,
            message: 'Admin login successful',
            data: {
                token,
                admin: {
                    username: ADMIN_USERNAME,
                    role: 'admin'
                }
            }
        });
    }
    catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
exports.adminLogin = adminLogin;
const verifyAdminToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Token already verified by middleware, just return success
        res.json({
            success: true,
            data: {
                username: ADMIN_USERNAME,
                role: 'admin'
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
exports.verifyAdminToken = verifyAdminToken;
