'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Store, Save, KeyRound, User, Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function SettingsPage() {
  const { settings, refresh } = useSettings();
  const { isAdmin, user, profile } = useAuth();
  const [form, setForm] = useState<Partial<Settings>>({});
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (settings) setForm(settings);
    loadUsers();
  }, [settings]);

  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('*').order('created_at');
    setUsers(data || []);
  }

  function set(key: keyof Settings, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function saveSettings() {
    if (!isAdmin) { toast.error('Admin access required'); return; }
    setSaving(true);
    if (settings) {
      const { error } = await supabase.from('settings').update({ ...form, updated_at: new Date().toISOString() }).eq('id', settings.id);
      if (error) { toast.error('Failed to save settings'); setSaving(false); return; }
    } else {
      await supabase.from('settings').insert(form);
    }
    refresh();
    toast.success('Settings saved');
    setSaving(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Store Settings */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-400" />Store Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Store Name</Label>
              <Input value={form.store_name || ''} onChange={e => set('store_name', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Phone Number</Label>
              <Input value={form.store_phone || ''} onChange={e => set('store_phone', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-slate-300 text-sm">Address</Label>
              <Input value={form.store_address || ''} onChange={e => set('store_address', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Email</Label>
              <Input type="email" value={form.store_email || ''} onChange={e => set('store_email', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Currency Symbol</Label>
              <Input value={form.currency_symbol || '₹'} onChange={e => set('currency_symbol', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Invoice Prefix</Label>
              <Input value={form.invoice_prefix || 'INV'} onChange={e => set('invoice_prefix', e.target.value)} placeholder="INV" className="bg-slate-800 border-slate-700 text-white h-9" disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Low Stock Threshold</Label>
              <Input type="number" value={form.low_stock_threshold || 5} onChange={e => set('low_stock_threshold' as any, e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-slate-300 text-sm">Invoice Footer</Label>
              <Input value={form.invoice_footer || ''} onChange={e => set('invoice_footer', e.target.value)} placeholder="Thank you for shopping!" className="bg-slate-800 border-slate-700 text-white h-9" disabled={!isAdmin} />
            </div>
          </div>
          {isAdmin && (
            <Button onClick={saveSettings} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-white gap-2">
              <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Settings'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* User Management (Admin only) */}
      {isAdmin && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />User Management
            </CardTitle>
            <Button size="sm" onClick={() => setShowAddUser(true)} className="h-7 gap-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-0 text-xs">
              <Plus className="w-3 h-3" />Add User
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-slate-800">
                  <div>
                    <p className="text-sm font-medium text-white">{u.full_name || 'No name'}</p>
                    <p className="text-xs text-slate-400">{u.role} · {u.is_active ? 'Active' : 'Inactive'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
                      {u.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change Password */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {showAddUser && <AddUserDialog onClose={() => setShowAddUser(false)} onSaved={loadUsers} />}
    </div>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!newPass || newPass !== confirm) { toast.error('Passwords do not match'); return; }
    if (newPass.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) { toast.error(error.message); } else { toast.success('Password changed successfully'); setCurrent(''); setNewPass(''); setConfirm(''); }
    setSaving(false);
  }

  return (
    <div className="space-y-4 max-w-sm">
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm">New Password</Label>
        <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm">Confirm Password</Label>
        <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" />
      </div>
      <Button onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-400 text-white gap-2">
        <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Change Password'}
      </Button>
    </div>
  );
}

function AddUserDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!email || !password || !name) { toast.error('All fields required'); return; }
    setSaving(true);
    const { data, error } = await supabase.auth.admin?.createUser
      ? await (supabase.auth as any).admin.createUser({ email, password, email_confirm: true })
      : await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message || 'Failed to create user');
      setSaving(false);
      return;
    }
    const userId = data?.user?.id;
    if (userId) {
      await supabase.from('user_profiles').upsert({ id: userId, full_name: name, role, is_active: true });
    }
    toast.success('User created');
    onSaved();
    onClose();
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
        <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label className="text-slate-300 text-sm">Full Name *</Label><Input value={name} onChange={e => setName(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" /></div>
          <div className="space-y-1.5"><Label className="text-slate-300 text-sm">Email *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" /></div>
          <div className="space-y-1.5"><Label className="text-slate-300 text-sm">Password *</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" /></div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Role</Label>
            <div className="flex gap-2">
              {(['staff', 'admin'] as const).map(r => (
                <button key={r} onClick={() => setRole(r)} className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors ${role === r ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-white">{saving ? 'Creating...' : 'Create User'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
