import { useAuth } from '../context/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { path: '/my-courses', icon: 'menu_book', label: 'Courses' },
        { path: '/attendance', icon: 'fingerprint', label: 'Auto Attendance' },
        { path: '/calendar', icon: 'calendar_month', label: 'Calendar' },
        { path: '/settings', icon: 'settings', label: 'Settings' },
    ];

    return (
        <div className="flex h-screen w-full bg-background-light dark:bg-background-dark overflow-hidden text-slate-900 dark:text-white font-display">
            {/* Sidebar - Desktop Only */}
            <aside className="hidden md:flex w-72 flex-col border-r border-[#3b4754] bg-[#111418] dark:bg-card-dark p-4 justify-between h-full">
                <div className="flex flex-col gap-6">
                    {/* Brand / Logo */}
                    <div className="flex items-center gap-3 px-2">
                        <img src="/logo_upn.png" alt="UPN Logo" className="size-10 object-contain" />
                        <div className="flex flex-col">
                            <h1 className="text-white text-lg font-bold leading-tight">Spada Task Manager</h1>
                            <p className="text-[#9dabb9] text-xs font-normal">UPN "Veteran" Yogyakarta</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex flex-col gap-2">
                        {navItems.map(item => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group ${isActive(item.path)
                                    ? 'bg-primary/15 border-l-4 border-primary'
                                    : 'hover:bg-[#283039]'
                                    }`}
                            >
                                <span className={`material-symbols-outlined ${isActive(item.path) ? 'text-primary filled-icon' : 'text-[#9dabb9] group-hover:text-white'}`}>{item.icon}</span>
                                <p className={`${isActive(item.path) ? 'text-white' : 'text-[#9dabb9] group-hover:text-white'} text-sm font-medium leading-normal`}>{item.label}</p>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Bottom Actions - Desktop */}
                <div className="flex flex-col gap-2 border-t border-[#3b4754] pt-4">
                    <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#283039] transition-colors group">
                        <div className="relative">
                            <span className="material-symbols-outlined text-[#9dabb9] group-hover:text-white text-3xl">account_circle</span>
                            <div className="absolute top-0 right-0 size-2 bg-upn-green rounded-full border border-[#111418]"></div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-[#9dabb9] group-hover:text-white text-sm font-medium leading-normal">{user?.name || 'User'}</p>
                            <p className="text-xs text-[#6e7b8b]">Student</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-900/20 group transition-colors"
                    >
                        <span className="material-symbols-outlined text-[#9dabb9] group-hover:text-red-400">logout</span>
                        <p className="text-[#9dabb9] group-hover:text-red-400 text-sm font-medium leading-normal">Logout</p>
                    </button>
                </div>
            </aside>

            {/* Mobile Header - Mobile Only */}
            <header className="flex md:hidden items-center justify-between bg-[#111418] border-b border-[#3b4754] px-4 py-3 sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <img src="/logo_upn.png" alt="UPN Logo" className="size-8 object-contain" />
                    <h1 className="text-white text-base font-bold">Spada Task Manager</h1>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                >
                    <span className="material-symbols-outlined text-red-400 text-xl">logout</span>
                    <span className="text-red-400 text-sm font-medium">Logout</span>
                </button>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-y-auto pb-20 md:pb-0">
                {children}
            </main>

            {/* Mobile Bottom Navigation - 5 items, Calendar in center */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-end justify-around bg-[#111418] border-t border-[#3b4754] h-16 px-2 safe-area-bottom">
                {/* Dashboard */}
                <Link
                    to="/dashboard"
                    className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${isActive('/dashboard') ? 'text-primary' : 'text-[#9dabb9]'}`}
                >
                    <span className={`material-symbols-outlined text-[22px] ${isActive('/dashboard') ? 'filled-icon' : ''}`}>dashboard</span>
                    <span className="text-[10px] font-medium">Dashboard</span>
                </Link>

                {/* Courses */}
                <Link
                    to="/my-courses"
                    className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${isActive('/my-courses') ? 'text-primary' : 'text-[#9dabb9]'}`}
                >
                    <span className={`material-symbols-outlined text-[22px] ${isActive('/my-courses') ? 'filled-icon' : ''}`}>menu_book</span>
                    <span className="text-[10px] font-medium">Courses</span>
                </Link>

                {/* Calendar - Center with circular design */}
                <Link
                    to="/calendar"
                    className="flex flex-col items-center justify-center flex-1 -mt-6 transition-all"
                >
                    <div className={`flex items-center justify-center size-14 rounded-full shadow-lg transition-all ${isActive('/calendar') ? 'bg-primary shadow-primary/30' : 'bg-gradient-to-br from-primary to-blue-600 shadow-primary/20'}`}>
                        <span className="material-symbols-outlined text-white text-[28px] filled-icon">calendar_month</span>
                    </div>
                    <span className={`text-[10px] font-medium mt-1 ${isActive('/calendar') ? 'text-primary' : 'text-[#9dabb9]'}`}>Calendar</span>
                </Link>

                {/* Auto Attendance */}
                <Link
                    to="/attendance"
                    className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${isActive('/attendance') ? 'text-primary' : 'text-[#9dabb9]'}`}
                >
                    <span className={`material-symbols-outlined text-[22px] ${isActive('/attendance') ? 'filled-icon' : ''}`}>fingerprint</span>
                    <span className="text-[10px] font-medium">Attendance</span>
                </Link>

                {/* Settings */}
                <Link
                    to="/settings"
                    className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${isActive('/settings') ? 'text-primary' : 'text-[#9dabb9]'}`}
                >
                    <span className={`material-symbols-outlined text-[22px] ${isActive('/settings') ? 'filled-icon' : ''}`}>settings</span>
                    <span className="text-[10px] font-medium">Settings</span>
                </Link>
            </nav>
        </div>
    );
};

export default Layout;
