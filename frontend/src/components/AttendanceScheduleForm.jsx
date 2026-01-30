import { useState, useEffect } from 'react';
import api from '../services/api';

const DAYS_OF_WEEK = [
    { value: 0, label: 'Minggu' },
    { value: 1, label: 'Senin' },
    { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' },
    { value: 4, label: 'Kamis' },
    { value: 5, label: 'Jumat' },
    { value: 6, label: 'Sabtu' }
];

const AttendanceScheduleForm = ({ courseId, courseName }) => {
    const [schedule, setSchedule] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    // Form state
    const [isActive, setIsActive] = useState(false);
    const [scheduleType, setScheduleType] = useState('SIMPLE');
    const [dayOfWeek, setDayOfWeek] = useState(1); // Default Monday
    const [timeOfDay, setTimeOfDay] = useState('08:00');
    const [cronExpression, setCronExpression] = useState('');
    const [maxRetries, setMaxRetries] = useState(6);
    const [retryIntervalMinutes, setRetryIntervalMinutes] = useState(5);
    const [useSeparateTelegram, setUseSeparateTelegram] = useState(false);
    const [customBotToken, setCustomBotToken] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showRetrySettings, setShowRetrySettings] = useState(false);

    // Logs
    const [logs, setLogs] = useState([]);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        fetchSchedule();
        fetchLogs();
    }, [courseId]);

    const fetchSchedule = async () => {
        try {
            const response = await api.get(`/attendance/${courseId}`);
            const data = response.data.data;
            if (data) {
                setSchedule(data);
                setIsActive(data.isActive);
                setScheduleType(data.scheduleType || 'SIMPLE');
                setDayOfWeek(data.dayOfWeek ?? 1);
                setTimeOfDay(data.timeOfDay || '08:00');
                setCronExpression(data.cronExpression || '');
                setMaxRetries(data.maxRetries ?? 6);
                setRetryIntervalMinutes(data.retryIntervalMinutes ?? 5);
                setUseSeparateTelegram(data.useSeparateTelegram || false);
                setCustomBotToken(data.customBotToken || '');
            }
        } catch (error) {
            console.error('Failed to fetch schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            const response = await api.get(`/attendance/${courseId}/logs?limit=5`);
            setLogs(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/attendance/${courseId}`, {
                scheduleType,
                dayOfWeek: scheduleType === 'SIMPLE' ? dayOfWeek : null,
                timeOfDay: scheduleType === 'SIMPLE' ? timeOfDay : null,
                cronExpression: scheduleType === 'CRON' ? cronExpression : null,
                maxRetries,
                retryIntervalMinutes,
                isActive,
                useSeparateTelegram,
                customBotToken: useSeparateTelegram ? customBotToken : null
            });
            alert('Schedule saved successfully!');
            fetchSchedule();
        } catch (error) {
            console.error('Failed to save schedule:', error);
            alert('Failed to save schedule');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!confirm('This will attempt to run attendance immediately. Continue?')) return;

        setTesting(true);
        try {
            const response = await api.post(`/attendance/${courseId}/test`);
            alert(response.data.message);
            fetchLogs();
        } catch (error) {
            console.error('Test failed:', error);
            alert(error.response?.data?.message || 'Test failed');
        } finally {
            setTesting(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'SUCCESS': return '✅';
            case 'FAILED': return '❌';
            case 'NOT_AVAILABLE': return 'ℹ️';
            case 'TIMEOUT': return '⏰';
            case 'ERROR': return '⚠️';
            default: return '❓';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="bg-card-dark rounded-xl border border-[#283039] p-6">
                <p className="text-[#9dabb9]">Loading attendance settings...</p>
            </div>
        );
    }

    return (
        <div className="bg-card-dark rounded-xl border border-[#283039] p-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-green-400">event_available</span>
                    <h3 className="text-white text-lg font-bold">Auto Attendance</h3>
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">BETA</span>
                </div>

                {/* Enable Toggle */}
                <button
                    onClick={() => setIsActive(!isActive)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${isActive ? 'bg-green-500' : 'bg-[#283039]'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isActive ? 'left-7' : 'left-1'}`}></div>
                </button>
            </div>

            {/* Schedule Settings */}
            <div className="flex flex-col gap-4">
                {/* Mode Toggle */}
                <div className="flex items-center gap-2">
                    <span className="text-[#9dabb9] text-sm">Mode:</span>
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${!showAdvanced ? 'bg-primary text-white' : 'bg-[#283039] text-[#9dabb9]'
                            }`}
                    >
                        Simple
                    </button>
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${showAdvanced ? 'bg-primary text-white' : 'bg-[#283039] text-[#9dabb9]'
                            }`}
                    >
                        Advanced (Cron)
                    </button>
                </div>

                {!showAdvanced ? (
                    /* Simple Mode */
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-white text-sm font-medium">Day</label>
                            <select
                                value={dayOfWeek}
                                onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                                className="bg-[#101922] border border-[#3b4754] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
                            >
                                {DAYS_OF_WEEK.map(day => (
                                    <option key={day.value} value={day.value}>{day.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-white text-sm font-medium">Time</label>
                            <input
                                type="time"
                                value={timeOfDay}
                                onChange={(e) => setTimeOfDay(e.target.value)}
                                className="bg-[#101922] border border-[#3b4754] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>
                ) : (
                    /* Advanced Mode */
                    <div className="flex flex-col gap-2">
                        <label className="text-white text-sm font-medium">Cron Expression</label>
                        <input
                            type="text"
                            value={cronExpression}
                            onChange={(e) => setCronExpression(e.target.value)}
                            placeholder="e.g. 0 8 * * 1 (Every Monday at 8 AM)"
                            className="bg-[#101922] border border-[#3b4754] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
                        />
                        <p className="text-xs text-[#5e6a75]">Format: minute hour day-of-month month day-of-week</p>
                    </div>
                )}

                {/* Retry Settings (Collapsible) */}
                <div className="border-t border-[#283039] pt-4">
                    <button
                        onClick={() => setShowRetrySettings(!showRetrySettings)}
                        className="flex items-center gap-2 text-[#9dabb9] hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">
                            {showRetrySettings ? 'expand_less' : 'expand_more'}
                        </span>
                        <span className="text-sm">Retry Settings</span>
                    </button>

                    {showRetrySettings && (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-white text-sm font-medium">Max Retries</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="12"
                                    value={maxRetries}
                                    onChange={(e) => setMaxRetries(parseInt(e.target.value))}
                                    className="bg-[#101922] border border-[#3b4754] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-white text-sm font-medium">Interval (minutes)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={retryIntervalMinutes}
                                    onChange={(e) => setRetryIntervalMinutes(parseInt(e.target.value))}
                                    className="bg-[#101922] border border-[#3b4754] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Telegram Settings */}
                <div className="border-t border-[#283039] pt-4 flex flex-col gap-3">
                    <label className="text-white text-sm font-medium">Telegram Notification</label>
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                checked={!useSeparateTelegram}
                                onChange={() => setUseSeparateTelegram(false)}
                                className="accent-primary"
                            />
                            <span className="text-[#cdd7e1] text-sm">Use same bot as deadline notifications</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                checked={useSeparateTelegram}
                                onChange={() => setUseSeparateTelegram(true)}
                                className="accent-primary"
                            />
                            <span className="text-[#cdd7e1] text-sm">Use separate bot</span>
                        </label>
                    </div>

                    {useSeparateTelegram && (
                        <input
                            type="text"
                            value={customBotToken}
                            onChange={(e) => setCustomBotToken(e.target.value)}
                            placeholder="Bot Token (from @BotFather)"
                            className="bg-[#101922] border border-[#3b4754] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
                        />
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors disabled:opacity-70"
                >
                    {saving ? 'Saving...' : 'Save Schedule'}
                </button>
                <button
                    onClick={handleTest}
                    disabled={testing}
                    className="px-6 py-2.5 bg-[#283039] text-white font-medium rounded-lg hover:bg-[#323b46] border border-[#3b4754] transition-colors disabled:opacity-50"
                >
                    {testing ? 'Running...' : '🧪 Test Now'}
                </button>
            </div>

            {/* Recent Logs */}
            <div className="border-t border-[#283039] pt-4">
                <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="flex items-center gap-2 text-[#9dabb9] hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">
                        {showLogs ? 'expand_less' : 'expand_more'}
                    </span>
                    <span className="text-sm">Recent Logs ({logs.length})</span>
                </button>

                {showLogs && (
                    <div className="mt-3 flex flex-col gap-2">
                        {logs.length === 0 ? (
                            <p className="text-[#5e6a75] text-sm">No logs yet</p>
                        ) : (
                            logs.map((log) => (
                                <div key={log.id} className="flex items-center gap-3 bg-[#101922] p-3 rounded-lg">
                                    <span className="text-lg">{getStatusIcon(log.status)}</span>
                                    <div className="flex-1">
                                        <p className="text-white text-sm">
                                            {log.status} {log.message && `- ${log.message.slice(0, 50)}...`}
                                        </p>
                                        <p className="text-[#5e6a75] text-xs">{formatDate(log.attemptedAt)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Next Run Info */}
            {schedule?.nextRunAt && isActive && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <p className="text-blue-200 text-sm">
                        ⏰ Next scheduled run: <b>{formatDate(schedule.nextRunAt)}</b>
                    </p>
                </div>
            )}
        </div>
    );
};

export default AttendanceScheduleForm;
