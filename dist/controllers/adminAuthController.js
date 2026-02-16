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
// Hardcoded admin credentials
const ADMIN_CREDENTIALS = {
    username: 'Sonia',
    // Pre-hashed password for "Nini123"
    passwordHash: bcrypt_1.default.hashSync('Nini123', 10)
};
const adminLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const isPasswordValid = yield bcrypt_1.default.compare(password, ADMIN_CREDENTIALS.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        // Generate admin JWT token
        const token = jsonwebtoken_1.default.sign({
            id: 'admin',
            username: ADMIN_CREDENTIALS.username,
            role: 'admin'
        }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
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
                username: 'Sonia',
                role: 'admin'
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
exports.verifyAdminToken = verifyAdminToken;
