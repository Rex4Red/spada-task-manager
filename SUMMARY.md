# SPADA Task Manager - Project Summary

## Overview

**SPADA Task Manager** adalah aplikasi web full-stack yang dirancang untuk mahasiswa UPN "Veteran" Yogyakarta untuk melacak dan mengelola tugas secara otomatis dari platform e-learning SPADA (Moodle-based LMS). Aplikasi ini melakukan scraping data course, melacak deadline, dan menyediakan notifikasi otomatis.

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI Framework |
| Vite | 7.2.5 | Build tool & Dev server |
| React Router DOM | 7.13.0 | Client-side routing |
| Tailwind CSS | 3.4.17 | Utility-first CSS framework |
| Axios | 1.13.4 | HTTP client |
| date-fns | 4.1.0 | Date manipulation |
| Lucide React | 0.563.0 | Icons |
| Framer Motion | 12.29.2 | Animations |
| SWR | 2.3.8 | Data fetching/caching |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js + Express | 5.2.1 | API Server |
| TypeScript | 5.9.3 | Type safety |
| Prisma ORM | 5.22.0 | Database ORM |
| PostgreSQL | - | Database (via Supabase) |
| Puppeteer | 24.36.1 | Web scraping/automation |
| JSON Web Token | 9.0.3 | Authentication |
| bcrypt | 6.0.0 | Password hashing |
| node-cron | 4.2.1 | Scheduled tasks |
| Helmet | 8.1.0 | Security middleware |

### Deployment
- **Frontend**: Vercel (dengan serverless functions untuk Telegram proxy)
- **Backend**: Hugging Face Spaces (Docker)
- **Database**: Supabase (PostgreSQL)

---

## Project Architecture

```
spada-task-manager/
|
+-- frontend/                    # React SPA
|   +-- api/                     # Vercel Serverless Functions
|   |   +-- telegram-proxy.js   # Proxy untuk Telegram messages
|   |   +-- telegram-photo-proxy.js  # Proxy untuk photos
|   +-- src/
|   |   +-- components/          # Reusable UI components
|   |   |   +-- Layout.jsx       # Main layout with sidebar/nav
|   |   |   +-- AdminLayout.jsx  # Admin panel layout
|   |   |   +-- AttendanceScheduleForm.jsx
|   |   +-- context/             # React Context providers
|   |   |   +-- AuthContext.jsx  # User authentication state
|   |   |   +-- AdminAuthContext.jsx  # Admin auth state
|   |   +-- pages/               # Page components
|   |   |   +-- Dashboard.jsx    # Main task overview
|   |   |   +-- MyCourses.jsx    # Course management
|   |   |   +-- Calendar.jsx     # Calendar view
|   |   |   +-- Attendance.jsx   # Auto-attendance config
|   |   |   +-- Settings.jsx     # User settings
|   |   |   +-- Login.jsx / Register.jsx
|   |   |   +-- admin/           # Admin pages
|   |   +-- services/
|   |       +-- api.js           # Axios instance with auth
|   +-- public/                  # Static assets
|
+-- backend/                     # Express API Server
|   +-- prisma/
|   |   +-- schema.prisma        # Database schema
|   +-- src/
|       +-- app.ts               # Express app entry point
|       +-- config/
|       |   +-- database.ts      # Prisma client
|       +-- controllers/         # Route handlers
|       |   +-- authController.ts
|       |   +-- courseController.ts
|       |   +-- scraperController.ts
|       |   +-- taskController.ts
|       |   +-- settingsController.ts
|       |   +-- attendanceController.ts
|       |   +-- adminController.ts
|       +-- services/            # Business logic
|       |   +-- scraperService.ts      # SPADA web scraper
|       |   +-- attendanceService.ts   # Auto-attendance bot
|       |   +-- telegramService.ts     # Telegram notifications
|       |   +-- schedulerService.ts    # Cron job manager
|       |   +-- courseService.ts       # Course data handling
|       +-- routes/              # API route definitions
|       +-- middlewares/
|       |   +-- authMiddleware.ts      # JWT protection
|       +-- middleware/
|       |   +-- adminAuth.ts           # Admin JWT protection
|       +-- utils/
|           +-- encryption.ts          # AES-256 encryption
|
+-- README.md
+-- SUMMARY.md
```

