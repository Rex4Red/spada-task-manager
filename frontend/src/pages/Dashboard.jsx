import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Layout from '../components/Layout';
import { format } from 'date-fns';

const Dashboard = () => {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [tasks, setTasks] = useState([]); // Flat list of ALL tasks
    const [filteredTasks, setFilteredTasks] = useState([]); // Filtered list for display
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, done, overdue, urgent
    const [courseFilter, setCourseFilter] = useState('all'); // 'all' or course id
    const [sort, setSort] = useState('deadline-asc'); // deadline-asc, deadline-desc, newToOld, oldToNew
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isCourseFilterOpen, setIsCourseFilterOpen] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        completedPercent: 0,
        pendingPercent: 0
    });

    const fetchData = async () => {
        try {
            const response = await api.get('/courses');
            const coursesData = response.data.data;
            setCourses(coursesData);

            // Flatten tasks
            const allTasks = coursesData.flatMap(c => c.tasks.map(t => ({ ...t, courseName: c.name })));
            setTasks(allTasks);

            // Stats
            let pending = 0;
            let completed = 0;
            const total = allTasks.length;

            allTasks.forEach(task => {
                const timeStr = (task.timeRemaining || '').toLowerCase();
                const isCompleted = task.status === 'COMPLETED' || timeStr.includes('submitted');
                if (isCompleted) completed++;
                else pending++;
            });

            setStats({
                totalTasks: total,
                pendingTasks: pending,
                completedTasks: completed,
                completedPercent: total > 0 ? (completed / total) * 100 : 0,
                pendingPercent: total > 0 ? (pending / total) * 100 : 0
            });

        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter & Sort Logic
    useEffect(() => {
        let result = [...tasks];
        const now = new Date();

        // 1. Filter
        if (filter === 'done') {
            result = result.filter(t => {
                const timeStr = (t.timeRemaining || '').toLowerCase();
                return t.status === 'COMPLETED' || timeStr.includes('submitted');
            });
        } else if (filter === 'overdue') {
            result = result.filter(t => {
                const timeStr = (t.timeRemaining || '').toLowerCase();
                const deadlineDate = t.deadline ? new Date(t.deadline) : null;
                const isOverdueByTime = timeStr.includes('overdue');
                const isOverdueByDate = deadlineDate && deadlineDate < now;
                // Only count as overdue if NOT done
                const isDone = t.status === 'COMPLETED' || timeStr.includes('submitted');
                return !isDone && (isOverdueByTime || isOverdueByDate);
            });
        } else if (filter === 'urgent') {
            // < 3 Days
            result = result.filter(t => {
                const timeStr = (t.timeRemaining || '').toLowerCase();
                const isDone = t.status === 'COMPLETED' || timeStr.includes('submitted');
                if (isDone) return false;

                if (!t.deadline) return false;
                const deadlineDate = new Date(t.deadline);
                const diffTime = deadlineDate - now;
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                return diffDays > 0 && diffDays < 3;
            });
        }

        // 2. Course Filter
        if (courseFilter !== 'all') {
            result = result.filter(t => t.courseId === parseInt(courseFilter));
        }

        // 3. Sort
        result.sort((a, b) => {
            if (sort === 'deadline-asc') {
                // Urgent first: Null deadlines last
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline) - new Date(b.deadline);
            } else if (sort === 'deadline-desc') {
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(b.deadline) - new Date(a.deadline);
            }
            return 0;
        });

        setFilteredTasks(result);
    }, [tasks, filter, courseFilter, sort]);


    // Helpers
    const getDeadlineClass = (date) => {
        if (!date) return 'text-gray-400';
        const now = new Date();
        const deadline = new Date(date);
        const diffHours = (deadline - now) / (1000 * 60 * 60);

        if (diffHours < 0) return 'text-red-600'; // Overdue
        if (diffHours < 24) return 'text-red-400'; // Urgent
        if (diffHours < 48) return 'text-upn-gold'; // Warning
        return 'text-[#9dabb9]';
    };

    const getDeadlineText = (date) => {
        if (!date) return 'No Deadline';
        const now = new Date();
        const deadline = new Date(date);
        const diffHours = (deadline - now) / (1000 * 60 * 60);

        if (diffHours < 0) return 'Overdue';
        if (diffHours < 24) return `Ends in ${Math.ceil(diffHours)}h`;
        if (diffHours < 48) return 'Ends Tomorrow';
        return format(deadline, 'MMM dd, HH:mm');
    };

    const getDeadlineStatusDisplay = (task) => {
        const timeStr = (task.timeRemaining || '').toLowerCase();
        if (timeStr.includes('overdue')) return <span className="text-red-500 font-bold">Overdue</span>;
        if (timeStr.includes('submitted')) return <span className="text-green-500 font-bold">Done</span>;

        // Only show date if it's a valid date
        if (task.deadline) {
            return format(new Date(task.deadline), 'MMM dd, HH:mm');
        }
        return '-';
    };

    const isTaskCompleted = (task) => {
        const timeStr = (task.timeRemaining || '').toLowerCase();
        return task.status === 'COMPLETED' || timeStr.includes('submitted');
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to hide this task? It will not appear in future syncs.')) return;
        try {
            await api.delete(`/tasks/${taskId}`);
            // Remove from local state immediately
            setTasks(prev => prev.filter(t => t.id !== taskId));
            // Stats will auto-recalc on next render/effect or we can manually recalc, 
            // but since stats are calculated in fetchData, we might want to update them or just let them be slightly stale until refresh.
            // Better: update stats locally for immediate feedback if needed, but for now just removing row is enough.
        } catch (error) {
            console.error('Failed to delete task:', error);
            alert('Failed to delete task');
        }
    };

    return (
        <Layout>
            <div className="flex flex-col w-full max-w-[1200px] mx-auto p-6 md:p-10 gap-8">
                {/* Page Header */}
                <div className="flex flex-wrap justify-between items-end gap-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em]">Welcome back, {user?.name?.split(' ')[0]}</h2>
                        <p className="text-[#9dabb9] text-base font-normal">Here is your academic progress overview.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-card-dark border border-[#3b4754] rounded-lg px-4 py-2">
                        <span className="material-symbols-outlined text-primary">event</span>
                        <span className="text-white text-sm font-medium">{format(new Date(), 'MMM dd, yyyy')}</span>
                    </div>
                </div>

                {loading ? (
                    /* Skeleton Loading UI */
                    <div className="animate-pulse flex flex-col gap-8 w-full">
                        {/* Stats Skeleton */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-40 rounded-xl bg-[#283039]/50 border border-[#3b4754]"></div>
                            ))}
                        </div>
                        {/* Table Skeleton */}
                        <div className="flex flex-col gap-4">
                            <div className="h-8 w-48 bg-[#283039] rounded"></div>
                            <div className="w-full h-96 rounded-xl bg-[#283039]/30 border border-[#3b4754]"></div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Total Tasks */}
                            <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-dark border border-[#3b4754] hover:border-primary/50 transition-colors shadow-lg shadow-black/20">
                                <div className="flex justify-between items-start">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <span className="material-symbols-outlined text-primary">assignment</span>
                                    </div>
                                    <span className="text-[#9dabb9] text-xs font-medium bg-[#283039] px-2 py-1 rounded">Semester Total</span>
                                </div>
                                <div className="mt-2">
                                    <p className="text-[#9dabb9] text-sm font-medium">Total Tasks</p>
                                    <p className="text-white text-3xl font-bold mt-1">{stats.totalTasks}</p>
                                </div>
                                <div className="w-full bg-[#283039] h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
                                </div>
                            </div>
                            {/* Completed */}
                            <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-dark border border-[#3b4754] hover:border-upn-green/50 transition-colors shadow-lg shadow-black/20">
                                <div className="flex justify-between items-start">
                                    <div className="p-2 bg-upn-green/10 rounded-lg">
                                        <span className="material-symbols-outlined text-upn-green">check_circle</span>
                                    </div>
                                    <span className="text-[#9dabb9] text-xs font-medium bg-[#283039] px-2 py-1 rounded">Graded</span>
                                </div>
                                <div className="mt-2">
                                    <p className="text-[#9dabb9] text-sm font-medium">Completed</p>
                                    <p className="text-white text-3xl font-bold mt-1">{stats.completedTasks}</p>
                                </div>
                                <div className="w-full bg-[#283039] h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-upn-green h-full rounded-full" style={{ width: `${stats.completedPercent}%` }}></div>
                                </div>
                            </div>
                            {/* Pending */}
                            <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-dark border border-[#3b4754] hover:border-upn-gold/50 transition-colors shadow-lg shadow-black/20">
                                <div className="flex justify-between items-start">
                                    <div className="p-2 bg-upn-gold/10 rounded-lg">
                                        <span className="material-symbols-outlined text-upn-gold">pending_actions</span>
                                    </div>
                                    <span className="text-[#9dabb9] text-xs font-medium bg-[#283039] px-2 py-1 rounded">Needs Action</span>
                                </div>
                                <div className="mt-2">
                                    <p className="text-[#9dabb9] text-sm font-medium">Pending</p>
                                    <p className="text-white text-3xl font-bold mt-1">{stats.pendingTasks}</p>
                                </div>
                                <div className="w-full bg-[#283039] h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-upn-gold h-full rounded-full" style={{ width: `${stats.pendingPercent}%` }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Deadline Alerts */}
                        {stats.pendingTasks > 0 && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-red-500 animate-pulse">notification_important</span>
                                    <h2 className="text-white text-xl font-bold leading-tight">Deadline Alerts</h2>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {tasks
                                        .filter(t => !isTaskCompleted(t) && t.deadline)
                                        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
                                        .slice(0, 2)
                                        .map(task => (
                                            <div key={task.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-l-4 bg-card-dark p-5 shadow-md ${getDeadlineClass(task.deadline).includes('red') ? 'border-[#3b4754] border-l-red-500' : 'border-[#3b4754] border-l-upn-gold'
                                                }`}>
                                                <div className="flex flex-col gap-1">
                                                    <p className="text-white text-base font-bold leading-tight line-clamp-1">{task.courseName}</p>
                                                    <p className="text-[#9dabb9] text-sm line-clamp-1">{task.title}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`material-symbols-outlined text-[18px] ${getDeadlineClass(task.deadline)}`}>timer</span>
                                                        <p className={`${getDeadlineClass(task.deadline)} text-sm font-medium`}>{getDeadlineText(task.deadline)}</p>
                                                    </div>
                                                    <p className="text-[#9dabb9] text-xs">Due: {task.deadline ? format(new Date(task.deadline), 'MMM dd, HH:mm') : 'No Date'}</p>
                                                </div>
                                                <a
                                                    href={task.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex w-full sm:w-auto items-center justify-center rounded-lg h-9 px-4 bg-primary hover:bg-blue-600 text-white text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
                                                >
                                                    Submit Now
                                                </a>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}

                        {/* Assignments Table Section */}
                        <div className="flex flex-col gap-4 pb-10">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h2 className="text-white text-xl font-bold leading-tight">All Assignments</h2>
                                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">

                                    {/* Custom Filter Dropdown */}
                                    <div className="relative w-full sm:w-auto">
                                        <button
                                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                                            className="flex items-center gap-2 px-3 py-2 bg-[#283039] border border-[#3b4754] rounded-lg text-sm text-white hover:bg-[#3b4754] transition-colors cursor-pointer w-full sm:min-w-[180px] justify-between"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                                                <span>
                                                    {filter === 'all' && 'All Tasks'}
                                                    {filter === 'urgent' && 'Urgent (< 3 Days)'}
                                                    {filter === 'overdue' && 'Overdue'}
                                                    {filter === 'done' && 'Done / Submitted'}
                                                </span>
                                            </div>
                                            <span className={`material-symbols-outlined text-[18px] text-[#9dabb9] transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`}>expand_more</span>
                                        </button>

                                        {isFilterOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)}></div>
                                                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-full sm:w-64 bg-card-dark border border-[#3b4754] rounded-lg shadow-xl z-20 overflow-hidden flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100">
                                                    {[
                                                        { id: 'all', label: 'All Tasks', icon: 'list' },
                                                        { id: 'urgent', label: 'Urgent (< 3 Days)', icon: 'notification_important', color: 'text-upn-gold' },
                                                        { id: 'overdue', label: 'Overdue', icon: 'warning', color: 'text-red-500' },
                                                        { id: 'done', label: 'Done / Submitted', icon: 'check_circle', color: 'text-upn-green' }
                                                    ].map(option => (
                                                        <button
                                                            key={option.id}
                                                            onClick={() => {
                                                                setFilter(option.id);
                                                                setIsFilterOpen(false);
                                                            }}
                                                            className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-[#283039] transition-colors text-left ${filter === option.id ? 'text-white bg-[#283039]' : 'text-[#9dabb9]'
                                                                }`}
                                                        >
                                                            <span className={`material-symbols-outlined text-[20px] ${option.color || ''}`}>{option.icon}</span>
                                                            <span>{option.label}</span>
                                                            {filter === option.id && <span className="material-symbols-outlined text-[18px] text-primary ml-auto">check</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Course Filter Dropdown */}
                                    <div className="relative w-full sm:w-auto">
                                        <button
                                            onClick={() => setIsCourseFilterOpen(!isCourseFilterOpen)}
                                            className="flex items-center gap-2 px-3 py-2 bg-[#283039] border border-[#3b4754] rounded-lg text-sm text-white hover:bg-[#3b4754] transition-colors cursor-pointer w-full sm:min-w-[180px] justify-between"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[18px]">menu_book</span>
                                                <span className="truncate max-w-[120px]">
                                                    {courseFilter === 'all'
                                                        ? 'All Courses'
                                                        : courses.find(c => c.id === parseInt(courseFilter))?.name || 'Course'}
                                                </span>
                                            </div>
                                            <span className={`material-symbols-outlined text-[18px] text-[#9dabb9] transition-transform duration-200 ${isCourseFilterOpen ? 'rotate-180' : ''}`}>expand_more</span>
                                        </button>

                                        {isCourseFilterOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setIsCourseFilterOpen(false)}></div>
                                                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-full sm:w-72 bg-card-dark border border-[#3b4754] rounded-lg shadow-xl z-20 overflow-hidden flex flex-col py-1 max-h-64 overflow-y-auto">
                                                    {/* All Courses Option */}
                                                    <button
                                                        onClick={() => {
                                                            setCourseFilter('all');
                                                            setIsCourseFilterOpen(false);
                                                        }}
                                                        className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-[#283039] transition-colors text-left ${courseFilter === 'all' ? 'text-white bg-[#283039]' : 'text-[#9dabb9]'}`}
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">apps</span>
                                                        <span>All Courses</span>
                                                        {courseFilter === 'all' && <span className="material-symbols-outlined text-[18px] text-primary ml-auto">check</span>}
                                                    </button>

                                                    {/* Divider */}
                                                    <div className="h-px bg-[#3b4754] mx-2 my-1"></div>

                                                    {/* Course List */}
                                                    {courses.map(course => (
                                                        <button
                                                            key={course.id}
                                                            onClick={() => {
                                                                setCourseFilter(course.id.toString());
                                                                setIsCourseFilterOpen(false);
                                                            }}
                                                            className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-[#283039] transition-colors text-left ${courseFilter === course.id.toString() ? 'text-white bg-[#283039]' : 'text-[#9dabb9]'}`}
                                                        >
                                                            <span className="material-symbols-outlined text-[20px] text-primary">school</span>
                                                            <span className="truncate flex-1">{course.name}</span>
                                                            <span className="text-xs text-[#64748b] shrink-0">({course.tasks?.length || 0})</span>
                                                            {courseFilter === course.id.toString() && <span className="material-symbols-outlined text-[18px] text-primary ml-1">check</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Search (Simplified visual) */}
                                    <div className="relative flex-grow sm:flex-grow-0">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#9dabb9] text-[18px]">search</span>
                                        <input className="w-full sm:w-64 pl-10 pr-4 py-2 bg-[#283039] border border-[#3b4754] rounded-lg text-white text-sm placeholder-[#64748b] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Search tasks (coming soon...)" type="text" disabled />
                                    </div>
                                </div>
                            </div>

                            <div className="w-full overflow-hidden rounded-xl border border-[#3b4754] bg-card-dark shadow-lg">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-[#3b4754] bg-[#1a232e]">
                                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#9dabb9]">Course Name</th>
                                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#9dabb9]">Task Name</th>
                                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#9dabb9]">Deadline</th>
                                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#9dabb9]">Status</th>
                                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#9dabb9]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#3b4754]">
                                            {filteredTasks.length > 0 ? filteredTasks.map((task) => (
                                                <tr key={task.id} className="group hover:bg-[#283039] transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center justify-center size-8 rounded bg-blue-900/30 text-blue-400">
                                                                <span className="material-symbols-outlined text-[18px]">code</span>
                                                            </div>
                                                            <p className="text-sm font-medium text-white line-clamp-1 max-w-[150px]" title={task.courseName}>{task.courseName}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <p className="text-sm text-[#d1d5db] line-clamp-1 max-w-[200px]" title={task.title}>{task.title}</p>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <p className={`text-sm ${getDeadlineClass(task.deadline)}`}>
                                                            {getDeadlineStatusDisplay(task)}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${isTaskCompleted(task)
                                                            ? 'bg-upn-green/10 text-upn-green border-upn-green/20'
                                                            : 'bg-upn-gold/10 text-upn-gold border-upn-gold/20'
                                                            }`}>
                                                            <span className={`size-1.5 rounded-full ${isTaskCompleted(task) ? 'bg-upn-green' : 'bg-upn-gold animate-pulse'}`}></span>
                                                            {isTaskCompleted(task) ? 'Submitted' : 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <a href={task.url} target="_blank" rel="noreferrer" className="text-primary hover:text-blue-400 transition-colors font-medium text-sm flex items-center gap-1">
                                                                Open <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                                            </a>
                                                            <button
                                                                onClick={() => handleDeleteTask(task.id)}
                                                                className="text-[#9dabb9] hover:text-red-500 transition-colors flex items-center justify-center p-1 rounded hover:bg-red-500/10"
                                                                title="Hide Task"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                                                        No tasks found for this filter.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
};

export default Dashboard;
