# 📚 SPADA Task Manager

A modern task management application designed for **UPN "Veteran" Yogyakarta** students to automatically track and manage assignments from the SPADA e-learning platform.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18+-green.svg)
![React](https://img.shields.io/badge/react-18+-61DAFB.svg)
![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)

## 🖼️ Preview

![Dashboard](docs/dashboard.png)

## ✨ Features

- 🔐 **User Authentication** – Secure registration and login with JWT-based session
- 📖 **Course Management** – Add and track multiple SPADA courses automatically
- 🤖 **Auto-Sync** – Automatically scrape & sync assignments from SPADA every 5 minutes
- 📅 **Calendar View** – Visualize deadlines in a beautiful monthly calendar
- ⏰ **Custom Deadline** – Set your own deadline when lecturers don't set one in SPADA
- 📊 **Dashboard** – Real-time overview of all assignments with deadline alerts
- 🎓 **Auto Attendance** – Automatically attend SPADA classes on schedule
- 🔔 **Multi-channel Notifications** – Deadline reminders via Telegram, Discord, or WhatsApp
- 📱 **Mobile Responsive** – Fully optimized for mobile devices
- 🌙 **Dark Mode** – Beautiful dark theme by default
- 🛡️ **Maintenance Guard** – Auto-sync pauses during SPADA maintenance hours (02:00-03:00 WIB)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Docker (recommended for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Rex4Red/spada-task-manager.git
   cd spada-task-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

3. **Configure Environment Variables**

   Create `.env` in the project root:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/database"
   DIRECT_URL="postgresql://user:password@host:5432/database"
   JWT_SECRET="your-super-secret-jwt-key"
   ENCRYPTION_KEY="your-32-char-encryption-key-here"

   # Optional: Notification Channels
   TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   WA_API_URL="your-whatsapp-api-url"
   DISCORD_PROXY_URL="your-discord-proxy-url"
   ```

4. **Initialize Database**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Build & Run**
   ```bash
   # Build frontend
   cd frontend && npm run build && cd ..

   # Build backend
   npm run build

   # Start
   npm start
   ```

6. **Open the app** at `http://localhost:7860`

### Docker Deployment

```bash
docker build -t spada-task-manager .
docker run -d \
  --name spada \
  --restart unless-stopped \
  --network host \
  -v $(pwd)/.env:/app/.env \
  spada-task-manager node dist/app.js
```

## 📖 Usage Guide

### 1. Create an Account
Register with your email and provide your SPADA credentials to enable auto-sync.

### 2. Add Courses
1. Go to **My Courses** page
2. Paste your SPADA course URL (e.g., `https://spada.upnyk.ac.id/course/view.php?id=12345`)
3. Click **Add Course** – the system will automatically scrape all assignments

### 3. View Dashboard
The dashboard shows:
- **Total Tasks** – All assignments across courses
- **Completed** – Tasks marked as graded/submitted
- **Pending** – Tasks still to complete
- **Deadline Alerts** – Upcoming assignments with submit buttons

### 4. Custom Deadline
For assignments without a SPADA deadline:
1. Open **Calendar** → Click a date → Select a task
2. Click ✏️ **Set Deadline**
3. Choose date & time → **Save**
4. The custom deadline takes priority over SPADA deadlines

### 5. Auto Attendance
1. Go to **Auto Attendance** page
2. Select a course and set the schedule (daily, weekly, or specific day)
3. The system will automatically attend the class at the scheduled time

### 6. Setup Notifications (Optional)
**Telegram:**
1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Get your Chat ID from [@userinfobot](https://t.me/userinfobot)
3. Go to **Settings** → Enter Bot Token & Chat ID

**Discord:**
1. Create a Discord Webhook in your server
2. Go to **Settings** → Enter Webhook URL

**WhatsApp:**
1. Set up WhatsApp API endpoint
2. Go to **Settings** → Enter phone number

## 🏗️ Tech Stack

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Lucide React** for icons
- **date-fns** for date manipulation

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **Prisma ORM** with PostgreSQL
- **Puppeteer** for web scraping
- **JWT** for authentication
- **node-cron** for scheduled tasks

### Deployment
- **AWS EC2** with Docker
- **Nginx** as reverse proxy with SSL
- **PostgreSQL** via Supabase

## 📁 Project Structure

```
spada-task-manager/
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React Context (Auth)
│   │   └── services/       # API services
│   └── api/                # Serverless proxy functions
│
├── src/                    # Express backend
│   ├── controllers/        # Route handlers
│   ├── services/           # Business logic & scrapers
│   ├── routes/             # API routes
│   ├── middleware/         # Auth middleware
│   └── config/             # Database config
│
├── prisma/                 # Database schema
├── docs/                   # Screenshots & assets
├── Dockerfile              # Docker container config
└── README.md
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| GET | `/api/courses` | Get user's courses with tasks |
| POST | `/api/scraper/course` | Add & scrape a course |
| POST | `/api/scraper/sync` | Trigger manual sync |
| PATCH | `/api/tasks/:id/deadline` | Set custom deadline |
| PUT | `/api/tasks/:id/hide` | Hide a task |
| GET | `/api/settings` | Get user settings |
| PUT | `/api/settings/telegram` | Update Telegram config |
| PUT | `/api/settings/discord` | Update Discord config |
| POST | `/api/attendance/schedule` | Create attendance schedule |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Rex4Red** - [GitHub](https://github.com/Rex4Red)

---

<p align="center">
  Made with ❤️ for UPN "Veteran" Yogyakarta Students
</p>
