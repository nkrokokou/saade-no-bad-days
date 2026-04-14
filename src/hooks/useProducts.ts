import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Produit {
  id: string;
  nom: string;
  categorie: string;
  unite?: string;
  prix_vente?: number;
}

export function useProducts(categorie?: string) {
  return useQuery({
    queryKey: ['produits', categorie],
    queryFn: async () => {
      let q = supabase.from('produits').select('*').order('nom');
      if (categorie) q = q.eq('categorie', categorie);
      const { data, error } = await q;
      if (error) throw error;
      return data as Produit[];
    },
  });
}