---

## Database Schema (Prisma/PostgreSQL)

### Models

1. **User**
   - id, email, password, name
   - spadaUsername, spadaPassword (encrypted)
   - Relations: courses[], tasks[], telegramConfig, notificationSettings

2. **Course**
   - id, sourceId (SPADA course ID), name, url
   - userId (FK), lastSynced, isDeleted
   - Relations: tasks[], attendanceSchedule

3. **Task**
   - id, title, description, status (PENDING/COMPLETED/OVERDUE)
   - deadline, url, timeRemaining
   - courseId (FK), userId (FK)
   - isScraped, isDeleted

4. **TelegramConfig**
   - userId (unique), botToken, chatId, isActive

5. **NotificationSettings**
   - userId (unique), thresholdDays, quietHoursStart/End, emailNotification

6. **AttendanceSchedule**
   - courseId (unique), scheduleType (SIMPLE/CRON)
   - dayOfWeek, timeOfDay, cronExpression
   - maxRetries, retryIntervalMinutes
   - useSeparateTelegram, customBotToken
   - lastRunAt, nextRunAt, isActive

7. **AttendanceLog**
   - scheduleId (FK), attemptedAt, attemptNumber
   - status (SUCCESS/FAILED/NOT_AVAILABLE/TIMEOUT/ERROR)
   - message, screenshotUrl

8. **Notification**
   - taskId (FK), sentAt, message, type, isDelivered

---

## API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Create new user account |
| POST | `/login` | User login, returns JWT |
| GET | `/me` | Get current user info (protected) |

### Courses (`/api/courses`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all user's courses with tasks |
| GET | `/tasks` | Get all tasks across courses |
| DELETE | `/:id` | Soft delete a course |

### Scraper (`/api/scraper`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/test-login` | Test SPADA credentials |
| POST | `/sync` | Sync all courses |
| POST | `/course` | Add/scrape a specific course by URL |

### Tasks (`/api/tasks`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| DELETE | `/:id` | Hide/delete a task |

### Settings (`/api/settings`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get user settings |
| PUT | `/telegram` | Update Telegram config |
| POST | `/telegram/test` | Test Telegram notification |
| PUT | `/spada` | Update SPADA credentials |

### Attendance (`/api/attendance`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:courseId` | Get attendance schedule |
| PUT | `/:courseId` | Create/update schedule |
| DELETE | `/:courseId` | Delete schedule |
| POST | `/:courseId/test` | Manually trigger attendance |
| GET | `/:courseId/logs` | Get attendance logs |

### Admin (`/api/admin`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Admin login |
| GET | `/auth/verify` | Verify admin token |
| GET | `/stats` | Dashboard statistics |
| GET | `/users` | List all users (paginated) |
| GET | `/users/:id` | Get user details |
| DELETE | `/users/:id` | Delete user (cascade) |
| GET | `/activity` | Recent attendance logs |

---

## Main Features

### 1. User Authentication
- Secure registration/login dengan bcrypt password hashing
- JWT-based authentication (30-day expiry)
- Protected routes pada frontend dan backend
- Separate admin authentication system

### 2. SPADA Course Scraping
- Menggunakan Puppeteer untuk otomasi login ke SPADA
- Scrape nama course dan assignments dari halaman course
- Parse deadline assignment dan status submission
- Credentials dienkripsi dengan AES-256-CBC

### 3. Task Management Dashboard
- Overview semua assignments dari semua courses
- Task filtering: All, Urgent (<3 days), Overdue, Completed
- Course-specific filtering
- Search functionality
- Statistics cards (total, pending, completed)
- Deadline alerts untuk urgent tasks

### 4. Calendar View
- Visualisasi kalender bulanan
- Tasks ditampilkan pada tanggal deadline

### 5. Auto-Sync Scheduler
- Background job berjalan setiap 10 menit
- Otomatis scrape assignments baru untuk semua users
- Update status task yang sudah ada

