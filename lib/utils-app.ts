import { supabase } from './supabase';
import { ActivityLog } from './types';

export async function logActivity(params: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  user_name?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: params.user_name || user.email || 'Unknown',
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    details: params.details,
  });
}

export function generateBarcode(productId: string): string {
  // Use last 8 chars of UUID + random 4 chars for brevity
  const shortId = productId.replace(/-/g, '').substring(0, 12).toUpperCase();
  return `NS${shortId}`;
}

export function generateInvoiceNumber(prefix: string = 'INV'): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${date}-${random}`;
}

export function formatCurrency(amount: number, symbol: string = '₹'): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getDaysUntilExpiry(expiryDate: string): number {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getStockStatus(quantity: number, minStock: number): 'out' | 'low' | 'ok' {
  if (quantity === 0) return 'out';
  if (quantity <= minStock) return 'low';
  return 'ok';
}
