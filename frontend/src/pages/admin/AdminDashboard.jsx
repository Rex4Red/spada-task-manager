import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';

const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || '/ctrl-s7x';

const AdminDashboard = () => {
    const { token } = useAdminAuth();
    const [stats, setStats] = useState(null);
    const [recentUsers, setRecentUsers] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [waStatus, setWaStatus] = useState(null);

    // Admin error notification settings
    const [adminWa, setAdminWa] = useState('');
    const [errorNotifEnabled, setErrorNotifEnabled] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsMsg, setSettingsMsg] = useState('');
    const [testingSending, setTestingSending] = useState(false);

    const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';

    useEffect(() => {
        fetchData();
        fetchWaStatus();
        fetchAdminSettings();
    }, []);

    const fetchWaStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/whatsapp/status`);
            const data = await res.json();
            setWaStatus(data);
        } catch (e) { /* silent */ }
    };

    const fetchAdminSettings = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setAdminWa(data.data.adminWhatsapp || '');
                setErrorNotifEnabled(data.data.errorNotifEnabled || false);
            }
        } catch (e) { /* silent */ }
    };

    const handleSaveSettings = async () => {
        setSettingsSaving(true);
        setSettingsMsg('');
        try {
            const res = await fetch(`${API_URL}/admin/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    adminWhatsapp: adminWa,
                    errorNotifEnabled
                })
            });
            const data = await res.json();
            setSettingsMsg(data.success ? '✅ Settings saved!' : '❌ ' + data.message);
        } catch (e) {
            setSettingsMsg('❌ Failed to save');
        } finally {
            setSettingsSaving(false);
            setTimeout(() => setSettingsMsg(''), 3000);
        }
    };

    const handleTestNotif = async () => {
        if (!adminWa) {
            setSettingsMsg('❌ Set WhatsApp number first');
            setTimeout(() => setSettingsMsg(''), 3000);
            return;
        }
        setTestingSending(true);
        try {
            const res = await fetch(`${API_URL}/admin/settings/test-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ phoneNumber: adminWa })
            });
            const data = await res.json();
            setSettingsMsg(data.success ? '✅ Test sent!' : '❌ ' + data.message);
        } catch (e) {
            setSettingsMsg('❌ Failed to send test');
        } finally {
            setTestingSending(false);
            setTimeout(() => setSettingsMsg(''), 3000);
        }
    };

    const handleWaTest = async () => {
        const phone = prompt('Enter phone number to test (e.g. 628xxx):');
        if (!phone) return;
        try {
            const res = await fetch(`${API_URL}/whatsapp/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: phone, message: '✅ SPADA WhatsApp test notification!' }),
            });
            const data = await res.json();
            alert(data.success ? 'Test message sent!' : `Failed: ${data.error}`);
        } catch (e) {
            alert('Failed to send test: ' + e.message);
        }
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
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="inline-flex items-center justify-center size-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-400">
                                        <span className="material-symbols-outlined text-white text-xl">chat</span>
                                    </div>
                                    <div>
                                        <h2 className="text-white font-semibold">WhatsApp Notifications</h2>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${waStatus?.ok ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                                            <span className="text-[#9dabb9] text-xs">
                                                {waStatus?.ok ? `Active — ${waStatus.status}` : waStatus?.error || 'Checking...'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {waStatus?.ok && (
                                    <button onClick={handleWaTest}
                                        className="px-4 py-1.5 bg-[#25D366] hover:bg-[#20BD5A] text-white text-sm font-bold rounded-lg transition-colors">
                                        Test
                                    </button>
                                )}
                            </div>
                            {!waStatus?.ok && waStatus?.error && (
                                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                    <p className="text-yellow-400 text-xs">
                                        Setup: Register at <a href="https://fonnte.com" target="_blank" rel="noopener" className="underline">fonnte.com</a> →
                                        Connect device → Add FONNTE_TOKEN to Vercel env vars
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Error Notification Settings */}
                        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="inline-flex items-center justify-center size-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-400">
                                    <span className="material-symbols-outlined text-white text-xl">notifications_active</span>
                                </div>
                                <div>
                                    <h2 className="text-white font-semibold">Error Notifications</h2>
                                    <p className="text-[#9dabb9] text-xs">Receive WhatsApp alerts when system errors occur</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Toggle */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[#c9d1d9] text-sm">Enable error notifications</span>
                                    <button
                                        onClick={() => setErrorNotifEnabled(!errorNotifEnabled)}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${errorNotifEnabled ? 'bg-green-500' : 'bg-[#30363d]'
                                            }`}
                                    >
                                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${errorNotifEnabled ? 'translate-x-[22px]' : 'translate-x-[3px]'
                                            }`} />
                                    </button>
                                </div>

                                {/* Phone Input */}
                                <div>
                                    <label className="text-[#9dabb9] text-xs block mb-1">Admin WhatsApp Number</label>
                                    <input
                                        type="text"
                                        value={adminWa}
                                        onChange={(e) => setAdminWa(e.target.value)}
                                        placeholder="628123456789"
                                        className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                                    />
                                    <p className="text-[#6e7b8b] text-xs mt-1">Format: 628xxx (with country code, no +)</p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3 flex-wrap">
                                    <button
                                        onClick={handleSaveSettings}
                                        disabled={settingsSaving}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        {settingsSaving ? 'Saving...' : 'Save Settings'}
                                    </button>
                                    <button
                                        onClick={handleTestNotif}
                                        disabled={testingSending || !adminWa}
                                        className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] disabled:opacity-50 text-white text-sm font-medium rounded-lg border border-[#30363d] transition-colors"
                                    >
                                        {testingSending ? 'Sending...' : '🔔 Test Notification'}
                                    </button>
                                    {settingsMsg && (
                                        <span className="text-sm">{settingsMsg}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Recent Users & Activity */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Recent Users */}
                            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-white font-semibold">Recent Users</h2>
                                    <Link to={`${ADMIN_PATH}/users`} className="text-purple-400 text-sm hover:underline">View All</Link>
                                </div>
                                <div className="space-y-3">
                                    {recentUsers.length === 0 ? (
                                        <p className="text-[#6e7b8b] text-sm text-center py-4">No users yet</p>
                                    ) : (
                                        recentUsers.map(user => (
                                            <Link
                                                key={user.id}
                                                to={`${ADMIN_PATH}/users/${user.id}`}
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
