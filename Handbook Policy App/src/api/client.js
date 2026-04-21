/**
 * Noble HR API client (Noble HR backend) — replaces Base44
 * All API calls go through this client.
 * Web: cookie-only auth (httpOnly pv_access_token). No localStorage for tokens (Truth #172).
 * Uses credentials: 'include'; sends X-CSRF-Token on state-changing requests.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

let csrfToken = null;
/** In-memory fallback for /auth/refresh (e.g. mobile tests). Web uses httpOnly pv_refresh_token cookie. */
let refreshTokenInMemory = null;

function getRefreshToken() {
  return refreshTokenInMemory;
}

function setRefreshToken(token) {
  refreshTokenInMemory = token || null;
}

let csrfPromise = null;

/** Fetch and cache CSRF token for double-submit (cookie is set by server, we send same value in header). */
async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  if (csrfPromise) return csrfPromise;

  csrfPromise = (async () => {
    try {
      const r = await fetch(`${API_BASE}/auth/csrf`, { method: 'GET', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (d.csrf) csrfToken = d.csrf;
      return csrfToken;
    } finally {
      csrfPromise = null;
    }
  })();
  
  return csrfPromise;
}

async function doRequest(path, options, skipRefresh) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  // Web: no Bearer header; cookie (pv_access_token) sent via credentials: 'include'
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = await ensureCsrf();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(url, { ...options, credentials: 'include', headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(res.ok ? 'Invalid response format' : (text || res.statusText));
  }
  if (res.status === 403 && data?.error && data.error.includes('CSRF')) {
    csrfToken = null;
  }
  if (res.status === 401 && !skipRefresh) {
    const mem = getRefreshToken();
    // Web: empty body — server reads pv_refresh_token cookie. Mobile/tests: body.refresh_token.
    const refreshBody = mem ? { refresh_token: mem } : {};
    try {
      const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(refreshBody),
      });
      const refData = await refreshed.json().catch(() => ({}));
      if (refreshed.ok && refData.token) {
        if (refData.refresh_token) setRefreshToken(refData.refresh_token);
        return doRequest(path, options, true);
      }
      setRefreshToken(null);
      csrfToken = null;
    } catch (_) {
      setRefreshToken(null);
    }
  }
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function request(path, options = {}) {
  return doRequest(path, options, false);
}

