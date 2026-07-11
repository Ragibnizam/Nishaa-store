'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils-app';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, Package, DollarSign } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ReportsPage() {
  const [period, setPeriod] = useState('30');
  const [salesData, setSalesData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ revenue: 0, profit: 0, orders: 0, avgOrder: 0 });
  const { settings } = useSettings();
  const sym = settings?.currency_symbol || '₹';

  useEffect(() => { loadReports(); }, [period]);

  async function loadReports() {
    setLoading(true);
    const days = parseInt(period);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    const [{ data: sales }, { data: saleItems }] = await Promise.all([
      supabase.from('sales').select('id, total, created_at, subtotal').gte('created_at', sinceStr).order('created_at'),
      supabase.from('sale_items').select('product_id, product_name, quantity, selling_price, purchase_price, total').gte('created_at', sinceStr),
    ]);

    // Group sales by day
    const byDay: Record<string, number> = {};
    (sales || []).forEach(s => {
      const day = s.created_at.split('T')[0];
      byDay[day] = (byDay[day] || 0) + Number(s.total);
    });
    const dailySales = Object.entries(byDay).map(([date, total]) => ({
      date: formatDate(date),
      sales: total,
      profit: total * 0.15,
    })).slice(-30);

    // Top products
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    (saleItems || []).forEach(item => {
      if (!productMap[item.product_id]) productMap[item.product_id] = { name: item.product_name, qty: 0, revenue: 0 };
      productMap[item.product_id].qty += Number(item.quantity);
      productMap[item.product_id].revenue += Number(item.total);
    });
    const top = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Category breakdown via products
    const { data: products } = await supabase.from('products').select('id, category:categories(name)');
    const catMap: Record<string, string> = {};
    (products || []).forEach(p => { catMap[p.id] = (p.category as any)?.name || 'Uncategorized'; });

    const catData: Record<string, number> = {};
    (saleItems || []).forEach(item => {
      const cat = catMap[item.product_id] || 'Uncategorized';
      catData[cat] = (catData[cat] || 0) + Number(item.total);
    });
    const cats = Object.entries(catData).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const totalRevenue = (sales || []).reduce((s, r) => s + Number(r.total), 0);
    const totalProfit = (saleItems || []).reduce((s, i) => s + (Number(i.selling_price) - Number(i.purchase_price)) * Number(i.quantity), 0);

    setSalesData(dailySales);
    setTopProducts(top);
    setCategoryData(cats);
    setSummary({ revenue: totalRevenue, profit: totalProfit, orders: (sales || []).length, avgOrder: (sales?.length || 0) > 0 ? totalRevenue / (sales?.length || 1) : 0 });
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">Business analytics and insights</p>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36 bg-slate-900 border-slate-700 text-slate-300 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last 1 year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Revenue', value: formatCurrency(summary.revenue, sym), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { label: 'Profit', value: formatCurrency(summary.profit, sym), icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'Orders', value: summary.orders.toString(), icon: Package, color: 'text-violet-400', bg: 'bg-violet-400/10' },
          { label: 'Avg Order', value: formatCurrency(summary.avgOrder, sym), icon: BarChart3, color: 'text-amber-400', bg: 'bg-amber-400/10' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <p className="text-xs text-slate-400">{card.label}</p>
                {loading ? <Skeleton className="h-6 w-24 bg-slate-800 mt-1" /> : <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white">Sales Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-56 bg-slate-800 rounded-lg" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} formatter={(v: number) => [formatCurrency(v, sym), 'Sales']} />
                  <Area type="monotone" dataKey="sales" stroke="#10b981" fill="url(#grad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white">Sales by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-56 bg-slate-800 rounded-lg" /> : categoryData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-slate-500 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="45%" outerRadius={70} dataKey="value" nameKey="name">
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} formatter={(v: number) => [formatCurrency(v, sym)]} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white">Top Selling Products</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 bg-slate-800 rounded-lg" />)}
            </div>
          ) : topProducts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No sales data for this period</div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => {
                const maxRev = topProducts[0].revenue;
                const pct = (p.revenue / maxRev) * 100;
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-6 text-xs text-slate-500 text-right flex-shrink-0">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-white truncate">{p.name}</span>
                        <span className="text-sm font-semibold text-emerald-400 flex-shrink-0 ml-2">{formatCurrency(p.revenue, sym)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 mt-0.5">{p.qty} units sold</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
