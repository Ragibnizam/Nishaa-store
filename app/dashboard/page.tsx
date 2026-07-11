'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime } from '@/lib/utils-app';
import { DashboardStats, Sale, ActivityLog } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp, Package, AlertTriangle, Clock, CreditCard,
  ShoppingCart, DollarSign, BarChart2, Users, Activity,
  ArrowUpRight, ArrowDownRight, Plus, Scan
} from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { formatDate } from '@/lib/utils-app';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; sales: number; profit: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();
  const { isAdmin } = useAuth();

  const sym = settings?.currency_symbol || '₹';

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const [
        { data: allProducts },
        { data: todaySalesData },
        { data: monthlySalesData },
        { data: creditData },
        { data: recentSalesData },
        { data: activityData },
      ] = await Promise.all([
        supabase.from('products').select('id, quantity, min_stock_alert, purchase_price, selling_price, expiry_date, is_active'),
        supabase.from('sales').select('total, paid_amount').gte('created_at', todayStr),
        supabase.from('sales').select('total, paid_amount').gte('created_at', monthStart),
        supabase.from('credit_sales').select('remaining_amount').eq('status', 'pending').or('status.eq.partial'),
        supabase.from('sales').select('*, items:sale_items(*)').order('created_at', { ascending: false }).limit(8),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      const products = allProducts || [];
      const todaySaleItems = await supabase.from('sale_items')
        .select('quantity, purchase_price, selling_price, total')
        .gte('created_at', todayStr);

      const monthlySaleItems = await supabase.from('sale_items')
        .select('quantity, purchase_price, selling_price, total')
        .gte('created_at', monthStart);

      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
      const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0];
      const todayDate = now.toISOString().split('T')[0];

      const todayRevenue = (todaySalesData || []).reduce((s, r) => s + Number(r.total), 0);
      const todayProfit = (todaySaleItems.data || []).reduce((s, r) =>
        s + (Number(r.selling_price) - Number(r.purchase_price)) * Number(r.quantity), 0);
      const monthlyRevenue = (monthlySalesData || []).reduce((s, r) => s + Number(r.total), 0);
      const monthlyProfit = (monthlySaleItems.data || []).reduce((s, r) =>
        s + (Number(r.selling_price) - Number(r.purchase_price)) * Number(r.quantity), 0);

      const creditPending = (creditData || []).reduce((s, r) => s + Number(r.remaining_amount), 0);

      setStats({
        todaySales: todayRevenue,
        todayProfit: todayProfit,
        monthlySales: monthlyRevenue,
        monthlyProfit: monthlyProfit,
        totalProducts: products.length,
        availableStock: products.reduce((s, p) => s + Number(p.quantity), 0),
        inventoryValue: products.reduce((s, p) => s + Number(p.purchase_price) * Number(p.quantity), 0),
        purchaseValue: products.reduce((s, p) => s + Number(p.purchase_price) * Number(p.quantity), 0),
        sellingValue: products.reduce((s, p) => s + Number(p.selling_price) * Number(p.quantity), 0),
        creditPending,
        lowStockCount: products.filter(p => Number(p.quantity) > 0 && Number(p.quantity) <= Number(p.min_stock_alert)).length,
        outOfStockCount: products.filter(p => Number(p.quantity) === 0).length,
        expiredCount: products.filter(p => p.expiry_date && p.expiry_date < todayDate).length,
        expiringSoonCount: products.filter(p => p.expiry_date && p.expiry_date >= todayDate && p.expiry_date <= in30).length,
      });

      setRecentSales(recentSalesData || []);
      setRecentActivity(activityData || []);

      // Weekly chart data
      const days: { day: string; sales: number; profit: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        const { data: daySales } = await supabase.from('sales')
          .select('total').gte('created_at', d.toISOString()).lt('created_at', next.toISOString());
        const dayTotal = (daySales || []).reduce((s, r) => s + Number(r.total), 0);
        days.push({
          day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
          sales: dayTotal,
          profit: dayTotal * 0.15,
        });
      }
      setWeeklyData(days);
    } finally {
      setLoading(false);
    }
  }

  const statCards = stats ? [
    { title: "Today's Sales", value: formatCurrency(stats.todaySales, sym), icon: TrendingUp, color: 'emerald', sub: isAdmin ? `Profit: ${formatCurrency(stats.todayProfit, sym)}` : undefined },
    { title: 'Monthly Sales', value: formatCurrency(stats.monthlySales, sym), icon: BarChart2, color: 'blue', sub: isAdmin ? `Profit: ${formatCurrency(stats.monthlyProfit, sym)}` : undefined },
    { title: 'Total Products', value: stats.totalProducts.toString(), icon: Package, color: 'violet', sub: `Stock units: ${stats.availableStock}` },
    { title: 'Credit Pending', value: formatCurrency(stats.creditPending, sym), icon: CreditCard, color: 'amber', sub: 'Udhar outstanding' },
    { title: 'Low Stock', value: stats.lowStockCount.toString(), icon: AlertTriangle, color: 'orange', sub: `${stats.outOfStockCount} out of stock`, link: '/low-stock' },
    { title: 'Expiring Soon', value: stats.expiringSoonCount.toString(), icon: Clock, color: 'red', sub: `${stats.expiredCount} already expired`, link: '/expiry' },
  ] : [];

  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    violet: 'text-violet-400 bg-violet-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    orange: 'text-orange-400 bg-orange-400/10',
    red: 'text-red-400 bg-red-400/10',
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-white gap-2 shadow-lg shadow-emerald-500/20">
          <Link href="/pos"><Scan className="w-4 h-4" />New Sale</Link>
        </Button>
        <Button asChild variant="outline" className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 gap-2">
          <Link href="/products/new"><Plus className="w-4 h-4" />Add Product</Link>
        </Button>
        <Button asChild variant="outline" className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 gap-2">
          <Link href="/customers"><Users className="w-4 h-4" />Customers</Link>
        </Button>
        <Button asChild variant="outline" className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 gap-2">
          <Link href="/credit"><CreditCard className="w-4 h-4" />Credit Sales</Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-2/3 bg-slate-800" />
                  <Skeleton className="h-7 w-1/2 bg-slate-800" />
                  <Skeleton className="h-3 w-full bg-slate-800" />
                </CardContent>
              </Card>
            ))
          : statCards.map((card) => {
              const Icon = card.icon;
              const colorClass = colorMap[card.color];
              return (
                <Card key={card.title} className={`bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors ${card.link ? 'cursor-pointer' : ''}`}>
                  {card.link ? (
                    <Link href={card.link}>
                      <CardContent className="p-4">
                        <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center mb-3`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <p className="text-xs text-slate-400 mb-1">{card.title}</p>
                        <p className="text-xl font-bold text-white">{card.value}</p>
                        <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
                      </CardContent>
                    </Link>
                  ) : (
                    <CardContent className="p-4">
                      <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center mb-3`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="text-xs text-slate-400 mb-1">{card.title}</p>
                      <p className="text-xl font-bold text-white">{card.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white">Weekly Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 bg-slate-800 rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                    formatter={(val: number) => [formatCurrency(val, sym), 'Sales']}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#10b981" fill="url(#salesGrad)" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white">Daily Profit (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 bg-slate-800 rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                    formatter={(val: number) => [formatCurrency(val, sym), 'Profit']}
                  />
                  <Bar dataKey="profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* Recent Sales + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-white">Recent Sales</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white h-7">
              <Link href="/sales">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 bg-slate-800 rounded-lg" />
                ))}
              </div>
            ) : recentSales.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No sales yet</div>
            ) : (
              <div className="divide-y divide-slate-800">
                {recentSales.map(sale => (
                  <div key={sale.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-white">{sale.invoice_number}</p>
                      <p className="text-xs text-slate-400">{sale.customer_name || 'Walk-in'} &middot; {formatDateTime(sale.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-400">{formatCurrency(sale.total, sym)}</p>
                      <Badge variant="secondary" className={`text-xs border-0 ${
                        sale.payment_method === 'credit' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {sale.payment_method}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-white">Recent Activity</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white h-7">
              <Link href="/activity">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 bg-slate-800 rounded-lg" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No activity yet</div>
            ) : (
              <div className="divide-y divide-slate-800">
                {recentActivity.map(log => (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{log.action}</p>
                      <p className="text-xs text-slate-400">{log.user_name} &middot; {formatDateTime(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
