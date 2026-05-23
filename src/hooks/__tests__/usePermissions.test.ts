import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { AuthProvider } from '@/contexts/AuthContext';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('usePermissions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: any) => (
    React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(AuthProvider, null, children)
    )
  );

  it('should return loading state initially', () => {
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const { result } = renderHook(() => usePermissions(), { wrapper });
    expect(result.current.loading).toBe(true);
  });

  it('should load permissions for user', async () => {
    const mockRoles = [{ role: 'ceo' }];
    const mockPermissions = [
      { role: 'ceo', module: 'dashboard', can_read: true, can_create: true, can_update: true, can_delete: true },
    ];

    (supabase.from as any)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockRoles, error: null }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({ data: mockPermissions, error: null }),
      });

    const { result } = renderHook(() => usePermissions(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.roles).toEqual(['ceo']);
    expect(result.current.isCeo).toBe(true);
  });

  it('should allow access for CEO to any module', async () => {
    const mockRoles = [{ role: 'ceo' }];
    const mockPermissions: any[] = [];

    (supabase.from as any)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockRoles, error: null }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({ data: mockPermissions, error: null }),
      });

    const { result } = renderHook(() => usePermissions(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.canAccess('dashboard')).toBe(true);
    expect(result.current.canAccess('admin')).toBe(true);
  });

  it('should check specific permissions for non-CEO roles', async () => {
    const mockRoles = [{ role: 'labo_patisserie' }];
    const mockPermissions = [
      { role: 'labo_patisserie', module: 'production', can_read: true, can_create: true, can_update: false, can_delete: false },
    ];

    (supabase.from as any)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockRoles, error: null }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({ data: mockPermissions, error: null }),
      });

    const { result } = renderHook(() => usePermissions(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.can('production', 'read')).toBe(true);
    expect(result.current.can('production', 'create')).toBe(true);
    expect(result.current.can('production', 'update')).toBe(false);
    expect(result.current.can('production', 'delete')).toBe(false);
  });
});
