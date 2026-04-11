import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail, ArrowLeft, ArrowRight, Phone, User, Lock, Loader2,
    BookOpen, CheckCircle, ShieldCheck, MessageSquare, KeyRound,
    Eye, EyeOff, AlertCircle
} from 'lucide-react';
import api from '../services/api';

const STEPS = {
    EMAIL: 'email',
    VERIFY_METHOD: 'verify_method',
    WHATSAPP_VERIFY: 'whatsapp_verify',
    SPADA_VERIFY: 'spada_verify',
    OTP_INPUT: 'otp_input',
    NEW_PASSWORD: 'new_password',
    SUCCESS: 'success',
};

const slideVariants = {
    enter: (direction) => ({ x: direction > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction) => ({ x: direction > 0 ? -80 : 80, opacity: 0 }),
};

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(STEPS.EMAIL);
    const [direction, setDirection] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form data
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [spadaUsername, setSpadaUsername] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Server data
    const [hasWhatsApp, setHasWhatsApp] = useState(false);
    const [maskedPhone, setMaskedPhone] = useState('');
    const [hasSpadaUsername, setHasSpadaUsername] = useState(false);
    const [resetToken, setResetToken] = useState('');

    // OTP timer
    const [otpTimer, setOtpTimer] = useState(0);
    const timerRef = useRef(null);

    // OTP input refs
    const otpRefs = useRef([]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startOtpTimer = () => {
        setOtpTimer(300); // 5 minutes = 300 seconds
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setOtpTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const formatTimer = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const goToStep = (newStep, dir = 1) => {
        setDirection(dir);
        setError('');
        setStep(newStep);
    };

    // Step 1: Check email
    const handleCheckEmail = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data } = await api.post('/auth/forgot-password/check-email', { email });
            setHasWhatsApp(data.hasWhatsApp);
            setMaskedPhone(data.maskedPhone || '');
            setHasSpadaUsername(data.hasSpadaUsername);

            if (data.hasWhatsApp) {
                goToStep(STEPS.VERIFY_METHOD);
            } else if (data.hasSpadaUsername) {
                goToStep(STEPS.SPADA_VERIFY);
            } else {
                setError('Account has no verification method available. Please contact admin.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    // Step 2a: Send OTP via WhatsApp
    const handleVerifyWhatsApp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/auth/forgot-password/verify-whatsapp', { email, phoneNumber });
            startOtpTimer();
            setOtp(['', '', '', '', '', '']);
            goToStep(STEPS.OTP_INPUT);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    // Step 2b: Verify SPADA username
    const handleVerifySpada = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data } = await api.post('/auth/forgot-password/verify-spada', { email, spadaUsername });
            setResetToken(data.resetToken);
            goToStep(STEPS.NEW_PASSWORD);
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Verify OTP
    const handleVerifyOtp = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            setError('Please enter the complete 6-digit OTP');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const { data } = await api.post('/auth/forgot-password/verify-otp', { email, otp: otpString });
            setResetToken(data.resetToken);
            goToStep(STEPS.NEW_PASSWORD);
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    // Step 4: Reset password
    const handleResetPassword = async (e) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }

        setError('');
        setLoading(true);

        try {
            await api.post('/auth/forgot-password/reset', { resetToken, newPassword });
            goToStep(STEPS.SUCCESS);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    // OTP input handler
    const handleOtpChange = (index, value) => {
        if (value.length > 1) value = value.slice(-1);
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
        if (e.key === 'Enter' && otp.join('').length === 6) {
            handleVerifyOtp();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            const newOtp = pasted.split('');
            setOtp(newOtp);
            otpRefs.current[5]?.focus();
        }
    };

    const renderStepIndicator = () => {
        const steps = hasWhatsApp
            ? ['Email', 'Verify', 'OTP', 'Reset']
            : ['Email', 'Verify', 'Reset'];

        const stepMap = {
            [STEPS.EMAIL]: 0,
            [STEPS.VERIFY_METHOD]: 1,
            [STEPS.WHATSAPP_VERIFY]: 1,
            [STEPS.SPADA_VERIFY]: 1,
            [STEPS.OTP_INPUT]: 2,
            [STEPS.NEW_PASSWORD]: hasWhatsApp ? 3 : 2,
            [STEPS.SUCCESS]: hasWhatsApp ? 4 : 3,
        };

        const currentIdx = stepMap[step] || 0;

        return (
            <div className="flex items-center justify-center gap-2 mb-6">
                {steps.map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                            i < currentIdx
                                ? 'bg-green-500 text-white'
                                : i === currentIdx
                                    ? 'bg-blue-600 text-white ring-4 ring-blue-600/20'
                                    : 'bg-zinc-700 text-zinc-400'
                        }`}>
                            {i < currentIdx ? '✓' : i + 1}
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`w-8 h-0.5 transition-all duration-300 ${
                                i < currentIdx ? 'bg-green-500' : 'bg-zinc-700'
                            }`} />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderStep = () => {
        switch (step) {
            case STEPS.EMAIL:
                return (
                    <form onSubmit={handleCheckEmail} className="space-y-5">
                        <div className="text-center mb-2">
                            <div className="mx-auto h-14 w-14 bg-blue-600/20 rounded-full flex items-center justify-center mb-4">
                                <KeyRound className="h-7 w-7 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Forgot Password</h3>
                            <p className="text-sm text-zinc-400 mt-1">Enter your email to get started</p>
                        </div>

                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="appearance-none rounded-lg block w-full px-10 py-3 border border-zinc-600 placeholder-zinc-500 text-white bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                placeholder="Enter your email"
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                        </button>
                    </form>
                );

            case STEPS.VERIFY_METHOD:
                return (
                    <div className="space-y-5">
                        <div className="text-center mb-2">
                            <div className="mx-auto h-14 w-14 bg-green-600/20 rounded-full flex items-center justify-center mb-4">
                                <ShieldCheck className="h-7 w-7 text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Choose Verification</h3>
                            <p className="text-sm text-zinc-400 mt-1">How would you like to verify your identity?</p>
                        </div>

                        <button
                            onClick={() => goToStep(STEPS.WHATSAPP_VERIFY)}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-600 bg-zinc-700/50 hover:bg-zinc-700 hover:border-green-500/50 transition-all group"
                        >
                            <div className="h-12 w-12 rounded-full bg-green-600/20 flex items-center justify-center group-hover:bg-green-600/30 transition-all">
                                <MessageSquare className="h-6 w-6 text-green-400" />
                            </div>
                            <div className="text-left flex-1">
                                <p className="font-semibold text-white">WhatsApp OTP</p>
                                <p className="text-xs text-zinc-400">Send verification code to {maskedPhone}</p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-zinc-500 group-hover:text-green-400 transition-colors" />
                        </button>

                        {hasSpadaUsername && (
                            <button
                                onClick={() => goToStep(STEPS.SPADA_VERIFY)}
                                className="w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-600 bg-zinc-700/50 hover:bg-zinc-700 hover:border-blue-500/50 transition-all group"
                            >
                                <div className="h-12 w-12 rounded-full bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600/30 transition-all">
                                    <User className="h-6 w-6 text-blue-400" />
                                </div>
                                <div className="text-left flex-1">
                                    <p className="font-semibold text-white">SPADA Username</p>
                                    <p className="text-xs text-zinc-400">Verify using your SPADA credentials</p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                            </button>
                        )}
                    </div>
                );

            case STEPS.WHATSAPP_VERIFY:
                return (
                    <form onSubmit={handleVerifyWhatsApp} className="space-y-5">
                        <div className="text-center mb-2">
                            <div className="mx-auto h-14 w-14 bg-green-600/20 rounded-full flex items-center justify-center mb-4">
                                <Phone className="h-7 w-7 text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Verify WhatsApp</h3>
                            <p className="text-sm text-zinc-400 mt-1">
                                Enter the WhatsApp number linked to your account
                            </p>
                        </div>

                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                            <input
                                type="tel"
                                required
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="appearance-none rounded-lg block w-full px-10 py-3 border border-zinc-600 placeholder-zinc-500 text-white bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                                placeholder="e.g. 08123456789"
                                autoFocus
                            />
                        </div>

                        <p className="text-xs text-zinc-500 text-center">
                            Hint: Your registered number is <span className="text-zinc-300 font-mono">{maskedPhone}</span>
                        </p>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <>Send OTP <ArrowRight className="h-4 w-4" /></>}
                        </button>
                    </form>
                );

            case STEPS.SPADA_VERIFY:
                return (
                    <form onSubmit={handleVerifySpada} className="space-y-5">
                        <div className="text-center mb-2">
                            <div className="mx-auto h-14 w-14 bg-blue-600/20 rounded-full flex items-center justify-center mb-4">
                                <User className="h-7 w-7 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Verify Identity</h3>
                            <p className="text-sm text-zinc-400 mt-1">Enter your SPADA username to verify</p>
                        </div>

                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                            <input
                                type="text"
                                required
                                value={spadaUsername}
                                onChange={(e) => setSpadaUsername(e.target.value)}
                                className="appearance-none rounded-lg block w-full px-10 py-3 border border-zinc-600 placeholder-zinc-500 text-white bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                placeholder="SPADA Username"
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <>Verify <ArrowRight className="h-4 w-4" /></>}
                        </button>
                    </form>
                );

            case STEPS.OTP_INPUT:
                return (
                    <div className="space-y-5">
                        <div className="text-center mb-2">
                            <div className="mx-auto h-14 w-14 bg-amber-600/20 rounded-full flex items-center justify-center mb-4">
                                <ShieldCheck className="h-7 w-7 text-amber-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Enter OTP</h3>
                            <p className="text-sm text-zinc-400 mt-1">
                                We sent a 6-digit code to your WhatsApp
                            </p>
                        </div>

                        {/* OTP Inputs */}
                        <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                            {otp.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={(el) => (otpRefs.current[i] = el)}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleOtpChange(i, e.target.value)}
                                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                    className={`w-12 h-14 text-center text-xl font-bold rounded-lg border bg-zinc-700 text-white focus:outline-none focus:ring-2 transition-all ${
                                        digit
                                            ? 'border-blue-500 focus:ring-blue-500'
                                            : 'border-zinc-600 focus:ring-blue-500'
                                    }`}
                                    autoFocus={i === 0}
                                />
                            ))}
                        </div>

                        {/* Timer */}
                        <div className="text-center">
                            {otpTimer > 0 ? (
                                <p className="text-sm text-zinc-400">
                                    Code expires in <span className="text-amber-400 font-mono font-bold">{formatTimer(otpTimer)}</span>
                                </p>
                            ) : (
                                <p className="text-sm text-red-400">OTP expired. Please go back and request a new one.</p>
                            )}
                        </div>

                        <button
                            onClick={handleVerifyOtp}
                            disabled={loading || otp.join('').length !== 6 || otpTimer === 0}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <>Verify OTP <ArrowRight className="h-4 w-4" /></>}
                        </button>
                    </div>
                );

            case STEPS.NEW_PASSWORD:
                return (
                    <form onSubmit={handleResetPassword} className="space-y-5">
                        <div className="text-center mb-2">
                            <div className="mx-auto h-14 w-14 bg-purple-600/20 rounded-full flex items-center justify-center mb-4">
                                <Lock className="h-7 w-7 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Set New Password</h3>
                            <p className="text-sm text-zinc-400 mt-1">Choose a strong password for your account</p>
                        </div>

                        <div className="space-y-3">
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="appearance-none rounded-lg block w-full px-10 py-3 pr-12 border border-zinc-600 placeholder-zinc-500 text-white bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                    placeholder="New Password"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="appearance-none rounded-lg block w-full px-10 py-3 pr-12 border border-zinc-600 placeholder-zinc-500 text-white bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                    placeholder="Confirm New Password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                                >
                                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {newPassword && confirmPassword && newPassword !== confirmPassword && (
                            <p className="text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Passwords do not match
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !newPassword || !confirmPassword}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <>Reset Password <CheckCircle className="h-4 w-4" /></>}
                        </button>
                    </form>
                );

            case STEPS.SUCCESS:
                return (
                    <div className="space-y-6 text-center">
                        <div className="mx-auto h-16 w-16 bg-green-600/20 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-8 w-8 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Password Reset!</h3>
                            <p className="text-sm text-zinc-400 mt-2">
                                Your password has been changed successfully. You can now sign in with your new password.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full py-3 px-4 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                        >
                            Go to Login
                        </button>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-900 px-4">
            <div className="max-w-md w-full bg-zinc-800 p-8 rounded-xl shadow-lg border border-zinc-700">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="mx-auto h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center mb-3">
                        <BookOpen className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-sm font-medium text-zinc-400">SPADA Manager</p>
                </div>

                {/* Step Indicator */}
                {step !== STEPS.SUCCESS && renderStepIndicator()}

                {/* Error message */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-900/20 text-red-400 p-3 rounded-lg text-sm text-center border border-red-800 mb-4 flex items-center justify-center gap-2"
                    >
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        {error}
                    </motion.div>
                )}

                {/* Step Content with Animation */}
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                    >
                        {renderStep()}
                    </motion.div>
                </AnimatePresence>

                {/* Back / Login links */}
                {step !== STEPS.SUCCESS && (
                    <div className="mt-6 flex items-center justify-between text-sm">
                        {step !== STEPS.EMAIL ? (
                            <button
                                onClick={() => {
                                    if (step === STEPS.VERIFY_METHOD) goToStep(STEPS.EMAIL, -1);
                                    else if (step === STEPS.WHATSAPP_VERIFY || step === STEPS.SPADA_VERIFY) {
                                        if (hasWhatsApp) goToStep(STEPS.VERIFY_METHOD, -1);
                                        else goToStep(STEPS.EMAIL, -1);
                                    }
                                    else if (step === STEPS.OTP_INPUT) goToStep(STEPS.WHATSAPP_VERIFY, -1);
                                    else if (step === STEPS.NEW_PASSWORD) goToStep(STEPS.EMAIL, -1);
                                }}
                                className="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" /> Back
                            </button>
                        ) : (
                            <div />
                        )}
                        <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
                            Back to Login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
