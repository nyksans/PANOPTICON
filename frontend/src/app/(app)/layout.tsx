'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, token, _hasHydrated, updateUser } = useAuthStore();
  const refreshedRef = useRef(false);

  // Background profile refresh — does NOT gate rendering.
  // Runs once per mount, 3-second timeout so a slow/offline backend never blocks the UI.
  useEffect(() => {
    if (!_hasHydrated || !token || !isAuthenticated) return;
    if (refreshedRef.current) return;
    refreshedRef.current = true;

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    );

    Promise.race([authApi.me(), timeout])
      .then((user) => {
        updateUser({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as import('@/types').UserRole,
          badge: user.badge,
          department: user.department,
        });
      })
      .catch(() => {
        // Silently ignore — stale profile data from localStorage is fine for a demo.
      });
  }, [_hasHydrated, token, isAuthenticated, updateUser]);

  // Wait for Zustand to hydrate from localStorage, then redirect if not authenticated.
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !token) {
    router.replace('/auth/login');
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
