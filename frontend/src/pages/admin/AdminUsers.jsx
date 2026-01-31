import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { formatDistanceToNow } from 'date-fns';

const AdminUsers = () => {
    const { token } = useAdminAuth();
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(null);

    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7860/api';

    useEffect(() => {
        fetchUsers();
    }, [pagination.page]);

    const fetchUsers = async (searchQuery = search) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: '15',
                ...(searchQuery && { search: searchQuery })
            });

            const res = await fetch(`${API_URL}/admin/users?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setUsers(data.data.users);
                setPagination(data.data.pagination);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchUsers(search);
    };

    const handleDelete = async (userId, userName) => {
        if (!confirm(`Are you sure you want to delete user "${userName}"? This will delete all their courses, assignments, and schedules.`)) {
            return;
        }

        setDeleting(userId);
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                fetchUsers();
            } else {
                alert(data.message || 'Failed to delete user');
            }
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Failed to delete user');
        } finally {
            setDeleting(null);
        }
    };

    return (
        <AdminLayout>
            <div className="flex flex-col min-h-full p-4 md:p-6 pt-16 md:pt-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Users</h1>
                        <p className="text-[#9dabb9] text-sm">{pagination.total} registered users</p>
                    </div>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or email..."
                            className="bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2 text-white text-sm w-64 focus:outline-none focus:border-purple-500"
                        />
                        <button
                            type="submit"
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">search</span>
                        </button>
                    </form>
                </div>

                {/* Users Table */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-20 text-[#6e7b8b]">
                            <span className="material-symbols-outlined text-4xl mb-2">person_off</span>
                            <p>No users found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-[#0d1117] border-b border-[#30363d]">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-[#9dabb9] text-xs font-medium uppercase">User</th>
                                        <th className="text-left px-4 py-3 text-[#9dabb9] text-xs font-medium uppercase hidden md:table-cell">SPADA</th>
                                        <th className="text-center px-4 py-3 text-[#9dabb9] text-xs font-medium uppercase">Courses</th>
                                        <th className="text-center px-4 py-3 text-[#9dabb9] text-xs font-medium uppercase hidden md:table-cell">Tasks</th>
                                        <th className="text-left px-4 py-3 text-[#9dabb9] text-xs font-medium uppercase hidden md:table-cell">Joined</th>
                                        <th className="text-right px-4 py-3 text-[#9dabb9] text-xs font-medium uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#30363d]">
                                    {users.map(user => (
                                        <tr key={user.id} className="hover:bg-[#21262d] transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-white text-sm font-bold">{user.name?.[0] || 'U'}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-white text-sm font-medium truncate">{user.name}</p>
                                                        <p className="text-[#6e7b8b] text-xs truncate">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                {user.spadaUsername ? (
                                                    <span className="text-green-400 text-xs flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                                        Connected
                                                    </span>
                                                ) : (
                                                    <span className="text-[#6e7b8b] text-xs">Not set</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-white text-sm">{user._count?.courses || 0}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center hidden md:table-cell">
                                                <span className="text-white text-sm">{user._count?.tasks || 0}</span>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className="text-[#9dabb9] text-xs">
                                                    {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        to={`/admin/users/${user.id}`}
                                                        className="p-2 rounded-lg hover:bg-purple-500/20 text-[#9dabb9] hover:text-purple-400 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">visibility</span>
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(user.id, user.name)}
                                                        disabled={deleting === user.id}
                                                        className="p-2 rounded-lg hover:bg-red-500/20 text-[#9dabb9] hover:text-red-400 transition-colors disabled:opacity-50"
                                                        title="Delete User"
                                                    >
                                                        {deleting === user.id ? (
                                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-400 border-t-transparent"></div>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-[#30363d]">
                            <p className="text-[#6e7b8b] text-sm">
                                Page {pagination.page} of {pagination.totalPages}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                    disabled={pagination.page === 1}
                                    className="px-3 py-1 rounded bg-[#21262d] text-[#9dabb9] text-sm hover:bg-[#30363d] disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                    disabled={pagination.page === pagination.totalPages}
                                    className="px-3 py-1 rounded bg-[#21262d] text-[#9dabb9] text-sm hover:bg-[#30363d] disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminUsers;
