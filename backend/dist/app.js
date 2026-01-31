"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const dns_1 = __importDefault(require("dns"));
// Force restart for Prisma Client update
dotenv_1.default.config();
// Fix for ENOTFOUND api.telegram.org in Node 17+ (forces IPv4)
if (dns_1.default.setDefaultResultOrder) {
    dns_1.default.setDefaultResultOrder('ipv4first');
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const scraperRoutes_1 = __importDefault(require("./routes/scraperRoutes"));
const courseRoutes_1 = __importDefault(require("./routes/courseRoutes"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const settingsRoutes_1 = __importDefault(require("./routes/settingsRoutes"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
// Services
const telegramService_1 = require("./services/telegramService");
const schedulerService_1 = require("./services/schedulerService");
const app = (0, express_1.default)();
// Initialize Services
exports.telegramService = new telegramService_1.TelegramService(process.env.TELEGRAM_BOT_TOKEN || '');
const schedulerService = new schedulerService_1.SchedulerService(exports.telegramService);
schedulerService.init();
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
// Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/scraper', scraperRoutes_1.default);
app.use('/api/courses', courseRoutes_1.default);
app.use('/api/tasks', taskRoutes_1.default);
app.use('/api/settings', settingsRoutes_1.default);
app.use('/api/attendance', attendanceRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
// Base route
app.get('/', (req, res) => {
    res.send('SPADA Task Manager API is running');
});
const PORT = process.env.PORT || 7860;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
exports.default = app;
