import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User, Key, Loader2, GraduationCap, Eye, EyeOff } from 'lucide-react';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        spadaUsername: '',
        spadaPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showSpadaPassword, setShowSpadaPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await register(
            formData.name,
            formData.email,
            formData.password,
            formData.spadaUsername,
            formData.spadaPassword
        );

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 px-4 py-12">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-700">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 bg-green-600 rounded-full flex items-center justify-center">
                        <GraduationCap className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
                        Create Account
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Start managing your SPADA assignments today
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm transition-all text-center border border-red-200 dark:border-red-800">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Account Details</h3>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                name="name"
                                type="text"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                className="appearance-none rounded-lg block w-full px-10 py-3 border border-gray-300 dark:border-zinc-600 placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                placeholder="Full Name"
                            />
                        </div>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                name="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                className="appearance-none rounded-lg block w-full px-10 py-3 border border-gray-300 dark:border-zinc-600 placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                placeholder="Email address"
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                required
                                value={formData.password}
                                onChange={handleChange}
                                className="appearance-none rounded-lg block w-full px-10 py-3 pr-12 border border-gray-300 dark:border-zinc-600 placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                placeholder="Password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>

                        <div className="pt-4">
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">SPADA Credentials (Optional)</h3>
                            <p className="text-xs text-gray-400 mb-3">Needed for auto-scraping. You can add this later.</p>
                            <div className="space-y-4">
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        name="spadaUsername"
                                        type="text"
                                        value={formData.spadaUsername}
                                        onChange={handleChange}
                                        className="appearance-none rounded-lg block w-full px-10 py-3 border border-gray-300 dark:border-zinc-600 placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                        placeholder="SPADA Username / NIM"
                                    />
                                </div>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        name="spadaPassword"
                                        type={showSpadaPassword ? "text" : "password"}
                                        value={formData.spadaPassword}
                                        onChange={handleChange}
                                        className="appearance-none rounded-lg block w-full px-10 py-3 pr-12 border border-gray-300 dark:border-zinc-600 placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                        placeholder="SPADA Password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSpadaPassword(!showSpadaPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                                    >
                                        {showSpadaPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-all"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </div>

                    <div className="text-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                            Already have an account?{' '}
                        </span>
                        <Link to="/login" className="font-medium text-green-600 hover:text-green-500">
                            Sign in
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Register;
