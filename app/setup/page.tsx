'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Store, Loader2, ShieldCheck } from 'lucide-react';

export default function SetupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if any admin exists
    supabase.from('user_profiles').select('id').eq('role', 'admin').limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          router.push('/');
        } else {
          setChecking(false);
        }
      });
  }, [router]);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error('All fields are required');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        await supabase.from('user_profiles').insert({
          id: data.user.id,
          full_name: name,
          role: 'admin',
          is_active: true,
        });
        toast.success('Admin account created! Signing you in...');
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInError) {
          router.push('/dashboard');
        } else {
          router.push('/');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Setup failed');
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4 shadow-lg shadow-emerald-500/30">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Nisha Store</h1>
          <p className="text-slate-400 mt-1 text-sm">Initial Setup</p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-6 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
            <h2 className="text-lg font-semibold text-white">Create Admin Account</h2>
          </div>
          <form onSubmit={handleSetup} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Full Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@nishastore.com" className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Password (min 8 characters)</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 h-11" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</> : 'Create Admin Account'}
            </Button>
          </form>
        </div>
        <p className="text-center text-slate-500 text-xs mt-6">
          This page is only accessible once &mdash; for initial setup.
        </p>
      </div>
    </div>
  );
}
