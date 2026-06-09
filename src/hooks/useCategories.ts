import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Categorie {
  id: string;
  nom: string;
  ordre: number;
  actif: boolean;
  parent_id?: string | null;
  imprimante_cible?: 'chaud' | 'froid' | 'caisse' | 'aucune';
}

export function useCategories(activeOnly = true) {
  return useQuery({
    queryKey: ['categories_produits', activeOnly],
    queryFn: async () => {
      let q = supabase.from('categories_produits' as any).select('*').order('ordre').order('nom');
      if (activeOnly) q = q.eq('actif', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Categorie[];
    },
  });
}
