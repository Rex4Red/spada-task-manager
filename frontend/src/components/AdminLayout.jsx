import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

const AdminLayout = ({ children }) => {
    const { admin, logout } = useAdminAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const isActive = (path) => location.pathname === path;

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    const navItems = [
        { path: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { path: '/admin/users', icon: 'group', label: 'Users' },
    ];

    return (
        <div className="flex h-screen w-full bg-[#0d1117] overflow-hidden text-white font-display">
            {/* Sidebar */}
            <aside className="hidden md:flex w-64 flex-col border-r border-[#30363d] bg-[#161b22] p-4 justify-between h-full">
                <div className="flex flex-col gap-6">
                    {/* Brand */}
                    <div className="flex items-center gap-3 px-2">
                        <div className="size-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-xl">admin_panel_settings</span>
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-white text-base font-bold leading-tight">Admin Panel</h1>
                            <p className="text-[#9dabb9] text-xs">SPADA Manager</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex flex-col gap-1">
                        {navItems.map(item => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive(item.path)
                                    ? 'bg-purple-500/20 border-l-4 border-purple-500 text-white'
                                    : 'hover:bg-[#21262d] text-[#9dabb9] hover:text-white'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-xl ${isActive(item.path) ? 'text-purple-400' : ''}`}>{item.icon}</span>
                                <span className="text-sm font-medium">{item.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Bottom */}
                <div className="flex flex-col gap-2 border-t border-[#30363d] pt-4">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="size-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                                {admin?.username?.[0] || 'A'}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-white text-sm font-medium">{admin?.username || 'Admin'}</p>
                            <p className="text-xs text-[#6e7b8b]">Administrator</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-900/20 text-[#9dabb9] hover:text-red-400 transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">logout</span>
                        <span className="text-sm font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-y-auto">
                {children}
            </main>

            {/* Mobile Header */}
            <div className="fixed top-0 left-0 right-0 z-50 flex md:hidden items-center justify-between bg-[#161b22] border-b border-[#30363d] h-14 px-4">
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-lg">admin_panel_settings</span>
                    </div>
                    <span className="text-white font-bold">Admin</span>
                </div>
                <button onClick={handleLogout} className="text-[#9dabb9] hover:text-red-400">
                    <span className="material-symbols-outlined">logout</span>
                </button>
            </div>

            {/* Mobile Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-center justify-around bg-[#161b22] border-t border-[#30363d] h-14">
                {navItems.map(item => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 ${isActive(item.path) ? 'text-purple-400' : 'text-[#9dabb9]'}`}
                    >
                        <span className="material-symbols-outlined text-xl">{item.icon}</span>
                        <span className="text-[10px]">{item.label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    );
};

export default AdminLayout;
