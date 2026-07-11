'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Package, ShoppingCart, Users, CreditCard,
  TrendingUp, BarChart3, Settings, Activity, LogOut, Store,
  ChevronLeft, ChevronRight, Bell, Search, Menu, X, Truck,
  AlertTriangle, Clock, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'staff'] },
  { label: 'Point of Sale', href: '/pos', icon: ShoppingCart, roles: ['admin', 'staff'] },
  { label: 'Products', href: '/products', icon: Package, roles: ['admin', 'staff'] },
  { label: 'Purchases', href: '/purchases', icon: Truck, roles: ['admin', 'staff'] },
  { label: 'Customers', href: '/customers', icon: Users, roles: ['admin', 'staff'] },
  { label: 'Credit (Udhar)', href: '/credit', icon: CreditCard, roles: ['admin', 'staff'] },
  { label: 'Sales History', href: '/sales', icon: TrendingUp, roles: ['admin', 'staff'] },
  { label: 'Expiry Alerts', href: '/expiry', icon: Clock, roles: ['admin', 'staff'] },
  { label: 'Low Stock', href: '/low-stock', icon: AlertTriangle, roles: ['admin', 'staff'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['admin'] },
  { label: 'Activity Log', href: '/activity', icon: Activity, roles: ['admin'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut, isAdmin } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();

  const visibleItems = navItems.filter(item =>
    item.roles.includes(profile?.role || 'staff')
  );

  async function handleLogout() {
    await signOut();
    toast.success('Signed out successfully');
    router.push('/');
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-40',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-slate-800 flex-shrink-0',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Store className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm truncate">
              {settings?.store_name || 'Nisha Store'}
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-white transition-colors ml-2 flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group',
                active
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', active && 'text-emerald-400')} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-slate-800 flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name || 'User'}</p>
              <Badge variant="secondary" className={cn(
                'text-xs h-4 mt-0.5',
                isAdmin ? 'bg-amber-500/20 text-amber-400 border-0' : 'bg-slate-700 text-slate-300 border-0'
              )}>
                {profile?.role || 'staff'}
              </Badge>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center py-2 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
