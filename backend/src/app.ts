import dotenv from 'dotenv';
// Force restart for Prisma Client update
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes';
import scraperRoutes from './routes/scraperRoutes';
import courseRoutes from './routes/courseRoutes';
import taskRoutes from './routes/taskRoutes';
import settingsRoutes from './routes/settingsRoutes';

// Services
import { TelegramService } from './services/telegramService';
import { SchedulerService } from './services/schedulerService';

const app = express();

// Initialize Services
export const telegramService = new TelegramService(process.env.TELEGRAM_BOT_TOKEN || '');
const schedulerService = new SchedulerService(telegramService);
schedulerService.init();

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/settings', settingsRoutes);

// Base route
app.get('/', (req, res) => {
    res.send('SPADA Task Manager API is running');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;
