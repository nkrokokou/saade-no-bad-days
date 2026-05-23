import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useSupabaseRealtime', () => {
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;
  let callback: ((payload: any) => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    // Mock supabase channel behavior
    (supabase.channel as any) = vi.fn().mockImplementation((_name: string) => ({
      on: vi.fn().mockImplementation((_event: string, _filter: any, cb: any) => {
        callback = cb;
        return { subscribe: vi.fn() };
      }),
      subscribe: vi.fn(),
    }));
    (supabase.removeChannel as any) = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should subscribe and invalidate queries on payload', async () => {
    const wrapper = ({ children }: any) => React.createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useSupabaseRealtime('test_table', ['test_key'], { debounceMs: 0 }), { wrapper });

    // Simulate a realtime payload
    act(() => { if (callback) callback({}); });
    vi.runAllTimers();    expect(invalidateSpy).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });
});
