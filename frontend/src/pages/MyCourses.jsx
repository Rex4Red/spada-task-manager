import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const MyCourses = () => {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newCourseUrl, setNewCourseUrl] = useState('');
    const [syncingNew, setSyncingNew] = useState(false);
    const [syncingId, setSyncingId] = useState(null);
    const [stats, setStats] = useState({ totalCourses: 0, pendingTasks: 0 });
    const [spadaUsername, setSpadaUsername] = useState(''); // Need to get this from user/db?
    const [spadaPassword, setSpadaPassword] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    // Fetch courses
    const fetchCourses = async () => {
        try {
            const response = await api.get('/courses');
            const data = response.data.data;
            console.log('Fetched courses:', data);
            setCourses(data);

            // Calc stats
            const total = data.length;
            const pending = data.flatMap(c => c.tasks).filter(t => t.status !== 'COMPLETED').length;
            setStats({ totalCourses: total, pendingTasks: pending });
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // We temporarily hardcode credentials or simple prompt because we haven't built a full Settings page for creds yet
        // Ideally, we should pull these from encrypted storage in DB
        // For this demo, let's ask user to re-enter if not stored in session (which acts as temp storage)
        fetchCourses();
    }, []);

    const handleAddCourse = async (e) => {
        e.preventDefault();
        if (!newCourseUrl) return;

        setSyncingNew(true);
        try {
            // Try adding course without explicit credentials (backend will use stored ones)
            await api.post('/scraper/course', {
                courseUrl: newCourseUrl
            });
            setNewCourseUrl('');
            await fetchCourses(); // Refresh
            alert('Course Added Successfully!');
        } catch (error) {
            console.error('Sync failed:', error);
            if (error.response && error.response.data && error.response.data.code === 'CREDENTIALS_REQUIRED') {
                if (window.confirm('SPADA credentials are missing. Please save them in Settings to enable this feature. Go to Settings now?')) {
                    window.location.href = '/settings';
                }
            } else {
                alert(error.response?.data?.message || 'Failed to add course.');
            }
        } finally {
            setSyncingNew(false);
        }
    };

    const handleSyncCourse = async (courseId) => {
        const course = courses.find(c => c.id === courseId);
        if (!course) return;

        setSyncingId(courseId);
        try {
            await api.post('/scraper/course', {
                courseUrl: course.url
            });
            await fetchCourses();
        } catch (error) {
            console.error(error);
            if (error.response && error.response.data && error.response.data.code === 'CREDENTIALS_REQUIRED') {
                if (window.confirm('SPADA credentials are missing. Please save them in Settings to enable re-sync. Go to Settings now?')) {
                    window.location.href = '/settings';
                }
            } else {
                alert('Re-sync failed');
            }
        } finally {
            setSyncingId(null);
        }
    };

    const handleDeleteCourse = async (courseId) => {
        if (!window.confirm('Are you sure you want to delete this course? All associated tasks will be hidden.')) return;
        try {
            await api.delete(`/courses/${courseId}`);
            setCourses(prev => prev.filter(c => c.id !== courseId));
            alert('Course deleted successfully');
        } catch (error) {
            console.error('Failed to delete course:', error);
            alert('Failed to delete course');
        }
    };

    return (
        <Layout>
            <div className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-8 py-6 flex flex-col gap-8">
                {/* Breadcrumbs & Header */}
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-[#9dabb9] font-medium">Home</span>
                        <span className="text-[#9dabb9] material-symbols-outlined text-[16px]">chevron_right</span>
                        <span className="text-white font-medium">My Courses</span>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
                        <div className="flex flex-col gap-2 max-w-2xl">
                            <h1 className="text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em]">Manage Your Courses</h1>
                            <p className="text-[#9dabb9] text-base font-normal leading-normal">Add, monitor, and sync your SPADA UPN subjects to keep your tasks up to date.</p>
                        </div>
                        <div className="flex gap-4 shrink-0 w-full lg:w-auto">
                            <div className="flex flex-col gap-1 rounded-lg px-5 py-3 bg-card-dark border border-[#283039] flex-1 lg:flex-none lg:min-w-[140px]">
                                <span className="text-[#9dabb9] text-xs font-medium uppercase tracking-wider">Total Courses</span>
                                <span className="text-white text-2xl font-bold">{stats.totalCourses}</span>
                            </div>
                            <div className="flex flex-col gap-1 rounded-lg px-5 py-3 bg-card-dark border border-[#283039] flex-1 lg:flex-none lg:min-w-[140px]">
                                <span className="text-[#9dabb9] text-xs font-medium uppercase tracking-wider">Pending Tasks</span>
                                <span className="text-white text-2xl font-bold">{stats.pendingTasks}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Add New Course Hero */}
                <div className="w-full bg-gradient-to-r from-[#1c252e] to-[#161b22] rounded-xl p-6 md:p-10 border border-[#283039] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-white text-xl md:text-2xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">add_circle</span>
                                Add New Course
                            </h2>
                            <p className="text-[#9dabb9] text-sm md:text-base">Paste your SPADA UPN Yogyakarta course URL to automatically fetch syllabus and assignments.</p>
                        </div>
                        <form onSubmit={handleAddCourse} className="flex flex-col w-full gap-3">
                            <div className="flex w-full items-center rounded-xl bg-[#283039] border border-transparent focus-within:border-primary/50 transition-colors h-14 px-4 gap-3">
                                <span className="material-symbols-outlined text-[#9dabb9]">link</span>
                                <input
                                    className="bg-transparent w-full text-white placeholder:text-[#5e6a75] text-sm focus:outline-none h-full"
                                    placeholder="https://spada.upnyk.ac.id/course/view.php?id=..."
                                    value={newCourseUrl}
                                    onChange={(e) => setNewCourseUrl(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={syncingNew}
                                className={`h-14 w-full px-6 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${syncingNew ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                <span className={`material-symbols-outlined text-[20px] ${syncingNew ? 'animate-spin' : ''}`}>{syncingNew ? 'sync' : 'add'}</span>
                                <span>{syncingNew ? 'Adding...' : 'Add Course'}</span>
                            </button>
                        </form>
                        <button
                            onClick={() => setShowHelp(true)}
                            className="text-[#9dabb9] text-xs font-medium hover:text-white flex items-center gap-1 w-fit"
                        >
                            <span className="material-symbols-outlined text-[16px]">help</span>
                            Not sure where to find the URL?
                        </button>
                    </div>
                </div>

                {/* Course Grid */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-white text-lg font-bold">Active Courses ({courses.length})</h3>
                    </div>

                    {loading ? (
                        <div className="text-center py-20 text-gray-500">Loading courses...</div>
                    ) : courses.length === 0 ? (
                        <div className="text-center py-20 bg-card-dark rounded-xl border border-[#283039]">
                            <p className="text-gray-400">No courses added yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-10">
                            {courses.map(course => {
                                const activeTasks = course.tasks.filter(t => t.status !== 'COMPLETED').length;
                                return (
                                    <div key={course.id} className="flex flex-col bg-card-dark rounded-xl border border-[#283039] overflow-hidden hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-black/20 group">
                                        <div className="h-24 bg-[#283039] relative overflow-hidden">
                                            {/* Random gradient based on ID */}
                                            <div className={`absolute inset-0 bg-gradient-to-br ${course.id % 4 === 0 ? 'from-blue-900/40' :
                                                course.id % 4 === 1 ? 'from-purple-900/40' :
                                                    course.id % 4 === 2 ? 'from-green-900/40' : 'from-red-900/40'
                                                } to-transparent`}></div>

                                            <div className="absolute bottom-3 left-4">
                                                <span className="bg-[#101922]/80 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded border border-white/10">
                                                    ID: {course.sourceId}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-5 flex flex-col gap-4 flex-1">
                                            <div className="flex flex-col gap-1">
                                                <h4 className="text-white text-lg font-bold leading-tight line-clamp-1" title={course.name}>{course.name}</h4>
                                                <a href={course.url} target="_blank" rel="noreferrer" className="text-[#9dabb9] text-xs hover:text-primary truncate">{course.url}</a>
                                            </div>

                                            <div className="flex items-center gap-3 py-2">
                                                <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${activeTasks > 0 ? 'bg-primary/20 text-primary' : 'bg-green-500/20 text-green-500'
                                                    }`}>
                                                    <span className="material-symbols-outlined fill">{activeTasks > 0 ? 'assignment' : 'check_circle'}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold text-lg">{activeTasks}</span>
                                                    <span className="text-[#9dabb9] text-xs">Active Tasks</span>
                                                </div>
                                            </div>

                                            <div className="mt-auto pt-4 border-t border-[#283039] flex items-center justify-between gap-3">
                                                <span className="text-[#5e6a75] text-xs flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                                    {course.lastSynced ? formatDistanceToNow(new Date(course.lastSynced), { addSuffix: true }) : 'Never synced'}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleDeleteCourse(course.id)}
                                                        className="text-[#9dabb9] hover:text-red-500 transition-colors flex items-center justify-center p-1.5 rounded-lg hover:bg-red-500/10"
                                                        title="Delete Course"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleSyncCourse(course.id)}
                                                        disabled={syncingId === course.id}
                                                        className="text-sm font-medium text-white bg-[#283039] hover:bg-[#323b46] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                                                    >
                                                        <span className={`material-symbols-outlined text-[16px] ${syncingId === course.id ? 'animate-spin' : ''}`}>sync</span>
                                                        <span>{syncingId === course.id ? 'Syncing...' : 'Sync'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Help Modal */}
            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1c252e] border border-[#3b4754] rounded-xl w-full max-w-lg p-6 flex flex-col gap-6 shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between shrink-0">
                            <h3 className="text-white text-xl font-bold">How to Find Course URL</h3>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="text-[#9dabb9] hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex flex-col gap-6 overflow-y-auto pr-2 pb-4">
                            {/* Step 1 */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">1</span>
                                    <h4 className="text-white font-bold text-sm">Login to SPADA</h4>
                                </div>
                                <p className="text-[#9dabb9] text-sm pl-8">Go to <a href="https://spada.upnyk.ac.id" target="_blank" rel="noreferrer" className="text-primary hover:underline">spada.upnyk.ac.id</a> and log in with your account.</p>
                            </div>

                            {/* Step 2 */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">2</span>
                                    <h4 className="text-white font-bold text-sm">Open Your Course</h4>
                                </div>
                                <p className="text-[#9dabb9] text-sm pl-8">Navigate to the specific subject/course you want to add.</p>
                            </div>

                            {/* Step 3 */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">3</span>
                                    <h4 className="text-white font-bold text-sm">Copy the URL</h4>
                                </div>
                                <p className="text-[#9dabb9] text-sm pl-8">Copy the link from the address bar at the top of your browser.</p>
                                <div className="pl-8 mt-2">
                                    <img src="/spada_url_guide.png" alt="Example of copying URL" className="rounded-lg border border-[#3b4754] w-full" />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowHelp(false)}
                            className="w-full py-2.5 bg-[#283039] hover:bg-[#323b46] text-white font-medium rounded-lg transition-colors shrink-0"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default MyCourses;
