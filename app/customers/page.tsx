'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Customer } from '@/lib/types';
import { formatCurrency, formatDateTime, logActivity } from '@/lib/utils-app';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Search, Users, Edit2, Trash2, CreditCard, History, X } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const { user, profile, isAdmin } = useAuth();
  const { settings } = useSettings();
  const sym = settings?.currency_symbol || '₹';

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q);
  });

  async function handleDelete(c: Customer) {
    const { error } = await supabase.from('customers').delete().eq('id', c.id);
    if (error) { toast.error('Cannot delete — customer has linked sales'); return; }
    toast.success('Customer deleted');
    setDeleteCustomer(null);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-400 text-sm">{customers.length} customers</p>
        <p className="text-slate-500 text-xs">Customers are created automatically during sales</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone..." className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-9" />
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Phone</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Total Purchases</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Credit Pending</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-10 bg-slate-800 rounded" /></td></tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-16 text-center">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No customers found</p>
                </td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <span className="text-emerald-400 text-sm font-bold">{c.name[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{c.name}</p>
                        {c.address && <p className="text-xs text-slate-400 truncate max-w-32">{c.address}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-slate-300">{c.phone || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-white">{formatCurrency(c.total_purchases, sym)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.credit_balance > 0 ? (
                      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 border">{formatCurrency(c.credit_balance, sym)}</Badge>
                    ) : <span className="text-slate-500 text-sm">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-slate-400 hover:text-blue-400" onClick={() => setViewCustomer(c)} title="View history">
                        <History className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-slate-400 hover:text-amber-400" onClick={() => { setEditCustomer(c); setShowForm(true); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button size="icon" variant="ghost" className="w-7 h-7 text-slate-400 hover:text-red-400" onClick={() => setDeleteCustomer(c)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showForm && <CustomerFormDialog customer={editCustomer} onClose={() => { setShowForm(false); setEditCustomer(null); }} onSaved={load} userId={user?.id} profile={profile} />}

      <AlertDialog open={!!deleteCustomer} onOpenChange={() => setDeleteCustomer(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Customer</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">Delete <strong className="text-white">{deleteCustomer?.name}</strong>? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-white border-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={() => deleteCustomer && handleDelete(deleteCustomer)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {viewCustomer && <CustomerHistoryDialog customer={viewCustomer} sym={sym} onClose={() => setViewCustomer(null)} />}
    </div>
  );
}

function CustomerFormDialog({ customer, onClose, onSaved, userId, profile }: { customer: Customer | null; onClose: () => void; onSaved: () => void; userId?: string; profile: any }) {
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    const payload = { name: name.trim(), phone: phone.trim() || null, address: address.trim() || null };
    if (customer) {
      await supabase.from('customers').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', customer.id);
      toast.success('Customer updated');
    } else {
      await supabase.from('customers').insert({ ...payload, created_by: userId });
      toast.success('Customer added');
      await logActivity({ action: 'Customer Added', entity_type: 'customer', details: { name }, user_name: profile?.full_name });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
        <DialogHeader><DialogTitle>{customer ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label className="text-slate-300 text-sm">Name *</Label><Input value={name} onChange={e => setName(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" /></div>
          <div className="space-y-1.5"><Label className="text-slate-300 text-sm">Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" /></div>
          <div className="space-y-1.5"><Label className="text-slate-300 text-sm">Address</Label><Input value={address} onChange={e => setAddress(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-white">{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerHistoryDialog({ customer, sym, onClose }: { customer: Customer; sym: string; onClose: () => void }) {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('sales').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { setSales(data || []); setLoading(false); });
  }, [customer.id]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
        <DialogHeader><DialogTitle>Purchase History - {customer.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="bg-slate-800 rounded-xl p-3">
            <p className="text-xs text-slate-400">Total Purchases</p>
            <p className="text-lg font-bold text-white mt-1">{formatCurrency(customer.total_purchases, sym)}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3">
            <p className="text-xs text-slate-400">Credit Pending</p>
            <p className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(customer.credit_balance, sym)}</p>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
          {loading ? <Skeleton className="h-20 bg-slate-800" /> :
            sales.length === 0 ? <p className="text-slate-500 text-sm py-8 text-center">No purchase history</p> :
              sales.map(s => (
                <div key={s.id} className="flex justify-between py-3 px-1">
                  <div>
                    <p className="text-sm text-white">{s.invoice_number}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(s.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{formatCurrency(s.total, sym)}</p>
                    <Badge className={`text-xs border-0 ${s.payment_method === 'credit' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{s.payment_method}</Badge>
                  </div>
                </div>
              ))
          }
        </div>
      </DialogContent>
    </Dialog>
  );
}
