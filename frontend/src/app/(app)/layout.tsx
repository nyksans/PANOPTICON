'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { AppShell } from '@/components/layout/AppShell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, token, _hasHydrated } = useAuthStore();

  // Wait for hydration, then redirect if not authenticated
  if (!_hasHydrated) {
    return null; // No spinner, instant hydration from localStorage
  }

  if (!isAuthenticated || !token) {
    router.replace('/auth/login');
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
