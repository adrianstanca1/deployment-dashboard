import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Server, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { authAPI } from '@/api';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const usernameRef = useRef<HTMLInputElement>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: string })?.from ?? '/overview';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError('');

    try {
      const result = await authAPI.login(username.trim(), password);
      if (result.success && result.token) {
        login(result.token, result.username);
        const from = (location.state as { from?: string })?.from ?? '/overview';
        navigate(from, { replace: true });
      } else {
        setError(result.error ?? 'Login failed');
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string }; status?: number } };
      if (axiosError.response?.status === 429) {
        setError('Too many attempts — wait a minute and try again');
      } else {
        setError(axiosError.response?.data?.error ?? 'Connection error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      {/* Background grid pattern */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#60a5fa 1px, transparent 1px), linear-gradient(90deg, #60a5fa 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600/20 border border-primary-500/30 mb-4">
            <Server size={26} className="text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-dark-100">Deploy Hub</h1>
          <p className="text-dark-500 text-sm mt-1">Server Control Panel</p>
        </div>

        {/* Card */}
        <div className="bg-dark-900 border border-dark-700 rounded-2xl p-7 shadow-2xl">
          <h2 className="text-sm font-semibold text-dark-300 mb-5 flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary-400" />
            Sign in to continue
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs text-dark-500 mb-1.5 font-medium">Username</label>
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="admin"
                autoComplete="username"
                className="input-field w-full text-sm"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-dark-500 mb-1.5 font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="input-field w-full text-sm pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-600 hover:text-dark-400"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Signing in…</>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-dark-700 mt-6">
          Protected · Session expires in 24h
        </p>
      </div>
    </div>
  );
}
