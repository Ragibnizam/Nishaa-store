'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, Category } from '@/lib/types';
import { formatCurrency, formatDate, getDaysUntilExpiry, getStockStatus, generateBarcode, logActivity } from '@/lib/utils-app';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus, Search, Package, Edit2, Trash2, Barcode, Filter,
  SortAsc, Camera, Image as ImageIcon, X, Copy, Printer, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import BarcodeDisplay from '@/components/BarcodeDisplay';
import Link from 'next/link';

const STOCK_COLORS = {
  out: 'bg-red-500/15 text-red-400 border-red-500/20',
  low: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  ok: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStock, setFilterStock] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'created_at'>('created_at');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const { isAdmin, user, profile } = useAuth();
  const { settings } = useSettings();
  const sym = settings?.currency_symbol || '₹';

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
    setLoading(false);
  }

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      (p.company || '').toLowerCase().includes(q) ||
      (p.category as any)?.name?.toLowerCase().includes(q);
    const matchCategory = filterCategory === 'all' || p.category_id === filterCategory;
    const stockStatus = getStockStatus(p.quantity, p.min_stock_alert);
    const matchStock = filterStock === 'all' ||
      (filterStock === 'out' && stockStatus === 'out') ||
      (filterStock === 'low' && stockStatus === 'low') ||
      (filterStock === 'ok' && stockStatus === 'ok');
    return matchSearch && matchCategory && matchStock;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'quantity') return a.quantity - b.quantity;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  async function handleDelete(product: Product) {
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) { toast.error('Failed to delete product'); return; }
    toast.success('Product deleted');
    await logActivity({ action: 'Product Deleted', entity_type: 'product', entity_id: product.id, details: { name: product.name }, user_name: profile?.full_name });
    setDeleteProduct(null);
    loadData();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-slate-400 text-sm mt-0.5">{products.length} products total</p>
        </div>
        <Button
          onClick={() => { setEditProduct(null); setShowForm(true); }}
          className="bg-emerald-500 hover:bg-emerald-400 text-white gap-2 shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, barcode, company..."
            className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-300 h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStock} onValueChange={setFilterStock}>
          <SelectTrigger className="w-36 bg-slate-900 border-slate-700 text-slate-300 h-9">
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="ok">In Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-36 bg-slate-900 border-slate-700 text-slate-300 h-9">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="created_at">Latest</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="quantity">Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      <Card className="bg-slate-900 border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Barcode</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Price</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Expiry</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-10 bg-slate-800 rounded" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-28 bg-slate-800 rounded" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20 bg-slate-800 rounded ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-6 w-16 bg-slate-800 rounded mx-auto" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-24 bg-slate-800 rounded" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-20 bg-slate-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No products found</p>
                    {search && <p className="text-slate-500 text-xs mt-1">Try a different search term</p>}
                  </td>
                </tr>
              ) : (
                filtered.map(product => {
                  const stockStatus = getStockStatus(product.quantity, product.min_stock_alert);
                  const daysToExpiry = product.expiry_date ? getDaysUntilExpiry(product.expiry_date) : null;
                  return (
                    <tr key={product.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-9 h-9 rounded-lg object-cover bg-slate-800 flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-slate-500" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">{product.name}</p>
                            <p className="text-xs text-slate-400">{product.company || (product.category as any)?.name || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="font-mono text-xs text-slate-400">{product.barcode}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm font-semibold text-white">{formatCurrency(product.selling_price, sym)}</p>
                        <p className="text-xs text-slate-500">Cost: {formatCurrency(product.purchase_price, sym)}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge className={cn('text-xs border', STOCK_COLORS[stockStatus])}>
                            {product.quantity}
                          </Badge>
                          {stockStatus !== 'ok' && (
                            <span className="text-xs text-slate-500">min: {product.min_stock_alert}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {product.expiry_date ? (
                          <span className={cn('text-xs', daysToExpiry !== null && daysToExpiry < 0 ? 'text-red-400' : daysToExpiry !== null && daysToExpiry <= 30 ? 'text-amber-400' : 'text-slate-400')}>
                            {daysToExpiry !== null && daysToExpiry < 0 ? 'Expired' : formatDate(product.expiry_date)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 text-slate-400 hover:text-blue-400"
                            onClick={() => setBarcodeProduct(product)}
                            title="Print barcode"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 text-slate-400 hover:text-amber-400"
                            onClick={() => { setEditProduct(product); setShowForm(true); }}
                            title="Edit product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-7 h-7 text-slate-400 hover:text-red-400"
                              onClick={() => setDeleteProduct(product)}
                              title="Delete product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Product Form Dialog */}
      {showForm && (
        <ProductFormDialog
          product={editProduct}
          categories={categories}
          onClose={() => { setShowForm(false); setEditProduct(null); }}
          onSaved={loadData}
          userId={user?.id}
          profile={profile}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Product</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete <strong className="text-white">{deleteProduct?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => deleteProduct && handleDelete(deleteProduct)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Barcode Dialog */}
      {barcodeProduct && (
        <BarcodePrintDialog
          product={barcodeProduct}
          storeName={settings?.store_name || 'Nisha Store'}
          currencySymbol={sym}
          onClose={() => setBarcodeProduct(null)}
        />
      )}
    </div>
  );
}

function ProductFormDialog({
  product, categories, onClose, onSaved, userId, profile
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  userId?: string;
  profile: any;
}) {
  const [form, setForm] = useState({
    name: product?.name || '',
    company: product?.company || '',
    category_id: product?.category_id || '',
    description: product?.description || '',
    purchase_price: product?.purchase_price?.toString() || '',
    selling_price: product?.selling_price?.toString() || '',
    quantity: product?.quantity?.toString() || '0',
    min_stock_alert: product?.min_stock_alert?.toString() || '5',
    mfg_date: product?.mfg_date || '',
    expiry_date: product?.expiry_date || '',
    image_url: product?.image_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState(product?.image_url || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const url = e.target?.result as string;
      setImagePreview(url);
      setForm(f => ({ ...f, image_url: url }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.name || !form.selling_price) {
      toast.error('Name and selling price are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        company: form.company.trim() || null,
        category_id: form.category_id || null,
        description: form.description.trim() || null,
        purchase_price: parseFloat(form.purchase_price) || 0,
        selling_price: parseFloat(form.selling_price),
        quantity: parseInt(form.quantity) || 0,
        min_stock_alert: parseInt(form.min_stock_alert) || 5,
        mfg_date: form.mfg_date || null,
        expiry_date: form.expiry_date || null,
        image_url: form.image_url || null,
        updated_by: userId,
      };

      if (product) {
        const { error } = await supabase.from('products').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', product.id);
        if (error) throw error;
        toast.success('Product updated');
        await logActivity({ action: 'Product Updated', entity_type: 'product', entity_id: product.id, details: { name: form.name }, user_name: profile?.full_name });
      } else {
        const newId = crypto.randomUUID();
        const barcode = generateBarcode(newId);
        const { error } = await supabase.from('products').insert({
          ...payload,
          id: newId,
          barcode,
          created_by: userId,
        });
        if (error) throw error;
        toast.success('Product added');
        await logActivity({ action: 'Product Added', entity_type: 'product', entity_id: newId, details: { name: form.name }, user_name: profile?.full_name });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          {/* Image */}
          <div className="md:col-span-2">
            <Label className="text-slate-300 text-sm mb-2 block">Product Image</Label>
            <div className="flex gap-3 items-start">
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-20 h-20 rounded-xl object-cover border border-slate-700" />
                  <button
                    onClick={() => { setImagePreview(''); setForm(f => ({ ...f, image_url: '' })); }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border border-dashed border-slate-600 flex items-center justify-center bg-slate-800">
                  <ImageIcon className="w-7 h-7 text-slate-500" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:text-white gap-2 h-8"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="w-3.5 h-3.5" />Camera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:text-white gap-2 h-8"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="w-3.5 h-3.5" />Gallery
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Product Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Parachute Coconut Oil" className="bg-slate-800 border-slate-700 text-white h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Company / Brand</Label>
            <Input value={form.company} onChange={e => set('company', e.target.value)} placeholder="e.g. Marico" className="bg-slate-800 border-slate-700 text-white h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Category</Label>
            <Select value={form.category_id} onValueChange={v => set('category_id', v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-9">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Description</Label>
            <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional" className="bg-slate-800 border-slate-700 text-white h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Purchase Price *</Label>
            <Input type="number" min="0" step="0.01" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} placeholder="0.00" className="bg-slate-800 border-slate-700 text-white h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Selling Price *</Label>
            <Input type="number" min="0" step="0.01" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} placeholder="0.00" className="bg-slate-800 border-slate-700 text-white h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Quantity</Label>
            <Input type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="0" className="bg-slate-800 border-slate-700 text-white h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Min Stock Alert</Label>
            <Input type="number" min="0" value={form.min_stock_alert} onChange={e => set('min_stock_alert', e.target.value)} placeholder="5" className="bg-slate-800 border-slate-700 text-white h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Manufacturing Date</Label>
            <Input type="date" value={form.mfg_date} onChange={e => set('mfg_date', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Expiry Date</Label>
            <Input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300 hover:text-white">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-white">
            {saving ? 'Saving...' : (product ? 'Update Product' : 'Add Product')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BarcodePrintDialog({
  product, storeName, currencySymbol, onClose
}: {
  product: Product;
  storeName: string;
  currencySymbol: string;
  onClose: () => void;
}) {
  const [copies, setCopies] = useState(1);
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank', 'width=600,height=400');
    if (!w) return;
    w.document.write(`
      <html><head><title>Barcode - ${product.name}</title>
      <style>
        body { font-family: monospace; margin: 0; padding: 10px; }
        .label { display: inline-block; border: 1px solid #ccc; padding: 8px 12px; margin: 4px; text-align: center; page-break-inside: avoid; }
        .store { font-size: 10px; font-weight: bold; }
        .prod { font-size: 9px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .price { font-size: 11px; font-weight: bold; margin-top: 2px; }
        .bc-num { font-size: 8px; color: #666; margin-top: 2px; }
        svg { display: block; margin: 4px auto; }
      </style>
      </head><body>
    `);
    for (let i = 0; i < copies; i++) {
      w.document.write(content.innerHTML);
    }
    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle>Print Barcode</DialogTitle>
        </DialogHeader>
        <div className="py-4 flex flex-col items-center gap-4">
          <div ref={printRef} className="label bg-white text-black p-3 rounded border text-center">
            <div className="store text-xs font-bold">{storeName}</div>
            <BarcodeDisplay value={product.barcode} />
            <div className="prod text-xs max-w-32 truncate">{product.name}</div>
            <div className="price text-sm font-bold">{currencySymbol}{product.selling_price}</div>
            <div className="bc-num text-xs text-gray-500 font-mono">{product.barcode}</div>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-slate-300 text-sm">Copies:</Label>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="w-7 h-7 border-slate-700" onClick={() => setCopies(Math.max(1, copies - 1))}>-</Button>
              <span className="text-white font-mono w-6 text-center">{copies}</span>
              <Button size="icon" variant="outline" className="w-7 h-7 border-slate-700" onClick={() => setCopies(copies + 1)}>+</Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300 hover:text-white">Cancel</Button>
          <Button onClick={handlePrint} className="bg-blue-500 hover:bg-blue-400 text-white gap-2">
            <Printer className="w-4 h-4" />Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
