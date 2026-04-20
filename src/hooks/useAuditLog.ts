import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';

export function useAuditLog() {
  const { user } = useAuth();
  return useCallback(
    async (action: string, table_name: string, record_id?: string, details?: Record<string, unknown>) => {
      if (!user) return;
      try {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          user_email: user.email || '',
          action,
          table_name,
          record_id: record_id || null,
          details: details || {},
        } as any);
      } catch (e) {
        console.error('audit log failed', e);
      }
    },
    [user]
  );
}
