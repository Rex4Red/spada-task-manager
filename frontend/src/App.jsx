import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import MyCourses from './pages/MyCourses';
import Calendar from './pages/Calendar';
import Attendance from './pages/Attendance';

// Admin Pages
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetail from './pages/admin/AdminUserDetail';

// Secret admin path - configurable via env
const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || '/ctrl-s7x';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

const AdminPrivateRoute = ({ children }) => {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return admin ? children : <Navigate to={`${ADMIN_PATH}/login`} />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* User Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      } />
      <Route path="/my-courses" element={
        <PrivateRoute>
          <MyCourses />
        </PrivateRoute>
      } />
      <Route path="/calendar" element={
        <PrivateRoute>
          <Calendar />
        </PrivateRoute>
      } />
      <Route path="/attendance" element={
        <PrivateRoute>
          <Attendance />
        </PrivateRoute>
      } />
      <Route path="/settings" element={
        <PrivateRoute>
          <Settings />
        </PrivateRoute>
      } />
      <Route path="/" element={<Navigate to="/dashboard" />} />

      {/* Admin Routes - secret path */}
      <Route path={`${ADMIN_PATH}/login`} element={<AdminLogin />} />
      <Route path={`${ADMIN_PATH}/dashboard`} element={
        <AdminPrivateRoute>
          <AdminDashboard />
        </AdminPrivateRoute>
      } />
      <Route path={`${ADMIN_PATH}/users`} element={
        <AdminPrivateRoute>
          <AdminUsers />
        </AdminPrivateRoute>
      } />
      <Route path={`${ADMIN_PATH}/users/:id`} element={
        <AdminPrivateRoute>
          <AdminUserDetail />
        </AdminPrivateRoute>
      } />
      <Route path={ADMIN_PATH} element={<Navigate to={`${ADMIN_PATH}/dashboard`} />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminAuthProvider>
          <AppRoutes />
        </AdminAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
