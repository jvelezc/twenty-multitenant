import type {
    TenantDetails,
    TenantStats,
    TenantSummary,
} from '@/settings/admin-panel/tenants/types/Tenant';
import { useCallback, useState } from 'react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const API_BASE = `${REACT_APP_SERVER_BASE_URL}/admin/tenants`;

/**
 * Hook for interacting with the Tenant Admin API
 */
export const useTenantApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = localStorage.getItem('tokenPair');
      const parsedToken = token ? JSON.parse(token) : null;

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsedToken?.accessToken?.token || ''}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    [],
  );

  const getTenants = useCallback(
    async (options?: {
      includeDisabled?: boolean;
      search?: string;
    }): Promise<TenantSummary[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.includeDisabled) params.append('includeDisabled', 'true');
        if (options?.search) params.append('search', options.search);

        const url = `${API_BASE}?${params.toString()}`;
        const data = await fetchWithAuth(url);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch tenants';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchWithAuth],
  );

  const getTenantDetails = useCallback(
    async (tenantId: string): Promise<TenantDetails> => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchWithAuth(`${API_BASE}/${tenantId}`);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch tenant details';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchWithAuth],
  );

  const getStats = useCallback(async (): Promise<TenantStats> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchWithAuth(`${API_BASE}/stats`);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stats';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);

  const disableTenant = useCallback(
    async (tenantId: string, reason?: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        await fetchWithAuth(`${API_BASE}/${tenantId}/disable`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to disable tenant';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchWithAuth],
  );

  const enableTenant = useCallback(
    async (tenantId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        await fetchWithAuth(`${API_BASE}/${tenantId}/enable`, {
          method: 'POST',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to enable tenant';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchWithAuth],
  );

  const updateAdminNotes = useCallback(
    async (tenantId: string, notes: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        await fetchWithAuth(`${API_BASE}/${tenantId}/notes`, {
          method: 'PATCH',
          body: JSON.stringify({ notes }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update notes';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchWithAuth],
  );

  return {
    isLoading,
    error,
    getTenants,
    getTenantDetails,
    getStats,
    disableTenant,
    enableTenant,
    updateAdminNotes,
  };
};
