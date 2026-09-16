const BASE = '';
const ADMIN_KEY_STORAGE = 'afecon_admin_key';

export function getAdminKey() {
  return sessionStorage.getItem(ADMIN_KEY_STORAGE) || '';
}

export function setAdminKey(key) {
  if (key) sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
  else sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

export function clearAdminKey() {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

function adminHeaders(extra = {}) {
  const key = getAdminKey();
  return key ? { ...extra, 'X-Admin-Key': key } : { ...extra };
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erreur API');
  }
  return res.json();
}

async function downloadFile(path, fallbackName) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: adminHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erreur API');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  let filename = fallbackName;
  const match = disposition?.match(/filename="([^"]+)"/);
  if (match) filename = match[1];
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function adminRequest(path, options = {}) {
  const headers = adminHeaders(options.headers);
  return request(path, { ...options, headers });
}

export const api = {
  getFamilies: (opts = {}) =>
    opts.all ? adminRequest('/api/families?all=1') : request('/api/families'),
  getProducts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const path = `/api/products${q ? `?${q}` : ''}`;
    return getAdminKey() ? adminRequest(path) : request(path);
  },
  getProduct: (id) => request(`/api/products/${id}`),
  createProduct: (body) =>
    adminRequest('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateProduct: (id, body) =>
    adminRequest(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteProduct: (id) => adminRequest(`/api/products/${id}`, { method: 'DELETE' }),
  getReferences: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return adminRequest(`/api/references?${q}`);
  },
  createReference: (body) =>
    adminRequest('/api/references', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateReference: (id, body) =>
    adminRequest(`/api/references/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteReference: (id) => adminRequest(`/api/references/${id}`, { method: 'DELETE' }),
  createFamily: (body) =>
    adminRequest('/api/families', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateFamily: (id, body) =>
    adminRequest(`/api/families/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteFamily: (id) => adminRequest(`/api/families/${id}`, { method: 'DELETE' }),
  createCategory: (familyId, body) =>
    adminRequest(`/api/families/${familyId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateCategory: (id, body) =>
    adminRequest(`/api/families/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteCategory: (id) =>
    adminRequest(`/api/families/categories/${id}`, { method: 'DELETE' }),
  importCatalog: (formData) => adminRequest('/api/import', { method: 'POST', body: formData }),
  getImportLogs: () => adminRequest('/api/import/logs'),
  submitContact: (body) =>
    request('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  getMarginRules: () => adminRequest('/api/pricing/margin-rules'),
  createMarginRule: (body) =>
    adminRequest('/api/pricing/margin-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteMarginRule: (id) =>
    adminRequest(`/api/pricing/margin-rules/${id}`, { method: 'DELETE' }),
  getPriceExceptions: () => adminRequest('/api/pricing/exceptions'),
  createPriceException: (body) =>
    adminRequest('/api/pricing/exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deletePriceException: (id) =>
    adminRequest(`/api/pricing/exceptions/${id}`, { method: 'DELETE' }),
  recalculatePrices: () => adminRequest('/api/pricing/recalculate', { method: 'POST' }),
  getShippingRules: () => adminRequest('/api/pricing/shipping-rules'),
  createShippingRule: (body) =>
    adminRequest('/api/pricing/shipping-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteShippingRule: (id) =>
    adminRequest(`/api/pricing/shipping-rules/${id}`, { method: 'DELETE' }),
  calculateShipping: (body) =>
    request('/api/pricing/shipping/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  getCurrencyConfig: () => request('/api/config/currency'),
  getMe: () => request('/api/auth/me'),
  login: (body) =>
    request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  register: (body) =>
    request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  logout: () =>
    request('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }),
  updateProfile: (body) =>
    request('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  getQuotes: () => request('/api/quotes'),
  getQuote: (id) => request(`/api/quotes/${id}`),
  createQuote: (body) =>
    request('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  downloadQuotePdf: (id) => downloadFile(`/api/quotes/${id}/pdf`, `devis-${id}.pdf`),
  getOrders: () => request('/api/orders'),
  getOrder: (id) => request(`/api/orders/${id}`),
  createOrder: (body) =>
    request('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  downloadOrderPdf: (id) => downloadFile(`/api/orders/${id}/pdf`, `commande-${id}.pdf`),
  getAdminOrders: () => adminRequest('/api/admin/orders'),
  updateAdminOrderStatus: (id, status) =>
    adminRequest(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
};

export function imageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return path;
}

export function formatPrice(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num);
}

export function isQuotePrice(ref) {
  return ref?.price_source === 'quote' || ref?.price_on_quote === true;
}

export const QUOTE_PRICE_TITLE = 'Prix sur devis';
export const QUOTE_PRICE_HINT = 'Contactez votre conseiller';

let currencyRates = { eur_to_cdf: 2850, eur_to_usd: 1.08 };

export async function loadCurrencyConfig() {
  try {
    currencyRates = await api.getCurrencyConfig();
  } catch {
    /* garde les valeurs par défaut */
  }
  return currencyRates;
}

export function getCurrencyRates() {
  return currencyRates;
}

export function formatCdf(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(num)} CDF`;
}

export function formatUsd(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function eurToCdf(eur) {
  const rates = getCurrencyRates();
  const num = Number(eur);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * rates.eur_to_cdf);
}

export function eurToUsd(eur) {
  const rates = getCurrencyRates();
  const num = Number(eur);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * rates.eur_to_usd * 100) / 100;
}
