"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = exports.discordService = exports.telegramService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const dns_1 = __importDefault(require("dns"));
// Force restart for Prisma Client update
dotenv_1.default.config();
// Fix for ENOTFOUND api.telegram.org in Node 17+ (forces IPv4)
if (dns_1.default.setDefaultResultOrder) {
    dns_1.default.setDefaultResultOrder('ipv4first');
}
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
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
const whatsappRoutes_1 = __importDefault(require("./routes/whatsappRoutes"));
// Services
const telegramService_1 = require("./services/telegramService");
const discordService_1 = require("./services/discordService");
const whatsappService_1 = require("./services/whatsappService");
const schedulerService_1 = require("./services/schedulerService");
const app = (0, express_1.default)();
// Initialize Services
exports.telegramService = new telegramService_1.TelegramService(process.env.TELEGRAM_BOT_TOKEN || '');
exports.discordService = new discordService_1.DiscordService();
exports.whatsappService = new whatsappService_1.WhatsAppService();
const schedulerService = new schedulerService_1.SchedulerService(exports.telegramService, exports.discordService);
schedulerService.init();
// WhatsApp via Fonnte HTTP API - no init needed
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
// Serve screenshots as static files (for WhatsApp notification links)
app.use('/screenshots', express_1.default.static(path_1.default.join(process.cwd(), 'screenshots')));
// Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/scraper', scraperRoutes_1.default);
app.use('/api/courses', courseRoutes_1.default);
app.use('/api/tasks', taskRoutes_1.default);
app.use('/api/settings', settingsRoutes_1.default);
app.use('/api/attendance', attendanceRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/whatsapp', whatsappRoutes_1.default);
// Serve frontend static files (built Vite app)
const publicPath = path_1.default.join(__dirname, 'public');
app.use(express_1.default.static(publicPath));
// SPA fallback - any non-API route serves index.html
app.get('*', (req, res) => {
    const indexPath = path_1.default.join(publicPath, 'index.html');
    // Only serve index.html if it exists (production build)
    if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
    }
    else {
        res.send('SPADA Task Manager API is running');
    }
});
const PORT = process.env.PORT || 7860;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
exports.default = app;
