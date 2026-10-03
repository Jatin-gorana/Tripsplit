const API_BASE = '/api';

export function getAuthToken() {
  return localStorage.getItem('tripsplit_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('tripsplit_token', token);
  } else {
    localStorage.removeItem('tripsplit_token');
  }
}

/**
 * Custom fetch wrapper with automatic JWT header, 401 handling, and retry logic.
 */
export async function apiRequest(endpoint, options = {}, retries = 1) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);

      if (response.status === 401) {
        setAuthToken(null);
        // Dispatch custom event for auth context to react
        window.dispatchEvent(new Event('unauthorized_access'));
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      attempt++;
      if (attempt <= retries && err.message.includes('Failed to fetch')) {
        // Cold start or temporary network glitch retry
        await new Promise(res => setTimeout(res, 1200));
      } else {
        throw err;
      }
    }
  }
}
