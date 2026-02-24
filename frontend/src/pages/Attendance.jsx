import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';
import AttendanceScheduleForm from '../components/AttendanceScheduleForm';

const Attendance = () => {
    const { token } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedCourse, setExpandedCourse] = useState(null);

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            const response = await api.get('/courses');
            const data = response.data.data || [];
            setCourses(data);
        } catch (err) {
            console.error('Failed to fetch courses:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="flex flex-col min-h-full bg-background-light dark:bg-background-dark p-4 md:p-6">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="material-symbols-outlined text-primary text-3xl">fingerprint</span>
                        <h1 className="text-2xl font-bold text-white">Auto Attendance</h1>
                    </div>
                </div>

                {/* Feature Description Card */}
                <div className="bg-gradient-to-r from-primary/10 to-upn-yellow/10 border border-primary/30 rounded-xl p-5 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">info</span>
                        Apa itu Auto Attendance?
                    </h2>
                    <div className="text-[#9dabb9] text-sm space-y-3">
                        <p>
                            <strong className="text-white">Auto Attendance</strong> adalah fitur otomatis untuk mengisi presensi/kehadiran
                            di SPADA UPN. Fitur ini akan menjalankan browser secara otomatis pada waktu yang kamu tentukan.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-upn-green text-xl">schedule</span>
                                <div>
                                    <p className="text-white font-medium">Penjadwalan Fleksibel</p>
                                    <p className="text-xs">Pilih hari dan jam untuk setiap mata kuliah</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-upn-yellow text-xl">notifications_active</span>
                                <div>
                                    <p className="text-white font-medium">Notifikasi Telegram</p>
                                    <p className="text-xs">Dapat laporan hasil absensi + screenshot</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-primary text-xl">play_circle</span>
                                <div>
                                    <p className="text-white font-medium">Test Manual</p>
                                    <p className="text-xs">Coba jalankan absensi kapan saja untuk testing</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-red-400 text-xl">history</span>
                                <div>
                                    <p className="text-white font-medium">Log Riwayat</p>
                                    <p className="text-xs">Lihat semua hasil percobaan absensi</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Important Note */}
                <div className="bg-[#1c252e]/60 rounded-xl p-4 mb-6 border border-[#283039] flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">info</span>
                    <p className="text-[#9dabb9] text-xs leading-relaxed">
                        <span className="text-white font-medium">Catatan Penting</span> — Pastikan kredensial SPADA kamu sudah tersimpan di <a href="/settings" className="text-primary hover:underline">Settings</a>. Absensi hanya berhasil jika halaman presensi sudah dibuka oleh dosen.
                    </p>
                </div>

                {/* Courses List */}
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">list</span>
                    Konfigurasi Per Mata Kuliah
                </h2>

                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : courses.length === 0 ? (
                    <div className="bg-gradient-to-r from-[#1c252e] to-[#161b22] rounded-xl p-6 md:p-8 border border-[#283039] relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="relative z-10 flex flex-col gap-5 max-w-2xl mx-auto">
                            <div className="flex flex-col items-center text-center gap-2">
                                <span className="material-symbols-outlined text-primary text-5xl">school</span>
                                <h3 className="text-white text-lg font-bold">Belum ada mata kuliah</h3>
                                <p className="text-[#9dabb9] text-sm">Untuk menggunakan Auto Attendance, kamu perlu sync dulu mata kuliah dari SPADA.</p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#283039]/50 border border-[#283039]">
                                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary shrink-0 text-xs font-bold">1</div>
                                    <div>
                                        <span className="text-white font-semibold text-sm">Buka halaman Courses</span>
                                        <p className="text-[#9dabb9] text-xs mt-0.5">Klik menu <strong className="text-white">Courses</strong> di sidebar.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#283039]/50 border border-[#283039]">
                                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary shrink-0 text-xs font-bold">2</div>
                                    <div>
                                        <span className="text-white font-semibold text-sm">Klik "Sync All Courses"</span>
                                        <p className="text-[#9dabb9] text-xs mt-0.5">Sistem akan mengambil semua mata kuliah dari SPADA secara otomatis.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#283039]/50 border border-[#283039]">
                                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary shrink-0 text-xs font-bold">3</div>
                                    <div>
                                        <span className="text-white font-semibold text-sm">Kembali ke sini</span>
                                        <p className="text-[#9dabb9] text-xs mt-0.5">Setelah sync selesai, kembali ke halaman ini untuk mengatur jadwal absensi otomatis.</p>
                                    </div>
                                </div>
                            </div>
                            <a href="/courses" className="w-full py-3 bg-primary hover:bg-blue-600 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                Buka Halaman Courses
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {courses.map((course) => (
                            <div key={course.id} className="bg-card-dark border border-[#3b4754] rounded-xl overflow-hidden">
                                {/* Course Header */}
                                <button
                                    onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-[#283039] transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-primary">school</span>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-white font-medium text-sm">{course.name}</p>
                                            <p className="text-[#6e7b8b] text-xs">ID: {course.sourceId}</p>
                                        </div>
                                    </div>
                                    <span className={`material-symbols-outlined text-[#9dabb9] transition-transform ${expandedCourse === course.id ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                </button>

                                {/* Expanded Content */}
                                {expandedCourse === course.id && (
                                    <div className="border-t border-[#3b4754] p-4 bg-[#0d1117]">
                                        <AttendanceScheduleForm courseId={course.id} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Attendance;
