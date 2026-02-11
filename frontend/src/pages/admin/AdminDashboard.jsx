import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';

const AdminDashboard = () => {
    const { token } = useAdminAuth();
    const [stats, setStats] = useState(null);
    const [recentUsers, setRecentUsers] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [waStatus, setWaStatus] = useState('disconnected');
    const [waQrCode, setWaQrCode] = useState(null);
    const [waConnecting, setWaConnecting] = useState(false);

    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7860/api';

    useEffect(() => {
        fetchData();
        pollWaStatus();
    }, []);

    useEffect(() => {
        if (waStatus === 'qr' || waStatus === 'connecting') {
            const interval = setInterval(pollWaStatus, 3000);
            return () => clearInterval(interval);
        }
    }, [waStatus]);

    const pollWaStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/whatsapp/status`);
            const data = await res.json();
            setWaStatus(data.status);
            setWaQrCode(data.qrCode);
        } catch (e) { /* silent */ }
    };

    const handleWaConnect = async () => {
        setWaConnecting(true);
        try {
            await fetch(`${API_URL}/whatsapp/connect`, { method: 'POST' });
            setTimeout(pollWaStatus, 2000);
        } catch (e) {
            alert('Failed to start WhatsApp');
        } finally {
            setWaConnecting(false);
        }
    };

    const handleWaLogout = async () => {
        if (!confirm('Disconnect WhatsApp?')) return;
        try {
            await fetch(`${API_URL}/whatsapp/logout`, { method: 'POST' });
            setWaStatus('disconnected');
            setWaQrCode(null);
        } catch (e) { alert('Logout failed'); }
    };

    const fetchData = async () => {
        try {
            const headers = { Authorization: `Bearer ${token}` };

            const [statsRes, usersRes, activityRes] = await Promise.all([
                fetch(`${API_URL}/admin/stats`, { headers }),
                fetch(`${API_URL}/admin/users?limit=5`, { headers }),
                fetch(`${API_URL}/admin/activity?limit=5`, { headers })
            ]);

            const statsData = await statsRes.json();
            const usersData = await usersRes.json();
            const activityData = await activityRes.json();

            if (statsData.success) setStats(statsData.data);
            if (usersData.success) setRecentUsers(usersData.data.users);
            if (activityData.success) setRecentActivity(activityData.data);
        } catch (err) {
            console.error('Failed to fetch admin data:', err);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        { label: 'Total Users', value: stats?.totalUsers || 0, icon: 'group', color: 'from-blue-500 to-cyan-400' },
        { label: 'Total Courses', value: stats?.totalCourses || 0, icon: 'school', color: 'from-green-500 to-emerald-400' },
        { label: 'Total Assignments', value: stats?.totalAssignments || 0, icon: 'assignment', color: 'from-orange-500 to-yellow-400' },
        { label: 'Active Schedules', value: stats?.activeSchedules || 0, icon: 'schedule', color: 'from-purple-500 to-pink-400' },
    ];

    return (
        <AdminLayout>
            <div className="flex flex-col min-h-full p-4 md:p-6 pt-16 md:pt-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-[#9dabb9] text-sm">Overview of SPADA Task Manager</p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            {statCards.map((stat, i) => (
                                <div key={i} className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
                                    <div className={`inline-flex items-center justify-center size-10 rounded-lg bg-gradient-to-br ${stat.color} mb-3`}>
                                        <span className="material-symbols-outlined text-white text-xl">{stat.icon}</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                                    <p className="text-[#9dabb9] text-xs">{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* WhatsApp Connection */}
                        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="inline-flex items-center justify-center size-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-400">
                                        <span className="material-symbols-outlined text-white text-xl">chat</span>
                                    </div>
                                    <div>
                                        <h2 className="text-white font-semibold">WhatsApp Bot</h2>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${waStatus === 'connected' ? 'bg-green-500' : waStatus === 'qr' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                                            <span className="text-[#9dabb9] text-xs">
                                                {waStatus === 'connected' ? 'Connected' : waStatus === 'qr' ? 'Waiting for QR scan' : waStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {waStatus === 'disconnected' && (
                                        <button onClick={handleWaConnect} disabled={waConnecting}
                                            className="px-4 py-1.5 bg-[#25D366] hover:bg-[#20BD5A] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-70">
                                            {waConnecting ? 'Starting...' : 'Connect'}
                                        </button>
                                    )}
                                    {waStatus === 'connected' && (
                                        <button onClick={handleWaLogout}
                                            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors">
                                            Disconnect
                                        </button>
                                    )}
                                </div>
                            </div>

                            {waStatus === 'qr' && waQrCode && (
                                <div className="flex flex-col items-center gap-3 py-4 border-t border-[#30363d]">
                                    <p className="text-[#9dabb9] text-sm">Scan this QR code with WhatsApp:</p>
                                    <div className="bg-white p-3 rounded-xl">
                                        <img src={waQrCode} alt="QR Code" className="w-64 h-64" />
                                    </div>
                                    <p className="text-xs text-[#6e7b8b]">WhatsApp → Settings → Linked Devices → Link a Device</p>
                                </div>
                            )}

                            {waStatus === 'connecting' && (
                                <div className="flex items-center justify-center py-4 border-t border-[#30363d]">
                                    <div className="animate-spin w-6 h-6 border-3 border-[#25D366] border-t-transparent rounded-full"></div>
                                    <span className="ml-3 text-[#9dabb9] text-sm">Connecting...</span>
                                </div>
                            )}
                        </div>

                        {/* Recent Users & Activity */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Recent Users */}
                            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-white font-semibold">Recent Users</h2>
                                    <Link to="/admin/users" className="text-purple-400 text-sm hover:underline">View All</Link>
                                </div>
                                <div className="space-y-3">
                                    {recentUsers.length === 0 ? (
                                        <p className="text-[#6e7b8b] text-sm text-center py-4">No users yet</p>
                                    ) : (
                                        recentUsers.map(user => (
                                            <Link
                                                key={user.id}
                                                to={`/admin/users/${user.id}`}
                                                className="flex items-center justify-between p-3 rounded-lg hover:bg-[#21262d] transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                                                        <span className="text-white text-sm font-bold">{user.name?.[0] || 'U'}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-white text-sm font-medium">{user.name}</p>
                                                        <p className="text-[#6e7b8b] text-xs">{user.email}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[#9dabb9] text-xs">{user._count?.courses || 0} courses</p>
                                                </div>
                                            </Link>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
                                <h2 className="text-white font-semibold mb-4">Recent Attendance Activity</h2>
                                <div className="space-y-3">
                                    {recentActivity.length === 0 ? (
                                        <p className="text-[#6e7b8b] text-sm text-center py-4">No activity yet</p>
                                    ) : (
                                        recentActivity.map(log => (
                                            <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1117]">
                                                <div className={`size-8 rounded-full flex items-center justify-center ${log.status === 'SUCCESS' ? 'bg-green-500/20 text-green-400' :
                                                    log.status === 'NOT_AVAILABLE' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    <span className="material-symbols-outlined text-lg">
                                                        {log.status === 'SUCCESS' ? 'check_circle' :
                                                            log.status === 'NOT_AVAILABLE' ? 'schedule' : 'error'}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-sm font-medium truncate">
                                                        {log.schedule?.course?.name || 'Unknown Course'}
                                                    </p>
                                                    <p className="text-[#6e7b8b] text-xs">{log.status}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminDashboard;