export const api = {
  /** Web: always null; auth is cookie-based. Call api.me() to check session. */
  getToken: () => null,
  async logout() {
    await api.auth.logout();
  },

  auth: {
    async login(email, password) {
      const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.refresh_token) setRefreshToken(data.refresh_token);
      return data;
    },
    async loginWithGoogle(credential) {
      const data = await request('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });
      if (data.refresh_token) setRefreshToken(data.refresh_token);
      return data;
    },
    async register(payload) {
      const data = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.refresh_token) setRefreshToken(data.refresh_token);
      return data;
    },
    async registerWithGoogle(payload) {
      const data = await request('/auth/google-register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.refresh_token) setRefreshToken(data.refresh_token);
      return data;
    },
    async logout() {
      try {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
      } catch (_) {}
      setRefreshToken(null);
      csrfToken = null;
    },
    async verifyEmail(token) {
      return request('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    },
    async resendVerification(email) {
      return request('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },
    /** Set httpOnly cookie from super-admin launch token (web only). */
    async setLaunchCookie(token) {
      const r = await fetch(`${API_BASE}/auth/launch-cookie`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Invalid launch token');
      return d;
    },
  },

  async me() {
    return request('/me');
  },

  employeeDocuments: {
    async list(employeeId) {
      const res = await request(`/employee-documents/${employeeId}`);
      return res.data ?? res;
    },
    async upload(employeeId, file, { category = 'other', notes = '' } = {}) {
      const csrf = await ensureCsrf();
      const form = new FormData();
      form.append('file', file);
      form.append('employee_id', employeeId);
      form.append('category', category);
      if (notes) form.append('notes', notes);
      const r = await fetch(`${API_BASE}/employee-documents/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
        body: form,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(data.error || r.statusText);
        err.status = r.status;
        err.data = data;
        throw err;
      }
      return data.data ?? data;
    },
    downloadUrl(documentId) {
      return `${API_BASE}/employee-documents/download/${documentId}`;
    },
    async download(documentId, filename) {
      const url = this.downloadUrl(documentId);
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || r.statusText);
      }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename || 'document';
      a.click();
      URL.revokeObjectURL(a.href);
    },
    async delete(documentId) {
      await request(`/employee-documents/${documentId}`, { method: 'DELETE' });
    },
  },

  async getCapabilities() {
    const data = await request('/capabilities', { method: 'GET' });
    return data.data?.capabilities ?? [];
  },

  account: {
    async changePassword(currentPassword, newPassword) {
      return request('/account/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
    },
    async changeEmail(newEmail, password) {
      return request('/account/change-email', {
        method: 'POST',
        body: JSON.stringify({ new_email: newEmail, password }),
      });
    },
    async updateProfile(data) {
      return request('/account/update-profile', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async forgotPassword(email) {
      return request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },
    async resetPassword(token, newPassword) {
      return request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword }),
      });
    },
    async deleteAccount(password) {
      return request('/account/delete-account', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    },
  },

  invites: {
    async validate(token) {
      const res = await fetch(`${API_BASE}/auth/invites/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch((e) => {
        throw new Error('Invalid response from server');
      });
      if (!res.ok) {
        const err = new Error(data.error || res.statusText);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    },
    async accept(payload) {
      const data = await request('/auth/invites/accept', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.refresh_token) setRefreshToken(data.refresh_token);
      return data;
    },
    async create(payload) {
      return request('/invites/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async list(organizationId) {
      return request('/invites/list', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId }),
      });
    },
  },

  superAdmin: {
    async pendingOrgs() {
      const res = await request('/super-admin/pending-orgs', { method: 'POST', body: JSON.stringify({}) });
      return res.data;
    },
    async approveOrg(organizationId) {
      return request('/super-admin/approve-org', { method: 'POST', body: JSON.stringify({ organization_id: organizationId }) });
    },
    async rejectOrg(organizationId) {
      return request('/super-admin/reject-org', { method: 'POST', body: JSON.stringify({ organization_id: organizationId }) });
    },
    async archiveOrg(organizationId) {
      return request('/super-admin/archive-org', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId }),
      });
    },
    async platformLocations() {
      const res = await request('/super-admin/platform-locations', { method: 'POST', body: JSON.stringify({}) });
      return res.data;
    },
    async createLocation(name, address) {
      return request('/super-admin/create-location', { method: 'POST', body: JSON.stringify({ name, address }) });
    },
    async deletePlatformLocation(locationId) {
      return request('/super-admin/delete-platform-location', {
        method: 'POST',
        body: JSON.stringify({ location_id: locationId }),
      });
    },
    async allOrgs() {
      const res = await request('/super-admin/all-orgs', { method: 'POST', body: JSON.stringify({}) });
      return res.data;
    },
    async orgsWithLocations() {
      const res = await request('/super-admin/orgs-with-locations', { method: 'POST', body: JSON.stringify({}) });
      return res.data;
    },
    async launchToken(organizationId) {
      return request('/super-admin/launch-token', { method: 'POST', body: JSON.stringify({ organization_id: organizationId }) });
    },
    async ensureTestOrg() {
      const res = await request('/super-admin/ensure-test-org', { method: 'POST', body: JSON.stringify({}) });
      return res.data;
    },
  },

  // AI: scan handbook for missing policies
  async scanHandbookMissing() {
    const data = await request('/ai/scan-handbook-missing', { method: 'POST', body: '{}' });
    return data.data?.suggested_titles ?? [];
  },
  // AI: extract policies from pasted handbook text
  async extractHandbook(text) {
    const data = await request('/ai/extract-handbook', { method: 'POST', body: JSON.stringify({ text }) });
    return data.data?.policies ?? [];
  },
  // AI: handbook recommend (name, industry, state)
  async handbookRecommend(params = {}) {
    const data = await request('/ai/handbook-recommend', { method: 'POST', body: JSON.stringify(params) });
    return data.data?.recommended_titles ?? [];
  },
  // AI: generate selected policy titles as drafts
  async handbookGenerateSelected(titles) {
    const data = await request('/ai/handbook-generate-selected', { method: 'POST', body: JSON.stringify({ titles }) });
    return data.data?.created_ids ?? [];
  },
  // AI: policy suggest for editor
  async policySuggest(policyId, currentDraftContent, userInstruction) {
    const data = await request('/ai/policy-suggest', {
      method: 'POST',
      body: JSON.stringify({ policy_id: policyId, current_draft_content: currentDraftContent, user_instruction: userInstruction }),
    });
    return data.data?.suggested_content ?? '';
  },
  async assistWriteUp(body) {
    const data = await request('/ai/assist-writeup', {
      method: 'POST',
      body: JSON.stringify(body || {}),
    });
    return data.data ?? data;
  },
  // AI policy generation (streaming) — calls server /ai/generate-policy
  async streamGeneratePolicy(params, onChunk) {
    const csrf = await ensureCsrf();
    const headers = { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) };
    const res = await fetch(`${API_BASE}/ai/generate-policy`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(params || {}),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.text) onChunk(payload.text);
            if (payload.error) throw new Error(payload.error);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
  },

  async invoke(functionName, params = {}) {
    const map = {
      getEmployeeContext: () => request('/me'),
      getAdminContext: () => request('/admin-context', { method: 'POST', body: JSON.stringify(params) }),
      getApplicablePolicies: () => request('/applicable-policies', { method: 'POST', body: JSON.stringify(params) }),
      getPoliciesForEmployee: () => request('/policies-for-employee', { method: 'POST', body: JSON.stringify(params) }),
      createSecureAcknowledgment: () => request('/create-acknowledgment', { method: 'POST', body: JSON.stringify(params) }),
      secureEntityWrite: () => request('/entity-write', { method: 'POST', body: JSON.stringify(params) }),
      secureEmployeeWrite: () => request('/employee-write', { method: 'POST', body: JSON.stringify(params) }),
      secureOrgWrite: () => request('/org-write', { method: 'POST', body: JSON.stringify(params) }),
      publishPolicy: () => request('/publish-policy', { method: 'POST', body: JSON.stringify(params) }),
      managePolicyLifecycle: () => request('/manage-policy-lifecycle', { method: 'POST', body: JSON.stringify(params) }),
      getHandbookData: () => request('/handbook-data', { method: 'POST', body: JSON.stringify(params) }),
      getMyOnboarding: () => request('/my-onboarding', { method: 'POST', body: JSON.stringify(params) }),
      getMyAcknowledgments: () => request('/my-acknowledgments', { method: 'POST', body: JSON.stringify(params) }),
      getPolicyForEmployee: () => request('/policy-for-employee', { method: 'POST', body: JSON.stringify(params) }),
      getActivityLog: () => request('/activity-log', { method: 'POST', body: JSON.stringify(params) }),
      getAcknowledgementMatrix: () => request('/acknowledgement-matrix', { method: 'POST', body: JSON.stringify(params) }),
      sendOnboardingReminder: () => request('/send-onboarding-reminder', { method: 'POST', body: JSON.stringify(params) }),
      getHRRecords: () => request('/hr-records', { method: 'POST', body: JSON.stringify(params) }),
      getIncidentReports: () => request('/incident-reports', { method: 'POST', body: JSON.stringify(params) }),
      getEmployeeProfile: () => request('/employee-profile', { method: 'POST', body: JSON.stringify(params) }),
      secureIncidentWrite: () => request('/secure-incident-write', { method: 'POST', body: JSON.stringify(params) }),
      manageHRRecordLifecycle: () => request('/manage-hr-lifecycle', { method: 'POST', body: JSON.stringify(params) }),
      acknowledgeHRRecord: () => request('/acknowledge-hr-record', { method: 'POST', body: JSON.stringify(params) }),
      sendPolicyReminders: () => Promise.resolve({ data: { success: true } }),
      guardAiUsage: () => Promise.resolve({ data: { allowed: true } }),
      getLocations: () => request('/locations', { method: 'POST', body: JSON.stringify(params) }),
      getPolicy: () => request('/policy', { method: 'POST', body: JSON.stringify(params) }),
      getPolicyVersions: () => request('/policy-versions', { method: 'POST', body: JSON.stringify(params) }),
      createSystemEvent: () => request('/system-event', { method: 'POST', body: JSON.stringify(params) }),
      getSystemEvents: () => request('/system-events', { method: 'POST', body: JSON.stringify(params) }),
      updatePolicy: () => request('/policy-update', { method: 'POST', body: JSON.stringify(params) }),
      verifyAcknowledgment: () => request('/verify-acknowledgment', { method: 'POST', body: JSON.stringify(params) }),
      exportOrgData: () => request('/export-org-data', { method: 'POST', body: JSON.stringify(params) }),
      exportEmployeeFile: () => request('/export-employee-file', { method: 'POST', body: JSON.stringify(params) }),
      getComplianceChecklist: () => request('/compliance-checklist', { method: 'POST', body: JSON.stringify({}) }),
      confirmComplianceItem: () => request('/compliance-checklist/confirm', { method: 'POST', body: JSON.stringify(params) }),
      verifyComplianceChecklist: () => request('/compliance-checklist/verify', { method: 'POST', body: JSON.stringify({}) }),
      updateComplianceItemContent: () => request('/compliance-checklist/update-content', { method: 'POST', body: JSON.stringify(params) }),
      restoreComplianceItemOriginal: () => request('/compliance-checklist/restore-original', { method: 'POST', body: JSON.stringify(params) }),
      getGapAudit: () => request('/gap-audit', { method: 'POST', body: JSON.stringify({}) }),
      changePassword: () => request('/account/change-password', { method: 'POST', body: JSON.stringify(params) }),
      changeEmail: () => request('/account/change-email', { method: 'POST', body: JSON.stringify(params) }),
      updateProfile: () => request('/account/update-profile', { method: 'POST', body: JSON.stringify(params) }),
    };
    const fn = map[functionName];
    if (!fn) throw new Error(`Unknown function: ${functionName}`);
    const result = await fn();
    return { data: result.data ?? result };
  },
};
