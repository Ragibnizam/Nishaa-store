'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/lib/types';
import { formatDate, getDaysUntilExpiry } from '@/lib/utils-app';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Package, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function ExpiryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('30');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('products')
      .select('*, category:categories(name)')
      .not('expiry_date', 'is', null)
      .order('expiry_date', { ascending: true });
    setProducts(data || []);
    setLoading(false);
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const filtered = products.filter(p => {
    if (!p.expiry_date) return false;
    const days = getDaysUntilExpiry(p.expiry_date);
    if (filter === 'expired') return days < 0;
    return days >= 0 && days <= parseInt(filter);
  });

  const expiredCount = products.filter(p => p.expiry_date && getDaysUntilExpiry(p.expiry_date) < 0).length;
  const in7 = products.filter(p => p.expiry_date && getDaysUntilExpiry(p.expiry_date) >= 0 && getDaysUntilExpiry(p.expiry_date) <= 7).length;
  const in30 = products.filter(p => p.expiry_date && getDaysUntilExpiry(p.expiry_date) >= 0 && getDaysUntilExpiry(p.expiry_date) <= 30).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Expired', count: expiredCount, color: 'text-red-400', bg: 'bg-red-400/10', filter: 'expired' },
          { label: 'Expiring in 7 days', count: in7, color: 'text-orange-400', bg: 'bg-orange-400/10', filter: '7' },
          { label: 'Expiring in 30 days', count: in30, color: 'text-amber-400', bg: 'bg-amber-400/10', filter: '30' },
        ].map(card => (
          <button key={card.label} onClick={() => setFilter(card.filter)} className={cn('text-left p-4 rounded-xl border transition-colors', filter === card.filter ? 'border-emerald-500/50 bg-slate-900' : 'border-slate-800 bg-slate-900 hover:border-slate-700')}>
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', card.bg)}>
              <AlertTriangle className={cn('w-4 h-4', card.color)} />
            </div>
            <p className="text-xs text-slate-400">{card.label}</p>
            <p className={cn('text-2xl font-bold mt-1', card.color)}>{card.count}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48 bg-slate-900 border-slate-700 text-slate-300 h-9"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="7">Expiring in 7 days</SelectItem>
            <SelectItem value="30">Expiring in 30 days</SelectItem>
            <SelectItem value="90">Expiring in 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Expiry Date</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Days Left</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-10 bg-slate-800 rounded" /></td></tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center">
                  <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No products in this expiry range</p>
                </td></tr>
              ) : filtered.map(p => {
                const days = getDaysUntilExpiry(p.expiry_date!);
                const isExpired = days < 0;
                const isUrgent = !isExpired && days <= 7;
                const isWarning = !isExpired && !isUrgent && days <= 30;
                return (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.company || '—'}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-slate-300">{(p.category as any)?.name || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-slate-300">{p.quantity}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-sm', isExpired ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-slate-300')}>
                        {formatDate(p.expiry_date!)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={cn('text-xs border-0', isExpired ? 'bg-red-500/15 text-red-400' : isUrgent ? 'bg-orange-500/15 text-orange-400' : 'bg-amber-500/15 text-amber-400')}>
                        {isExpired ? `${Math.abs(days)} days ago` : `${days} days`}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline" className="h-7 px-2 border-slate-700 text-slate-300 hover:text-white text-xs">
                        <Link href={`/products?edit=${p.id}`}>Edit</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
