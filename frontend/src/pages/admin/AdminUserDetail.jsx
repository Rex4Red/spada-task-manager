import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { formatDistanceToNow, format } from 'date-fns';

const AdminUserDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useAdminAuth();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7860/api';

    useEffect(() => {
        fetchUser();
    }, [id]);

    const fetchUser = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setUser(data.data);
            } else {
                navigate('/admin/users');
            }
        } catch (err) {
            console.error('Failed to fetch user:', err);
            navigate('/admin/users');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete user "${user.name}"? This action cannot be undone.`)) {
            return;
        }

        setDeleting(true);
        try {
            const res = await fetch(`${API_URL}/admin/users/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                navigate('/admin/users');
            } else {
                alert(data.message || 'Failed to delete user');
            }
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Failed to delete user');
        } finally {
            setDeleting(false);
        }
    };

    const getDayName = (dayNum) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayNum] || 'Unknown';
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
                </div>
            </AdminLayout>
        );
    }

    if (!user) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center min-h-screen text-[#6e7b8b]">
                    <span className="material-symbols-outlined text-4xl mb-2">person_off</span>
                    <p>User not found</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="flex flex-col min-h-full p-4 md:p-6 pt-16 md:pt-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link to="/admin/users" className="p-2 rounded-lg hover:bg-[#21262d] text-[#9dabb9] hover:text-white transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-white">{user.name}</h1>
                        <p className="text-[#9dabb9] text-sm">{user.email}</p>
                    </div>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50"
                    >
                        {deleting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-400 border-t-transparent"></div>
                        ) : (
                            <span className="material-symbols-outlined text-lg">delete</span>
                        )}
                        Delete User
                    </button>
                </div>

                {/* User Info Card */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 mb-6">
                    <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-400">person</span>
                        User Information
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-[#6e7b8b] text-xs mb-1">SPADA Username</p>
                            <p className="text-white text-sm">{user.spadaUsername || <span className="text-[#6e7b8b]">Not set</span>}</p>
                        </div>
                        <div>
                            <p className="text-[#6e7b8b] text-xs mb-1">Telegram</p>
                            <p className="text-white text-sm">
                                {user.telegramConfig?.chatId ? (
                                    <span className="text-green-400 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        Connected
                                    </span>
                                ) : (
                                    <span className="text-[#6e7b8b]">Not configured</span>
                                )}
                            </p>
                        </div>
                        <div>
                            <p className="text-[#6e7b8b] text-xs mb-1">Total Courses</p>
                            <p className="text-white text-sm">{user.courses?.length || 0}</p>
                        </div>
                        <div>
                            <p className="text-[#6e7b8b] text-xs mb-1">Joined</p>
                            <p className="text-white text-sm">{formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</p>
                        </div>
                    </div>
                </div>

                {/* Courses */}
                <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400">school</span>
                    Courses ({user.courses?.length || 0})
                </h2>

                {user.courses?.length === 0 ? (
                    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-center text-[#6e7b8b]">
                        <span className="material-symbols-outlined text-3xl mb-2">school</span>
                        <p>No courses added</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {user.courses.map(course => (
                            <div key={course.id} className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
                                {/* Course Header */}
                                <div className="p-4 border-b border-[#30363d]">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-white font-medium">{course.name}</h3>
                                            <p className="text-[#6e7b8b] text-xs mt-1">
                                                ID: {course.sourceId} • Last synced: {course.lastSynced ? formatDistanceToNow(new Date(course.lastSynced), { addSuffix: true }) : 'Never'}
                                            </p>
                                        </div>
                                        {course.attendanceSchedule && (
                                            <div className={`px-2 py-1 rounded text-xs font-medium ${course.attendanceSchedule.isActive ? 'bg-green-500/20 text-green-400' : 'bg-[#21262d] text-[#6e7b8b]'}`}>
                                                {course.attendanceSchedule.isActive ? 'Auto Attendance ON' : 'Auto Attendance OFF'}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Assignments */}
                                {course.tasks?.length > 0 && (
                                    <div className="p-4 bg-[#0d1117]">
                                        <p className="text-[#9dabb9] text-xs font-medium mb-2">Assignments ({course.tasks.length})</p>
                                        <div className="space-y-2">
                                            {course.tasks.slice(0, 5).map(task => (
                                                <div key={task.id} className="flex items-center justify-between text-sm">
                                                    <span className="text-white truncate flex-1 mr-4">{task.title}</span>
                                                    <div className="flex items-center gap-3 flex-shrink-0">
                                                        <span className={`text-xs ${task.status === 'COMPLETED' ? 'text-green-400' : task.status === 'OVERDUE' ? 'text-red-400' : 'text-[#9dabb9]'}`}>
                                                            {task.status}
                                                        </span>
                                                        {task.deadline && (
                                                            <span className="text-[#6e7b8b] text-xs">
                                                                {format(new Date(task.deadline), 'MMM d, HH:mm')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {course.tasks.length > 5 && (
                                                <p className="text-[#6e7b8b] text-xs">+{course.tasks.length - 5} more assignments</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Attendance Schedule */}
                                {course.attendanceSchedule && (
                                    <div className="p-4 border-t border-[#30363d]">
                                        <p className="text-[#9dabb9] text-xs font-medium mb-2">Attendance Schedule</p>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-white">
                                                {getDayName(course.attendanceSchedule.dayOfWeek)} at {course.attendanceSchedule.timeOfDay}
                                            </span>
                                            {course.attendanceSchedule.nextRunAt && (
                                                <span className="text-[#6e7b8b] text-xs">
                                                    Next: {format(new Date(course.attendanceSchedule.nextRunAt), 'MMM d, HH:mm')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminUserDetail;
