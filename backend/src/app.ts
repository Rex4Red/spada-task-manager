import dotenv from 'dotenv';
import dns from 'dns';
// Force restart for Prisma Client update
dotenv.config();

// Fix for ENOTFOUND api.telegram.org in Node 17+ (forces IPv4)
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes';
import scraperRoutes from './routes/scraperRoutes';
import courseRoutes from './routes/courseRoutes';
import taskRoutes from './routes/taskRoutes';
import settingsRoutes from './routes/settingsRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import adminRoutes from './routes/adminRoutes';
import whatsappRoutes from './routes/whatsappRoutes';

// Services
import { TelegramService } from './services/telegramService';
import { DiscordService } from './services/discordService';
import { WhatsAppService } from './services/whatsappService';
import { SchedulerService } from './services/schedulerService';

const app = express();

// Initialize Services
export const telegramService = new TelegramService(process.env.TELEGRAM_BOT_TOKEN || '');
export const discordService = new DiscordService();
export const whatsappService = new WhatsAppService();
const schedulerService = new SchedulerService(telegramService, discordService);
schedulerService.init();

// WhatsApp via Fonnte HTTP API - no init needed

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Serve screenshots as static files (for WhatsApp notification links)
app.use('/screenshots', express.static(path.join(process.cwd(), 'screenshots')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Base route
app.get('/', (req, res) => {
    res.send('SPADA Task Manager API is running');
});

const PORT = process.env.PORT || 7860;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;
