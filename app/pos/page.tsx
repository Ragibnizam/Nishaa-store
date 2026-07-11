'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Product, Customer, CartItem } from '@/lib/types';
import { formatCurrency, generateInvoiceNumber, logActivity } from '@/lib/utils-app';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Scan, Search, Plus, Minus, Trash2, ShoppingCart, Printer,
  User, CreditCard, Banknote, Smartphone, DollarSign, Package,
  CheckCircle, X, Receipt, Phone, UserCheck, UserPlus, MapPin, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CameraScanner = dynamic(() => import('@/components/CameraScanner'), { ssr: false });

type PaymentMethod = 'cash' | 'upi' | 'card' | 'mixed';
type SaleType = 'normal' | 'without_bill';
type CheckoutSaleType = 'paid' | 'credit';

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [saleType, setSaleType] = useState<SaleType>('normal');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [checkoutSaleType, setCheckoutSaleType] = useState<CheckoutSaleType>('paid');
  const [creditPaidAmount, setCreditPaidAmount] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [upiAmount, setUpiAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [custMobile, setCustMobile] = useState('');
  const [custName, setCustName] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custLookupStatus, setCustLookupStatus] = useState<'idle' | 'searching' | 'found' | 'new'>('idle');
  const [custIsNew, setCustIsNew] = useState(false);
  const [billCustomer, setBillCustomer] = useState<Customer | null>(null);
  const mobileDebounce = useRef<NodeJS.Timeout>();
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const sym = settings?.currency_symbol || '₹';
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchDebounce = useRef<NodeJS.Timeout>();

  const subtotal = cart.reduce((s, item) => s + item.product.selling_price * item.quantity - item.discount_amount, 0);
  const discountAmount = discountType === 'percentage' ? subtotal * (discountValue / 100) : discountValue;
  const total = Math.max(0, subtotal - discountAmount);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  function handleBarcodeInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const val = (e.target as HTMLInputElement).value.trim();
      if (val) {
        addByBarcode(val);
        (e.target as HTMLInputElement).value = '';
      }
    }
  }

  function handleCameraScan(barcode: string) {
    setShowCamera(false);
    addByBarcode(barcode);
    toast.success(`Scanned: ${barcode}`, { duration: 1500 });
  }

  async function addByBarcode(barcode: string) {
    const { data } = await supabase.from('products').select('*').eq('barcode', barcode.toUpperCase()).maybeSingle();
    if (!data) {
      toast.error(`Product not found: ${barcode}`);
      return;
    }
    addToCart(data);
  }

  function addToCart(product: Product) {
    if (product.quantity === 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast.warning(`Only ${product.quantity} units available`);
          return prev;
        }
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, discount_amount: 0 }];
    });
    toast.success(`${product.name} added`, { duration: 1000 });
  }

  function updateQuantity(productId: string, delta: number) {
    setCart(prev => prev.map(item => {
      if (item.product.id !== productId) return item;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return item;
      if (newQty > item.product.quantity) {
        toast.warning(`Only ${item.product.quantity} available`);
        return item;
      }
      return { ...item, quantity: newQty };
    }));
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }

  async function searchProducts(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    const { data } = await supabase.from('products')
      .select('*')
      .or(`name.ilike.%${q}%,barcode.ilike.%${q}%,company.ilike.%${q}%`)
      .eq('is_active', true)
      .gt('quantity', 0)
      .limit(8);
    setSearchResults(data || []);
  }

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => searchProducts(q), 200);
  }

  async function searchCustomers(q: string) {
    if (!q) { setCustomers([]); return; }
    const { data } = await supabase.from('customers').select('*')
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(6);
    setCustomers(data || []);
  }

  async function lookupCustomerByMobile(mobile: string) {
    if (!mobile || mobile.trim().length < 7) {
      setCustLookupStatus('idle');
      setCustIsNew(false);
      return;
    }
    setCustLookupStatus('searching');
    const { data } = await supabase.from('customers').select('*').eq('phone', mobile.trim()).maybeSingle();
    if (data) {
      setCustName(data.name);
      setCustAddress(data.address || '');
      setBillCustomer(data);
      setCustIsNew(false);
      setCustLookupStatus('found');
    } else {
      setBillCustomer(null);
      setCustIsNew(true);
      setCustLookupStatus('new');
    }
  }

  function handleMobileChange(value: string) {
    setCustMobile(value);
    clearTimeout(mobileDebounce.current);
    if (value.trim().length >= 7) {
      mobileDebounce.current = setTimeout(() => lookupCustomerByMobile(value), 400);
    } else {
      setCustLookupStatus('idle');
      setCustIsNew(false);
      setBillCustomer(null);
    }
  }

  function openCustomerModal() {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (saleType === 'normal') {
      setCustMobile('');
      setCustName('');
      setCustAddress('');
      setCustLookupStatus('idle');
      setCustIsNew(false);
      setBillCustomer(null);
      setShowCustomerModal(true);
    } else {
      setShowCheckout(true);
    }
  }

  function confirmCustomerAndProceed() {
    if (!custMobile.trim()) { toast.error('Enter customer mobile number'); return; }
    if (!custName.trim()) { toast.error('Enter customer name'); return; }
    setSelectedCustomer(billCustomer);
    if (!billCustomer) {
      setSelectedCustomer({
        id: '', name: custName.trim(), phone: custMobile.trim(),
        address: custAddress.trim(), credit_balance: 0, total_purchases: 0,
      } as Customer);
    }
    setShowCustomerModal(false);
    setShowCheckout(true);
  }

  async function handleCompleteSale() {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (saleType === 'normal' && !selectedCustomer) {
      toast.error('Customer details required for With Bill sale');
      return;
    }
    if (saleType === 'normal' && checkoutSaleType === 'credit' && !selectedCustomer) {
      toast.error('Customer is required for credit sales');
      return;
    }
    if (checkoutSaleType === 'credit') {
      const paid = parseFloat(creditPaidAmount) || 0;
      if (paid > total) {
        toast.error('Paid amount cannot exceed total');
        return;
      }
    }
    setProcessing(true);
    try {
      let customerId = selectedCustomer?.id || null;
      let customerName = selectedCustomer?.name || null;
      let customerPhone = selectedCustomer?.phone || null;

      // Auto-create new customer for With Bill sales
      if (saleType === 'normal' && selectedCustomer && !selectedCustomer.id) {
        const { data: newCust, error: custErr } = await supabase.from('customers').insert({
          name: selectedCustomer.name,
          phone: selectedCustomer.phone,
          address: selectedCustomer.address || null,
          created_by: user?.id,
        }).select().single();
        if (custErr) throw custErr;
        customerId = newCust.id;
        customerName = newCust.name;
        customerPhone = newCust.phone;
      }

      const isCredit = checkoutSaleType === 'credit';
      const paidAmt = isCredit ? (parseFloat(creditPaidAmount) || 0) : total;
      const remainingAmt = Math.max(0, total - paidAmt);

      const invoiceNumber = generateInvoiceNumber(settings?.invoice_prefix || 'INV');
      const salePayload = {
        invoice_number: invoiceNumber,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        sale_type: saleType,
        subtotal,
        discount_type: discountValue > 0 ? discountType : null,
        discount_value: discountValue,
        discount_amount: discountAmount,
        total,
        paid_amount: paidAmt,
        payment_method: isCredit ? 'credit' : paymentMethod,
        is_credit: isCredit,
        created_by: user?.id,
      };

      const { data: sale, error: saleErr } = await supabase
        .from('sales').insert(salePayload).select().single();
      if (saleErr) throw saleErr;

      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        product_name: item.product.name,
        barcode: item.product.barcode,
        quantity: item.quantity,
        purchase_price: item.product.purchase_price,
        selling_price: item.product.selling_price,
        discount_amount: item.discount_amount,
        total: item.product.selling_price * item.quantity - item.discount_amount,
      }));

      const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems);
      if (itemsErr) throw itemsErr;

      // Create credit sale if needed
      if (isCredit && customerId) {
        const creditStatus = remainingAmt === 0 ? 'paid' : (paidAmt > 0 ? 'partial' : 'pending');
        const { data: creditSale } = await supabase.from('credit_sales').insert({
          sale_id: sale.id,
          customer_id: customerId,
          total_amount: total,
          paid_amount: paidAmt,
          remaining_amount: remainingAmt,
          due_date: creditDueDate || null,
          status: creditStatus,
          created_by: user?.id,
        }).select().single();
        // Record initial partial payment if any was made at sale time
        if (paidAmt > 0 && creditSale) {
          await supabase.from('credit_payments').insert({
            credit_sale_id: creditSale.id,
            customer_id: customerId,
            amount: paidAmt,
            payment_method: paymentMethod,
            notes: 'Initial payment at sale',
            created_by: user?.id,
          });
        }
        await supabase.from('customers').update({
          credit_balance: (selectedCustomer?.credit_balance || 0) + remainingAmt,
          total_purchases: (selectedCustomer?.total_purchases || 0) + total,
          updated_at: new Date().toISOString(),
        }).eq('id', customerId);
      } else if (customerId) {
        await supabase.from('customers').update({
          total_purchases: (selectedCustomer?.total_purchases || 0) + total,
          updated_at: new Date().toISOString(),
        }).eq('id', customerId);
      }

      await logActivity({
        action: `Sale Created - ${invoiceNumber}`,
        entity_type: 'sale',
        entity_id: sale.id,
        details: { total, items: cart.length, payment_method: paymentMethod },
        user_name: profile?.full_name,
      });

      const saleCustomer = customerId ? { ...selectedCustomer, id: customerId } : null;
      setLastSale({ ...sale, items: cart, customer: saleCustomer });
      setCart([]);
      setSelectedCustomer(null);
      setBillCustomer(null);
      setCustMobile('');
      setCustName('');
      setCustAddress('');
      setDiscountValue(0);
      setPaymentMethod('cash');
      setCheckoutSaleType('paid');
      setCreditPaidAmount('');
      setCashReceived('');
      setShowCheckout(false);
      setShowSuccess(true);
      toast.success(`Sale completed! ${invoiceNumber}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete sale');
    } finally {
      setProcessing(false);
    }
  }

  function printBill() {
    if (!lastSale) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const items = lastSale.items.map((item: CartItem) =>
      `<tr><td>${item.product.name}</td><td style="text-align:right">${item.quantity}</td><td style="text-align:right">${sym}${item.product.selling_price}</td><td style="text-align:right">${sym}${(item.product.selling_price * item.quantity).toFixed(2)}</td></tr>`
    ).join('');
    w.document.write(`<html><head><title>Invoice</title><style>
      body{font-family:sans-serif;max-width:400px;margin:20px auto;font-size:13px}
      h2{text-align:center;margin:0}p{margin:2px 0;text-align:center}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{padding:5px;border-bottom:1px solid #eee}th{background:#f5f5f5}
      .total{font-size:15px;font-weight:bold}.footer{text-align:center;font-size:11px;color:#666}
      @media print{.no-print{display:none}}
    </style></head><body>
    <h2>${settings?.store_name || 'Nisha Store'}</h2>
    <p>${settings?.store_address || ''}</p><p>${settings?.store_phone || ''}</p>
    <hr/>
    <p>Invoice: <b>${lastSale.invoice_number}</b></p>
    <p>Date: ${new Date(lastSale.created_at || Date.now()).toLocaleString('en-IN')}</p>
    ${lastSale.customer ? `<p>Customer: ${lastSale.customer.name} (${lastSale.customer.phone || ''})</p>` : ''}
    <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>${items}</tbody></table>
    <hr/>
    <p>Subtotal: ${sym}${lastSale.subtotal?.toFixed(2) || subtotal.toFixed(2)}</p>
    ${lastSale.discount_amount > 0 ? `<p>Discount: -${sym}${Number(lastSale.discount_amount).toFixed(2)}</p>` : ''}
    <p class="total">Total: ${sym}${Number(lastSale.total).toFixed(2)}</p>
    <p>Payment: ${lastSale.payment_method?.toUpperCase()}</p>
    <hr/>
    <p class="footer">${settings?.invoice_footer || 'Thank you for shopping!'}</p>
    <button class="no-print" onclick="window.print();window.close()">Print</button>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }


  return (
    <div className="h-[calc(100vh-3.5rem-2rem)] flex gap-4">
      {/* Left: Product Search */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Top bar */}
        <div className="flex gap-3">
          {/* Camera scan button */}
          <button
            onClick={() => setShowCamera(true)}
            className="flex-shrink-0 w-10 h-10 bg-emerald-500 hover:bg-emerald-400 rounded-lg flex items-center justify-center text-white transition-colors shadow-lg shadow-emerald-500/20"
            title="Open camera scanner"
          >
            <Scan className="w-5 h-5" />
          </button>
          {/* Barcode input */}
          <div className="relative flex-1">
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Type/scan barcode + Enter..."
              className="w-full px-4 h-10 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500"
              onKeyDown={handleBarcodeInput}
            />
          </div>
          {/* Sale type toggle */}
          <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5 gap-0.5">
            {(['normal', 'without_bill'] as SaleType[]).map(t => (
              <button
                key={t}
                onClick={() => setSaleType(t)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', saleType === t ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white')}
              >
                {t === 'normal' ? 'With Bill' : 'Quick Sale'}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => setShowSearch(true)}
            placeholder="Search products by name, barcode, company..."
            className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-10"
          />
          {showSearch && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 mt-1 overflow-hidden">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => { addToCart(p); setSearchQuery(''); setSearchResults([]); setShowSearch(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors text-left"
                >
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-9 h-9 rounded-lg object-cover bg-slate-700 flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.barcode} &middot; Stock: {p.quantity}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-emerald-400">{formatCurrency(p.selling_price, sym)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <Card className="bg-slate-900 border-slate-800 flex-1 overflow-hidden flex flex-col">
          <CardHeader className="py-3 px-4 border-b border-slate-800 flex-shrink-0">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              Cart <Badge className="bg-emerald-500/15 text-emerald-400 border-0 text-xs">{cart.length} items</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-slate-500">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-1">Scan a barcode or search for products</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.product.name}</p>
                      <p className="text-xs text-slate-400">{formatCurrency(item.product.selling_price, sym)} each</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 flex items-center justify-center text-xs">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-white font-mono text-sm w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 flex items-center justify-center text-xs">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="w-20 text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-white">{formatCurrency(item.product.selling_price * item.quantity - item.discount_amount, sym)}</p>
                    </div>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 ml-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Order Summary */}
      <div className="w-80 flex flex-col gap-4 flex-shrink-0">
        {/* Customer (normal sale only) */}
        {saleType === 'normal' && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 space-y-3">
              <Label className="text-slate-300 text-xs uppercase tracking-wider">Customer</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{selectedCustomer.name}</p>
                    <p className="text-xs text-slate-400">{selectedCustomer.phone}</p>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-slate-500 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); searchCustomers(e.target.value); }}
                    placeholder="Search customer..."
                    className="pl-8 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-8 text-sm"
                  />
                  {customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 mt-1">
                      {customers.map(c => (
                        <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomers([]); }} className="w-full px-3 py-2 text-left hover:bg-slate-800 text-sm text-white">
                          {c.name} <span className="text-slate-400 text-xs">· {c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Order Summary */}
        <Card className="bg-slate-900 border-slate-800 flex-1">
          <CardContent className="p-4 space-y-4">
            <Label className="text-slate-300 text-xs uppercase tracking-wider">Order Summary</Label>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal ({cart.length} items)</span>
                <span>{formatCurrency(subtotal, sym)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmount, sym)}</span>
                </div>
              )}
              <Separator className="bg-slate-700" />
              <div className="flex justify-between text-white font-bold text-base">
                <span>Total</span>
                <span>{formatCurrency(total, sym)}</span>
              </div>
            </div>

            {/* Discount */}
            <div className="space-y-2">
              <Label className="text-slate-400 text-xs">Discount</Label>
              <div className="flex gap-2">
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger className="w-28 bg-slate-800 border-slate-700 text-slate-300 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="fixed">Fixed {sym}</SelectItem>
                    <SelectItem value="percentage">Percent %</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number" min="0" value={discountValue || ''}
                  onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="flex-1 bg-slate-800 border-slate-700 text-white h-8 text-sm"
                />
              </div>
            </div>

            <Button
              onClick={openCustomerModal}
              disabled={cart.length === 0}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white h-11 text-base font-semibold shadow-lg shadow-emerald-500/20"
            >
              Checkout {cart.length > 0 && `· ${formatCurrency(total, sym)}`}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Camera Scanner */}
      {showCamera && (
        <CameraScanner
          onDetected={handleCameraScan}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Customer Details Modal (With Bill) */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Customer Details</DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter mobile number to find existing customer or add a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Mobile Number */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Mobile Number *</Label>
              <div className="relative">
                <Input
                  type="tel"
                  value={custMobile}
                  onChange={(e) => handleMobileChange(e.target.value)}
                  placeholder="Enter 10-digit mobile number"
                  className="bg-slate-800 border-slate-700 text-white pl-10"
                  maxLength={10}
                />
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                {custLookupStatus === 'searching' && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                )}
              </div>
              {/* Status indicator */}
              {custLookupStatus === 'found' && billCustomer && (
                <div className="flex items-center gap-2 text-emerald-400 text-xs mt-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
                  <UserCheck className="w-4 h-4" />
                  <span>Existing customer found — details auto-filled</span>
                </div>
              )}
              {custLookupStatus === 'new' && (
                <div className="flex items-center gap-2 text-amber-400 text-xs mt-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                  <UserPlus className="w-4 h-4" />
                  <span>New customer — enter name to save</span>
                </div>
              )}
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Customer Name *</Label>
              <div className="relative">
                <Input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Enter customer name"
                  className="bg-slate-800 border-slate-700 text-white pl-10"
                  disabled={custLookupStatus === 'found'}
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Address (optional)</Label>
              <div className="relative">
                <Input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="Enter address"
                  className="bg-slate-800 border-slate-700 text-white pl-10"
                  disabled={custLookupStatus === 'found'}
                />
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Customer preview card if found */}
            {custLookupStatus === 'found' && billCustomer && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{billCustomer.name}</p>
                    <p className="text-slate-400 text-xs">{billCustomer.phone}</p>
                  </div>
                </div>
                {billCustomer.address && (
                  <p className="text-slate-400 text-xs pl-10">{billCustomer.address}</p>
                )}
                <div className="flex gap-3 pl-10 text-xs">
                  <span className="text-slate-400">Total purchases: <span className="text-emerald-400 font-medium">{formatCurrency(billCustomer.total_purchases)}</span></span>
                  {billCustomer.credit_balance > 0 && (
                    <span className="text-red-400">Credit: {formatCurrency(billCustomer.credit_balance)}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => setShowCustomerModal(false)}
              className="flex-1 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmCustomerAndProceed}
              disabled={!custMobile.trim() || !custName.trim()}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white"
            >
              Proceed to Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Confirm Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Sale</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-300">
                <span>Items</span><span>{cart.length}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-emerald-400">
                  <span>Discount</span><span>-{formatCurrency(discountAmount, sym)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-white text-lg border-t border-slate-700 pt-2">
                <span>Total</span><span>{formatCurrency(total, sym)}</span>
              </div>
            </div>

            {selectedCustomer && (
              <div className="text-sm text-slate-300">Customer: <span className="text-white font-medium">{selectedCustomer.name}</span> ({selectedCustomer.phone})</div>
            )}

            {/* Sale Type: Paid vs Credit */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs font-medium">Sale Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCheckoutSaleType('paid')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all',
                    checkoutSaleType === 'paid'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  )}
                >
                  <DollarSign className="w-4 h-4" /> Paid
                </button>
                <button
                  onClick={() => setCheckoutSaleType('credit')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all',
                    checkoutSaleType === 'credit'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  )}
                >
                  <CreditCard className="w-4 h-4" /> Credit (Udhar)
                </button>
              </div>
            </div>

            {/* Payment Method (only for Paid sales) */}
            {checkoutSaleType === 'paid' && (
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs font-medium">Payment Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'upi', 'card'] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all',
                        paymentMethod === method
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                      )}
                    >
                      {method === 'cash' && <Banknote className="w-3.5 h-3.5" />}
                      {method === 'upi' && <Smartphone className="w-3.5 h-3.5" />}
                      {method === 'card' && <CreditCard className="w-3.5 h-3.5" />}
                      {method.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Credit: Paid Amount + Remaining Balance */}
            {checkoutSaleType === 'credit' && (
              <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                <div className="space-y-1.5">
                  <Label className="text-amber-400 text-xs font-medium">Paid Amount (now)</Label>
                  <Input
                    type="number"
                    min="0"
                    max={total}
                    value={creditPaidAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (val > total) {
                        toast.error('Paid amount cannot exceed total');
                        return;
                      }
                      setCreditPaidAmount(e.target.value);
                    }}
                    placeholder="0"
                    className="bg-slate-800 border-slate-700 text-white h-9"
                  />
                  <div className="flex gap-1.5">
                    <button onClick={() => setCreditPaidAmount('0')} className="flex-1 py-1 text-xs rounded border border-slate-700 text-slate-400 hover:text-white">₹0</button>
                    <button onClick={() => setCreditPaidAmount((total * 0.5).toFixed(2))} className="flex-1 py-1 text-xs rounded border border-slate-700 text-slate-400 hover:text-white">Half</button>
                    <button onClick={() => setCreditPaidAmount(total.toFixed(2))} className="flex-1 py-1 text-xs rounded border border-slate-700 text-slate-400 hover:text-white">Full</button>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Amount</span>
                  <span className="text-white font-medium">{formatCurrency(total, sym)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Paid Now</span>
                  <span className="text-emerald-400 font-medium">{formatCurrency(parseFloat(creditPaidAmount) || 0, sym)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-amber-500/20 pt-2">
                  <span className="text-amber-400 font-medium">Remaining Credit</span>
                  <span className="text-amber-400 font-bold">{formatCurrency(Math.max(0, total - (parseFloat(creditPaidAmount) || 0)), sym)}</span>
                </div>
                {selectedCustomer && (selectedCustomer as any).credit_balance > 0 && (
                  <div className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1.5">
                    Existing credit: {formatCurrency((selectedCustomer as any).credit_balance, sym)}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-amber-400 text-xs font-medium">Due Date (optional)</Label>
                  <Input
                    type="date"
                    value={creditDueDate}
                    onChange={(e) => setCreditDueDate(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white h-9"
                  />
                </div>
              </div>
            )}

            {/* Cash received (only for Paid + Cash) */}
            {checkoutSaleType === 'paid' && paymentMethod === 'cash' && (
              <div>
                <Label className="text-slate-400 text-xs">Cash Received</Label>
                <Input
                  type="number" value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder={total.toFixed(2)}
                  className="bg-slate-800 border-slate-700 text-white h-9 mt-1"
                />
                {parseFloat(cashReceived) > total && (
                  <p className="text-emerald-400 text-xs mt-1">Change: {formatCurrency(parseFloat(cashReceived) - total, sym)}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckout(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button
              onClick={handleCompleteSale}
              disabled={processing}
              className="bg-emerald-500 hover:bg-emerald-400 text-white gap-2"
            >
              {processing ? 'Processing...' : checkoutSaleType === 'credit' ? 'Complete Credit Sale' : 'Complete Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Sale Complete!</h3>
            <p className="text-slate-400 text-sm">{lastSale?.invoice_number}</p>
            <p className="text-2xl font-bold text-emerald-400 mt-3">{lastSale && formatCurrency(lastSale.total, sym)}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowSuccess(false)} className="flex-1 border-slate-700 text-slate-300 hover:text-white">
              New Sale
            </Button>
            <Button onClick={() => { printBill(); setShowSuccess(false); }} className="flex-1 bg-blue-500 hover:bg-blue-400 text-white gap-2">
              <Printer className="w-4 h-4" />Print Bill
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
