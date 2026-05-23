import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Hook to subscribe to Supabase realtime changes for a given table.
 * When a row is inserted, updated, or deleted, it invalidates the corresponding React Query cache key.
 * Includes error handling, debounced invalidations, and a toast notification for UI feedback.
 *
 * @param table - The name of the Supabase table to listen to.
 * @param queryKey - The React Query key to invalidate when a change occurs.
 * @param options - Optional configuration (debounceMs default 300).
 */
export function useSupabaseRealtime(
  table: string,
  queryKey: any[],
  options?: { debounceMs?: number }
) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const debounceMs = options?.debounceMs ?? 300;

  useEffect(() => {
    try {
      const channel = supabase.channel(`realtime-${table}`);
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          // Debounce invalidation to avoid flooding the network
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey });
            toast.success(`🔄 ${table} mis à jour`);
          }, debounceMs);
        })
        .subscribe();

      // Cleanup on unmount
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        supabase.removeChannel(channel);
      };
    } catch (err: any) {
      toast.error(`❗️ Erreur de realtime pour ${table}: ${err.message || err}`);
    }
  }, [table, queryKey, queryClient, debounceMs]);
}

export default useSupabaseRealtime;
