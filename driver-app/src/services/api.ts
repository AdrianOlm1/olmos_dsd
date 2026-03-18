import * as Device from 'expo-device';

const API_BASE_URL = __DEV__ ? 'http://localhost:3001/api' : 'https://api.olmosdsd.com/api';

let authToken: string | null = null;
let deviceId: string | null = null;

export function setAuthToken(token: string) {
  authToken = token;
}

export function getDeviceId(): string {
  if (!deviceId) {
    deviceId = `${Device.modelName}-${Device.osVersion}-${Date.now()}`;
  }
  return deviceId;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Sync
  sync: (payload: any) =>
    request<any>('/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Route
  getRoute: (driverId: string, date?: string) =>
    request<any>(`/routes/driver/${driverId}${date ? `?date=${date}` : ''}`),

  startRoute: (routeId: string) =>
    request<any>(`/routes/${routeId}/start`, { method: 'POST' }),

  // Invoices
  createInvoice: (data: any) =>
    request<any>('/invoices', { method: 'POST', body: JSON.stringify(data) }),

  deliverInvoice: (id: string, signatureData: string, signedByName: string) =>
    request<any>(`/invoices/${id}/deliver`, {
      method: 'POST',
      body: JSON.stringify({ signatureData, signedByName }),
    }),

  // Payments
  collectPayment: (data: any) =>
    request<any>('/payments', { method: 'POST', body: JSON.stringify(data) }),

  // Credits
  createCredit: (data: any) =>
    request<any>('/credits', { method: 'POST', body: JSON.stringify(data) }),

  // DEX
  generateDEX: (invoiceId: string) =>
    request<{ dexData: string }>(`/dex/generate/${invoiceId}`, { method: 'POST' }),

  markDEXTransmitted: (invoiceId: string) =>
    request<any>(`/dex/transmitted/${invoiceId}`, { method: 'POST' }),

  // Inventory
  getTruckInventory: (driverId: string) =>
    request<any>(`/inventory/truck/${driverId}`),

  // Products
  getProducts: () => request<any[]>('/products'),

  getProductPrice: (productId: string, customerId: string, quantity = 1) =>
    request<any>(`/products/${productId}/price/${customerId}?quantity=${quantity}`),

  // Customers
  getCustomers: () => request<any[]>('/customers'),

  // Analytics
  getCustomerInsights: (customerId: string) =>
    request<any>(`/analytics/customer/${customerId}`),
};
