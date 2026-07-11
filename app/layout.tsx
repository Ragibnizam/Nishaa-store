import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Nisha Store - Inventory & POS',
  description: 'Complete inventory and point of sale management system for Nisha Store',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <SettingsProvider>
            {children}
            <Toaster richColors position="top-right" />
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
