import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Produit {
  id: string;
  nom: string;
  categorie: string;
  sous_categorie?: string | null;
  unite?: string;
  prix_vente?: number;
  prix_cout?: number;
  photo_url?: string | null;
  actif?: boolean;
}

export function useProducts(categorie?: string, includeInactive = false) {
  return useQuery({
    queryKey: ['produits', categorie, includeInactive],
    queryFn: async () => {
      let q = supabase.from('produits').select('*').order('nom');
      if (categorie) q = q.eq('categorie', categorie);
      if (!includeInactive) q = q.eq('actif', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as Produit[];
    },
  });
}