### 6. Telegram Notifications
- Configurable per-user bot token dan chat ID
- Deadline reminders (dicek setiap jam)
- Notifikasi untuk tasks yang due dalam 3 hari
- Menggunakan Vercel serverless proxy (HF block direct connections)
- Support pengiriman photos/screenshots

### 7. Auto-Attendance Bot
- Schedule automatic attendance submission per course
- Configurable day of week dan time (WIB timezone)
- Menggunakan Puppeteer untuk navigasi dan submit attendance
- Takes screenshots sebagai bukti
- Mengirim Telegram notification dengan hasil
- Log semua attempts dengan status

### 8. Admin Panel
- Separate admin authentication
- Dashboard dengan system statistics
- User management (view, search, delete)
- User detail view dengan courses dan schedules
- Recent activity/logs viewer

---

## Security Features

1. **Password Hashing**: bcrypt dengan 10 salt rounds
2. **SPADA Credential Encryption**: AES-256-CBC dengan random IV
3. **JWT Authentication**: Bearer token dengan configurable expiry
4. **CORS Protection**: Configured origin restriction
5. **Helmet Middleware**: Security headers
6. **Telegram Proxy Secret**: Optional auth untuk proxy endpoints
7. **Admin Separate Auth**: Environment-based admin credentials

---

## UI/UX Features

- **Dark Mode**: Full dark theme optimized untuk OLED
- **Mobile Responsive**: Bottom navigation bar untuk mobile
- **UPN Branding**: University colors (green, gold, blue)
- **Skeleton Loading**: Animated loading states
- **Custom Dropdowns**: Styled filter menus
- **Help Modals**: Embedded video tutorials (YouTube)
- **Material Icons**: Google Material Symbols

---

## Scheduled Tasks (node-cron)

| Schedule | Task | Description |
|----------|------|-------------|
| `0 * * * *` | Deadline Check | Hourly - sends Telegram reminders |
| `*/10 * * * *` | Auto-Sync | Every 10 min - scrapes new assignments |
| `* * * * *` | Attendance Check | Every minute - checks scheduled attendance |

---

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=<secret>
JWT_EXPIRES_IN=30d
ENCRYPTION_KEY=<32-char-key>
TELEGRAM_BOT_TOKEN=<optional-default>
TELEGRAM_PROXY_URL=https://...vercel.app/api/telegram-proxy
TELEGRAM_PROXY_SECRET=<optional>
CORS_ORIGIN=http://localhost:5173
ADMIN_USERNAME=<admin>
ADMIN_PASSWORD=<password>
ADMIN_JWT_SECRET=<secret>
```

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:7860/api
```

---

## How The App Works (Flow)

1. **User Registration**: User membuat akun, opsional menyimpan SPADA credentials (encrypted dan stored)

2. **Adding Courses**: User paste SPADA course URL -> Backend menggunakan Puppeteer untuk login dan scrape assignments -> Data disimpan ke PostgreSQL

3. **Viewing Tasks**: Dashboard fetch semua courses dengan tasks -> Ditampilkan dengan filtering/sorting -> Menampilkan deadline alerts

4. **Auto-Sync**: Background cron job secara periodik re-scrape semua saved courses untuk setiap user dengan credentials

5. **Notifications**: Hourly cron mengecek upcoming deadlines -> Mengirim Telegram messages via Vercel proxy

6. **Auto-Attendance**: User konfigurasi schedule (e.g., Monday 08:00 WIB) -> Scheduler trigger pada waktu tersebut -> Puppeteer submit attendance -> Screenshot + notification dikirim

---

## Video Tutorials

- **Telegram Credentials**: https://youtu.be/4uLoLyaA85I
- **How to Find Course URL**: https://youtu.be/3WqNt8aYgas

---

## File Statistics

- **Frontend JSX files**: 18 components/pages
- **Backend TypeScript files**: 25 modules
- **Database Models**: 8 tables

---

## Links

- **Live App**: https://spada-task-manager.vercel.app
- **GitHub**: https://github.com/Rex4Red/spada-task-manager
