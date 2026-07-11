export type UserRole = 'admin' | 'staff';

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  company?: string;
  category_id?: string;
  category?: Category;
  description?: string;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  min_stock_alert: number;
  mfg_date?: string;
  expiry_date?: string;
  image_url?: string;
  is_active: boolean;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  product_id: string;
  product?: Product;
  supplier_name?: string;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  credit_balance: number;
  total_purchases: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  invoice_number: string;
  customer_id?: string;
  customer?: Customer;
  customer_name?: string;
  customer_phone?: string;
  sale_type: 'normal' | 'without_bill';
  subtotal: number;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  payment_method: 'cash' | 'upi' | 'card' | 'mixed' | 'credit';
  payment_details?: Record<string, unknown>;
  notes?: string;
  is_credit: boolean;
  created_by?: string;
  created_at: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product?: Product;
  product_name: string;
  barcode: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  discount_amount: number;
  total: number;
  created_at: string;
}

export interface CreditSale {
  id: string;
  sale_id: string;
  sale?: Sale;
  customer_id: string;
  customer?: Customer;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date?: string;
  notes?: string;
  status: 'pending' | 'partial' | 'paid';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditPayment {
  id: string;
  credit_sale_id: string;
  customer_id: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'card';
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface Settings {
  id: string;
  store_name: string;
  store_address?: string;
  store_phone?: string;
  store_email?: string;
  currency: string;
  currency_symbol: string;
  invoice_prefix: string;
  invoice_footer?: string;
  logo_url?: string;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount_amount: number;
}

export interface DashboardStats {
  todaySales: number;
  todayProfit: number;
  monthlySales: number;
  monthlyProfit: number;
  totalProducts: number;
  availableStock: number;
  inventoryValue: number;
  purchaseValue: number;
  sellingValue: number;
  creditPending: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiredCount: number;
  expiringSoonCount: number;
}
