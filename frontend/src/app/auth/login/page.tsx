'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Shield, Lock, User, AlertCircle, Zap } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const { login, setLoading, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter your credentials.');
      return;
    }
    setLoading(true);
    try {
      const result = await authApi.login(email, password);
      login(
        {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role as import('@/types').UserRole,
          badge: result.user.badge,
          department: result.user.department,
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
        },
        result.access_token,
      );
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'message' in err
          ? (err as { message: string }).message
          : 'Authentication failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = () => {
    setEmail('analyst@panopticon.gov');
    setPassword('demo1234');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid + glow */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-40" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-glow-md">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent to-primary opacity-30 blur-xl" />
            </div>
          </motion.div>
          <h1 className="text-2xl font-bold tracking-wider text-gradient-cyan">PANOPTICON</h1>
          <p className="text-xs text-muted-foreground tracking-widest mt-1">FORENSIC INTELLIGENCE PLATFORM</p>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl border border-border p-8 shadow-panel">
          <div className="mb-6">
            <h2 className="text-base font-semibold">Secure Access</h2>
            <p className="text-xs text-muted-foreground mt-1">Law enforcement credentials required</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/25 mb-4"
            >
              <AlertCircle className="w-4 h-4 text-danger shrink-0" />
              <p className="text-xs text-danger">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Badge Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@department.gov"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 text-sm bg-surface border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 text-sm bg-surface border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200',
                isLoading
                  ? 'bg-accent/50 text-white/50 cursor-not-allowed'
                  : 'bg-accent text-accent-foreground hover:bg-accent-glow shadow-glow-sm hover:shadow-glow-md'
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" />
                  Access Platform
                </span>
              )}
            </button>
          </form>

          {/* Demo */}
          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={demoLogin}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs text-muted-foreground border border-border hover:border-accent/30 hover:text-foreground transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-accent" />
              Use Demo Credentials
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-2xs text-muted-foreground/50 mt-6">
          PANOPTICON is authorized for law enforcement use only. Unauthorized access is prohibited and monitored.
        </p>
      </motion.div>
    </div>
  );
}
