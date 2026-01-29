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

    return (
        <div className="flex h-screen w-full bg-background-light dark:bg-background-dark overflow-hidden text-slate-900 dark:text-white font-display">
            {/* Sidebar */}
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
                        <Link
                            to="/dashboard"
                            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group ${isActive('/dashboard')
                                ? 'bg-primary/15 border-l-4 border-primary'
                                : 'hover:bg-[#283039]'
                                }`}
                        >
                            <span className={`material-symbols-outlined ${isActive('/dashboard') ? 'text-primary filled-icon' : 'text-[#9dabb9] group-hover:text-white'}`}>dashboard</span>
                            <p className={`${isActive('/dashboard') ? 'text-white' : 'text-[#9dabb9] group-hover:text-white'} text-sm font-medium leading-normal`}>Dashboard</p>
                        </Link>

                        <Link
                            to="/my-courses"
                            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group ${isActive('/my-courses')
                                ? 'bg-primary/15 border-l-4 border-primary'
                                : 'hover:bg-[#283039]'
                                }`}
                        >
                            <span className={`material-symbols-outlined ${isActive('/my-courses') ? 'text-primary filled-icon' : 'text-[#9dabb9] group-hover:text-white'}`}>menu_book</span>
                            <p className={`${isActive('/my-courses') ? 'text-white' : 'text-[#9dabb9] group-hover:text-white'} text-sm font-medium leading-normal`}>My Courses</p>
                        </Link>

                        <Link
                            to="/calendar"
                            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group ${isActive('/calendar')
                                ? 'bg-primary/15 border-l-4 border-primary'
                                : 'hover:bg-[#283039]'
                                }`}
                        >
                            <span className={`material-symbols-outlined ${isActive('/calendar') ? 'text-primary filled-icon' : 'text-[#9dabb9] group-hover:text-white'}`}>calendar_month</span>
                            <p className={`${isActive('/calendar') ? 'text-white' : 'text-[#9dabb9] group-hover:text-white'} text-sm font-medium leading-normal`}>Calendar</p>
                        </Link>

                        <Link
                            to="/settings"
                            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group ${isActive('/settings')
                                ? 'bg-primary/15 border-l-4 border-primary'
                                : 'hover:bg-[#283039]'
                                }`}
                        >
                            <span className={`material-symbols-outlined ${isActive('/settings') ? 'text-primary filled-icon' : 'text-[#9dabb9] group-hover:text-white'}`}>settings</span>
                            <p className={`${isActive('/settings') ? 'text-white' : 'text-[#9dabb9] group-hover:text-white'} text-sm font-medium leading-normal`}>Settings</p>
                        </Link>
                    </div>
                </div>

                {/* Bottom Actions */}
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

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-y-auto">
                {children}
            </main>
        </div>
    );
};

export default Layout;
