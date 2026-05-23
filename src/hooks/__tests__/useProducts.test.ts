import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProducts, Produit } from '@/hooks/useProducts';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('useProducts', () => {
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
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  const mockProducts: Produit[] = [
    {
      id: '1',
      nom: 'Croissant',
      categorie: 'Viennoiserie',
      sous_categorie: 'Petit-déjeuner',
      unite: 'pièce',
      prix_vente: 500,
      prix_cout: 200,
      photo_url: null,
      actif: true,
      poste_preparation: 'labo_viennoiserie',
    },
    {
      id: '2',
      nom: 'Baguette',
      categorie: 'Pain',
      unite: 'pièce',
      prix_vente: 300,
      prix_cout: 100,
      photo_url: null,
      actif: true,
      poste_preparation: 'labo_patisserie',
    },
  ];

  it('should fetch all active products by default', async () => {
    const mockQuery = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
      }),
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: mockQuery,
      }),
    });

    const { result } = renderHook(() => useProducts(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockProducts);
    expect(supabase.from).toHaveBeenCalledWith('produits');
  });

  it('should filter by category when provided', async () => {
    const mockQuery = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [mockProducts[0]], error: null }),
      }),
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: mockQuery,
      }),
    });

    const { result } = renderHook(() => useProducts('Viennoiserie'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([mockProducts[0]]);
  });

  it('should include inactive products when specified', async () => {
    const inactiveProduct: Produit = {
      id: '3',
      nom: 'Old Product',
      categorie: 'Test',
      actif: false,
    };

    const mockQuery = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [mockProducts[0], inactiveProduct], error: null }),
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: mockQuery,
      }),
    });

    const { result } = renderHook(() => useProducts(undefined, true), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
  });

  it('should handle errors gracefully', async () => {
    const mockQuery = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
      }),
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: mockQuery,
      }),
    });

    const { result } = renderHook(() => useProducts(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});
