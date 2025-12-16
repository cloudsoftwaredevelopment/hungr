import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Updated to match your server configuration
const API_URL = '/api';

const AuthModal = ({ onClose }) => {
    const { login, getRememberedCredentials } = useAuth();
    const [view, setView] = useState('login'); // 'login', 'register', 'otp'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    // Form States
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        mobile: '',
        password: '',
        otp: ''
    });

    // Load remembered credentials on mount
    useEffect(() => {
        const remembered = getRememberedCredentials();
        if (remembered.email) {
            setFormData(prev => ({ ...prev, email: remembered.email }));
            setRememberMe(remembered.rememberMe);
        }
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Use context login with rememberMe flag
        const res = await login(formData.email, formData.password, rememberMe);

        if (res.success) {
            onClose();
        } else {
            setError(res.error || 'Login failed');
        }
        setLoading(false);
    };

    const handleRequestOTP = async (e) => {
        e.preventDefault();
        if (!formData.firstName || !formData.lastName || !formData.email || !formData.mobile || !formData.password) {
            setError("All fields are required");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/send-otp`, { // Fixed endpoint name based on server.js
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile: formData.mobile })
            });
            const data = await res.json();
            if (data.success) {
                setView('otp');
                alert(`Demo OTP: ${data.data?.otp || '123456'}`);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError("Failed to send OTP. Registration might be closed.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                // Auto login after signup
                await login(formData.email, formData.password);
                onClose();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError("Registration failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 relative animate-in zoom-in duration-200 shadow-2xl">

                {/* Back Button for Register/OTP views */}
                {view !== 'login' && (
                    <button
                        onClick={() => setView(view === 'otp' ? 'register' : 'login')}
                        className="absolute left-4 top-4 text-gray-400 hover:text-gray-600"
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}

                <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>

                <h2 className="text-2xl font-black text-gray-800 mb-1 text-center mt-6 tracking-tight">
                    {view === 'login' && 'Welcome Back'}
                    {view === 'register' && 'Create Account'}
                    {view === 'otp' && 'Verify Mobile'}
                </h2>
                <p className="text-sm text-gray-500 text-center mb-6">
                    {view === 'login' && 'Login to your account to continue'}
                    {view === 'register' && 'Sign up to start ordering'}
                    {view === 'otp' && `Enter the code sent to ${formData.mobile}`}
                </p>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 text-center border border-red-100">{error}</div>}

                {/* LOGIN FORM */}
                {view === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:border-orange-500 outline-none transition-colors text-gray-800" required />
                        <input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:border-orange-500 outline-none transition-colors text-gray-800" required />

                        {/* Remember Me Checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                            />
                            <span className="text-sm text-gray-600">Remember me</span>
                        </label>

                        <button type="submit" disabled={loading} className="w-full bg-orange-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-700 transition flex justify-center active:scale-[0.98]">
                            {loading ? <Loader className="animate-spin" size={20} /> : 'Login'}
                        </button>
                        <div className="text-center mt-4">
                            <span className="text-sm text-gray-500">Don't have an account? </span>
                            <button type="button" onClick={() => { setError(''); setView('register'); }} className="text-orange-600 font-bold text-sm hover:underline">
                                Register Now
                            </button>
                        </div>
                    </form>
                )}

                {/* REGISTRATION FORM */}
                {view === 'register' && (
                    <form onSubmit={handleRequestOTP} className="space-y-3">
                        <div className="flex gap-2">
                            <input name="firstName" type="text" placeholder="First Name" value={formData.firstName} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-800" required />
                            <input name="lastName" type="text" placeholder="Last Name" value={formData.lastName} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-800" required />
                        </div>
                        <input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-800" required />
                        <input name="mobile" type="tel" placeholder="Mobile Number (09...)" value={formData.mobile} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-800" required />
                        <input name="password" type="password" placeholder="Create Password" value={formData.password} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-800" required />

                        <button type="submit" disabled={loading} className="w-full bg-orange-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-700 transition flex justify-center mt-2">
                            {loading ? <Loader className="animate-spin" size={20} /> : 'Send OTP'}
                        </button>
                    </form>
                )}

                {/* OTP VERIFICATION FORM */}
                {view === 'otp' && (
                    <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                        <div className="flex justify-center">
                            <input
                                name="otp"
                                type="text"
                                placeholder="123456"
                                maxLength={6}
                                value={formData.otp}
                                onChange={handleChange}
                                className="w-2/3 p-4 text-center text-2xl tracking-widest bg-gray-50 rounded-xl border border-gray-200 focus:border-orange-500 outline-none text-gray-800"
                                required
                            />
                        </div>
                        <button type="submit" disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 transition flex justify-center">
                            {loading ? <Loader className="animate-spin" size={20} /> : 'Verify & Create Account'}
                        </button>
                        <div className="text-center mt-2">
                            <button type="button" onClick={() => alert("Registration Closed (Demo)")} className="text-gray-400 text-xs hover:text-gray-600">
                                Resend Code
                            </button>
                        </div>
                    </form>
                )}

            </div>
        </div>
    );
};

export default AuthModal;
