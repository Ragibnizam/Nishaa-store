'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ActivityLog } from '@/lib/types';
import { formatDateTime } from '@/lib/utils-app';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const ENTITY_COLORS: Record<string, string> = {
  product: 'bg-blue-500/15 text-blue-400',
  sale: 'bg-emerald-500/15 text-emerald-400',
  purchase: 'bg-violet-500/15 text-violet-400',
  customer: 'bg-amber-500/15 text-amber-400',
  credit_sale: 'bg-red-500/15 text-red-400',
  auth: 'bg-slate-500/15 text-slate-400',
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(300);
    setLogs(data || []);
    setLoading(false);
  }

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.action.toLowerCase().includes(q) || (l.user_name || '').toLowerCase().includes(q);
    const matchEntity = filterEntity === 'all' || l.entity_type === filterEntity;
    return matchSearch && matchEntity;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activity..." className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-9" />
        </div>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-300 h-9"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="product">Products</SelectItem>
            <SelectItem value="sale">Sales</SelectItem>
            <SelectItem value="purchase">Purchases</SelectItem>
            <SelectItem value="customer">Customers</SelectItem>
            <SelectItem value="credit_sale">Credit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <div className="divide-y divide-slate-800">
          {loading ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3"><Skeleton className="h-10 bg-slate-800 rounded" /></div>
          )) : filtered.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No activity found</p>
            </div>
          ) : filtered.map(log => (
            <div key={log.id} className="flex items-start gap-4 px-4 py-3 hover:bg-slate-800/40 transition-colors">
              <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{log.action}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  <span className="text-slate-300">{log.user_name || 'System'}</span>
                  {' · '}{formatDateTime(log.created_at)}
                </p>
              </div>
              <Badge className={cn('text-xs border-0 flex-shrink-0', ENTITY_COLORS[log.entity_type] || 'bg-slate-500/15 text-slate-400')}>
                {log.entity_type}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
