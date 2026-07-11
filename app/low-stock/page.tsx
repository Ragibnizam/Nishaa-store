'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/lib/types';
import { formatCurrency } from '@/lib/utils-app';
import { useSettings } from '@/contexts/SettingsContext';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Package, Truck } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function LowStockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'low' | 'out'>('low');
  const { settings } = useSettings();
  const sym = settings?.currency_symbol || '₹';

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('products')
      .select('*, category:categories(name)')
      .eq('is_active', true)
      .order('quantity', { ascending: true });
    setProducts(data || []);
    setLoading(false);
  }

  const outOfStock = products.filter(p => p.quantity === 0);
  const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= p.min_stock_alert);
  const displayed = tab === 'out' ? outOfStock : lowStock;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="w-8 h-8 bg-red-400/10 rounded-lg flex items-center justify-center mb-3">
            <Package className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-xs text-slate-400">Out of Stock</p>
          <p className="text-2xl font-bold text-red-400">{outOfStock.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="w-8 h-8 bg-amber-400/10 rounded-lg flex items-center justify-center mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xs text-slate-400">Low Stock</p>
          <p className="text-2xl font-bold text-amber-400">{lowStock.length}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 max-w-xs">
        {(['low', 'out'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors', tab === t ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white')}>
            {t === 'out' ? 'Out of Stock' : 'Low Stock'}
          </button>
        ))}
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Current Stock</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Min Alert</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Selling Price</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-10 bg-slate-800 rounded" /></td></tr>
              )) : displayed.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center">
                  <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No products in this category</p>
                </td></tr>
              ) : displayed.map(p => (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.company || '—'}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-slate-300">{(p.category as any)?.name || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={cn('text-xs border-0', p.quantity === 0 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400')}>
                      {p.quantity}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-slate-400">{p.min_stock_alert}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-white">{formatCurrency(p.selling_price, sym)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" className="h-7 px-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-0 text-xs gap-1">
                      <Link href="/purchases"><Truck className="w-3 h-3" />Restock</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
