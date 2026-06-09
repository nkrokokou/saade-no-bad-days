import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
  id: string;
  type: string;
  titre: string;
  message: string;
  severite: 'info' | 'warning' | 'danger';
  lien: string | null;
  lue: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data || []) as any);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel('notifications-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, load)
      .subscribe();
    const i = setInterval(load, 60_000);
    return () => { supabase.removeChannel(channel); clearInterval(i); };
  }, [user, load]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ lue: true }).eq('id', id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, lue: true } : n));
  };

  const markAllRead = async () => {
    const ids = items.filter(n => !n.lue).map(n => n.id);
    if (!ids.length) return;
    await supabase.from('notifications').update({ lue: true }).in('id', ids);
    setItems(prev => prev.map(n => ({ ...n, lue: true })));
  };

  const unread = items.filter(n => !n.lue).length;
  return { items, unread, loading, markRead, markAllRead, refresh: load };
}
