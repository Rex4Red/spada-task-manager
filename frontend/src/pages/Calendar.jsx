import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, add, sub } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, Pencil, X } from 'lucide-react';

const Calendar = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editDeadlineValue, setEditDeadlineValue] = useState('');

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const response = await api.get('/courses');
            let allTasks = [];
            if (response.data.data) {
                response.data.data.forEach(course => {
                    if (course.tasks) {
                        course.tasks.forEach(task => {
                            allTasks.push({ ...task, course });
                        });
                    }
                });
                setTasks(allTasks);
            }
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    /** Get the effective deadline: customDeadline > deadline > parsed from timeRemaining */
    const getEffectiveDeadline = (task) => {
        if (task.customDeadline) return new Date(task.customDeadline);
        if (task.deadline) return new Date(task.deadline);

        // Fallback: Parse 'timeRemaining' string
        if (task.timeRemaining) {
            const text = task.timeRemaining.toLowerCase();
            const anchorDate = task.updatedAt ? new Date(task.updatedAt) : new Date();

            const yearsMatch = text.match(/(\d+)\s+years?/);
            const monthsMatch = text.match(/(\d+)\s+months?/);
            const daysMatch = text.match(/(\d+)\s+days?/);
            const hoursMatch = text.match(/(\d+)\s+hours?/);
            const minsMatch = text.match(/(\d+)\s+min/);

            const years = yearsMatch ? parseInt(yearsMatch[1]) : 0;
            const months = monthsMatch ? parseInt(monthsMatch[1]) : 0;
            const days = daysMatch ? parseInt(daysMatch[1]) : 0;
            const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
            const minutes = minsMatch ? parseInt(minsMatch[1]) : 0;

            if (years === 0 && months === 0 && days === 0 && hours === 0 && minutes === 0) return null;
            const duration = { years, months, days, hours, minutes };

            if (text.includes('overdue')) return sub(anchorDate, duration);
            if (text.includes('remaining') || text.includes('due')) return add(anchorDate, duration);
        }
        return null;
    };

    const getTasksForDate = (date) => {
        return tasks.filter(task => {
            const d = getEffectiveDeadline(task);
            if (!d) return false;
            try { return isSameDay(d, date); } catch { return false; }
        });
    };

    const selectedDateTasks = getTasksForDate(selectedDate);

    /** Save custom deadline via API */
    const handleSaveDeadline = async (taskId) => {
        try {
            const payload = editDeadlineValue
                ? { customDeadline: new Date(editDeadlineValue).toISOString() }
                : { customDeadline: null };

            await api.patch(`/tasks/${taskId}/deadline`, payload);
            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, customDeadline: payload.customDeadline } : t
            ));
            setEditingTaskId(null);
            setEditDeadlineValue('');
        } catch (err) {
            console.error('Failed to update deadline:', err);
            alert('Gagal menyimpan deadline');
        }
    };

    /** Clear custom deadline */
    const handleClearDeadline = async (taskId) => {
        try {
            await api.patch(`/tasks/${taskId}/deadline`, { customDeadline: null });
            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, customDeadline: null } : t
            ));
            setEditingTaskId(null);
        } catch (err) {
            console.error('Failed to clear deadline:', err);
        }
    };

    /** Start editing a task's deadline */
    const startEditDeadline = (task) => {
        setEditingTaskId(task.id);
        const d = task.customDeadline || task.deadline;
        if (d) {
            const date = new Date(d);
            const offset = date.getTimezoneOffset();
            const local = new Date(date.getTime() - offset * 60 * 1000);
            setEditDeadlineValue(local.toISOString().slice(0, 16));
        } else {
            setEditDeadlineValue('');
        }
    };

    return (
        <Layout>
            <div className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-white text-3xl font-black tracking-tight">{format(currentDate, 'MMMM yyyy')}</h1>
                        <p className="text-[#9dabb9] text-sm font-medium">Manage your schedule</p>
                    </div>
                    <div className="flex items-center gap-2 bg-[#1e252e] p-1 rounded-xl border border-[#283039]">
                        <button onClick={prevMonth} className="p-2 hover:bg-[#2c353f] rounded-lg text-white transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs font-bold text-[#9dabb9] hover:text-white transition-colors">
                            TODAY
                        </button>
                        <button onClick={nextMonth} className="p-2 hover:bg-[#2c353f] rounded-lg text-white transition-colors">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Feature Description */}
                <div className="bg-[#1c252e]/60 rounded-xl p-4 border border-[#283039] flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">info</span>
                    <p className="text-[#9dabb9] text-xs leading-relaxed">
                        <span className="text-white font-medium">Kalender Tugas</span> &mdash; Menampilkan semua deadline tugas. Klik tanggal untuk melihat detail. Klik ✏️ untuk set deadline custom jika dosen tidak menyetel di SPADA.
                        <span className="inline-flex items-center gap-1 ml-2"><span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span> Aktif</span>
                        <span className="inline-flex items-center gap-1 ml-2"><span className="inline-block w-2 h-2 rounded-full bg-red-500"></span> Mendesak</span>
                        <span className="inline-flex items-center gap-1 ml-2"><span className="inline-block w-2 h-2 rounded-full bg-purple-500"></span> Custom</span>
                        <span className="inline-flex items-center gap-1 ml-2"><span className="inline-block w-2 h-2 rounded-full bg-green-500"></span> Selesai</span>
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Calendar Grid */}
                    <div className="flex-1 bg-[#161e27] rounded-3xl border border-[#283039] p-4 md:p-6 flex flex-col shadow-2xl relative overflow-visible">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

                        <div className="grid grid-cols-7 mb-2">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="text-[#586572] text-[10px] md:text-xs font-bold uppercase tracking-wider text-center py-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1 md:gap-2">
                            {calendarDays.map((day, idx) => {
                                const dayTasks = getTasksForDate(day);
                                const isSelected = isSameDay(day, selectedDate);
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                const isTodayDate = isToday(day);

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedDate(day)}
                                        className={`
                                            relative rounded-lg md:rounded-2xl aspect-square p-1 md:p-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-300
                                            ${!isCurrentMonth ? 'opacity-30' : 'hover:bg-[#1e252e]'}
                                            ${isSelected ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-900/50 scale-[1.02] border-none' : 'border border-transparent'}
                                            ${isTodayDate && !isSelected ? 'border-[#3b4754] bg-[#1e252e]' : ''}
                                        `}
                                    >
                                        <span className={`text-xs md:text-sm font-bold ${isSelected ? 'text-white' : 'text-[#9dabb9]'}`}>
                                            {format(day, 'd')}
                                        </span>

                                        {dayTasks.length > 0 && (
                                            <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                                {dayTasks.length <= 3 ? (
                                                    dayTasks.map((t, i) => {
                                                        const isUrgent = t.timeRemaining?.toLowerCase().includes('hour') || t.timeRemaining?.toLowerCase().includes('1 day');
                                                        let dotColor = 'bg-yellow-500';
                                                        if (t.status === 'COMPLETED') dotColor = 'bg-green-500';
                                                        else if (isUrgent) dotColor = 'bg-red-500';
                                                        else if (t.customDeadline) dotColor = 'bg-purple-500';
                                                        return <div key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : dotColor}`} />;
                                                    })
                                                ) : (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                        {dayTasks.length}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Side Panel (Selected Date) */}
                    <div className="w-full lg:w-96 bg-[#161e27] rounded-3xl border border-[#283039] p-6 flex flex-col shadow-2xl min-h-[300px] lg:min-h-0">
                        <div className="flex flex-col gap-1 pb-6 border-b border-[#283039]">
                            <h2 className="text-white text-xl font-bold">{format(selectedDate, 'EEEE')}</h2>
                            <p className="text-[#9dabb9] text-base">{format(selectedDate, 'MMMM do, yyyy')}</p>
                        </div>

                        <div className="flex-1 overflow-y-auto mt-6 flex flex-col gap-4 pr-2 custom-scrollbar">
                            {selectedDateTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                                    <div className="w-16 h-16 bg-[#1e252e] rounded-full flex items-center justify-center mb-4">
                                        <Clock className="w-8 h-8 text-[#586572]" />
                                    </div>
                                    <p className="text-[#9dabb9] font-medium">No tasks for this day</p>
                                    <p className="text-[#586572] text-xs mt-1">Free time! 🎉</p>
                                </div>
                            ) : (
                                selectedDateTasks.map(task => {
                                    const isEditing = editingTaskId === task.id;
                                    const hasCustom = !!task.customDeadline;
                                    const effectiveDate = getEffectiveDeadline(task);

                                    return (
                                        <div key={task.id} className="bg-[#1e252e] p-4 rounded-xl border border-[#283039] hover:border-blue-500/30 transition-colors group">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-white font-bold text-sm leading-tight group-hover:text-blue-400 transition-colors line-clamp-2">{task.title}</h3>
                                                {task.status === 'COMPLETED' ? (
                                                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                                ) : (
                                                    <AlertCircle className={`w-4 h-4 shrink-0 ${task.timeRemaining?.includes('hour') ? 'text-red-500' : 'text-yellow-500'}`} />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-[#9dabb9] flex-wrap">
                                                <span className="bg-[#2c353f] px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide">
                                                    {task.course?.name || 'Unknown Course'}
                                                </span>
                                                {hasCustom && (
                                                    <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide font-bold">
                                                        Custom
                                                    </span>
                                                )}
                                            </div>

                                            {/* Deadline editor */}
                                            {isEditing ? (
                                                <div className="mt-3 flex flex-col gap-2">
                                                    <input
                                                        type="datetime-local"
                                                        value={editDeadlineValue}
                                                        onChange={e => setEditDeadlineValue(e.target.value)}
                                                        className="w-full bg-[#283039] border border-[#3b4754] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleSaveDeadline(task.id)}
                                                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 rounded-lg transition-colors"
                                                        >
                                                            Save
                                                        </button>
                                                        {hasCustom && (
                                                            <button
                                                                onClick={() => handleClearDeadline(task.id)}
                                                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold py-1.5 px-3 rounded-lg transition-colors"
                                                            >
                                                                Clear
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setEditingTaskId(null)}
                                                            className="bg-[#283039] hover:bg-[#3b4754] text-[#9dabb9] text-xs py-1.5 px-3 rounded-lg transition-colors"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-3 flex justify-between items-end">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono text-[#586572]">
                                                            {effectiveDate ? format(effectiveDate, 'HH:mm') : '--:--'}
                                                        </span>
                                                        <button
                                                            onClick={() => startEditDeadline(task)}
                                                            className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                                                            title={hasCustom ? 'Edit deadline' : 'Set custom deadline'}
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                            {hasCustom ? 'Edit' : 'Set Deadline'}
                                                        </button>
                                                    </div>
                                                    <a
                                                        href={task.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest"
                                                    >
                                                        Open Task
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Calendar;
