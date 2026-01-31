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
exports.getMe = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const encryption_1 = require("../utils/encryption");
const generateToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: (process.env.JWT_EXPIRES_IN || '30d'),
    });
};
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Register request body:', req.body);
    const { name, email, password, spadaUsername, spadaPassword } = req.body;
    if (!name || !email || !password) {
        console.log('Register failed: Missing fields');
        return res.status(400).json({ message: 'Please provide all fields' });
    }
    try {
        const userExists = yield database_1.default.user.findUnique({
            where: { email },
        });
        if (userExists) {
            console.log('Register failed: User already exists');
            return res.status(400).json({ message: 'User already exists' });
        }
        const salt = yield bcrypt_1.default.genSalt(10);
        const hashedPassword = yield bcrypt_1.default.hash(password, salt);
        // Encrypt SPADA password if provided
        const encryptedSpadaPassword = spadaPassword ? (0, encryption_1.encrypt)(spadaPassword) : null;
        const user = yield database_1.default.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
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
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error', error });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Login request body:', req.body);
    const { email, password } = req.body;
    try {
        const user = yield database_1.default.user.findUnique({
            where: { email },
        });
        if (user && (yield bcrypt_1.default.compare(password, user.password))) {
            console.log('Login success:', user.email);
            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                token: generateToken(user.id),
            });
        }
        else {
            console.log('Login failed: Invalid credentials for', email);
            res.status(401).json({ message: 'Invalid email or password' });
        }
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error', error });
    }
});
exports.login = login;
const getMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json(req.user);
});
exports.getMe = getMe;
