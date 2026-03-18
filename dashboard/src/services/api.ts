const API_BASE = '/api';

let token: string | null = localStorage.getItem('olmos_dsd_token');

export function setToken(t: string) {
  token = t;
  localStorage.setItem('olmos_dsd_token', t);
}

export function clearToken() {
  token = null;
  localStorage.removeItem('olmos_dsd_token');
}

export function getToken() { return token; }

export function isAuthRedirect(err: unknown): err is { name: 'AuthRedirect' } {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AuthRedirect';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const authToken = token ?? localStorage.getItem('olmos_dsd_token');
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    if (path.startsWith('/auth/login')) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || 'Invalid email or password');
    }
    clearToken();
    window.location.replace('/login');
    return Promise.reject({ name: 'AuthRedirect' }) as Promise<T>;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: any; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  // Dashboard
  getDashboardMetrics: (days = 30) => request<any>(`/analytics/dashboard?days=${days}`),
  getRevenueTrend: (days = 30) => request<any[]>(`/analytics/revenue-trend?days=${days}`),
  getInventoryAlerts: () => request<any>('/analytics/inventory-alerts'),

  // Customers
  getCustomers: (search?: string) => request<any[]>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getCustomer: (id: string) => request<any>(`/customers/${id}`),
  getCustomerAnalytics: (id: string) => request<any>(`/analytics/customer/${id}`),

  // Products
  getProducts: (search?: string) => request<any[]>(`/products${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  // Routes
  getActiveRoutes: () => request<any[]>('/routes/active'),

  // Invoices — global paginated list
  getInvoices: (params: {
    status?: string;
    search?: string;
    driverId?: string;
    days?: number;
    page?: number;
    limit?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.status && params.status !== 'ALL') qs.set('status', params.status);
    if (params.search)   qs.set('search', params.search);
    if (params.driverId) qs.set('driverId', params.driverId);
    if (params.days)     qs.set('days', String(params.days));
    if (params.page)     qs.set('page', String(params.page));
    if (params.limit)    qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<any>(`/invoices${q ? `?${q}` : ''}`);
  },
  getInvoicesByCustomer: (customerId: string) => request<any[]>(`/invoices/customer/${customerId}`),

  // Drivers
  getDriverPerformance: (driverId: string, days = 30) => request<any>(`/analytics/driver/${driverId}?days=${days}`),

  // Credits
  getPendingCredits: () => request<any[]>('/credits/pending'),
  approveCredit: (id: string) => request<any>(`/credits/${id}/approve`, { method: 'POST' }),

  // QuickBooks
  getQBOStatus: () => request<any>('/qbo/status'),
  getQBOSyncStatus: () => request<any>('/qbo/sync-status'),
  connectQBO: () => request<{ authUri: string }>('/qbo/connect'),
};
