# 📚 SPADA Task Manager

A modern task management application designed for **UPN "Veteran" Yogyakarta** students to automatically track and manage assignments from the SPADA e-learning platform.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18+-green.svg)
![React](https://img.shields.io/badge/react-18+-61DAFB.svg)

## ✨ Features

- 🔐 **User Authentication** - Secure registration and login system
- 📖 **Course Management** - Add and track multiple SPADA courses
- 🤖 **Auto-Sync** - Automatically scrape assignments from SPADA
- 📅 **Calendar View** - Visualize deadlines in a beautiful calendar
- 📊 **Dashboard** - Overview of all tasks with status tracking
- 🔔 **Telegram Notifications** - Get deadline reminders via Telegram
- 📱 **Mobile Responsive** - Fully optimized for mobile devices
- 🌙 **Dark Mode** - Eye-friendly dark theme

## 🖼️ Screenshots

| Dashboard | Calendar | Mobile |
|-----------|----------|--------|
| Task overview with stats | Monthly view with tasks | Responsive bottom navigation |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Rex4Red/spada-task-manager.git
   cd spada-task-manager
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   ```

3. **Configure Environment Variables**
   
   Create `backend/.env`:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/database"
   JWT_SECRET="your-super-secret-jwt-key"
   ENCRYPTION_KEY="your-32-char-encryption-key-here"
   
   # Optional: Telegram Bot
   TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   TELEGRAM_PROXY_URL="https://your-vercel-app.vercel.app/api/telegram-proxy"
   ```

4. **Initialize Database**
   ```bash
   npx prisma db push
   ```

5. **Build & Run Backend**
   ```bash
   npm run build
   npm start
   ```

6. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

7. **Configure Frontend Environment**
   
   Create `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:7860/api
   ```

8. **Run Frontend**
   ```bash
   npm run dev
   ```

9. **Open the app** at `http://localhost:5173`

## 📖 Usage Guide

### 1. Create an Account
Register with your email and optionally provide SPADA credentials for auto-sync.

### 2. Add Courses
1. Go to **My Courses** page
2. Paste your SPADA course URL (e.g., `https://spada.upnyk.ac.id/course/view.php?id=12345`)
3. Click **Add Course** - the system will automatically scrape all assignments

### 3. View Dashboard
The dashboard shows:
- **Total Tasks** - All assignments across courses
- **Completed** - Tasks marked as done
- **Pending** - Tasks still to complete
- **Urgent Alerts** - Deadlines within 24 hours

### 4. Setup Telegram Notifications (Optional)
1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Get your Chat ID from [@userinfobot](https://t.me/userinfobot)
3. Go to **Settings** → Enter Bot Token & Chat ID
4. Enable notifications and test!

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

### Deployment
- **Frontend**: Vercel
- **Backend**: Hugging Face Spaces (Docker)
- **Database**: Supabase (PostgreSQL)

## 📁 Project Structure

```
spada-task-manager/
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React Context
│   │   └── services/       # API services
│   └── api/                # Vercel serverless functions
│
├── backend/                # Express backend
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API routes
│   │   └── middleware/     # Auth middleware
│   └── prisma/             # Database schema
│
└── README.md
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| GET | `/api/courses` | Get user's courses |
| POST | `/api/scraper/course` | Add & scrape course |
| PUT | `/api/tasks/:id/hide` | Hide a task |
| GET | `/api/settings` | Get user settings |
| PUT | `/api/settings/telegram` | Update Telegram config |

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
