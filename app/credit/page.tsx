'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CreditSale, CreditPayment, Customer } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, logActivity } from '@/lib/utils-app';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, CreditCard, DollarSign, History, AlertTriangle, Printer, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-red-500/15 text-red-400 border-red-500/20',
  partial: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
};

interface CustomerCredit {
  customer: Customer;
  totalCredit: number;
  totalPaid: number;
  remaining: number;
  lastPaymentDate: string | null;
  status: 'pending' | 'partial' | 'paid';
  creditSales: CreditSale[];
}

export default function CreditPage() {
  const [customerCredits, setCustomerCredits] = useState<CustomerCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [paymentModal, setPaymentModal] = useState<CustomerCredit | null>(null);
  const [historyModal, setHistoryModal] = useState<CustomerCredit | null>(null);
  const [detailsModal, setDetailsModal] = useState<CustomerCredit | null>(null);
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const sym = settings?.currency_symbol || '₹';

  const load = useCallback(async () => {
    const { data } = await supabase.from('credit_sales')
      .select('*, customer:customers(*), sale:sales(invoice_number, created_at)')
      .order('created_at', { ascending: false });
    if (!data) { setLoading(false); return; }

    const map = new Map<string, CustomerCredit>();
    for (const cs of data) {
      const cust = cs.customer as any;
      if (!cust) continue;
      const existing = map.get(cust.id);
      const tc = Number(cs.total_amount);
      const tp = Number(cs.paid_amount);
      const tr = Number(cs.remaining_amount);
      const pd = cs.updated_at || cs.created_at;

      if (existing) {
        existing.totalCredit += tc;
        existing.totalPaid += tp;
        existing.remaining += tr;
        existing.creditSales.push(cs);
        if (!existing.lastPaymentDate || (pd && new Date(pd) > new Date(existing.lastPaymentDate))) {
          existing.lastPaymentDate = pd;
        }
      } else {
        map.set(cust.id, {
          customer: cust, totalCredit: tc, totalPaid: tp, remaining: tr,
          lastPaymentDate: pd, status: cs.status, creditSales: [cs],
        });
      }
    }

    const result = Array.from(map.values()).map(cc => {
      let status: 'pending' | 'partial' | 'paid' = 'pending';
      if (cc.remaining <= 0) status = 'paid';
      else if (cc.totalPaid > 0) status = 'partial';
      cc.status = status;
      return cc;
    });

    setCustomerCredits(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = customerCredits.filter(cc => {
    const q = search.toLowerCase();
    const matchSearch = !q || cc.customer.name.toLowerCase().includes(q) || (cc.customer.phone || '').includes(q);
    const matchStatus = filterStatus === 'all' || cc.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalOutstanding = customerCredits.reduce((s, c) => s + c.remaining, 0);
  const pendingCount = customerCredits.filter(c => c.status !== 'paid').length;
  const partialCount = customerCredits.filter(c => c.status === 'partial').length;
  const paidCount = customerCredits.filter(c => c.status === 'paid').length;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-red-400/10 rounded-lg flex items-center justify-center mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-xs text-slate-400">Total Outstanding</p>
            <p className="text-xl font-bold text-white">{formatCurrency(totalOutstanding, sym)}</p>
            <p className="text-xs text-slate-500 mt-1">{pendingCount} customers</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-amber-400/10 rounded-lg flex items-center justify-center mb-3">
              <CreditCard className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs text-slate-400">Partial Payments</p>
            <p className="text-xl font-bold text-white">{partialCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-emerald-400/10 rounded-lg flex items-center justify-center mb-3">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-400">Fully Paid</p>
            <p className="text-xl font-bold text-white">{paidCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="w-8 h-8 bg-blue-400/10 rounded-lg flex items-center justify-center mb-3">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xs text-slate-400">Total Customers</p>
            <p className="text-xl font-bold text-white">{customerCredits.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or mobile..." className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-9" />
        </div>
        <div className="flex gap-1.5">
          {['all', 'pending', 'partial', 'paid'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize',
                filterStatus === s
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 bg-slate-900'
              )}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Credit Customers Table */}
      <Card className="bg-slate-900 border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Mobile</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Total Credit</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Total Paid</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Remaining</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Last Payment</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-10 bg-slate-800 rounded" /></td></tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center">
                  <CreditCard className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No credit customers found</p>
                  <p className="text-slate-500 text-xs mt-1">Credit transactions are created automatically during sales</p>
                </td></tr>
              ) : filtered.map(cc => (
                <tr key={cc.customer.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
                        <span className="text-amber-400 text-sm font-bold">{cc.customer.name[0]?.toUpperCase()}</span>
                      </div>
                      <p className="text-sm font-medium text-white">{cc.customer.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-slate-300">{cc.customer.phone || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-white">{formatCurrency(cc.totalCredit, sym)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-emerald-400">{formatCurrency(cc.totalPaid, sym)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('text-sm font-semibold', cc.remaining > 0 ? 'text-red-400' : 'text-slate-400')}>
                      {formatCurrency(cc.remaining, sym)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-slate-400">{cc.lastPaymentDate ? formatDate(cc.lastPaymentDate) : '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={cn('text-xs border', STATUS_COLORS[cc.status])}>{cc.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-slate-400 hover:text-blue-400" onClick={() => setDetailsModal(cc)} title="View Details">
                        <User className="w-3.5 h-3.5" />
                      </Button>
                      {cc.remaining > 0 && (
                        <Button size="sm" variant="outline" className="h-7 px-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 text-xs gap-1" onClick={() => setPaymentModal(cc)}>
                          <DollarSign className="w-3 h-3" />Pay
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-slate-400 hover:text-blue-400" onClick={() => setHistoryModal(cc)} title="Payment History">
                        <History className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-slate-400 hover:text-white" onClick={() => printStatement(cc, sym)} title="Print Statement">
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {paymentModal && <PaymentDialog cc={paymentModal} sym={sym} userId={user?.id} profile={profile} onClose={() => setPaymentModal(null)} onSaved={load} />}
      {historyModal && <PaymentHistoryDialog cc={historyModal} sym={sym} onClose={() => setHistoryModal(null)} />}
      {detailsModal && <CreditDetailsDialog cc={detailsModal} sym={sym} onClose={() => setDetailsModal(null)} onPay={() => { setPaymentModal(detailsModal); setDetailsModal(null); }} />}
    </div>
  );
}

function printStatement(cc: CustomerCredit, sym: string) {
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) { toast.error('Popup blocked'); return; }
  const rows = cc.creditSales.map((cs, i) => {
    const sale = cs.sale as any;
    return `<tr>
      <td>${i + 1}</td>
      <td>${sale?.invoice_number || '—'}</td>
      <td style="text-align:right">${formatCurrency(Number(cs.total_amount), sym)}</td>
      <td style="text-align:right">${formatCurrency(Number(cs.paid_amount), sym)}</td>
      <td style="text-align:right">${formatCurrency(Number(cs.remaining_amount), sym)}</td>
      <td>${formatDate(cs.created_at)}</td>
    </tr>`;
  }).join('');
  w.document.write(`<html><head><title>Credit Statement - ${cc.customer.name}</title>
  <style>
    body { font-family: monospace; padding: 20px; max-width: 400px; }
    h2 { text-align:center; margin-bottom: 5px; }
    .info { margin: 10px 0; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
    th { background: #f5f5f5; }
    .summary { margin-top: 15px; font-size: 12px; }
    .summary div { display: flex; justify-content: space-between; padding: 2px 0; }
    .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; }
  </style></head><body>
    <h2>Credit Statement</h2>
    <div class="info">
      <p><strong>Customer:</strong> ${cc.customer.name}</p>
      <p><strong>Mobile:</strong> ${cc.customer.phone || '—'}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
    </div>
    <table>
      <thead><tr><th>#</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary">
      <div><span>Total Credit:</span><span>${formatCurrency(cc.totalCredit, sym)}</span></div>
      <div><span>Total Paid:</span><span>${formatCurrency(cc.totalPaid, sym)}</span></div>
      <div style="font-weight:bold;font-size:14px"><span>Outstanding:</span><span>${formatCurrency(cc.remaining, sym)}</span></div>
    </div>
    <div class="footer">This is a computer-generated statement.</div>
  </body></html>`);
  w.document.close();
  w.print();
}

function PaymentDialog({ cc, sym, userId, profile, onClose, onSaved }: {
  cc: CustomerCredit; sym: string; userId?: string; profile: any; onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState(cc.remaining.toFixed(2));
  const [method, setMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }
    if (amt > cc.remaining) { toast.error('Amount exceeds remaining balance'); return; }
    setSaving(true);

    const unpaidSale = cc.creditSales.find(cs => Number(cs.remaining_amount) > 0);
    if (!unpaidSale) { toast.error('No unpaid credit found'); setSaving(false); return; }

    const { error } = await supabase.from('credit_payments').insert({
      credit_sale_id: unpaidSale.id,
      customer_id: cc.customer.id,
      amount: amt,
      payment_method: method,
      notes: notes.trim() || null,
      created_by: userId,
    });
    if (error) { toast.error('Failed to record payment'); setSaving(false); return; }

    const newPaid = Number(unpaidSale.paid_amount) + amt;
    const newRemaining = Math.max(0, Number(unpaidSale.total_amount) - newPaid);
    const newStatus = newRemaining === 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'pending');
    await supabase.from('credit_sales').update({
      paid_amount: newPaid,
      remaining_amount: newRemaining,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', unpaidSale.id);

    await supabase.from('customers').update({
      credit_balance: Math.max(0, (cc.customer.credit_balance || 0) - amt),
      updated_at: new Date().toISOString(),
    }).eq('id', cc.customer.id);

    toast.success('Payment recorded');
    await logActivity({ action: 'Credit Payment Received', entity_type: 'credit_sale', entity_id: unpaidSale.id, details: { amount: amt, customer: cc.customer.name }, user_name: profile?.full_name });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
        <DialogHeader><DialogTitle>Receive Payment</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-slate-800 rounded-xl p-4 space-y-1">
            <p className="text-xs text-slate-400">Customer: <span className="text-white">{cc.customer.name}</span></p>
            <p className="text-xs text-slate-400">Mobile: <span className="text-white">{cc.customer.phone || '—'}</span></p>
            <p className="text-xs text-slate-400 mt-2">Outstanding Balance: <span className="text-red-400 font-semibold text-base">{formatCurrency(cc.remaining, sym)}</span></p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Payment Amount *</Label>
            <Input type="number" min="1" max={cc.remaining} value={amount} onChange={e => setAmount(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" />
            <div className="flex gap-1.5">
              <button onClick={() => setAmount(cc.remaining.toFixed(2))} className="flex-1 py-1 text-xs rounded border border-slate-700 text-slate-400 hover:text-white">Full</button>
              <button onClick={() => setAmount((cc.remaining * 0.5).toFixed(2))} className="flex-1 py-1 text-xs rounded border border-slate-700 text-slate-400 hover:text-white">Half</button>
              <button onClick={() => setAmount('0')} className="flex-1 py-1 text-xs rounded border border-slate-700 text-slate-400 hover:text-white">₹0</button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Payment Method</Label>
            <div className="flex gap-2">
              {(['cash', 'upi', 'card'] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)} className={cn('flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors', method === m ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'border-slate-700 text-slate-400 hover:text-white')}>
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" className="bg-slate-800 border-slate-700 text-white h-9" />
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-slate-400">After Payment:</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Remaining</span><span className="text-amber-400 font-medium">{formatCurrency(Math.max(0, cc.remaining - (parseFloat(amount) || 0)), sym)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-white">{saving ? 'Saving...' : 'Record Payment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentHistoryDialog({ cc, sym, onClose }: { cc: CustomerCredit; sym: string; onClose: () => void }) {
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saleIds = cc.creditSales.map(cs => cs.id);
    if (saleIds.length === 0) { setLoading(false); return; }
    supabase.from('credit_payments').select('*').in('credit_sale_id', saleIds).order('created_at', { ascending: false })
      .then(({ data }) => { setPayments(data || []); setLoading(false); });
  }, [cc.creditSales]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader><DialogTitle>Payment History - {cc.customer.name}</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {loading ? <Skeleton className="h-20 bg-slate-800" /> :
            payments.length === 0 ? <p className="text-slate-500 text-sm py-6 text-center">No payments recorded yet</p> :
              payments.map(p => (
                <div key={p.id} className="flex justify-between items-center py-2.5 px-3 bg-slate-800/50 rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">{formatCurrency(p.amount, sym)}</p>
                    <p className="text-xs text-slate-400">{p.payment_method} · {formatDateTime(p.created_at)}</p>
                  </div>
                  {p.notes && <p className="text-xs text-slate-500 max-w-28 truncate">{p.notes}</p>}
                </div>
              ))
          }
        </div>
        <div className="border-t border-slate-800 pt-3 space-y-1">
          <div className="flex justify-between text-sm"><span className="text-slate-400">Total Credit</span><span className="text-white font-medium">{formatCurrency(cc.totalCredit, sym)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-400">Total Paid</span><span className="text-emerald-400 font-semibold">{formatCurrency(cc.totalPaid, sym)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-400">Remaining</span><span className="text-red-400 font-semibold">{formatCurrency(cc.remaining, sym)}</span></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreditDetailsDialog({ cc, sym, onClose, onPay }: { cc: CustomerCredit; sym: string; onClose: () => void; onPay: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader><DialogTitle>Credit Details</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
              <span className="text-amber-400 text-lg font-bold">{cc.customer.name[0]?.toUpperCase()}</span>
            </div>
            <div>
              <p className="text-white font-medium">{cc.customer.name}</p>
              <p className="text-xs text-slate-400">{cc.customer.phone || 'No phone'}</p>
            </div>
            <Badge className={cn('ml-auto text-xs border', STATUS_COLORS[cc.status])}>{cc.status}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-400">Total Credit</p>
              <p className="text-sm font-bold text-white mt-1">{formatCurrency(cc.totalCredit, sym)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-400">Total Paid</p>
              <p className="text-sm font-bold text-emerald-400 mt-1">{formatCurrency(cc.totalPaid, sym)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-400">Remaining</p>
              <p className="text-sm font-bold text-red-400 mt-1">{formatCurrency(cc.remaining, sym)}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Credit Transactions ({cc.creditSales.length})</p>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {cc.creditSales.map(cs => {
                const sale = cs.sale as any;
                return (
                  <div key={cs.id} className="flex justify-between items-center py-2 px-3 bg-slate-800/30 rounded-lg">
                    <div>
                      <p className="text-xs font-mono text-slate-300">{sale?.invoice_number || '—'}</p>
                      <p className="text-xs text-slate-500">{formatDate(cs.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white">{formatCurrency(Number(cs.total_amount), sym)}</p>
                      <p className="text-xs text-red-400">Due: {formatCurrency(Number(cs.remaining_amount), sym)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">Close</Button>
          {cc.remaining > 0 && (
            <Button onClick={onPay} className="bg-emerald-500 hover:bg-emerald-400 text-white gap-2">
              <DollarSign className="w-4 h-4" /> Receive Payment
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
