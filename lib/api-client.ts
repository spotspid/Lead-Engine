const API_BASE = '/api';

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

// Leads
export const api = {
  // Dashboard
  getDashboard: () => fetchAPI('/dashboard'),

  // Leads
  getLeads: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchAPI(`/leads${query}`);
  },
  getLead: (id: number) => fetchAPI(`/leads/${id}`),
  createLead: (data: any) => fetchAPI('/leads', { method: 'POST', body: JSON.stringify(data) }),
  createLeads: (data: any[]) => fetchAPI('/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (id: number, data: any) => fetchAPI(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLead: (id: number) => fetchAPI(`/leads/${id}`, { method: 'DELETE' }),
  bulkDeleteLeads: (ids: number[]) => fetchAPI('/leads/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  cleanupPreview: (data: any) => fetchAPI('/leads/cleanup-preview', { method: 'POST', body: JSON.stringify(data) }),
  cleanupExecute: (data: any) => fetchAPI('/leads/cleanup-execute', { method: 'POST', body: JSON.stringify(data) }),

  // Outreach
  getOutreach: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchAPI(`/outreach${query}`);
  },
  logOutreach: (data: any) => fetchAPI('/outreach', { method: 'POST', body: JSON.stringify(data) }),

  // Templates
  getTemplates: () => fetchAPI('/templates'),
  createTemplate: (data: any) => fetchAPI('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (data: any) => fetchAPI('/templates', { method: 'PUT', body: JSON.stringify(data) }),

  // Deals
  getDeals: () => fetchAPI('/deals'),
  createDeal: (data: any) => fetchAPI('/deals', { method: 'POST', body: JSON.stringify(data) }),

  // Scrape Batches
  getScrapeBatches: () => fetchAPI('/scrape-batches'),
  logScrapeBatch: (data: any) => fetchAPI('/scrape-batches', { method: 'POST', body: JSON.stringify(data) }),

  // Scraper
  scrape: (data: any) => fetchAPI('/scrape', { method: 'POST', body: JSON.stringify(data) }),
  apifyScrape: (data: any) => fetchAPI('/apify-scrape', { method: 'POST', body: JSON.stringify(data) }),
};
