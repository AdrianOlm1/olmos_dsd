import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../services/api';
import { Zap, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.login(email, password);
      if (!result?.token) { setError("Couldn't complete sign-in. Please try again."); return; }
      setToken(result.token);
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('Invalid') || msg.includes('credentials') || msg.includes('password')) {
        setError('Invalid email or password. Please check your credentials.');
      } else if (msg.includes('fetch') || msg.includes('network')) {
        setError('Unable to reach the server. Please check your connection.');
      } else {
        setError(msg || 'Sign-in failed. Please try again.');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-dark-DEFAULT flex items-center justify-center p-6">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            <Zap size={24} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">Olmos DSD</h1>
          <p className="text-sm text-muted mt-1">Route Accounting Management</p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white">Sign in to your account</h2>
            <p className="text-xs text-muted mt-1">Enter your credentials to access the dashboard</p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-danger/10 border border-danger/30 text-danger rounded-lg px-3.5 py-3 text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  className="input pl-9"
                  placeholder="admin@company.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="input pl-9"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-dark-DEFAULT font-bold text-sm rounded-lg hover:bg-primary-dark active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-dark-DEFAULT/30 border-t-dark-DEFAULT rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Olmos DSD v1.0 · Direct Store Delivery Suite
        </p>
      </div>
    </div>
  );
}
