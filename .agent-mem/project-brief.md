# Project Brief: spada-task-manager

## What
- Architecture: Full-stack (React/Next frontend + API backend)
- Dependency: lucide-react (imported in 3 files)
- Dependency: puppeteer (imported in 4 files)

## Tech Stack
> JavaScript/TypeScript · React + Tailwind + Express · DB: Prisma
- **Languages**: JavaScript, TypeScript
- **Frameworks**: React, Tailwind, Express
- **DB**: Prisma
- **Build**: npm, Vite, Docker

## 🗺️ Repository Map
> 86 source files, ~13,051 lines

```
./
  └── migrate-db.js                  — migrate db [M]

backend/src/
  └── app.ts                         — app — 3 exports [S]
      exports: telegramService, discordService, whatsappService

backend/src/config/
  └── database.ts                    — database [S]

backend/src/controllers/
  ├── adminAuthController.ts         — adminAuthController (adminLogin) [M]
  │   exports: adminLogin
  ├── adminController.ts             — adminController — 2 exports [M]
  │   exports: getStats, getUsers
  ├── attendanceController.ts        — attendanceController — 2 exports [L]
  │   exports: getSchedule, updateSchedule
  ├── authController.ts              — authController — 2 exports [S]
  │   exports: register, login
  ├── courseController.ts            — courseController — 3 exports [S]
  │   exports: getCourses, getTasks, deleteCourse
  ├── scraperController.ts           — scraperController — 2 exports [M]
  │   exports: testScraping, syncCourses
  ├── settingsController.ts          — settingsController — 3 exports [M]
  │   exports: updateTelegramSettings, getSettings, testTelegramNotification
  └── taskController.ts              — taskController (deleteTask) [S]
      exports: deleteTask

backend/src/middleware/
  └── adminAuth.ts                   — adminAuth — 2 exports [S]
      exports: AdminRequest, adminAuth

backend/src/middlewares/
  └── authMiddleware.ts              — authMiddleware (protect) [S]
      exports: protect

backend/src/routes/
  ├── adminRoutes.ts                 — adminRoutes [S]
  ├── attendanceRoutes.ts            — attendanceRoutes [S]
  ├── authRoutes.ts                  — authRoutes [S]
  ├── courseRoutes.ts                — courseRoutes [S]
  ├── scraperRoutes.ts               — scraperRoutes [S]
  ├── settingsRoutes.ts              — settingsRoutes [S]
  ├── taskRoutes.ts                  — taskRoutes [S]
  └── whatsappRoutes.ts              — whatsappRoutes [S]

backend/src/services/
  ├── attendanceService.ts           — attendanceService (AttendanceService) [L]
  │   exports: AttendanceService
  ├── courseService.ts               — courseService (saveCoursesToDb) [M]
  │   exports: saveCoursesToDb
  ├── discordService.ts              — discordService (DiscordService) [M]
  │   exports: DiscordService
  ├── schedulerService.ts            — schedulerService (SchedulerService) [L]
  │   exports: SchedulerService
  ├── scraperService.ts              — scraperService (ScraperService) [L]
  │   exports: ScraperService
  ├── telegramService.ts             — telegramService (TelegramService) [M]
  │   exports: TelegramService
  └── whatsappService.ts             — whatsappService (WhatsAppService) [M]
      exports: WhatsAppService

backend/src/utils/
  └── encryption.ts                  — encryption — 2 exports [S]
      exports: encrypt, decrypt

frontend/
  ├── eslint.config.js               — eslint.config [S]
  ├── postcss.config.js              — postcss.config [S]
  ├── tailwind.config.js             — tailwind.config [S]
  └── vite.config.js                 — vite.config [S]

frontend/api/
  ├── discord-proxy.js               — discord proxy [M]
  ├── telegram-photo-proxy.js        — telegram photo proxy [S]
  ├── telegram-proxy.js              — telegram proxy [S]
  └── whatsapp-proxy.js              — whatsapp proxy [S]

frontend/src/
  ├── App.jsx                        — App [M]
  └── main.jsx                       — main [S]

frontend/src/components/
  ├── AdminLayout.jsx                — AdminLayout [M]
  ├── AttendanceScheduleForm.jsx     — AttendanceScheduleForm [M]
  └── Layout.jsx                     — Layout [M]

frontend/src/context/
  ├── AdminAuthContext.jsx           — AdminAuthContext — 2 exports [S]
  │   exports: AdminAuthProvider, useAdminAuth
  └── AuthContext.jsx                — AuthContext — 2 exports [S]
      exports: AuthProvider, useAuth

frontend/src/pages/
  ├── AdminLogin.jsx                 — AdminLogin [M]
  ├── Attendance.jsx                 — Attendance [M]
  ├── Calendar.jsx                   — Calendar [L]
  ├── Dashboard.jsx                  — Dashboard [L]
  ├── Login.jsx                      — Login [M]
  ├── MyCourses.jsx                  — MyCourses [L]
  ├── Register.jsx                   — Register [M]
  └── Settings.jsx                   — Settings [L]

frontend/src/pages/admin/
  ├── AdminDashboard.jsx             — AdminDashboard [L]
  ├── AdminUserDetail.jsx            — AdminUserDetail [M]
  └── AdminUsers.jsx                 — AdminUsers [M]

frontend/src/services/
  └── api.js                         — api [S]

src/
  └── app.ts                         — app — 3 exports [S]
      exports: telegramService, discordService, whatsappService

src/config/
  └── database.ts                    — database [S]

src/controllers/
  ├── adminAuthController.ts         — adminAuthController (adminLogin) [M]
  │   exports: adminLogin
  ├── adminController.ts             — adminController — 2 exports [L]
  │   exports: getStats, getUsers
  ├── attendanceController.ts        — attendanceController — 2 exports [L]
  │   exports: getSchedule, updateSchedule
  ├── authController.ts              — authController — 2 exports [S]
  │   exports: register, login
  ├── courseController.ts            — courseController — 3 exports [S]
  │   exports: getCourses, getTasks, deleteCourse
  ├── scraperController.ts           — scraperController — 2 exports [M]
  │   exports: testScraping, syncCourses
  ├── settingsController.ts          — settingsController — 3 exports [M]
  │   exports: updateTelegramSettings, getSettings, testTelegramNotification
  └── taskController.ts              — taskController — 2 exports [S]
      exports: deleteTask, updateTaskDeadline

src/middleware/
  └── adminAuth.ts                   — adminAuth — 2 exports [S]
      exports: AdminRequest, adminAuth

src/middlewares/
  └── authMiddleware.ts              — authMiddleware (protect) [S]
      exports: protect

src/routes/
  ├── adminRoutes.ts                 — adminRoutes [S]
  ├── attendanceRoutes.ts            — attendanceRoutes [S]
  ├── authRoutes.ts                  — authRoutes [S]
  ├── courseRoutes.ts                — courseRoutes [S]
  ├── scraperRoutes.ts               — scraperRoutes [S]
  ├── settingsRoutes.ts              — settingsRoutes [S]
  ├── taskRoutes.ts                  — taskRoutes [S]
  └── whatsappRoutes.ts              — whatsappRoutes [S]

src/services/
  ├── adminNotificationService.ts    — adminNotificationService (AdminNotificationService) [M]
  │   exports: AdminNotificationService
  ├── attendanceService.ts           — attendanceService (AttendanceService) [L]
  │   exports: AttendanceService
  ├── courseService.ts               — courseService (saveCoursesToDb) [L]
  │   exports: saveCoursesToDb
  ├── discordService.ts              — discordService (DiscordService) [M]
  │   exports: DiscordService
  ├── schedulerService.ts            — schedulerService (SchedulerService) [L]
  │   exports: SchedulerService
  ├── scraperService.ts              — scraperService (ScraperService) [L]
  │   exports: ScraperService
  ├── spadaApiService.ts             — spadaApiService (SpadaApiService) [M]
  │   exports: SpadaApiService
  ├── telegramService.ts             — telegramService (TelegramService) [M]
  │   exports: TelegramService
  └── whatsappService.ts             — whatsappService (WhatsAppService) [M]
      exports: WhatsAppService

src/utils/
  └── encryption.ts                  — encryption — 2 exports [S]
      exports: encrypt, decrypt

Size: [S]<100 lines  [M]=100-300 lines  [L]=300+ lines
```

**Key Dependencies:**
- app.ts → authRoutes.ts, scraperRoutes.ts, courseRoutes.ts
- adminController.ts → database.ts, adminAuth.ts
- attendanceController.ts → database.ts, attendanceService.ts, app.ts
- authController.ts → database.ts, encryption.ts
- courseController.ts → database.ts
- scraperController.ts → scraperService.ts, database.ts, courseService.ts
- settingsController.ts → database.ts, app.ts
- taskController.ts → database.ts
- authMiddleware.ts → database.ts
- adminRoutes.ts → adminAuthController.ts, adminController.ts, adminAuth.ts

---
*Auto-generated by BrainSync 🧠*
