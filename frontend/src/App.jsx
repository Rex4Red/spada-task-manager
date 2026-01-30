import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import MyCourses from './pages/MyCourses';
import Calendar from './pages/Calendar';
import Attendance from './pages/Attendance';

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

function AppRoutes() {
  return (
    <Routes>
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
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
