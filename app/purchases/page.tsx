'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Purchase, Product } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, logActivity } from '@/lib/utils-app';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Truck, Package } from 'lucide-react';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const sym = settings?.currency_symbol || '₹';

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: p }, { data: prod }] = await Promise.all([
      supabase.from('purchases').select('*, product:products(id, name, barcode, quantity)').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('name').eq('is_active', true),
    ]);
    setPurchases(p || []);
    setProducts(prod || []);
    setLoading(false);
  }

  const filtered = purchases.filter(p => {
    const q = search.toLowerCase();
    const prod = p.product as any;
    return !q || (prod?.name || '').toLowerCase().includes(q) || (p.supplier_name || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-400 text-sm">{purchases.length} purchase records</p>
        <Button onClick={() => setShowForm(true)} className="bg-emerald-500 hover:bg-emerald-400 text-white gap-2 shadow-lg shadow-emerald-500/20">
          <Plus className="w-4 h-4" />Add Purchase / Restock
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or supplier..." className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-9" />
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Supplier</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Qty Added</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Purchase Price</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Total Cost</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-10 bg-slate-800 rounded" /></td></tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center">
                  <Truck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No purchase records</p>
                </td></tr>
              ) : filtered.map(p => {
                const prod = p.product as any;
                return (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{prod?.name || '—'}</p>
                        <p className="text-xs text-slate-400 font-mono">{prod?.barcode}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell"><span className="text-sm text-slate-300">{p.supplier_name || '—'}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-sm font-semibold text-emerald-400">+{p.quantity}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-sm text-slate-300">{formatCurrency(p.purchase_price, sym)}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-sm font-medium text-white">{formatCurrency(p.purchase_price * p.quantity, sym)}</span></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><span className="text-xs text-slate-400">{formatDate(p.purchase_date)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {showForm && <PurchaseFormDialog products={products} userId={user?.id} profile={profile} sym={sym} onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function PurchaseFormDialog({ products, userId, profile, sym, onClose, onSaved }: { products: Product[]; userId?: string; profile: any; sym: string; onClose: () => void; onSaved: () => void }) {
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [prodSearch, setProdSearch] = useState('');
  const [showProdList, setShowProdList] = useState(false);

  const selectedProduct = products.find(p => p.id === productId);
  const filteredProds = prodSearch ? products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.barcode.toLowerCase().includes(prodSearch.toLowerCase())) : products.slice(0, 8);

  function selectProduct(p: Product) {
    setProductId(p.id);
    setProdSearch(p.name);
    setPrice(p.purchase_price.toString());
    setShowProdList(false);
  }

  async function save() {
    if (!productId || !qty || !price) { toast.error('Product, quantity and price are required'); return; }
    setSaving(true);
    const { error } = await supabase.from('purchases').insert({
      product_id: productId,
      quantity: parseInt(qty),
      purchase_price: parseFloat(price),
      supplier_name: supplier.trim() || null,
      purchase_date: date,
      notes: notes.trim() || null,
      created_by: userId,
    });
    if (error) { toast.error('Failed to add purchase'); setSaving(false); return; }
    toast.success('Stock added successfully');
    await logActivity({ action: 'Stock Updated (Purchase)', entity_type: 'purchase', details: { product_id: productId, quantity: qty }, user_name: profile?.full_name });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader><DialogTitle>Add Purchase / Restock</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5 relative">
            <Label className="text-slate-300 text-sm">Product *</Label>
            <Input
              value={prodSearch} placeholder="Search product by name or barcode..."
              onChange={e => { setProdSearch(e.target.value); setShowProdList(true); if (!e.target.value) setProductId(''); }}
              onFocus={() => setShowProdList(true)}
              className="bg-slate-800 border-slate-700 text-white h-9"
            />
            {showProdList && filteredProds.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 mt-1 max-h-48 overflow-y-auto">
                {filteredProds.map(p => (
                  <button key={p.id} onClick={() => selectProduct(p)} className="w-full px-3 py-2 text-left hover:bg-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-sm text-white">{p.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{p.barcode} · Stock: {p.quantity}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedProduct && (
              <p className="text-xs text-emerald-400">Current stock: {selectedProduct.quantity} units</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Quantity *</Label>
              <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Purchase Price ({sym}) *</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Supplier Name</Label>
              <Input value={supplier} onChange={e => setSupplier(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Purchase Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" className="bg-slate-800 border-slate-700 text-white h-9" />
          </div>
          {qty && price && (
            <div className="bg-slate-800 rounded-xl p-3 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Total Cost</span>
                <span className="font-semibold text-white">{formatCurrency(parseFloat(qty) * parseFloat(price), sym)}</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-white">{saving ? 'Saving...' : 'Add Stock'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
