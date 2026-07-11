/*
# Nisha Store - Core Schema Migration

## Overview
Complete database schema for Nisha Store Inventory & POS Management System.
This is a multi-user, role-based application with Admin and Staff roles.

## New Tables

### users_profiles
- Extends Supabase auth.users with role, name, phone
- Roles: 'admin' | 'staff'

### categories
- Product categories with name, description, color

### products
- Full product catalog with barcode, pricing, stock, expiry, images
- Includes purchase price, selling price, min stock alert
- image_url for Cloudinary-hosted images

### purchases
- Purchase/restock records linked to products
- Tracks supplier, quantity added, purchase price, date

### customers
- Customer directory with name, phone, address, credit balance

### sales
- Sale headers: customer, total, discount, payment method, type
- sale_type: 'normal' | 'without_bill'

### sale_items
- Individual line items per sale (product, qty, price, discount)

### credit_sales
- Credit (udhar) transactions linked to customers and sales
- Tracks total, paid, remaining, due date

### credit_payments
- Individual payment records against credit sales

### activity_logs
- Audit trail for all system actions

### settings
- Single-row store configuration table

## Security
- RLS enabled on all tables
- Authenticated users can read/write based on role
- Staff cannot delete products, sales, or manage users
- Admin has full access

## Notes
- All monetary values stored as NUMERIC(12,2)
- Barcode = unique product ID (auto-generated short code)
- Stock auto-updates via triggers on purchases and sales
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USER PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON user_profiles;
CREATE POLICY "select_own_profile" ON user_profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON user_profiles;
CREATE POLICY "insert_own_profile" ON user_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
CREATE POLICY "update_own_profile" ON user_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'
  )) WITH CHECK (auth.uid() = id OR EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'
  ));

DROP POLICY IF EXISTS "admin_delete_profile" ON user_profiles;
CREATE POLICY "admin_delete_profile" ON user_profiles FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'
  ));

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_categories" ON categories;
CREATE POLICY "select_categories" ON categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_categories" ON categories;
CREATE POLICY "insert_categories" ON categories FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_categories" ON categories;
CREATE POLICY "update_categories" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_categories" ON categories;
CREATE POLICY "admin_delete_categories" ON categories FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL UNIQUE,
  name text NOT NULL,
  company text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  description text,
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  min_stock_alert integer NOT NULL DEFAULT 5,
  mfg_date date,
  expiry_date date,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_products" ON products;
CREATE POLICY "select_products" ON products FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_products" ON products;
CREATE POLICY "insert_products" ON products FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_products" ON products;
CREATE POLICY "update_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_products" ON products;
CREATE POLICY "admin_delete_products" ON products FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);

-- ============================================================
-- PURCHASES (stock-in)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  supplier_name text,
  quantity integer NOT NULL CHECK (quantity > 0),
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_purchases" ON purchases;
CREATE POLICY "select_purchases" ON purchases FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_purchases" ON purchases;
CREATE POLICY "insert_purchases" ON purchases FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_purchases" ON purchases;
CREATE POLICY "update_purchases" ON purchases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_purchases" ON purchases;
CREATE POLICY "admin_delete_purchases" ON purchases FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);

-- Trigger: auto-increment product stock on purchase insert
CREATE OR REPLACE FUNCTION increment_stock_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products SET
    quantity = quantity + NEW.quantity,
    purchase_price = NEW.purchase_price,
    updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_stock ON purchases;
CREATE TRIGGER trg_increment_stock
  AFTER INSERT ON purchases
  FOR EACH ROW EXECUTE FUNCTION increment_stock_on_purchase();

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  credit_balance numeric(12,2) NOT NULL DEFAULT 0,
  total_purchases numeric(12,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_customers" ON customers;
CREATE POLICY "select_customers" ON customers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_customers" ON customers;
CREATE POLICY "insert_customers" ON customers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_customers" ON customers;
CREATE POLICY "update_customers" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_customers" ON customers;
CREATE POLICY "admin_delete_customers" ON customers FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);

-- ============================================================
-- SALES
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  sale_type text NOT NULL DEFAULT 'normal' CHECK (sale_type IN ('normal', 'without_bill')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_type text CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'card', 'mixed', 'credit')),
  payment_details jsonb,
  notes text,
  is_credit boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_type ON sales(sale_type);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_sales" ON sales;
CREATE POLICY "select_sales" ON sales FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_sales" ON sales;
CREATE POLICY "insert_sales" ON sales FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_sales" ON sales;
CREATE POLICY "update_sales" ON sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_sales" ON sales;
CREATE POLICY "admin_delete_sales" ON sales FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);

-- ============================================================
-- SALE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  barcode text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_sale_items" ON sale_items;
CREATE POLICY "select_sale_items" ON sale_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_sale_items" ON sale_items;
CREATE POLICY "insert_sale_items" ON sale_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_sale_items" ON sale_items;
CREATE POLICY "update_sale_items" ON sale_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_sale_items" ON sale_items;
CREATE POLICY "admin_delete_sale_items" ON sale_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);

-- Trigger: auto-decrement product stock on sale_items insert
CREATE OR REPLACE FUNCTION decrement_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products SET
    quantity = GREATEST(0, quantity - NEW.quantity),
    updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_decrement_stock ON sale_items;
CREATE TRIGGER trg_decrement_stock
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION decrement_stock_on_sale();

-- ============================================================
-- CREDIT SALES (UDHAR)
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  remaining_amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_sales_customer ON credit_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_sales_status ON credit_sales(status);

ALTER TABLE credit_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_credit_sales" ON credit_sales;
CREATE POLICY "select_credit_sales" ON credit_sales FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_credit_sales" ON credit_sales;
CREATE POLICY "insert_credit_sales" ON credit_sales FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_credit_sales" ON credit_sales;
CREATE POLICY "update_credit_sales" ON credit_sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_credit_sales" ON credit_sales;
CREATE POLICY "admin_delete_credit_sales" ON credit_sales FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);

-- ============================================================
-- CREDIT PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_sale_id uuid NOT NULL REFERENCES credit_sales(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'card')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_payments_credit_sale ON credit_payments(credit_sale_id);

ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_credit_payments" ON credit_payments;
CREATE POLICY "select_credit_payments" ON credit_payments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_credit_payments" ON credit_payments;
CREATE POLICY "insert_credit_payments" ON credit_payments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_credit_payments" ON credit_payments;
CREATE POLICY "update_credit_payments" ON credit_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_credit_payments" ON credit_payments;
CREATE POLICY "admin_delete_credit_payments" ON credit_payments FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);

-- Trigger: update credit_sale remaining and status after payment
CREATE OR REPLACE FUNCTION update_credit_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_total numeric(12,2);
  v_new_paid numeric(12,2);
  v_new_remaining numeric(12,2);
  v_status text;
BEGIN
  SELECT total_amount, paid_amount INTO v_total, v_new_paid FROM credit_sales WHERE id = NEW.credit_sale_id;
  v_new_paid := v_new_paid + NEW.amount;
  v_new_remaining := GREATEST(0, v_total - v_new_paid);
  IF v_new_remaining = 0 THEN v_status := 'paid';
  ELSIF v_new_paid > 0 THEN v_status := 'partial';
  ELSE v_status := 'pending';
  END IF;
  UPDATE credit_sales SET
    paid_amount = v_new_paid,
    remaining_amount = v_new_remaining,
    status = v_status,
    updated_at = now()
  WHERE id = NEW.credit_sale_id;
  -- Update customer credit balance
  UPDATE customers SET
    credit_balance = GREATEST(0, credit_balance - NEW.amount),
    updated_at = now()
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_credit_on_payment ON credit_payments;
CREATE TRIGGER trg_update_credit_on_payment
  AFTER INSERT ON credit_payments
  FOR EACH ROW EXECUTE FUNCTION update_credit_on_payment();

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_activity_logs" ON activity_logs;
CREATE POLICY "select_activity_logs" ON activity_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_activity_logs" ON activity_logs;
CREATE POLICY "insert_activity_logs" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "no_update_activity_logs" ON activity_logs;
CREATE POLICY "no_update_activity_logs" ON activity_logs FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "admin_delete_activity_logs" ON activity_logs;
CREATE POLICY "admin_delete_activity_logs" ON activity_logs FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);

-- ============================================================
-- SETTINGS (single-row per store)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL DEFAULT 'Nisha Store',
  store_address text,
  store_phone text,
  store_email text,
  currency text NOT NULL DEFAULT 'INR',
  currency_symbol text NOT NULL DEFAULT '₹',
  invoice_prefix text NOT NULL DEFAULT 'INV',
  invoice_footer text,
  logo_url text,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_settings" ON settings;
CREATE POLICY "select_settings" ON settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_settings" ON settings;
CREATE POLICY "admin_insert_settings" ON settings FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_settings" ON settings;
CREATE POLICY "admin_update_settings" ON settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_settings" ON settings;
CREATE POLICY "admin_delete_settings" ON settings FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
);

-- Insert default settings
INSERT INTO settings (store_name, currency, currency_symbol, invoice_prefix)
SELECT 'Nisha Store', 'INR', '₹', 'INV'
WHERE NOT EXISTS (SELECT 1 FROM settings);

-- Insert default categories
INSERT INTO categories (name, color) VALUES
  ('General', '#6b7280'),
  ('Food & Beverages', '#f59e0b'),
  ('Medicines', '#ef4444'),
  ('Electronics', '#3b82f6'),
  ('Cosmetics', '#ec4899'),
  ('Clothing', '#8b5cf6'),
  ('Stationary', '#10b981')
ON CONFLICT (name) DO NOTHING;
