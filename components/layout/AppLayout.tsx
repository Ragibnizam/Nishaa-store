'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { cn } from '@/lib/utils';
import { Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pos': 'Point of Sale',
  '/products': 'Products',
  '/purchases': 'Purchases',
  '/customers': 'Customers',
  '/credit': 'Credit (Udhar)',
  '/sales': 'Sales History',
  '/expiry': 'Expiry Alerts',
  '/low-stock': 'Low Stock',
  '/reports': 'Reports',
  '/activity': 'Activity Log',
  '/settings': 'Settings',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const title = Object.entries(pageTitles).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] || 'Nisha Store';

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-slate-900 border-slate-800">
          <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className={cn(
        'transition-all duration-300',
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
      )}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60 flex items-center px-4 gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-slate-400 hover:text-white h-8 w-8"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-white">{title}</h1>
          </div>
          <button className="text-slate-400 hover:text-white transition-colors relative">
            <Bell className="w-5 h-5" />
          </button>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
