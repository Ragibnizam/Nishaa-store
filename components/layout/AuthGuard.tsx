'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2 } from 'lucide-react';

const ADMIN_ONLY_ROUTES = ['/reports', '/activity', '/settings'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/');
      return;
    }
    const role = profile?.role || 'staff';
    const isAdminRoute = ADMIN_ONLY_ROUTES.some(route =>
      pathname === route || pathname.startsWith(route + '/')
    );
    if (isAdminRoute && role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, profile, loading, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const role = profile?.role || 'staff';
  const isAdminRoute = ADMIN_ONLY_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );
  if (isAdminRoute && role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-sm">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}
