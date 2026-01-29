import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { format, startOfMonth, endOfMonth, min, max, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, add, sub, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const Calendar = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    console.log('Calendar Component Rendering...');

    useEffect(() => {
        console.log('Calendar useEffect running...');
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        console.log('Fetching tasks...');
        try {
            const response = await api.get('/courses');
            console.log('API Response:', response.data);
            // Flatten tasks from courses
            let allTasks = [];
            if (response.data.data) {
                response.data.data.forEach(course => {
                    if (course.tasks) {
                        allTasks = [...allTasks, ...course.tasks];
                    }
                });
                console.log("All Tasks Flattened:", allTasks);
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
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const estimateDeadline = (task) => {
        // 1. Use explicit deadline if valid
        if (task.deadline) {
            return new Date(task.deadline);
        }

        // 2. Fallback: Parse 'timeRemaining' string
        // Format example: "Assignment is overdue by: 88 days 23 hours"
        if (task.timeRemaining) {
            const text = task.timeRemaining.toLowerCase();
            const anchorDate = task.updatedAt ? new Date(task.updatedAt) : new Date();

            const daysMatch = text.match(/(\d+)\s+days?/);
            const hoursMatch = text.match(/(\d+)\s+hours?/);
            const minsMatch = text.match(/(\d+)\s+min/); // matches mins or minutes

            const days = daysMatch ? parseInt(daysMatch[1]) : 0;
            const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
            const minutes = minsMatch ? parseInt(minsMatch[1]) : 0;

            // Avoid parsing if no numbers found
            if (days === 0 && hours === 0 && minutes === 0) return null;

            const duration = { days, hours, minutes };

            if (text.includes('overdue')) {
                return sub(anchorDate, duration);
            } else if (text.includes('remaining') || text.includes('due')) {
                return add(anchorDate, duration);
            }
        }
        return null;
    };

    const getTasksForDate = (date) => {
        return tasks.filter(task => {
            const estimatedDate = estimateDeadline(task);
            if (!estimatedDate) return false;

            try {
                return isSameDay(estimatedDate, date);
            } catch (e) {
                return false;
            }
        });
    };

    const selectedDateTasks = getTasksForDate(selectedDate);

    return (
        <Layout>
            <div className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 h-[calc(100vh-80px)]">
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

                <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                    {/* Calendar Grid */}
                    <div className="flex-1 bg-[#161e27] rounded-3xl border border-[#283039] p-6 flex flex-col shadow-2xl relative overflow-hidden">
                        {/* Glow Effect */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

                        {/* Days Header */}
                        <div className="grid grid-cols-7 mb-4">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="text-[#586572] text-xs font-bold uppercase tracking-wider text-center py-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 grid-rows-6 gap-2 flex-1">
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
                                            relative rounded-2xl p-2 flex flex-col items-center justify-start gap-1 transition-all duration-300
                                            ${!isCurrentMonth ? 'opacity-30' : 'hover:bg-[#1e252e]'}
                                            ${isSelected ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-900/50 scale-[1.02] border-none' : 'border border-transparent'}
                                            ${isTodayDate && !isSelected ? 'border-[#3b4754] bg-[#1e252e]' : ''}
                                        `}
                                    >
                                        <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-[#9dabb9]'}`}>
                                            {format(day, 'd')}
                                        </span>

                                        {/* Task Indicators */}
                                        <div className="flex gap-1 mt-1 flex-wrap justify-center content-start w-full px-2">
                                            {dayTasks.map((t, i) => {
                                                if (i > 3) return null; // Limit dots
                                                const isUrgent = t.timeRemaining?.toLowerCase().includes('hour') || t.timeRemaining?.toLowerCase().includes('1 day');
                                                // Color logic
                                                let dotColor = 'bg-gray-500';
                                                if (t.status === 'COMPLETED') dotColor = 'bg-green-500';
                                                else if (isUrgent) dotColor = 'bg-red-500';
                                                else dotColor = 'bg-yellow-500';

                                                return (
                                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : dotColor} shadow-sm`} />
                                                )
                                            })}
                                            {dayTasks.length > 4 && (
                                                <span className="text-[8px] text-[#586572] leading-none">+</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Side Panel (Selected Date) */}
                    <div className="w-full lg:w-96 bg-[#161e27] rounded-3xl border border-[#283039] p-6 flex flex-col shadow-2xl h-full">
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
                                selectedDateTasks.map(task => (
                                    <div key={task.id} className="bg-[#1e252e] p-4 rounded-xl border border-[#283039] hover:border-blue-500/30 transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-white font-bold text-sm leading-tight group-hover:text-blue-400 transition-colors line-clamp-2">{task.title}</h3>
                                            {task.status === 'COMPLETED' ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                            ) : (
                                                <AlertCircle className={`w-4 h-4 shrink-0 ${task.timeRemaining?.includes('hour') ? 'text-red-500' : 'text-yellow-500'}`} />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-[#9dabb9]">
                                            <span className="bg-[#2c353f] px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide">
                                                {task.course?.name || 'Unknown Course'}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex justify-between items-end">
                                            <span className="text-xs font-mono text-[#586572]">
                                                {(() => {
                                                    const date = estimateDeadline(task);
                                                    return date ? format(date, 'HH:mm') : '--:--';
                                                })()}
                                            </span>
                                            <a
                                                href={task.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest"
                                            >
                                                Open Task
                                            </a>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Calendar;
