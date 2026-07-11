'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sale } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/utils-app';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, TrendingUp, Eye, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';

const METHOD_COLORS: Record<string, string> = {
  cash: 'bg-emerald-500/15 text-emerald-400',
  upi: 'bg-blue-500/15 text-blue-400',
  card: 'bg-violet-500/15 text-violet-400',
  mixed: 'bg-amber-500/15 text-amber-400',
  credit: 'bg-red-500/15 text-red-400',
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const { settings } = useSettings();
  const sym = settings?.currency_symbol || '₹';

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('sales').select('*, items:sale_items(*, product:products(name, barcode))').order('created_at', { ascending: false }).limit(200);
    setSales(data || []);
    setLoading(false);
  }

  const filtered = sales.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.invoice_number.toLowerCase().includes(q) || (s.customer_name || '').toLowerCase().includes(q);
    const matchMethod = filterMethod === 'all' || s.payment_method === filterMethod;
    const matchType = filterType === 'all' || s.sale_type === filterType;
    return matchSearch && matchMethod && matchType;
  });

  const totalRevenue = filtered.reduce((s, sale) => s + Number(sale.total), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales', value: filtered.length.toString(), color: 'text-white' },
          { label: 'Total Revenue', value: formatCurrency(totalRevenue, sym), color: 'text-emerald-400' },
          { label: 'Cash Sales', value: filtered.filter(s => s.payment_method === 'cash').length.toString(), color: 'text-white' },
          { label: 'Credit Sales', value: filtered.filter(s => s.is_credit).length.toString(), color: 'text-amber-400' },
        ].map(card => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-400">{card.label}</p>
            <p className={cn('text-xl font-bold mt-1', card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice or customer..." className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-9" />
        </div>
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-36 bg-slate-900 border-slate-700 text-slate-300 h-9"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 bg-slate-900 border-slate-700 text-slate-300 h-9"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="normal">With Bill</SelectItem>
            <SelectItem value="without_bill">Quick Sale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Invoice</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Customer</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Items</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Total</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Payment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-10 bg-slate-800 rounded" /></td></tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center">
                  <TrendingUp className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No sales found</p>
                </td></tr>
              ) : filtered.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <p className="text-sm font-mono font-medium text-white">{sale.invoice_number}</p>
                    <p className="text-xs text-slate-400">{sale.sale_type === 'without_bill' ? 'Quick Sale' : 'With Bill'}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm text-slate-300">{sale.customer_name || 'Walk-in'}</p>
                    {sale.customer_phone && <p className="text-xs text-slate-500">{sale.customer_phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className="bg-slate-800 text-slate-300 border-0 text-xs">{(sale.items as any[])?.length || 0}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-semibold text-white">{formatCurrency(sale.total, sym)}</p>
                    {sale.discount_amount > 0 && <p className="text-xs text-emerald-400">-{formatCurrency(sale.discount_amount, sym)}</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={cn('text-xs border-0', METHOD_COLORS[sale.payment_method])}>{sale.payment_method}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-xs text-slate-400">{formatDateTime(sale.created_at)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-slate-400 hover:text-blue-400" onClick={() => setViewSale(sale)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {viewSale && <SaleDetailDialog sale={viewSale} sym={sym} settings={settings} onClose={() => setViewSale(null)} />}
    </div>
  );
}

function SaleDetailDialog({ sale, sym, settings, onClose }: { sale: Sale; sym: string; settings: any; onClose: () => void }) {
  const items = (sale.items as any[]) || [];

  function printBill() {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = items.map(i => `<tr><td>${i.product_name}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${sym}${Number(i.selling_price).toFixed(2)}</td><td style="text-align:right">${sym}${Number(i.total).toFixed(2)}</td></tr>`).join('');
    w.document.write(`<html><head><title>Invoice</title><style>body{font-family:sans-serif;max-width:400px;margin:20px auto;font-size:13px}h2,p{text-align:center;margin:2px 0}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{padding:5px;border-bottom:1px solid #eee}th{background:#f5f5f5}</style></head><body>
    <h2>${settings?.store_name || 'Nisha Store'}</h2><p>${settings?.store_address || ''}</p><p>${settings?.store_phone || ''}</p><hr/>
    <p>Invoice: <b>${sale.invoice_number}</b></p><p>Date: ${new Date(sale.created_at).toLocaleString('en-IN')}</p>
    ${sale.customer_name ? `<p>Customer: ${sale.customer_name}</p>` : ''}
    <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><hr/>
    <p>Subtotal: ${sym}${Number(sale.subtotal).toFixed(2)}</p>
    ${sale.discount_amount > 0 ? `<p>Discount: -${sym}${Number(sale.discount_amount).toFixed(2)}</p>` : ''}
    <p style="font-weight:bold;font-size:15px">Total: ${sym}${Number(sale.total).toFixed(2)}</p>
    <p>Payment: ${sale.payment_method.toUpperCase()}</p><hr/>
    <p style="font-size:11px;color:#666">${settings?.invoice_footer || 'Thank you!'}</p>
    <button onclick="window.print();window.close()">Print</button></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{sale.invoice_number}</span>
            <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 gap-2 h-7" onClick={printBill}>
              <Printer className="w-3.5 h-3.5" />Print
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-slate-400">Customer:</span> <span className="text-white">{sale.customer_name || 'Walk-in'}</span></div>
            <div><span className="text-slate-400">Payment:</span> <span className="text-white capitalize">{sale.payment_method}</span></div>
            <div><span className="text-slate-400">Date:</span> <span className="text-white">{formatDateTime(sale.created_at)}</span></div>
            <div><span className="text-slate-400">Type:</span> <span className="text-white">{sale.sale_type === 'without_bill' ? 'Quick Sale' : 'With Bill'}</span></div>
          </div>
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-slate-800"><th className="text-left px-3 py-2 text-xs text-slate-400">Item</th><th className="text-right px-3 py-2 text-xs text-slate-400">Qty</th><th className="text-right px-3 py-2 text-xs text-slate-400">Price</th><th className="text-right px-3 py-2 text-xs text-slate-400">Total</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {items.map(i => (
                  <tr key={i.id}><td className="px-3 py-2 text-sm text-white">{i.product_name}</td><td className="px-3 py-2 text-sm text-slate-300 text-right">{i.quantity}</td><td className="px-3 py-2 text-sm text-slate-300 text-right">{formatCurrency(i.selling_price, sym)}</td><td className="px-3 py-2 text-sm font-medium text-white text-right">{formatCurrency(i.total, sym)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{formatCurrency(sale.subtotal, sym)}</span></div>
            {sale.discount_amount > 0 && <div className="flex justify-between text-emerald-400"><span>Discount</span><span>-{formatCurrency(sale.discount_amount, sym)}</span></div>}
            <div className="flex justify-between text-white font-bold text-base border-t border-slate-800 pt-2"><span>Total</span><span>{formatCurrency(sale.total, sym)}</span></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
