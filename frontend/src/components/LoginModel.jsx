import React from 'react'
import { FiX, FiMail, FiLock, FiUser, FiArrowRight, FiCheckCircle } from "react-icons/fi";
import { motion } from "motion/react"
import { FcGoogle } from "react-icons/fc";
import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '../utils/firebase';
import api from '../utils/axios';

function LoginModel({ onClose, setUser }) {
    const [mode, setMode] = React.useState('login');
    const [loading, setLoading] = React.useState(false);
    const [otpSent, setOtpSent] = React.useState(false);
    const [otpLoading, setOtpLoading] = React.useState(false);
    const [otpVerified, setOtpVerified] = React.useState(false);
    const [otpVerifying, setOtpVerifying] = React.useState(false);
    const [forgotPassword, setForgotPassword] = React.useState(false);
    const [resetCodeSent, setResetCodeSent] = React.useState(false);
    const [resetLoading, setResetLoading] = React.useState(false);
    const [resetPasswordLoading, setResetPasswordLoading] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const [successMessage, setSuccessMessage] = React.useState('');
    const [form, setForm] = React.useState({
        name: '',
        email: '',
        password: '',
        otp: '',
    });

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetMessages = () => {
        setErrorMessage('');
        setSuccessMessage('');
    };

    const resetOtpFlow = () => {
        setOtpSent(false);
        setOtpVerified(false);
        setForm((prev) => ({ ...prev, otp: '' }));
    };

    const resetForgotPasswordFlow = () => {
        setForgotPassword(false);
        setResetCodeSent(false);
        setForm((prev) => ({ ...prev, otp: '', password: '' }));
    };

    const handleGoogleAuth = async () => {
        try {
            setLoading(true);
            resetMessages();
            const result = await signInWithPopup(auth, provider);
            const token = await result.user.getIdToken();
            const response = await api.post('/api/auth/login', { token });
            setUser(response?.data?.user);
            onClose();
        } catch (error) {
            console.error('Firebase/Login error:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                setErrorMessage('Sign-in popup was closed.');
            } else {
                setErrorMessage(error?.response?.data?.message || error.message || 'Failed to sign in');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async () => {
        if (!form.email.trim()) {
            setErrorMessage('Please enter your email address first.');
            return;
        }

        try {
            setOtpLoading(true);
            resetMessages();
            setOtpVerified(false);
            setForm((prev) => ({ ...prev, otp: '' }));
            await api.post('/api/auth/send-otp', {
                email: form.email,
                mode,
            });
            setOtpSent(true);
            setSuccessMessage('OTP sent successfully. Check your inbox.');
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || 'Failed to send OTP.');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!form.email || !form.otp) {
            setErrorMessage('Please enter the OTP received in your email.');
            return;
        }

        try {
            setOtpVerifying(true);
            resetMessages();
            await api.post('/api/auth/verify-otp', {
                email: form.email,
                otp: form.otp,
            });
            setOtpVerified(true);
            setSuccessMessage('Email verified successfully. You can now create your account.');
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || 'Failed to verify OTP.');
            setOtpVerified(false);
        } finally {
            setOtpVerifying(false);
        }
    };

    const handleEmailLogin = async (e) => {
        e.preventDefault();

        if (!form.email || !form.password) {
            setErrorMessage('Email and password are required.');
            return;
        }

        try {
            setLoading(true);
            resetMessages();
            const response = await api.post('/api/auth/login-email', {
                email: form.email,
                password: form.password,
            });
            setUser(response?.data?.user);
            onClose();
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || 'Unable to login.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();

        if (!form.name || !form.email || !form.password) {
            setErrorMessage('Name, email and password are required.');
            return;
        }

        if (!passwordMeetsRequirements(form.password)) {
            setErrorMessage('Password must include letters, uppercase, lowercase, a symbol, and be at least 8 characters long.');
            return;
        }

        if (!otpVerified) {
            setErrorMessage('Please verify your email with the OTP before creating an account.');
            return;
        }

        try {
            setLoading(true);
            resetMessages();
            const response = await api.post('/api/auth/signup', {
                name: form.name,
                email: form.email,
                password: form.password,
                otp: form.otp,
            });
            setUser(response?.data?.user);
            onClose();
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || 'Unable to create account.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!form.email.trim()) {
            setErrorMessage('Please enter your email address.');
            return;
        }

        try {
            setResetLoading(true);
            resetMessages();
            await api.post('/api/auth/forgot-password', {
                email: form.email,
            });
            setResetCodeSent(true);
            setSuccessMessage('Reset code sent to your email.')
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || 'Failed to send reset code.');
        } finally {
            setResetLoading(false);
        }
    };

    const handleSendForgotPasswordCode = async () => {
        if (!form.email.trim()) {
            setErrorMessage('Please enter your email address first.');
            return;
        }

        try {
            setResetLoading(true);
            resetMessages();
            await api.post('/api/auth/forgot-password', { email: form.email });
            setResetCodeSent(true);
            setSuccessMessage('Password reset code sent successfully. Check your inbox.');
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || 'Failed to send reset code.');
        } finally {
            setResetLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();

        if (!form.email || !form.otp || !form.password) {
            setErrorMessage('Email, reset code and new password are required.');
            return;
        }

        if (form.password.length < 6) {
            setErrorMessage('Password must be at least 6 characters long.');
            return;
        }

        try {
            setResetPasswordLoading(true);
            resetMessages();
            await api.post('/api/auth/reset-password', {
                email: form.email,
                otp: form.otp,
                password: form.password,
            });
            setSuccessMessage('Password reset successful. You can now log in.');
            setForgotPassword(false);
            setResetCodeSent(false);
            setForm((prev) => ({ ...prev, otp: '', password: '' }));
            setMode('login');
        } catch (error) {
            setErrorMessage(error?.response?.data?.message || 'Failed to reset password.');
        } finally {
            setResetPasswordLoading(false);
        }
    };

    const getPasswordChecks = (password) => [
        { label: 'Contains letters', passed: /[A-Za-z]/.test(password) },
        { label: 'Contains uppercase', passed: /[A-Z]/.test(password) },
        { label: 'Contains lowercase', passed: /[a-z]/.test(password) },
        { label: 'Contains symbol', passed: /[^A-Za-z0-9]/.test(password) },
        { label: 'Minimum 8 characters', passed: password.length >= 8 },
    ];

    const passwordMeetsRequirements = (password) =>
        /[A-Za-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[^A-Za-z0-9]/.test(password) &&
        password.length >= 8;

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4'>
            <div className='relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#0A0A0A]/85 border border-white/10 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]'>
                <div className='absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_45%)] pointer-events-none' />

                <div className='relative p-6 md:p-7'>
                    <button
                        onClick={onClose}
                        className='absolute top-4 right-4 text-white/40 hover:text-white transition-colors'
                    >
                        <FiX size={18} />
                    </button>

                    <div className='text-center'>
                        <div className='inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-4'>
                            <FiCheckCircle size={20} className='text-white' />
                        </div>
                        <h2 className='text-2xl font-extrabold text-white tracking-tight'>
                            {mode === 'login' ? 'Welcome back' : 'Create account'}
                        </h2>
                        <p className='text-white/45 text-xs mt-2'>
                            {mode === 'login'
                                ? 'Sign in to continue your AI interview journey.'
                                : 'Register with email and verify your account securely.'}
                        </p>
                    </div>

                    <div className='mt-6 grid grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-1'>
                        <button
                            type='button'
                            onClick={() => {
                                setMode('login');
                                setForgotPassword(false);
                                resetMessages();
                                resetOtpFlow();
                            }}
                            className={`rounded-lg py-2.5 text-sm font-medium transition-all ${
                                mode === 'login' ? 'bg-white text-black shadow-sm' : 'text-white/60'
                            }`}
                        >
                            Login
                        </button>
                        <button
                            type='button'
                            onClick={() => {
                                setMode('signup');
                                setForgotPassword(false);
                                resetMessages();
                                resetOtpFlow();
                            }}
                            className={`rounded-lg py-2.5 text-sm font-medium transition-all ${
                                mode === 'signup' ? 'bg-white text-black shadow-sm' : 'text-white/60'
                            }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {errorMessage && (
                        <div className='mt-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs text-center'>
                            {errorMessage}
                        </div>
                    )}

                    {successMessage && (
                        <div className='mt-4 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs text-center'>
                            {successMessage}
                        </div>
                    )}

                    {mode === 'login' ? (
                        forgotPassword ? (
                            <form onSubmit={handleResetPassword} className='mt-6 space-y-4'>
                                <div className='relative'>
                                    <FiMail className='absolute left-3 top-3.5 text-white/35' />
                                    <input
                                        type='email'
                                        name='email'
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder='Email address'
                                        className='w-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl py-3 pl-10 pr-3 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-colors'
                                    />
                                </div>

                                <div className='flex items-center gap-2'>
                                    <input
                                        type='text'
                                        name='otp'
                                        value={form.otp}
                                        onChange={handleChange}
                                        placeholder='Enter reset code'
                                        className='flex-1 bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl py-3 px-3 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-colors'
                                    />
                                    <button
                                        type='button'
                                        onClick={handleSendForgotPasswordCode}
                                        disabled={resetLoading}
                                        className='shrink-0 px-3 py-3 rounded-xl border border-white/15 bg-white/5 text-white text-[11px] font-medium hover:bg-white/8 transition-colors disabled:opacity-60'
                                    >
                                        {resetLoading ? 'Sending...' : resetCodeSent ? 'Resend' : 'Send code'}
                                    </button>
                                </div>

                                <div className='relative'>
                                    <FiLock className='absolute left-3 top-3.5 text-white/35' />
                                    <input
                                        type='password'
                                        name='password'
                                        value={form.password}
                                        onChange={handleChange}
                                        placeholder='New password'
                                        className='w-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl py-3 pl-10 pr-3 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-colors'
                                    />
                                </div>

                                <button
                                    type='submit'
                                    disabled={resetPasswordLoading}
                                    className='w-full flex items-center justify-center gap-2 bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-60'
                                >
                                    {resetPasswordLoading ? 'Resetting...' : 'Reset password'}
                                    <FiArrowRight size={16} />
                                </button>

                                <button
                                    type='button'
                                    onClick={() => {
                                        resetForgotPasswordFlow();
                                        setMode('login');
                                        resetMessages();
                                    }}
                                    className='w-full text-sm text-white/60 hover:text-white transition-colors'
                                >
                                    Back to login
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleEmailLogin} className='mt-6 space-y-4'>
                                <div className='relative'>
                                    <FiMail className='absolute left-3 top-3.5 text-white/35' />
                                    <input
                                        type='email'
                                        name='email'
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder='Email address'
                                        className='w-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl py-3 pl-10 pr-3 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-colors'
                                    />
                                </div>

                                <div className='relative'>
                                    <FiLock className='absolute left-3 top-3.5 text-white/35' />
                                    <input
                                        type='password'
                                        name='password'
                                        value={form.password}
                                        onChange={handleChange}
                                        placeholder='Password'
                                        className='w-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl py-3 pl-10 pr-3 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-colors'
                                    />
                                </div>

                                <div className='flex justify-end'>
                                    <button
                                        type='button'
                                        onClick={() => {
                                            setForgotPassword(true);
                                            resetMessages();
                                            setForm((prev) => ({ ...prev, password: '', otp: '' }));
                                        }}
                                        className='text-xs text-white/60 hover:text-white transition-colors'
                                    >
                                        Forgot password?
                                    </button>
                                </div>

                                <button
                                    type='submit'
                                    disabled={loading}
                                    className='w-full flex items-center justify-center gap-2 bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-60'
                                >
                                    {loading ? 'Logging in...' : 'Login'}
                                    <FiArrowRight size={16} />
                                </button>
                            </form>
                        )
                    ) : (
                        <form onSubmit={handleSignup} className='mt-6 space-y-4'>
                            <div className='relative'>
                                <FiUser className='absolute left-3 top-3.5 text-white/35' />
                                <input
                                    type='text'
                                    name='name'
                                    value={form.name}
                                    onChange={handleChange}
                                    placeholder='Full name'
                                    className='w-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl py-3 pl-10 pr-3 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-colors'
                                />
                            </div>

                            <div className='flex items-center gap-2'>
                                <div className='relative flex-1'>
                                    <FiMail className='absolute left-3 top-3.5 text-white/35' />
                                    <input
                                        type='email'
                                        name='email'
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder='Email address'
                                        className='w-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl py-3 pl-10 pr-3 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-colors'
                                    />
                                </div>
                                <button
                                    type='button'
                                    onClick={handleSendOtp}
                                    disabled={otpLoading}
                                    className='shrink-0 px-3 py-3 rounded-xl border border-white/15 bg-white/5 text-white text-[11px] font-medium hover:bg-white/8 transition-colors disabled:opacity-60'
                                >
                                    {otpLoading ? 'Sending...' : otpSent ? 'Resend' : 'Send OTP'}
                                </button>
                            </div>

                            <div className='relative'>
                                <FiLock className='absolute left-3 top-3.5 text-white/35' />
                                <input
                                    type='password'
                                    name='password'
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder='Password'
                                    className='w-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl py-3 pl-10 pr-3 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-colors'
                                />
                            </div>

                            {form.password && (
                                <div className='space-y-2 rounded-xl border border-white/10 bg-white/5 p-3'>
                                    {getPasswordChecks(form.password).map((check) => (
                                        <div key={check.label} className='flex items-center gap-2 text-[11px]'>
                                            <span className={`inline-flex h-2 w-2 rounded-full ${check.passed ? 'bg-emerald-400' : 'bg-white/30'}`} />
                                            <span className={check.passed ? 'text-emerald-300' : 'text-white/60'}>{check.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {otpSent && (
                                <div className='space-y-2'>
                                    <label className='text-white/60 text-[11px] uppercase tracking-[0.18em]'>Confirm OTP</label>
                                    <div className='flex gap-2'>
                                        <input
                                            type='text'
                                            name='otp'
                                            value={form.otp}
                                            onChange={handleChange}
                                            placeholder='Enter 6-digit OTP'
                                            className='flex-1 bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl py-3 px-3 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-colors'
                                        />
                                        <button
                                            type='button'
                                            onClick={handleVerifyOtp}
                                            disabled={otpVerifying || !form.otp}
                                            className='shrink-0 px-3 py-3 rounded-xl border border-white/15 bg-white/5 text-white text-[11px] font-medium hover:bg-white/8 transition-colors disabled:opacity-60'
                                        >
                                            {otpVerifying ? 'Verifying...' : otpVerified ? 'Verified' : 'Verify'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!otpSent && (
                                <div className='mt-4 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs text-center'>
                                    Note: Please ensure your password meets the requirements.
                                </div>
                            )}

                            <button
                                type='submit'
                                disabled={loading || !otpVerified}
                                className='w-full flex items-center justify-center gap-2 bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                            >
                                {loading ? 'Creating account...' : 'Create account'}
                                <FiArrowRight size={16} />
                            </button>
                        </form>
                    )}

                    <div className='mt-6'>
                        <div className='relative flex items-center justify-center text-[10px] uppercase tracking-[0.2em] text-white/25'>
                            <span className='bg-[#0A0A0A] px-2'>or continue with</span>
                        </div>

                        <motion.button
                            onClick={handleGoogleAuth}
                            disabled={loading}
                            whileHover={loading ? {} : { scale: 1.02 }}
                            whileTap={loading ? {} : { scale: 0.98 }}
                            className={`mt-4 w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/8 transition-all ${
                                loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                        >
                            <FcGoogle size={18} />
                            <span className='text-white font-medium text-sm'>Continue with Google</span>
                        </motion.button>
                    </div>
                </div>

                <div className='relative border-t border-white/10 bg-black/30 p-4 text-center'>
                    <p className='text-white/30 text-[11px]'>Secure authentication powered by Firebase + Redis</p>
                </div>
            </div>
        </div>
    )
}

export default LoginModel
