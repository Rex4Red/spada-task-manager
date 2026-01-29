import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { encrypt } from '../utils/encryption';

const generateToken = (id: number) => {
    return jwt.sign({ id }, process.env.JWT_SECRET as string, {
        expiresIn: (process.env.JWT_EXPIRES_IN || '30d') as any,
    });
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

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Encrypt SPADA password if provided
        const encryptedSpadaPassword = spadaPassword ? encrypt(spadaPassword) : null;

        const user = await prisma.user.create({
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

        if (user && (await bcrypt.compare(password, user.password))) {
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
