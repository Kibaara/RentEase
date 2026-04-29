const API_BASE = '/api';

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    let errorMsg = 'An unexpected error occurred';
    try {
      const errorData = await res.json();
      errorMsg = errorData.error || errorData.message || errorMsg;
    } catch (e) {
      const text = await res.text().catch(() => '');
      if (text) {
        console.error('Non-JSON error response:', text.slice(0, 200));
        errorMsg = `Server Error: ${res.status}`;
      } else {
        errorMsg = `Request failed (${res.status})`;
      }
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  auth: {
    login: (credentials: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (data: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
    setupPassword: (data: any) => request('/auth/setup-password', { method: 'POST', body: JSON.stringify(data) }),
    status: () => request('/auth/status'),
  },
  dashboard: {
    summary: () => request('/dashboard/summary'),
  },
  units: {
    list: () => request('/units'),
    create: (data: any) => request('/units', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/units/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  users: {
    list: () => request('/users'),
    create: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  payments: {
    list: () => request('/payments'),
    create: (data: any) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/payments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  serviceRequests: {
    list: () => request('/service-requests'),
    create: (data: any) => request('/service-requests', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/service-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  expenses: {
    list: () => request('/expenses'),
    create: (data: any) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  config: {
    get: () => request('/config'),
    update: (data: any) => request('/config', { method: 'POST', body: JSON.stringify(data) }),
  },
  waterReadings: {
    list: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return request(`/water-readings${query}`);
    },
    create: (data: any) => request('/water-readings', { method: 'POST', body: JSON.stringify(data) }),
  },
  invoices: {
    list: () => request('/invoices'),
    get: (id: string) => request(`/invoices/${id}`),
    generate: (data: any = {}) => request('/admin/generate-invoices', { method: 'POST', body: JSON.stringify(data) }),
  },
  admin: {
    auditLogs: (limit = 100, offset = 0) => request(`/admin/audit-logs?limit=${limit}&offset=${offset}`),
  },
};
