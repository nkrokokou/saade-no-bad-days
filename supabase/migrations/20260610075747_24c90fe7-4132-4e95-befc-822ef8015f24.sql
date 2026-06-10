UPDATE public.produits SET categorie = 'VIENNOISERIE', updated_at = now()
WHERE id IN (
  '1235590f-a23d-4e54-94d2-8662d4b1f620', -- Donut Nutella Kinder
  '251f324a-57a3-4dcc-98cc-3d13f49a2025', -- Donut Oreo
  'c968c5b7-3e0e-443d-bc11-c80d92ec4d63', -- Donut Speculoos
  '215d4ee7-6fae-4069-9602-eb93b1f44d17', -- Donut Vermicelles
  '7694109e-4b1c-483d-bc5c-8bad107e6612'  -- Mini Donut
);