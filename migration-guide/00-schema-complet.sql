
-- ============================================================
-- 20260410013252_0711b09d-fcda-4827-89cf-d96fb01ebbb2.sql
-- ============================================================

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'salle' check (role in ('ceo', 'labo_patisserie', 'labo_viennoiserie', 'cuisine_salee', 'salle')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Products table
create table public.produits (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  categorie text not null default 'DIVERS',
  unite text default 'piÃ¨ce',
  created_at timestamptz not null default now()
);

alter table public.produits enable row level security;

create policy "Authenticated users can read products"
  on public.produits for select
  to authenticated
  using (true);

-- Bons de transfert
create table public.bons_transfert (
  id uuid primary key default gen_random_uuid(),
  date_transfert date not null,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'livre', 'recu', 'cloture')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.bons_transfert enable row level security;

create policy "Authenticated users can read bons"
  on public.bons_transfert for select to authenticated using (true);
create policy "Authenticated users can insert bons"
  on public.bons_transfert for insert to authenticated with check (true);
create policy "Authenticated users can update bons"
  on public.bons_transfert for update to authenticated using (true);

-- Bon transfert lignes
create table public.bon_transfert_lignes (
  id uuid primary key default gen_random_uuid(),
  bon_transfert_id uuid not null references public.bons_transfert(id) on delete cascade,
  produit_id uuid not null references public.produits(id),
  qte_prevue numeric not null default 0,
  solde_ouverture numeric not null default 0,
  qte_recue numeric not null default 0,
  perte numeric not null default 0,
  solde_fin numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.bon_transfert_lignes enable row level security;

create policy "Authenticated can read lignes"
  on public.bon_transfert_lignes for select to authenticated using (true);
create policy "Authenticated can insert lignes"
  on public.bon_transfert_lignes for insert to authenticated with check (true);
create policy "Authenticated can update lignes"
  on public.bon_transfert_lignes for update to authenticated using (true);

-- Stock tampon
create table public.stock_tampon (
  id uuid primary key default gen_random_uuid(),
  date_stock date not null,
  produit_id uuid not null references public.produits(id),
  quantite numeric not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.stock_tampon enable row level security;

create policy "Authenticated can read stock"
  on public.stock_tampon for select to authenticated using (true);
create policy "Authenticated can insert stock"
  on public.stock_tampon for insert to authenticated with check (true);
create policy "Authenticated can update stock"
  on public.stock_tampon for update to authenticated using (true);

-- Pertes
create table public.pertes (
  id uuid primary key default gen_random_uuid(),
  semaine_debut date not null,
  jour text not null,
  type_labo text not null,
  produit_id uuid not null references public.produits(id),
  quantite numeric not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.pertes enable row level security;

create policy "Authenticated can read pertes"
  on public.pertes for select to authenticated using (true);
create policy "Authenticated can insert pertes"
  on public.pertes for insert to authenticated with check (true);
create policy "Authenticated can update pertes"
  on public.pertes for update to authenticated using (true);

-- Production labo
create table public.production_labo (
  id uuid primary key default gen_random_uuid(),
  date_production date not null,
  produit_id uuid not null references public.produits(id),
  qte_produite numeric not null default 0,
  qte_sortie_en_salle numeric not null default 0,
  qte_perte numeric not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.production_labo enable row level security;

create policy "Authenticated can read production"
  on public.production_labo for select to authenticated using (true);
create policy "Authenticated can insert production"
  on public.production_labo for insert to authenticated with check (true);
create policy "Authenticated can update production"
  on public.production_labo for update to authenticated using (true);

-- Inventaire
create table public.inventaire (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  date_inventaire date not null,
  nom_produit text not null,
  quantite numeric not null default 0,
  unite text default 'g',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.inventaire enable row level security;

create policy "Authenticated can read inventaire"
  on public.inventaire for select to authenticated using (true);
create policy "Authenticated can insert inventaire"
  on public.inventaire for insert to authenticated with check (true);
create policy "Authenticated can delete inventaire"
  on public.inventaire for delete to authenticated using (true);


-- ============================================================
-- 20260411071155_9b9c7299-e790-42f3-b380-8f4213789e1f.sql
-- ============================================================

-- Table ClÃ´ture journaliÃ¨re & Invendus -50%
CREATE TABLE public.cloture_journaliere (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_cloture DATE NOT NULL,
  produit_id UUID NOT NULL REFERENCES public.produits(id),
  qte_vendue NUMERIC NOT NULL DEFAULT 0,
  qte_invendu NUMERIC NOT NULL DEFAULT 0,
  prix_invendu_50 NUMERIC NOT NULL DEFAULT 0,
  qte_perte NUMERIC NOT NULL DEFAULT 0,
  qte_degustation NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cloture_journaliere ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cloture" ON public.cloture_journaliere FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert cloture" ON public.cloture_journaliere FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update cloture" ON public.cloture_journaliere FOR UPDATE TO authenticated USING (true);

-- Table DÃ©gustations
CREATE TABLE public.degustations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_degustation DATE NOT NULL,
  produit_id UUID NOT NULL REFERENCES public.produits(id),
  quantite NUMERIC NOT NULL DEFAULT 0,
  motif TEXT DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.degustations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read degustations" ON public.degustations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert degustations" ON public.degustations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update degustations" ON public.degustations FOR UPDATE TO authenticated USING (true);


-- ============================================================
-- 20260413001618_76e274d0-7c21-484e-82ba-57ea52af3f39.sql
-- ============================================================

-- Table achats matiÃ¨res premiÃ¨res
CREATE TABLE public.achats_mp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_achat DATE NOT NULL,
  fournisseur TEXT NOT NULL DEFAULT '',
  produit TEXT NOT NULL,
  quantite NUMERIC NOT NULL DEFAULT 0,
  unite TEXT DEFAULT 'kg',
  prix_unitaire NUMERIC NOT NULL DEFAULT 0,
  prix_total NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.achats_mp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read achats" ON public.achats_mp FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert achats" ON public.achats_mp FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update achats" ON public.achats_mp FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete achats" ON public.achats_mp FOR DELETE TO authenticated USING (true);

-- Table mouvements stock tampon (entrÃ©es/sorties)
CREATE TABLE public.mouvements_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_mouvement DATE NOT NULL,
  produit_id UUID NOT NULL REFERENCES public.produits(id),
  type TEXT NOT NULL DEFAULT 'entree', -- 'entree' or 'sortie'
  quantite NUMERIC NOT NULL DEFAULT 0,
  motif TEXT DEFAULT '',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mouvements_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read mouvements" ON public.mouvements_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert mouvements" ON public.mouvements_stock FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update mouvements" ON public.mouvements_stock FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete mouvements" ON public.mouvements_stock FOR DELETE TO authenticated USING (true);

-- Ajout colonnes flux salle Ã  clÃ´ture journaliÃ¨re
ALTER TABLE public.cloture_journaliere ADD COLUMN IF NOT EXISTS stock_ouverture NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.cloture_journaliere ADD COLUMN IF NOT EXISTS qte_recue NUMERIC NOT NULL DEFAULT 0;

-- Enable realtime pour mouvements
ALTER PUBLICATION supabase_realtime ADD TABLE public.mouvements_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.achats_mp;


-- ============================================================
-- 20260414004701_f6411f26-c37a-422e-8f4c-57e228a7c6de.sql
-- ============================================================
-- Add prix_vente to produits
ALTER TABLE public.produits ADD COLUMN prix_vente numeric NOT NULL DEFAULT 0;

-- Create fiches_techniques table (recipes: MP â†’ product)
CREATE TABLE public.fiches_techniques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES public.produits(id) ON DELETE CASCADE,
  matiere_premiere text NOT NULL,
  quantite_mp numeric NOT NULL DEFAULT 0,
  unite_mp text NOT NULL DEFAULT 'kg',
  cout_unitaire_mp numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.fiches_techniques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read fiches" ON public.fiches_techniques FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert fiches" ON public.fiches_techniques FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update fiches" ON public.fiches_techniques FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete fiches" ON public.fiches_techniques FOR DELETE TO authenticated USING (true);

-- Allow authenticated to insert/update produits (for prix_vente management)
CREATE POLICY "Authenticated can insert produits" ON public.produits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update produits" ON public.produits FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- 20260420111746_cc7d82bb-52f5-4e71-95dd-66303402d184.sql
-- ============================================================
-- 1. Enum des rÃ´les
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('ceo', 'labo_patisserie', 'labo_viennoiserie', 'cuisine_salee', 'salle');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Table user_roles (sÃ©parÃ©e de profiles)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Table matrice permissions
CREATE TABLE IF NOT EXISTS public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module text NOT NULL,
  can_read boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  UNIQUE(role, module)
);

ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- 4. Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_ceo(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'ceo'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.can_perform(_user_id uuid, _module text, _action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF public.is_ceo(_user_id) THEN RETURN true; END IF;
  SELECT CASE _action
    WHEN 'read'   THEN bool_or(can_read)
    WHEN 'create' THEN bool_or(can_create)
    WHEN 'update' THEN bool_or(can_update)
    WHEN 'delete' THEN bool_or(can_delete)
    ELSE false
  END INTO allowed
  FROM public.module_permissions mp
  JOIN public.user_roles ur ON ur.role = mp.role
  WHERE ur.user_id = _user_id AND mp.module = _module;
  RETURN COALESCE(allowed, false);
END $$;

-- 5. RLS sur user_roles & module_permissions
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_ceo(auth.uid()));
DROP POLICY IF EXISTS "CEO manages roles" ON public.user_roles;
CREATE POLICY "CEO manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));

DROP POLICY IF EXISTS "All read permissions" ON public.module_permissions;
CREATE POLICY "All read permissions" ON public.module_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "CEO manages permissions" ON public.module_permissions;
CREATE POLICY "CEO manages permissions" ON public.module_permissions FOR ALL TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));

-- 6. Migration des rÃ´les existants profiles â†’ user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role::public.app_role FROM public.profiles
WHERE role IN ('ceo','labo_patisserie','labo_viennoiserie','cuisine_salee','salle')
ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Trigger : crÃ©er rÃ´le "salle" par dÃ©faut Ã  l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'salle'::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 8. Seed matrice permissions
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete) VALUES
  -- CEO : tout (mais on garde le bypass via is_ceo)
  ('ceo','dashboard',true,true,true,true),
  ('ceo','insights',true,true,true,true),
  ('ceo','admin',true,true,true,true),
  ('ceo','achats_mp',true,true,true,true),
  ('ceo','fiches_techniques',true,true,true,true),
  ('ceo','bons_transfert',true,true,true,true),
  ('ceo','stock_tampon',true,true,true,true),
  ('ceo','pertes',true,true,true,true),
  ('ceo','production',true,true,true,true),
  ('ceo','inventaire',true,true,true,true),
  ('ceo','cloture',true,true,true,true),
  ('ceo','degustations',true,true,true,true),
  -- LABO PÃ‚TISSERIE
  ('labo_patisserie','achats_mp',true,true,true,false),
  ('labo_patisserie','fiches_techniques',true,true,true,true),
  ('labo_patisserie','bons_transfert',true,true,true,false),
  ('labo_patisserie','stock_tampon',true,true,true,false),
  ('labo_patisserie','pertes',true,true,true,false),
  ('labo_patisserie','production',true,true,true,false),
  -- LABO VIENNOISERIE
  ('labo_viennoiserie','achats_mp',true,true,true,false),
  ('labo_viennoiserie','fiches_techniques',true,true,true,true),
  ('labo_viennoiserie','bons_transfert',true,true,true,false),
  ('labo_viennoiserie','stock_tampon',true,true,true,false),
  ('labo_viennoiserie','pertes',true,true,true,false),
  ('labo_viennoiserie','production',true,true,true,false),
  -- CUISINE SALÃ‰E
  ('cuisine_salee','achats_mp',true,true,true,false),
  ('cuisine_salee','stock_tampon',true,true,true,false),
  ('cuisine_salee','pertes',true,true,true,false),
  ('cuisine_salee','inventaire',true,true,true,true),
  -- SALLE
  ('salle','bons_transfert',true,false,true,false),
  ('salle','fiches_techniques',true,false,false,false),
  ('salle','cloture',true,true,true,false),
  ('salle','degustations',true,true,true,false)
ON CONFLICT (role, module) DO UPDATE SET
  can_read = EXCLUDED.can_read,
  can_create = EXCLUDED.can_create,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;

-- 9. Mise Ã  jour RLS sur tables mÃ©tier (utilise can_perform)
-- ACHATS_MP
DROP POLICY IF EXISTS "Authenticated can read achats" ON public.achats_mp;
DROP POLICY IF EXISTS "Authenticated can insert achats" ON public.achats_mp;
DROP POLICY IF EXISTS "Authenticated can update achats" ON public.achats_mp;
DROP POLICY IF EXISTS "Authenticated can delete achats" ON public.achats_mp;
CREATE POLICY "perm read achats" ON public.achats_mp FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'achats_mp','read'));
CREATE POLICY "perm insert achats" ON public.achats_mp FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'achats_mp','create'));
CREATE POLICY "perm update achats" ON public.achats_mp FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'achats_mp','update'));
CREATE POLICY "perm delete achats" ON public.achats_mp FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'achats_mp','delete'));

-- FICHES_TECHNIQUES
DROP POLICY IF EXISTS "Authenticated can read fiches" ON public.fiches_techniques;
DROP POLICY IF EXISTS "Authenticated can insert fiches" ON public.fiches_techniques;
DROP POLICY IF EXISTS "Authenticated can update fiches" ON public.fiches_techniques;
DROP POLICY IF EXISTS "Authenticated can delete fiches" ON public.fiches_techniques;
CREATE POLICY "perm read fiches" ON public.fiches_techniques FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'fiches_techniques','read'));
CREATE POLICY "perm insert fiches" ON public.fiches_techniques FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'fiches_techniques','create'));
CREATE POLICY "perm update fiches" ON public.fiches_techniques FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'fiches_techniques','update'));
CREATE POLICY "perm delete fiches" ON public.fiches_techniques FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'fiches_techniques','delete'));

-- BONS_TRANSFERT
DROP POLICY IF EXISTS "Authenticated users can read bons" ON public.bons_transfert;
DROP POLICY IF EXISTS "Authenticated users can insert bons" ON public.bons_transfert;
DROP POLICY IF EXISTS "Authenticated users can update bons" ON public.bons_transfert;
CREATE POLICY "perm read bons" ON public.bons_transfert FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','read'));
CREATE POLICY "perm insert bons" ON public.bons_transfert FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'bons_transfert','create'));
CREATE POLICY "perm update bons" ON public.bons_transfert FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','update'));
CREATE POLICY "perm delete bons" ON public.bons_transfert FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','delete'));

DROP POLICY IF EXISTS "Authenticated can read lignes" ON public.bon_transfert_lignes;
DROP POLICY IF EXISTS "Authenticated can insert lignes" ON public.bon_transfert_lignes;
DROP POLICY IF EXISTS "Authenticated can update lignes" ON public.bon_transfert_lignes;
CREATE POLICY "perm read lignes" ON public.bon_transfert_lignes FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','read'));
CREATE POLICY "perm insert lignes" ON public.bon_transfert_lignes FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'bons_transfert','create'));
CREATE POLICY "perm update lignes" ON public.bon_transfert_lignes FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','update'));
CREATE POLICY "perm delete lignes" ON public.bon_transfert_lignes FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'bons_transfert','delete'));

-- STOCK_TAMPON
DROP POLICY IF EXISTS "Authenticated can read stock" ON public.stock_tampon;
DROP POLICY IF EXISTS "Authenticated can insert stock" ON public.stock_tampon;
DROP POLICY IF EXISTS "Authenticated can update stock" ON public.stock_tampon;
CREATE POLICY "perm read stock" ON public.stock_tampon FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','read'));
CREATE POLICY "perm insert stock" ON public.stock_tampon FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'stock_tampon','create'));
CREATE POLICY "perm update stock" ON public.stock_tampon FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','update'));
CREATE POLICY "perm delete stock" ON public.stock_tampon FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','delete'));

-- MOUVEMENTS_STOCK (liÃ© Ã  stock_tampon)
DROP POLICY IF EXISTS "Authenticated can read mouvements" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Authenticated can insert mouvements" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Authenticated can update mouvements" ON public.mouvements_stock;
DROP POLICY IF EXISTS "Authenticated can delete mouvements" ON public.mouvements_stock;
CREATE POLICY "perm read mouvements" ON public.mouvements_stock FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','read'));
CREATE POLICY "perm insert mouvements" ON public.mouvements_stock FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'stock_tampon','create'));
CREATE POLICY "perm update mouvements" ON public.mouvements_stock FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','update'));
CREATE POLICY "perm delete mouvements" ON public.mouvements_stock FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'stock_tampon','delete'));

-- PERTES
DROP POLICY IF EXISTS "Authenticated can read pertes" ON public.pertes;
DROP POLICY IF EXISTS "Authenticated can insert pertes" ON public.pertes;
DROP POLICY IF EXISTS "Authenticated can update pertes" ON public.pertes;
CREATE POLICY "perm read pertes" ON public.pertes FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'pertes','read'));
CREATE POLICY "perm insert pertes" ON public.pertes FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'pertes','create'));
CREATE POLICY "perm update pertes" ON public.pertes FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'pertes','update'));
CREATE POLICY "perm delete pertes" ON public.pertes FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'pertes','delete'));

-- PRODUCTION_LABO
DROP POLICY IF EXISTS "Authenticated can read production" ON public.production_labo;
DROP POLICY IF EXISTS "Authenticated can insert production" ON public.production_labo;
DROP POLICY IF EXISTS "Authenticated can update production" ON public.production_labo;
CREATE POLICY "perm read production" ON public.production_labo FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'production','read'));
CREATE POLICY "perm insert production" ON public.production_labo FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'production','create'));
CREATE POLICY "perm update production" ON public.production_labo FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'production','update'));
CREATE POLICY "perm delete production" ON public.production_labo FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'production','delete'));

-- INVENTAIRE
DROP POLICY IF EXISTS "Authenticated can read inventaire" ON public.inventaire;
DROP POLICY IF EXISTS "Authenticated can insert inventaire" ON public.inventaire;
DROP POLICY IF EXISTS "Authenticated can delete inventaire" ON public.inventaire;
CREATE POLICY "perm read inventaire" ON public.inventaire FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'inventaire','read'));
CREATE POLICY "perm insert inventaire" ON public.inventaire FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'inventaire','create'));
CREATE POLICY "perm update inventaire" ON public.inventaire FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'inventaire','update'));
CREATE POLICY "perm delete inventaire" ON public.inventaire FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'inventaire','delete'));

-- CLOTURE
DROP POLICY IF EXISTS "Authenticated can read cloture" ON public.cloture_journaliere;
DROP POLICY IF EXISTS "Authenticated can insert cloture" ON public.cloture_journaliere;
DROP POLICY IF EXISTS "Authenticated can update cloture" ON public.cloture_journaliere;
CREATE POLICY "perm read cloture" ON public.cloture_journaliere FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'cloture','read'));
CREATE POLICY "perm insert cloture" ON public.cloture_journaliere FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'cloture','create'));
CREATE POLICY "perm update cloture" ON public.cloture_journaliere FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'cloture','update'));
CREATE POLICY "perm delete cloture" ON public.cloture_journaliere FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'cloture','delete'));

-- DEGUSTATIONS
DROP POLICY IF EXISTS "Authenticated can read degustations" ON public.degustations;
DROP POLICY IF EXISTS "Authenticated can insert degustations" ON public.degustations;
DROP POLICY IF EXISTS "Authenticated can update degustations" ON public.degustations;
CREATE POLICY "perm read degustations" ON public.degustations FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'degustations','read'));
CREATE POLICY "perm insert degustations" ON public.degustations FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'degustations','create'));
CREATE POLICY "perm update degustations" ON public.degustations FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'degustations','update'));
CREATE POLICY "perm delete degustations" ON public.degustations FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'degustations','delete'));

-- ============================================================
-- 20260420112320_6ba3eaae-d694-4fcd-8ae2-2586d6abf9a3.sql
-- ============================================================
-- Workflow bons_transfert
ALTER TABLE public.bons_transfert
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_by uuid,
  ADD COLUMN IF NOT EXISTS received_by uuid,
  ADD COLUMN IF NOT EXISTS validated_by uuid,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_bons_transfert_date ON public.bons_transfert(date_transfert DESC);
CREATE INDEX IF NOT EXISTS idx_bons_transfert_statut ON public.bons_transfert(statut);

-- Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_table ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_date ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can insert audit" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "CEO can read audit" ON public.audit_logs;
CREATE POLICY "CEO can read audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_ceo(auth.uid()));

-- ============================================================
-- 20260420114853_fed91d67-dfc9-46fd-90e1-c26c763bab6b.sql
-- ============================================================
-- Add photo_url to pertes and degustations
ALTER TABLE public.pertes ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.degustations ADD COLUMN IF NOT EXISTS photo_url text;

-- Create storage bucket for evidence photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence-photos', 'evidence-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects for evidence-photos bucket
CREATE POLICY "Public can view evidence photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidence-photos');

CREATE POLICY "Authenticated can upload evidence photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidence-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own evidence photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'evidence-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own evidence photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'evidence-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- 20260420120107_e15403c1-a51f-40c5-9d8b-956ae3a59638.sql
-- ============================================================

-- 1. Fix produits permissive policies
DROP POLICY IF EXISTS "Authenticated can insert produits" ON public.produits;
DROP POLICY IF EXISTS "Authenticated can update produits" ON public.produits;

CREATE POLICY "perm insert produits" ON public.produits
  FOR INSERT TO authenticated
  WITH CHECK (public.can_perform(auth.uid(), 'fiches_techniques', 'create'));

CREATE POLICY "perm update produits" ON public.produits
  FOR UPDATE TO authenticated
  USING (public.can_perform(auth.uid(), 'fiches_techniques', 'update'));

CREATE POLICY "perm delete produits" ON public.produits
  FOR DELETE TO authenticated
  USING (public.is_ceo(auth.uid()));

-- 2. Make evidence-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'evidence-photos';

DROP POLICY IF EXISTS "Public can view evidence photos" ON storage.objects;

CREATE POLICY "Authenticated can view evidence photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidence-photos');

-- 3. Prevent users from changing their own role via profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile name only"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "CEO can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_ceo(auth.uid()))
  WITH CHECK (public.is_ceo(auth.uid()));


-- ============================================================
-- 20260420120246_86af5913-4065-4d0e-a9b6-6441f4211268.sql
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'achats_mp'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.achats_mp';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mouvements_stock'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.mouvements_stock';
  END IF;
END $$;


-- ============================================================
-- 20260506075906_cbe3090c-aba8-45e7-8be3-6c6b5d608f1b.sql
-- ============================================================

ALTER TABLE public.produits
  ADD COLUMN IF NOT EXISTS sous_categorie text,
  ADD COLUMN IF NOT EXISTS prix_cout numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Permissions catalogue : CEO bypass dÃ©jÃ  gÃ©rÃ© par can_perform.
-- Seed default module_permissions for 'catalogue' module so non-CEO can read.
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete)
SELECT r::public.app_role, 'catalogue', true, false, false, false
FROM unnest(ARRAY['labo_patisserie','labo_viennoiserie','cuisine_salee','salle']) AS r
ON CONFLICT DO NOTHING;

-- Update produits RLS to use 'catalogue' module
DROP POLICY IF EXISTS "perm insert produits" ON public.produits;
DROP POLICY IF EXISTS "perm update produits" ON public.produits;
DROP POLICY IF EXISTS "perm delete produits" ON public.produits;

CREATE POLICY "perm insert produits" ON public.produits
  FOR INSERT TO authenticated
  WITH CHECK (public.can_perform(auth.uid(), 'catalogue', 'create'));

CREATE POLICY "perm update produits" ON public.produits
  FOR UPDATE TO authenticated
  USING (public.can_perform(auth.uid(), 'catalogue', 'update'));

CREATE POLICY "perm delete produits" ON public.produits
  FOR DELETE TO authenticated
  USING (public.can_perform(auth.uid(), 'catalogue', 'delete'));


-- ============================================================
-- 20260506080621_35a26ea4-da02-4307-8c63-b2fc23ca8024.sql
-- ============================================================

-- Sessions de caisse
CREATE TABLE IF NOT EXISTS public.sessions_caisse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ouvert_par uuid,
  ferme_par uuid,
  fond_initial numeric NOT NULL DEFAULT 0,
  fond_final_attendu numeric DEFAULT 0,
  fond_final_compte numeric DEFAULT 0,
  ecart numeric DEFAULT 0,
  statut text NOT NULL DEFAULT 'ouverte',
  ouvert_at timestamptz NOT NULL DEFAULT now(),
  ferme_at timestamptz,
  notes text
);
ALTER TABLE public.sessions_caisse ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read sessions" ON public.sessions_caisse FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'pos','read'));
CREATE POLICY "perm insert sessions" ON public.sessions_caisse FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'pos','create'));
CREATE POLICY "perm update sessions" ON public.sessions_caisse FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'pos','update'));
CREATE POLICY "perm delete sessions" ON public.sessions_caisse FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'pos','delete'));

-- Ventes (tickets)
CREATE TABLE IF NOT EXISTS public.ventes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions_caisse(id) ON DELETE SET NULL,
  numero_ticket bigserial,
  date_vente timestamptz NOT NULL DEFAULT now(),
  total numeric NOT NULL DEFAULT 0,
  remise_globale numeric NOT NULL DEFAULT 0,
  mode_paiement text NOT NULL DEFAULT 'especes',
  montant_recu numeric DEFAULT 0,
  rendu numeric DEFAULT 0,
  statut text NOT NULL DEFAULT 'validee',
  encaisse_par uuid,
  client_nom text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ventes_date ON public.ventes(date_vente);
CREATE INDEX IF NOT EXISTS idx_ventes_session ON public.ventes(session_id);
ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read ventes" ON public.ventes FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'ventes','read') OR public.can_perform(auth.uid(),'pos','read'));
CREATE POLICY "perm insert ventes" ON public.ventes FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'pos','create'));
CREATE POLICY "perm update ventes" ON public.ventes FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'pos','update') OR public.can_perform(auth.uid(),'ventes','update'));
CREATE POLICY "perm delete ventes" ON public.ventes FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'ventes','delete'));

-- Lignes de vente
CREATE TABLE IF NOT EXISTS public.vente_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vente_id uuid NOT NULL REFERENCES public.ventes(id) ON DELETE CASCADE,
  produit_id uuid NOT NULL,
  produit_nom text NOT NULL,
  quantite numeric NOT NULL DEFAULT 1,
  prix_unitaire numeric NOT NULL DEFAULT 0,
  remise numeric NOT NULL DEFAULT 0,
  total_ligne numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vlignes_vente ON public.vente_lignes(vente_id);
CREATE INDEX IF NOT EXISTS idx_vlignes_produit ON public.vente_lignes(produit_id);
ALTER TABLE public.vente_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read vlignes" ON public.vente_lignes FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'ventes','read') OR public.can_perform(auth.uid(),'pos','read'));
CREATE POLICY "perm insert vlignes" ON public.vente_lignes FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'pos','create'));
CREATE POLICY "perm update vlignes" ON public.vente_lignes FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'pos','update'));
CREATE POLICY "perm delete vlignes" ON public.vente_lignes FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'ventes','delete'));

-- Default permissions for new modules
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete) VALUES
  ('salle','pos',true,true,true,false),
  ('salle','ventes',true,false,false,false),
  ('labo_patisserie','pos',false,false,false,false),
  ('labo_viennoiserie','pos',false,false,false,false),
  ('cuisine_salee','pos',false,false,false,false),
  ('labo_patisserie','ventes',false,false,false,false),
  ('labo_viennoiserie','ventes',false,false,false,false),
  ('cuisine_salee','ventes',false,false,false,false)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 20260506083156_69a77464-fe91-4a4e-ac1e-ca5e9c4fd7ea.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  notes TEXT,
  plafond_credit NUMERIC NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read clients" ON public.clients FOR SELECT TO authenticated USING (can_perform(auth.uid(), 'clients', 'read'));
CREATE POLICY "perm insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (can_perform(auth.uid(), 'clients', 'create'));
CREATE POLICY "perm update clients" ON public.clients FOR UPDATE TO authenticated USING (can_perform(auth.uid(), 'clients', 'update'));
CREATE POLICY "perm delete clients" ON public.clients FOR DELETE TO authenticated USING (can_perform(auth.uid(), 'clients', 'delete'));
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.credits_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  client_nom TEXT NOT NULL,
  vente_id UUID,
  montant_initial NUMERIC NOT NULL DEFAULT 0,
  montant_restant NUMERIC NOT NULL DEFAULT 0,
  date_credit DATE NOT NULL DEFAULT CURRENT_DATE,
  statut TEXT NOT NULL DEFAULT 'ouvert',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.credits_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read credits" ON public.credits_clients FOR SELECT TO authenticated USING (can_perform(auth.uid(), 'clients', 'read') OR can_perform(auth.uid(), 'pos', 'read'));
CREATE POLICY "perm insert credits" ON public.credits_clients FOR INSERT TO authenticated WITH CHECK (can_perform(auth.uid(), 'pos', 'create') OR can_perform(auth.uid(), 'clients', 'create'));
CREATE POLICY "perm update credits" ON public.credits_clients FOR UPDATE TO authenticated USING (can_perform(auth.uid(), 'clients', 'update') OR can_perform(auth.uid(), 'pos', 'update'));
CREATE POLICY "perm delete credits" ON public.credits_clients FOR DELETE TO authenticated USING (can_perform(auth.uid(), 'clients', 'delete'));
CREATE TRIGGER trg_credits_updated BEFORE UPDATE ON public.credits_clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.paiements_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.credits_clients(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL DEFAULT 0,
  mode_paiement TEXT NOT NULL DEFAULT 'especes',
  date_paiement TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.paiements_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read paiements" ON public.paiements_credits FOR SELECT TO authenticated USING (can_perform(auth.uid(), 'clients', 'read') OR can_perform(auth.uid(), 'pos', 'read'));
CREATE POLICY "perm insert paiements" ON public.paiements_credits FOR INSERT TO authenticated WITH CHECK (can_perform(auth.uid(), 'clients', 'update') OR can_perform(auth.uid(), 'pos', 'create'));
CREATE POLICY "perm delete paiements" ON public.paiements_credits FOR DELETE TO authenticated USING (can_perform(auth.uid(), 'clients', 'delete'));

ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS client_id UUID;

CREATE OR REPLACE FUNCTION public.recalc_credit_restant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_credit_id UUID; v_initial NUMERIC; v_paye NUMERIC; v_restant NUMERIC;
BEGIN
  v_credit_id := COALESCE(NEW.credit_id, OLD.credit_id);
  SELECT montant_initial INTO v_initial FROM public.credits_clients WHERE id = v_credit_id;
  SELECT COALESCE(SUM(montant),0) INTO v_paye FROM public.paiements_credits WHERE credit_id = v_credit_id;
  v_restant := GREATEST(v_initial - v_paye, 0);
  UPDATE public.credits_clients
    SET montant_restant = v_restant,
        statut = CASE WHEN v_restant <= 0 THEN 'solde' ELSE 'ouvert' END
    WHERE id = v_credit_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_recalc_credit
AFTER INSERT OR UPDATE OR DELETE ON public.paiements_credits
FOR EACH ROW EXECUTE FUNCTION public.recalc_credit_restant();

INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete) VALUES
  ('salle', 'clients', true, true, true, false),
  ('ceo', 'clients', true, true, true, true);


-- ============================================================
-- 20260506092143_0cb4c680-e380-4c76-93a3-41c6d5f774b9.sql
-- ============================================================

-- 1. Categories table
CREATE TABLE IF NOT EXISTS public.categories_produits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories_produits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read categories"
  ON public.categories_produits FOR SELECT TO authenticated USING (true);

CREATE POLICY "CEO insert categories"
  ON public.categories_produits FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "CEO update categories"
  ON public.categories_produits FOR UPDATE TO authenticated
  USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "CEO delete categories"
  ON public.categories_produits FOR DELETE TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE TRIGGER tg_categories_produits_updated
  BEFORE UPDATE ON public.categories_produits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed from existing distinct categorie values
INSERT INTO public.categories_produits (nom, ordre)
SELECT DISTINCT categorie, 0 FROM public.produits
WHERE categorie IS NOT NULL AND categorie <> ''
ON CONFLICT (nom) DO NOTHING;

-- 2. Stock fin comptÃ© on cloture (for auto-perte)
ALTER TABLE public.cloture_journaliere
  ADD COLUMN IF NOT EXISTS stock_fin_compte NUMERIC;


-- ============================================================
-- 20260506095146_e3f31cf1-b336-4e5a-8fab-290074e394de.sql
-- ============================================================

-- 1. Add poste_preparation to produits
ALTER TABLE public.produits
  ADD COLUMN IF NOT EXISTS poste_preparation text NOT NULL DEFAULT 'salle';

-- 2. Tables restaurant
CREATE TABLE IF NOT EXISTS public.tables_restaurant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  zone text,
  places integer NOT NULL DEFAULT 2,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tables_restaurant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read tables" ON public.tables_restaurant
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "CEO manage tables insert" ON public.tables_restaurant
  FOR INSERT TO authenticated WITH CHECK (public.is_ceo(auth.uid()));
CREATE POLICY "CEO manage tables update" ON public.tables_restaurant
  FOR UPDATE TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));
CREATE POLICY "CEO manage tables delete" ON public.tables_restaurant
  FOR DELETE TO authenticated USING (public.is_ceo(auth.uid()));

CREATE TRIGGER trg_tables_updated_at BEFORE UPDATE ON public.tables_restaurant
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Ventes: table_id + serveur_id (pour service Ã  table)
ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES public.tables_restaurant(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS serveur_id uuid;

CREATE INDEX IF NOT EXISTS idx_ventes_statut_table ON public.ventes(statut, table_id);

-- 4. Seed quelques tables par dÃ©faut
INSERT INTO public.tables_restaurant (numero, zone, places) VALUES
  ('1', 'Salle', 2),('2', 'Salle', 2),('3', 'Salle', 4),('4', 'Salle', 4),
  ('5', 'Terrasse', 2),('6', 'Terrasse', 4),('Comptoir', 'Comptoir', 1)
ON CONFLICT (numero) DO NOTHING;


-- ============================================================
-- 20260506095646_7face515-7e4d-46d1-bdd4-01b0eee8d5e4.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.matieres_premieres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  marque text,
  fournisseur text,
  colisage numeric NOT NULL DEFAULT 1,
  unite text NOT NULL DEFAULT 'G',
  prix_achat numeric NOT NULL DEFAULT 0,
  prix_unitaire numeric NOT NULL DEFAULT 0,
  notes text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nom, marque, fournisseur)
);

ALTER TABLE public.matieres_premieres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read MP" ON public.matieres_premieres
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "perm insert MP" ON public.matieres_premieres
  FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(), 'catalogue', 'create'));
CREATE POLICY "perm update MP" ON public.matieres_premieres
  FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(), 'catalogue', 'update'));
CREATE POLICY "perm delete MP" ON public.matieres_premieres
  FOR DELETE TO authenticated USING (public.can_perform(auth.uid(), 'catalogue', 'delete'));

CREATE TRIGGER trg_mp_updated_at BEFORE UPDATE ON public.matieres_premieres
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_mp_nom ON public.matieres_premieres(nom);


-- ============================================================
-- 20260506100608_57c48f41-5f18-4ca1-b950-2a4b75e28347.sql
-- ============================================================
-- 1. Lien fiches_techniques -> matieres_premieres
ALTER TABLE public.fiches_techniques
  ADD COLUMN IF NOT EXISTS matiere_premiere_id UUID REFERENCES public.matieres_premieres(id) ON DELETE SET NULL;

ALTER TABLE public.fiches_techniques
  ALTER COLUMN matiere_premiere DROP NOT NULL;

-- 2. Trigger recalcul prix_cout produit
CREATE OR REPLACE FUNCTION public.recalc_produit_prix_cout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid UUID;
  v_total NUMERIC;
BEGIN
  v_pid := COALESCE(NEW.produit_id, OLD.produit_id);
  SELECT COALESCE(SUM(quantite_mp * cout_unitaire_mp), 0)
    INTO v_total
    FROM public.fiches_techniques
    WHERE produit_id = v_pid;
  UPDATE public.produits SET prix_cout = v_total, updated_at = now() WHERE id = v_pid;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recalc_produit_prix_cout ON public.fiches_techniques;
CREATE TRIGGER trg_recalc_produit_prix_cout
AFTER INSERT OR UPDATE OR DELETE ON public.fiches_techniques
FOR EACH ROW EXECUTE FUNCTION public.recalc_produit_prix_cout();

-- 3. Permissions par dÃ©faut pour matieres_premieres et tables_restaurant
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete) VALUES
  ('ceo', 'matieres_premieres', true, true, true, true),
  ('labo_patisserie', 'matieres_premieres', true, false, false, false),
  ('labo_viennoiserie', 'matieres_premieres', true, false, false, false),
  ('cuisine_salee', 'matieres_premieres', true, false, false, false),
  ('salle', 'matieres_premieres', false, false, false, false),
  ('ceo', 'tables_restaurant', true, true, true, true),
  ('labo_patisserie', 'tables_restaurant', false, false, false, false),
  ('labo_viennoiserie', 'tables_restaurant', false, false, false, false),
  ('cuisine_salee', 'tables_restaurant', false, false, false, false),
  ('salle', 'tables_restaurant', true, false, false, false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 20260506181308_95375298-9f3d-4d88-8aa6-69c99e3c231a.sql
-- ============================================================
-- 1. Lien direct achats â†’ MP rÃ©fÃ©rentiel
ALTER TABLE public.achats_mp
  ADD COLUMN IF NOT EXISTS matiere_premiere_id UUID REFERENCES public.matieres_premieres(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_achats_mp_mp_id ON public.achats_mp(matiere_premiere_id);

-- 2. Seuil d'alerte stock
ALTER TABLE public.matieres_premieres
  ADD COLUMN IF NOT EXISTS stock_min NUMERIC NOT NULL DEFAULT 0;

-- 3. Vue stock MP en temps rÃ©el
CREATE OR REPLACE VIEW public.v_stock_matieres_premieres AS
WITH achats AS (
  SELECT
    COALESCE(a.matiere_premiere_id, mp.id) AS mp_id,
    SUM(a.quantite) AS total_achete
  FROM public.achats_mp a
  LEFT JOIN public.matieres_premieres mp
    ON mp.id = a.matiere_premiere_id
    OR (a.matiere_premiere_id IS NULL AND lower(trim(mp.nom)) = lower(trim(a.produit)))
  WHERE COALESCE(a.matiere_premiere_id, mp.id) IS NOT NULL
  GROUP BY COALESCE(a.matiere_premiere_id, mp.id)
),
conso AS (
  SELECT
    ft.matiere_premiere_id AS mp_id,
    SUM(COALESCE(pl.qte_produite, 0) * ft.quantite_mp) AS total_consomme
  FROM public.fiches_techniques ft
  JOIN public.production_labo pl ON pl.produit_id = ft.produit_id
  WHERE ft.matiere_premiere_id IS NOT NULL
  GROUP BY ft.matiere_premiere_id
)
SELECT
  mp.id,
  mp.nom,
  mp.unite,
  mp.fournisseur,
  mp.prix_unitaire,
  mp.stock_min,
  COALESCE(a.total_achete, 0)   AS total_achete,
  COALESCE(c.total_consomme, 0) AS total_consomme,
  COALESCE(a.total_achete, 0) - COALESCE(c.total_consomme, 0) AS stock_actuel,
  CASE
    WHEN COALESCE(a.total_achete, 0) - COALESCE(c.total_consomme, 0) <= mp.stock_min
    THEN true ELSE false
  END AS alerte_stock
FROM public.matieres_premieres mp
LEFT JOIN achats a ON a.mp_id = mp.id
LEFT JOIN conso  c ON c.mp_id = mp.id
WHERE mp.actif = true;

GRANT SELECT ON public.v_stock_matieres_premieres TO authenticated;

-- ============================================================
-- 20260506181323_b147bf81-b7d5-4231-accd-35c26c469bfe.sql
-- ============================================================
ALTER VIEW public.v_stock_matieres_premieres SET (security_invoker = true);

-- ============================================================
-- 20260514100050_ec66d903-35ce-4025-bd62-4caea0136831.sql
-- ============================================================
-- ClÃ©s Ã©trangÃ¨res manquantes
ALTER TABLE public.vente_lignes
  ADD CONSTRAINT vente_lignes_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(id) ON DELETE RESTRICT;

ALTER TABLE public.ventes
  ADD CONSTRAINT ventes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.credits_clients
  ADD CONSTRAINT credits_vente_id_fkey FOREIGN KEY (vente_id) REFERENCES public.ventes(id) ON DELETE SET NULL;

-- Permissions corrigÃ©es
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete)
VALUES
  ('labo_patisserie', 'dashboard', true, false, false, false),
  ('labo_viennoiserie', 'dashboard', true, false, false, false),
  ('cuisine_salee', 'dashboard', true, false, false, false),
  ('salle', 'dashboard', true, false, false, false)
ON CONFLICT DO NOTHING;

UPDATE public.module_permissions
   SET can_read = true
 WHERE role = 'labo_patisserie' AND module = 'fiches_techniques';

-- Index performance
CREATE INDEX IF NOT EXISTS idx_vente_lignes_vente_id ON public.vente_lignes(vente_id);
CREATE INDEX IF NOT EXISTS idx_vente_lignes_produit_id ON public.vente_lignes(produit_id);
CREATE INDEX IF NOT EXISTS idx_production_labo_date ON public.production_labo(date_production);
CREATE INDEX IF NOT EXISTS idx_cloture_date ON public.cloture_journaliere(date_cloture);
CREATE INDEX IF NOT EXISTS idx_degustations_date ON public.degustations(date_degustation);
CREATE INDEX IF NOT EXISTS idx_ventes_date ON public.ventes(date_vente);
CREATE INDEX IF NOT EXISTS idx_stock_tampon_date ON public.stock_tampon(date_stock);

-- ============================================================
-- 20260523140534_2a45c90e-55c7-48ef-8e11-638fd80a39bc.sql
-- ============================================================

-- 1. Fix evidence-photos SELECT to owner-only (CEO bypass)
DROP POLICY IF EXISTS "Authenticated can view evidence photos" ON storage.objects;

CREATE POLICY "Users view own evidence photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_ceo(auth.uid())
    )
  );

-- 2. Allow authenticated users to read all profiles (needed for staff name/role display)
CREATE POLICY "Authenticated can read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

-- 3. Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 4. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated.
-- They are used inside RLS policies (run with definer privileges regardless) and
-- should not be exposed via PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_ceo(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_perform(uuid, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_produit_prix_cout() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_credit_restant() FROM anon, authenticated, public;


-- ============================================================
-- 20260525090639_bbf05d52-2ecb-475f-9f89-d58bd411cf04.sql
-- ============================================================

CREATE TABLE public.rapports_journaliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_rapport DATE NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_destinataire TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rapports_journaliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO read rapports"
  ON public.rapports_journaliers FOR SELECT
  TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE POLICY "CEO insert rapports"
  ON public.rapports_journaliers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "CEO update rapports"
  ON public.rapports_journaliers FOR UPDATE
  TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE TRIGGER trg_rapports_updated_at
  BEFORE UPDATE ON public.rapports_journaliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_rapports_date ON public.rapports_journaliers (date_rapport DESC);


-- ============================================================
-- 20260525090748_56f14ded-b5bc-4bc7-bc91-f153d51c0c56.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ============================================================
-- 20260525091553_9a2e86b7-709f-47e1-9949-196d27740af6.sql
-- ============================================================
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- 20260525091612_3a045279-f142-48c8-b463-d56c9b21cb12.sql
-- ============================================================
SELECT cron.schedule(
  'rapport-journalier-ceo',
  '0 23 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://ybbrjwywpeurimiisjwm.supabase.co/functions/v1/rapport-journalier-ceo',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- 20260525094138_36663934-012c-4048-ab6f-96b29dc93890.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.audits_ceo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_audit DATE NOT NULL DEFAULT CURRENT_DATE,
  rubriques JSONB NOT NULL DEFAULT '{}'::jsonb,
  defauts TEXT,
  ameliorations TEXT,
  commentaires TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audits_ceo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO can view audits" ON public.audits_ceo FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ceo'));

CREATE POLICY "CEO can insert audits" ON public.audits_ceo FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ceo'));

CREATE POLICY "CEO can update audits" ON public.audits_ceo FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ceo'));

CREATE POLICY "CEO can delete audits" ON public.audits_ceo FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ceo'));

CREATE TRIGGER update_audits_ceo_updated_at
BEFORE UPDATE ON public.audits_ceo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_audits_ceo_date ON public.audits_ceo(date_audit DESC);

-- ============================================================
-- 20260526104909_85374ae9-3bcd-453c-ad33-0fcd1f27b170.sql
-- ============================================================
GRANT EXECUTE ON FUNCTION public.can_perform(uuid, text, text) TO authenticated, anon;

-- ============================================================
-- 20260526104934_c54ff7cd-5c55-45ba-85ab-a0740c871448.sql
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.can_perform(uuid, text, text) FROM anon;

-- ============================================================
-- 20260529231740_a7576a66-e649-4b17-be21-0e75a936fbda.sql
-- ============================================================

-- ============================================================
-- 1. AUDIT LOGS AUTOMATIQUES via TRIGGERS
-- ============================================================

-- Fonction gÃ©nÃ©rique pour logger automatiquement (SECURITY DEFINER pour bypass RLS)
CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_record_id uuid;
  v_action text;
  v_details jsonb;
BEGIN
  -- Ne logge que si on a un user authentifiÃ© (Ã©vite les triggers techniques)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- RÃ©cupÃ¨re l'email depuis auth.users
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_record_id := NEW.id;
    v_details := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_record_id := NEW.id;
    v_details := jsonb_build_object('changes',
      (SELECT jsonb_object_agg(key, value)
       FROM jsonb_each(to_jsonb(NEW))
       WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
         AND key NOT IN ('updated_at')));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_record_id := OLD.id;
    v_details := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, table_name, record_id, details)
  VALUES (v_user_id, COALESCE(v_email, ''), v_action, TG_TABLE_NAME, v_record_id, COALESCE(v_details, '{}'::jsonb));

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'action mÃ©tier si le log Ã©choue
  RETURN COALESCE(NEW, OLD);
END $$;

-- Attache le trigger sur les tables clÃ©s
DO $$
DECLARE
  t text;
  target_tables text[] := ARRAY[
    'produits','matieres_premieres','fiches_techniques','achats_mp',
    'bons_transfert','bon_transfert_lignes','production_labo','inventaire',
    'pertes','degustations','cloture_journaliere','ventes','vente_lignes',
    'sessions_caisse','clients','credits_clients','paiements_credits',
    'categories_produits','tables_restaurant','stock_tampon','mouvements_stock',
    'audits_ceo'
  ];
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_change()', t, t);
  END LOOP;
END $$;

-- Ouvre les policies INSERT car les triggers (security definer) bypass mais on conserve l'integritÃ©
-- La policy existante exige auth.uid() = user_id ce qui est OK car la fonction met user_id := auth.uid()
-- On Ã©largit pour permettre INSERT depuis trigger SECURITY DEFINER
DROP POLICY IF EXISTS "Authenticated can insert audit" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 2. TICKET TEMPLATES (configuration CEO)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ticket_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE CHECK (type IN ('cuisine','caisse')),
  header_title text NOT NULL DEFAULT 'SAADÃ‰',
  header_subtitle text DEFAULT 'PÃ‚TISSERIE Â· SNACK Â· CONCEPT STORE',
  header_address text DEFAULT 'LomÃ© Â· Togo',
  header_phone text DEFAULT '',
  footer_message text DEFAULT 'Merci de votre visite',
  footer_legal text DEFAULT '',
  show_ticket_number boolean NOT NULL DEFAULT true,
  show_datetime boolean NOT NULL DEFAULT true,
  show_serveur boolean NOT NULL DEFAULT true,
  show_table boolean NOT NULL DEFAULT true,
  show_caissier boolean NOT NULL DEFAULT true,
  show_prices boolean NOT NULL DEFAULT true,
  show_payment_mode boolean NOT NULL DEFAULT true,
  show_change boolean NOT NULL DEFAULT true,
  exclude_boissons boolean NOT NULL DEFAULT true,
  group_by_category boolean NOT NULL DEFAULT false,
  font_size_px int NOT NULL DEFAULT 12,
  paper_width_mm int NOT NULL DEFAULT 80,
  extra_css text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.ticket_templates TO authenticated;
GRANT INSERT, UPDATE ON public.ticket_templates TO authenticated;
GRANT ALL ON public.ticket_templates TO service_role;

ALTER TABLE public.ticket_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all auth read ticket templates"
  ON public.ticket_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "ceo insert ticket templates"
  ON public.ticket_templates FOR INSERT TO authenticated
  WITH CHECK (is_ceo(auth.uid()));

CREATE POLICY "ceo update ticket templates"
  ON public.ticket_templates FOR UPDATE TO authenticated
  USING (is_ceo(auth.uid()))
  WITH CHECK (is_ceo(auth.uid()));

CREATE TRIGGER set_ticket_templates_updated_at
  BEFORE UPDATE ON public.ticket_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults
INSERT INTO public.ticket_templates (type, show_prices, show_payment_mode, show_change, exclude_boissons)
VALUES
  ('cuisine', false, false, false, true),
  ('caisse',  true,  true,  true,  false)
ON CONFLICT (type) DO NOTHING;


-- ============================================================
-- 20260529231754_53ac5a4d-27ed-418d-98cf-7fbbf022b2f7.sql
-- ============================================================

REVOKE ALL ON FUNCTION public.log_audit_change() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Authenticated can insert audit" ON public.audit_logs;
CREATE POLICY "Audit insert own or trigger"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR auth.uid() IS NULL);


-- ============================================================
-- 20260603225937_634ac373-cdb8-48eb-afe7-a8832dcac72c.sql
-- ============================================================
GRANT EXECUTE ON FUNCTION public.is_ceo(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_perform(uuid, text, text) TO authenticated, anon, service_role;

-- ============================================================
-- 20260603230001_69c79b48-3ec7-4252-a6b1-73cd39475194.sql
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.is_ceo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_perform(uuid, text, text) FROM anon;

-- ============================================================
-- 20260604234017_52d7e0af-9095-4db6-8604-dce44873b981.sql
-- ============================================================

-- 1. Tighten audit_logs INSERT: only allow inserting own user_id (triggers use SECURITY DEFINER so bypass RLS)
DROP POLICY IF EXISTS "Audit insert own or trigger" ON public.audit_logs;
CREATE POLICY "Audit insert own"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. Restrict module_permissions SELECT: users only see permissions for their own roles; CEO sees all
DROP POLICY IF EXISTS "All read permissions" ON public.module_permissions;
CREATE POLICY "Users read own role permissions"
  ON public.module_permissions
  FOR SELECT
  TO authenticated
  USING (
    public.is_ceo(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = module_permissions.role
    )
  );


-- ============================================================
-- 20260606031943_c3b0beac-1332-42e6-9960-2fa63f62fee3.sql
-- ============================================================

-- 1. Ajout de la valeur 'economat' Ã  l'enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'economat';

-- 2. Table referentiel articles
CREATE TABLE IF NOT EXISTS public.economat_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie TEXT NOT NULL DEFAULT 'DIVERS',
  nom TEXT NOT NULL UNIQUE,
  unite TEXT NOT NULL DEFAULT 'G',
  stock_initial NUMERIC NOT NULL DEFAULT 0,
  prix_unitaire NUMERIC NOT NULL DEFAULT 0,
  stock_min NUMERIC NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.economat_articles TO authenticated;
GRANT ALL ON public.economat_articles TO service_role;
ALTER TABLE public.economat_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perm read economat articles" ON public.economat_articles
  FOR SELECT TO authenticated USING (can_perform(auth.uid(), 'economat', 'read'));
CREATE POLICY "perm insert economat articles" ON public.economat_articles
  FOR INSERT TO authenticated WITH CHECK (can_perform(auth.uid(), 'economat', 'create'));
CREATE POLICY "perm update economat articles" ON public.economat_articles
  FOR UPDATE TO authenticated USING (can_perform(auth.uid(), 'economat', 'update'));
CREATE POLICY "perm delete economat articles" ON public.economat_articles
  FOR DELETE TO authenticated USING (can_perform(auth.uid(), 'economat', 'delete'));

CREATE TRIGGER trg_economat_articles_updated_at
  BEFORE UPDATE ON public.economat_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Mouvements
CREATE TABLE IF NOT EXISTS public.economat_mouvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.economat_articles(id) ON DELETE CASCADE,
  date_mouvement DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('entree','sortie','perte','inventaire')),
  quantite NUMERIC NOT NULL DEFAULT 0,
  motif TEXT DEFAULT '',
  photo_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_econ_mouv_article ON public.economat_mouvements(article_id);
CREATE INDEX IF NOT EXISTS idx_econ_mouv_date ON public.economat_mouvements(date_mouvement);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.economat_mouvements TO authenticated;
GRANT ALL ON public.economat_mouvements TO service_role;
ALTER TABLE public.economat_mouvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perm read economat mouv" ON public.economat_mouvements
  FOR SELECT TO authenticated USING (can_perform(auth.uid(), 'economat', 'read'));
CREATE POLICY "perm insert economat mouv" ON public.economat_mouvements
  FOR INSERT TO authenticated WITH CHECK (can_perform(auth.uid(), 'economat', 'create'));
CREATE POLICY "perm update economat mouv" ON public.economat_mouvements
  FOR UPDATE TO authenticated USING (can_perform(auth.uid(), 'economat', 'update'));
CREATE POLICY "perm delete economat mouv" ON public.economat_mouvements
  FOR DELETE TO authenticated USING (can_perform(auth.uid(), 'economat', 'delete'));

-- 4. Vue de stock
CREATE OR REPLACE VIEW public.v_economat_stock AS
SELECT
  a.id, a.categorie, a.nom, a.unite, a.prix_unitaire, a.stock_initial, a.stock_min, a.actif,
  COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE 0 END), 0) AS total_entrees,
  COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.quantite ELSE 0 END), 0) AS total_sorties,
  COALESCE(SUM(CASE WHEN m.type = 'perte'  THEN m.quantite ELSE 0 END), 0) AS total_pertes,
  a.stock_initial
    + COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.quantite ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.type = 'perte'  THEN m.quantite ELSE 0 END), 0) AS stock_courant,
  (a.stock_initial
    + COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.quantite ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.type = 'perte'  THEN m.quantite ELSE 0 END), 0)
  ) * a.prix_unitaire AS valeur_stock
FROM public.economat_articles a
LEFT JOIN public.economat_mouvements m ON m.article_id = a.id
GROUP BY a.id;

GRANT SELECT ON public.v_economat_stock TO authenticated;


-- ============================================================
-- 20260606031954_7b877b0b-db34-48a6-bf98-4679729b88f5.sql
-- ============================================================
ALTER VIEW public.v_economat_stock SET (security_invoker = true);

-- ============================================================
-- 20260609203552_cfd46f44-5d01-423b-8e0c-b1fe182b8c24.sql
-- ============================================================

-- ============================================================
-- PHASE 1 â€” Foundation migration (sous-catÃ©gories, imprimantes,
-- crÃ©dits, palettes, sous-permissions, clÃ´ture auto)
-- ============================================================

-- 1. Sous-catÃ©gories hiÃ©rarchiques + imprimante cible par catÃ©gorie
ALTER TABLE public.categories_produits
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories_produits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imprimante_cible text DEFAULT 'chaud' CHECK (imprimante_cible IN ('chaud','froid','caisse','aucune'));

CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories_produits(parent_id);

-- 2. Imprimante cible override par produit (optionnel, sinon hÃ©rite de la catÃ©gorie)
ALTER TABLE public.produits
  ADD COLUMN IF NOT EXISTS imprimante_cible text CHECK (imprimante_cible IN ('chaud','froid','caisse','aucune'));

-- 3. CrÃ©dits clients â€” pas de dÃ©crÃ©mentation stock Ã  la crÃ©ation
-- statut ventes peut Ãªtre 'credit_pending' (crÃ©Ã©) -> 'vente' (soldÃ©)
-- Trigger: Ã  la crÃ©ation d'un crÃ©dit, on marque la vente credit_pending
-- Ã€ la conversion (statut credit -> solde), on gÃ©nÃ¨re les mouvements de stock
CREATE OR REPLACE FUNCTION public.handle_credit_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ligne RECORD;
BEGIN
  -- Quand un crÃ©dit passe Ã  'solde', gÃ©nÃ©rer les mouvements de stock pour la vente liÃ©e
  IF NEW.statut = 'solde' AND COALESCE(OLD.statut,'') <> 'solde' AND NEW.vente_id IS NOT NULL THEN
    -- Marquer la vente comme finalisÃ©e
    UPDATE public.ventes SET statut = 'vente' WHERE id = NEW.vente_id AND statut = 'credit_pending';
    -- GÃ©nÃ©rer mouvements de stock (sortie)
    FOR v_ligne IN SELECT produit_id, quantite FROM public.vente_lignes WHERE vente_id = NEW.vente_id AND produit_id IS NOT NULL LOOP
      INSERT INTO public.mouvements_stock (date_mouvement, produit_id, type, quantite, motif, created_by)
      VALUES (CURRENT_DATE, v_ligne.produit_id, 'sortie', v_ligne.quantite, 'CrÃ©dit soldÃ© â€” vente '||NEW.vente_id, NEW.created_by);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_credit_settlement ON public.credits_clients;
CREATE TRIGGER trg_credit_settlement
  AFTER UPDATE OF statut ON public.credits_clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_credit_settlement();

-- 4. Sous-permissions (submodule) â€” colonne optionnelle
ALTER TABLE public.module_permissions
  ADD COLUMN IF NOT EXISTS submodule text;

-- Index pour can_perform
CREATE INDEX IF NOT EXISTS idx_module_perms_role_module ON public.module_permissions(role, module);

-- 5. PrÃ©fÃ©rences UI utilisateur (palette + thÃ¨me)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  palette text NOT NULL DEFAULT 'saade_classic',
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark','auto')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own prefs read" ON public.user_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own prefs insert" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own prefs update" ON public.user_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_prefs_updated BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. ClÃ´ture automatique caisse Ã  23h59 â€” fonction utilisÃ©e par cron
CREATE OR REPLACE FUNCTION public.auto_close_open_sessions()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_total_ventes numeric;
BEGIN
  FOR v_session IN SELECT id, fond_initial FROM public.sessions_caisse WHERE statut = 'ouverte' LOOP
    SELECT COALESCE(SUM(total),0) INTO v_total_ventes
      FROM public.ventes
      WHERE session_id = v_session.id AND mode_paiement IN ('especes','cash');
    UPDATE public.sessions_caisse
      SET statut = 'fermee_auto',
          ferme_at = now(),
          fond_final_attendu = v_session.fond_initial + COALESCE(v_total_ventes,0),
          notes = COALESCE(notes,'') || ' [Fermeture automatique 23h59]'
      WHERE id = v_session.id;
  END LOOP;
END $$;

-- 7. Cron pg_cron + pg_net pour fermeture auto Ã  23:59 (heure serveur UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop ancien job s'il existe
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'auto-close-cash-sessions' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'auto-close-cash-sessions',
  '59 22 * * *',  -- 22:59 UTC = 23:59 LomÃ© (GMT+0/+1 selon pÃ©riode; Togo = GMT+0)
  $$ SELECT public.auto_close_open_sessions(); $$
);

-- 8. CatÃ©gories produits â€” granter aux roles
GRANT SELECT ON public.categories_produits TO anon;


-- ============================================================
-- 20260609203608_364ac018-60f7-4863-927e-78083c758e97.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.auto_close_open_sessions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_credit_settlement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_credit_restant() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_produit_prix_cout() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 20260609204158_d7a10564-5127-4e85-8e95-5a3aed76b8e3.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_achat_to_economat()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_article_id uuid;
BEGIN
  -- Tente de matcher par nom exact (case-insensitive)
  SELECT id INTO v_article_id
    FROM public.economat_articles
    WHERE lower(trim(nom)) = lower(trim(NEW.produit))
    LIMIT 1;

  IF v_article_id IS NOT NULL THEN
    INSERT INTO public.economat_mouvements (article_id, date_mouvement, type, quantite, motif, created_by)
    VALUES (v_article_id, NEW.date_achat, 'entree', NEW.quantite,
            'Achat MP auto â€” '||COALESCE(NEW.fournisseur,'fournisseur')||' ('||NEW.id||')',
            NEW.created_by);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- jamais bloquer l'achat MP
END $$;

REVOKE EXECUTE ON FUNCTION public.sync_achat_to_economat() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_achat_to_economat ON public.achats_mp;
CREATE TRIGGER trg_sync_achat_to_economat
  AFTER INSERT ON public.achats_mp
  FOR EACH ROW EXECUTE FUNCTION public.sync_achat_to_economat();


-- ============================================================
-- 20260609204457_fda79d72-4c4b-4c81-a250-c1acd4e50ace.sql
-- ============================================================

-- Notifications in-app
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role_cible app_role,
  type text NOT NULL,
  titre text NOT NULL,
  message text NOT NULL,
  severite text NOT NULL DEFAULT 'info',
  lien text,
  lue boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voir ses notifications ou celles de son rÃ´le"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (role_cible IS NOT NULL AND has_role(auth.uid(), role_cible))
    OR is_ceo(auth.uid())
  );

CREATE POLICY "Marquer comme lue"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (role_cible IS NOT NULL AND has_role(auth.uid(), role_cible))
    OR is_ceo(auth.uid())
  );

CREATE INDEX idx_notif_user_lue ON public.notifications(user_id, lue);
CREATE INDEX idx_notif_role_lue ON public.notifications(role_cible, lue);

-- Passage de quart : session reprise d'une prÃ©cÃ©dente
ALTER TABLE public.sessions_caisse
  ADD COLUMN IF NOT EXISTS session_parent_id uuid REFERENCES public.sessions_caisse(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motif_fermeture text;

-- Fonction de gÃ©nÃ©ration des alertes (appelÃ©e par cron + Ã  la demande)
CREATE OR REPLACE FUNCTION public.generer_alertes_systeme()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  -- Stock MP critique (< seuil)
  FOR r IN SELECT id, nom, stock_actuel, seuil_alerte FROM matieres_premieres
           WHERE stock_actuel IS NOT NULL AND seuil_alerte IS NOT NULL AND stock_actuel <= seuil_alerte LOOP
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='stock_mp_critique' AND lien=r.id::text AND created_at::date = CURRENT_DATE) THEN
      INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','stock_mp_critique','Stock MP critique',
              r.nom || ' : ' || r.stock_actuel || ' (seuil ' || r.seuil_alerte || ')','warning',r.id::text);
    END IF;
  END LOOP;

  -- Ã‰cart caisse > 2000
  FOR r IN SELECT id, ecart, ferme_at FROM sessions_caisse
           WHERE statut LIKE 'fermee%' AND ABS(COALESCE(ecart,0)) > 2000
             AND ferme_at::date = CURRENT_DATE LOOP
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='ecart_caisse' AND lien=r.id::text) THEN
      INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','ecart_caisse','Ã‰cart de caisse',
              'Ã‰cart de ' || r.ecart || ' F CFA dÃ©tectÃ©','warning',r.id::text);
    END IF;
  END LOOP;

  -- CrÃ©dits non soldÃ©s > 30 jours
  FOR r IN SELECT id, montant_restant, created_at FROM credits_clients
           WHERE statut='ouvert' AND created_at < now() - interval '30 days' LOOP
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='credit_ancien' AND lien=r.id::text AND created_at > now() - interval '7 days') THEN
      INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','credit_ancien','CrÃ©dit non soldÃ© > 30j',
              'CrÃ©dit de ' || r.montant_restant || ' F CFA en attente','danger',r.id::text);
    END IF;
  END LOOP;
END $$;

-- Cron : alertes toutes les 30 minutes
SELECT cron.unschedule('alertes-systeme') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='alertes-systeme');
SELECT cron.schedule('alertes-systeme', '*/30 * * * *', $$SELECT public.generer_alertes_systeme();$$);


-- ============================================================
-- 20260609204511_272dfadf-9fa4-40c2-8ff6-918cabe70e98.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.generer_alertes_systeme() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generer_alertes_systeme() TO service_role, postgres;


-- ============================================================
-- 20260609204712_3d7de40d-0403-4dd7-84c8-14b2355e695b.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.generer_alertes_systeme()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; v_stock numeric;
BEGIN
  -- Stock Ã©conomat critique
  FOR r IN
    SELECT a.id, a.nom, a.stock_min,
           a.stock_initial + COALESCE((
             SELECT SUM(CASE WHEN m.type='entree' THEN m.quantite ELSE -m.quantite END)
             FROM economat_mouvements m WHERE m.article_id = a.id
           ),0) AS stock
    FROM economat_articles a
    WHERE a.actif = true AND a.stock_min IS NOT NULL AND a.stock_min > 0
  LOOP
    IF r.stock <= r.stock_min THEN
      IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='stock_critique' AND lien=r.id::text AND created_at::date = CURRENT_DATE) THEN
        INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
        VALUES ('ceo','stock_critique','Stock critique',
                r.nom || ' : ' || r.stock || ' (seuil ' || r.stock_min || ')','warning',r.id::text);
        INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
        VALUES ('economat','stock_critique','Stock critique',
                r.nom || ' : ' || r.stock || ' (seuil ' || r.stock_min || ')','warning',r.id::text);
      END IF;
    END IF;
  END LOOP;

  -- Ã‰cart caisse > 2000
  FOR r IN SELECT id, ecart FROM sessions_caisse
           WHERE statut LIKE 'fermee%' AND ABS(COALESCE(ecart,0)) > 2000
             AND ferme_at::date = CURRENT_DATE LOOP
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='ecart_caisse' AND lien=r.id::text) THEN
      INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','ecart_caisse','Ã‰cart de caisse',
              'Ã‰cart de ' || r.ecart || ' F CFA dÃ©tectÃ©','warning',r.id::text);
    END IF;
  END LOOP;

  -- CrÃ©dits > 30j
  FOR r IN SELECT id, montant_restant FROM credits_clients
           WHERE statut='ouvert' AND created_at < now() - interval '30 days' LOOP
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='credit_ancien' AND lien=r.id::text AND created_at > now() - interval '7 days') THEN
      INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','credit_ancien','CrÃ©dit non soldÃ© > 30j',
              'CrÃ©dit de ' || r.montant_restant || ' F CFA en attente','danger',r.id::text);
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.generer_alertes_systeme() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generer_alertes_systeme() TO service_role, postgres;


-- ============================================================
-- 20260609205453_9f274195-1242-4801-aeec-e4ef7faa8744.sql
-- ============================================================

CREATE TABLE public.fiches_techniques_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL UNIQUE REFERENCES public.produits(id) ON DELETE CASCADE,
  rendement numeric,
  rendement_unite text DEFAULT 'piÃ¨ces',
  temps_preparation_min integer,
  temps_cuisson_min integer,
  temperature_cuisson integer,
  allergenes text[] DEFAULT '{}',
  etapes text,
  conservation text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiches_techniques_meta TO authenticated;
GRANT ALL ON public.fiches_techniques_meta TO service_role;
ALTER TABLE public.fiches_techniques_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture authentifiÃ©e"
  ON public.fiches_techniques_meta FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insertion authentifiÃ©e"
  ON public.fiches_techniques_meta FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Modification authentifiÃ©e"
  ON public.fiches_techniques_meta FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Suppression CEO"
  ON public.fiches_techniques_meta FOR DELETE TO authenticated USING (is_ceo(auth.uid()));

CREATE TRIGGER trg_fiches_meta_updated_at
  BEFORE UPDATE ON public.fiches_techniques_meta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 20260609211437_7d4d204a-3ea2-481e-8269-df63560714b5.sql
-- ============================================================
DROP POLICY IF EXISTS "Insert fiches_techniques_meta" ON public.fiches_techniques_meta;
DROP POLICY IF EXISTS "Update fiches_techniques_meta" ON public.fiches_techniques_meta;
DROP POLICY IF EXISTS "Delete fiches_techniques_meta" ON public.fiches_techniques_meta;
DROP POLICY IF EXISTS "insert_fiches_techniques_meta" ON public.fiches_techniques_meta;
DROP POLICY IF EXISTS "update_fiches_techniques_meta" ON public.fiches_techniques_meta;
DROP POLICY IF EXISTS "delete_fiches_techniques_meta" ON public.fiches_techniques_meta;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='fiches_techniques_meta' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fiches_techniques_meta', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "ft_meta_insert" ON public.fiches_techniques_meta
  FOR INSERT TO authenticated
  WITH CHECK (public.can_perform(auth.uid(), 'fiches_techniques', 'create'));

CREATE POLICY "ft_meta_update" ON public.fiches_techniques_meta
  FOR UPDATE TO authenticated
  USING (public.can_perform(auth.uid(), 'fiches_techniques', 'update'))
  WITH CHECK (public.can_perform(auth.uid(), 'fiches_techniques', 'update'));

CREATE POLICY "ft_meta_delete" ON public.fiches_techniques_meta
  FOR DELETE TO authenticated
  USING (public.can_perform(auth.uid(), 'fiches_techniques', 'delete'));

-- ============================================================
-- 20260609215744_e1e3acac-f207-4b69-a780-a867c07d1918.sql
-- ============================================================
ALTER TABLE public.bons_transfert
  DROP CONSTRAINT IF EXISTS bons_transfert_statut_check;

ALTER TABLE public.bons_transfert
  ADD CONSTRAINT bons_transfert_statut_check
  CHECK (statut IN ('brouillon', 'envoye', 'recu', 'valide', 'livre', 'cloture'));

UPDATE public.bons_transfert
SET statut = CASE statut
  WHEN 'livre' THEN 'envoye'
  WHEN 'cloture' THEN 'valide'
  ELSE statut
END
WHERE statut IN ('livre', 'cloture');

-- ============================================================
-- 20260609215854_0ad65a67-636e-4222-8f5a-50f214bfe35a.sql
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ceo(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.can_perform(uuid, text, text) FROM authenticated, anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.is_ceo(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.can_perform(uuid, text, text) TO postgres, service_role;

-- ============================================================
-- 20260609222059_5a8b54e8-e7d4-406f-b1d7-4a81656ba7c0.sql
-- ============================================================
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ceo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_perform(uuid, text, text) TO authenticated;

-- ============================================================
-- 20260609224319_11c169ca-f56d-4a9f-910c-066d6a54f750.sql
-- ============================================================
ALTER TABLE public.fiches_techniques ADD COLUMN IF NOT EXISTS section text;
ALTER TABLE public.fiches_techniques ADD COLUMN IF NOT EXISTS ordre integer;

ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS moule text;
ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS taille_longueur text;
ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS taille_hauteur text;
ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS diametre text;
ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS diametre_secondaire text;
ALTER TABLE public.fiches_techniques_meta ADD COLUMN IF NOT EXISTS qte_recette numeric;

-- ============================================================
-- 20260609225612_93d8cc82-48a6-4b9d-a132-b8b00304197f.sql
-- ============================================================

-- ========== HELPER: reassign FK refs from old IDs to a keeper ID ==========

-- 1) PRODUITS â€” dÃ©doublonnage par lower(trim(nom))
DO $$
DECLARE
  rec RECORD;
  keeper UUID;
  dup_ids UUID[];
BEGIN
  FOR rec IN
    SELECT lower(trim(nom)) AS key, array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
    FROM public.produits
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    keeper := rec.ids[1];
    dup_ids := rec.ids[2:array_length(rec.ids,1)];

    UPDATE public.bon_transfert_lignes   SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.stock_tampon           SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.pertes                 SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.production_labo        SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.cloture_journaliere    SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.degustations           SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.mouvements_stock       SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    UPDATE public.vente_lignes           SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    -- fiches : on dÃ©place puis on dÃ©doublonnera plus bas
    UPDATE public.fiches_techniques      SET produit_id = keeper WHERE produit_id = ANY(dup_ids);
    -- meta : peut conflicter (clÃ© unique Ã  venir), donc on supprime les doublons cÃ´tÃ© dups d'abord
    DELETE FROM public.fiches_techniques_meta WHERE produit_id = ANY(dup_ids);

    DELETE FROM public.produits WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- 2) MATIERES_PREMIERES â€” dÃ©doublonnage par lower(trim(nom))
DO $$
DECLARE
  rec RECORD;
  keeper UUID;
  dup_ids UUID[];
BEGIN
  FOR rec IN
    SELECT lower(trim(nom)) AS key, array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
    FROM public.matieres_premieres
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    keeper := rec.ids[1];
    dup_ids := rec.ids[2:array_length(rec.ids,1)];
    UPDATE public.fiches_techniques SET matiere_premiere_id = keeper WHERE matiere_premiere_id = ANY(dup_ids);
    -- achats_mp ne rÃ©fÃ©rence pas par FK uuid (texte fournisseur/produit), rien Ã  faire
    DELETE FROM public.matieres_premieres WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- 3) CATEGORIES_PRODUITS â€” dÃ©doublonnage par lower(trim(nom))
DO $$
DECLARE
  rec RECORD;
  dup_ids UUID[];
BEGIN
  FOR rec IN
    SELECT lower(trim(nom)) AS key, array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
    FROM public.categories_produits
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    dup_ids := rec.ids[2:array_length(rec.ids,1)];
    DELETE FROM public.categories_produits WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- 4) ECONOMAT_ARTICLES â€” dÃ©doublonnage par lower(trim(nom))
DO $$
DECLARE
  rec RECORD;
  keeper UUID;
  dup_ids UUID[];
BEGIN
  FOR rec IN
    SELECT lower(trim(nom)) AS key, array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
    FROM public.economat_articles
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    keeper := rec.ids[1];
    dup_ids := rec.ids[2:array_length(rec.ids,1)];
    UPDATE public.economat_mouvements SET article_id = keeper WHERE article_id = ANY(dup_ids);
    DELETE FROM public.economat_articles WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- 5) CLIENTS â€” dÃ©doublonnage par lower(trim(nom))
DO $$
DECLARE
  rec RECORD;
  keeper UUID;
  dup_ids UUID[];
BEGIN
  FOR rec IN
    SELECT lower(trim(nom)) AS key, array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
    FROM public.clients
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    keeper := rec.ids[1];
    dup_ids := rec.ids[2:array_length(rec.ids,1)];
    UPDATE public.credits_clients SET client_id = keeper WHERE client_id = ANY(dup_ids);
    UPDATE public.ventes          SET client_id = keeper WHERE client_id = ANY(dup_ids);
    DELETE FROM public.clients WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

-- 6) FICHES_TECHNIQUES â€” un seul ingrÃ©dient identique par produit
DELETE FROM public.fiches_techniques a
USING public.fiches_techniques b
WHERE a.produit_id = b.produit_id
  AND lower(trim(a.matiere_premiere)) = lower(trim(b.matiere_premiere))
  AND a.created_at > b.created_at;

-- doublons restants avec mÃªme created_at : on garde le plus petit id
DELETE FROM public.fiches_techniques a
USING public.fiches_techniques b
WHERE a.produit_id = b.produit_id
  AND lower(trim(a.matiere_premiere)) = lower(trim(b.matiere_premiere))
  AND a.id > b.id;

-- 7) FICHES_TECHNIQUES_META â€” un seul enregistrement par produit
DELETE FROM public.fiches_techniques_meta a
USING public.fiches_techniques_meta b
WHERE a.produit_id = b.produit_id
  AND a.id > b.id;

-- ========== CONTRAINTES D'UNICITÃ‰ (anti-doublons futurs) ==========
CREATE UNIQUE INDEX IF NOT EXISTS produits_nom_unique_idx           ON public.produits (lower(trim(nom)));
CREATE UNIQUE INDEX IF NOT EXISTS matieres_premieres_nom_unique_idx ON public.matieres_premieres (lower(trim(nom)));
CREATE UNIQUE INDEX IF NOT EXISTS categories_produits_nom_unique_idx ON public.categories_produits (lower(trim(nom)));
CREATE UNIQUE INDEX IF NOT EXISTS economat_articles_nom_unique_idx  ON public.economat_articles (lower(trim(nom)));
CREATE UNIQUE INDEX IF NOT EXISTS fiches_techniques_meta_produit_unique_idx ON public.fiches_techniques_meta (produit_id);
CREATE UNIQUE INDEX IF NOT EXISTS fiches_techniques_produit_mp_unique_idx ON public.fiches_techniques (produit_id, lower(trim(matiere_premiere)));


-- ============================================================
-- 20260610075747_24c90fe7-4132-4e95-befc-822ef8015f24.sql
-- ============================================================
UPDATE public.produits SET categorie = 'VIENNOISERIE', updated_at = now()
WHERE id IN (
  '1235590f-a23d-4e54-94d2-8662d4b1f620', -- Donut Nutella Kinder
  '251f324a-57a3-4dcc-98cc-3d13f49a2025', -- Donut Oreo
  'c968c5b7-3e0e-443d-bc11-c80d92ec4d63', -- Donut Speculoos
  '215d4ee7-6fae-4069-9602-eb93b1f44d17', -- Donut Vermicelles
  '7694109e-4b1c-483d-bc5c-8bad107e6612'  -- Mini Donut
);

-- ============================================================
-- 20260612070402_5d547f85-a71a-4bca-815b-80947b29d42f.sql
-- ============================================================

-- 1) PERMISSIONS
ALTER TABLE public.module_permissions
  DROP CONSTRAINT IF EXISTS module_permissions_role_module_key;
CREATE UNIQUE INDEX IF NOT EXISTS module_permissions_role_module_submodule_key
  ON public.module_permissions (role, module, COALESCE(submodule, ''));

-- 2) FICHES TECHNIQUES
UPDATE public.fiches_techniques f
   SET cout_unitaire_mp = m.prix_unitaire
  FROM public.matieres_premieres m
 WHERE f.matiere_premiere_id = m.id
   AND f.cout_unitaire_mp IS DISTINCT FROM m.prix_unitaire;

UPDATE public.fiches_techniques f
   SET cout_unitaire_mp = m.prix_unitaire,
       matiere_premiere_id = m.id
  FROM public.matieres_premieres m
 WHERE f.matiere_premiere_id IS NULL
   AND lower(trim(f.matiere_premiere)) = lower(trim(m.nom));

UPDATE public.produits p
   SET prix_cout = COALESCE((
     SELECT SUM(quantite_mp * cout_unitaire_mp)
       FROM public.fiches_techniques
      WHERE produit_id = p.id
   ), 0),
       updated_at = now();

-- 3) RÃ”LE DEV + flag is_hidden (sans utiliser developer dans une fonction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'developer';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;


-- ============================================================
-- 20260612070439_f761b5cb-bdf0-49f8-afe4-9ceaa91c4661.sql
-- ============================================================

-- 1) Finaliser dev role : is_user_hidden + is_ceo Ã©tendu + audit log
CREATE OR REPLACE FUNCTION public.is_user_hidden(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_hidden FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.is_ceo(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'ceo'::public.app_role)
      OR public.has_role(_user_id, 'developer'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_user_id uuid; v_email text; v_record_id uuid; v_action text; v_details jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF public.is_user_hidden(v_user_id) THEN RETURN COALESCE(NEW, OLD); END IF;
  BEGIN SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN v_email := NULL; END;
  IF TG_OP = 'INSERT' THEN
    v_action := 'create'; v_record_id := NEW.id;
    v_details := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update'; v_record_id := NEW.id;
    v_details := jsonb_build_object('changes',
      (SELECT jsonb_object_agg(key, value) FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
          AND key NOT IN ('updated_at')));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete'; v_record_id := OLD.id;
    v_details := jsonb_build_object('old', to_jsonb(OLD));
  END IF;
  INSERT INTO public.audit_logs (user_id, user_email, action, table_name, record_id, details)
  VALUES (v_user_id, COALESCE(v_email,''), v_action, TG_TABLE_NAME, v_record_id, COALESCE(v_details,'{}'::jsonb));
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN RETURN COALESCE(NEW, OLD);
END $function$;

-- 2) POS OPTIONS
CREATE TABLE IF NOT EXISTS public.produit_options_groupes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES public.produits(id) ON DELETE CASCADE,
  nom text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  min_choix integer NOT NULL DEFAULT 1,
  max_choix integer NOT NULL DEFAULT 1,
  obligatoire boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produit_options_groupes TO authenticated;
GRANT ALL ON public.produit_options_groupes TO service_role;
ALTER TABLE public.produit_options_groupes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read opt groupes" ON public.produit_options_groupes FOR SELECT TO authenticated USING (true);
CREATE POLICY "CEO manage opt groupes" ON public.produit_options_groupes FOR ALL TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));
CREATE TRIGGER trg_opt_groupes_updated BEFORE UPDATE ON public.produit_options_groupes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_opt_groupes_produit ON public.produit_options_groupes(produit_id);

CREATE TABLE IF NOT EXISTS public.produit_options_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groupe_id uuid NOT NULL REFERENCES public.produit_options_groupes(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  prix_supplement numeric NOT NULL DEFAULT 0,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produit_options_items TO authenticated;
GRANT ALL ON public.produit_options_items TO service_role;
ALTER TABLE public.produit_options_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read opt items" ON public.produit_options_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "CEO manage opt items" ON public.produit_options_items FOR ALL TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_opt_items_groupe ON public.produit_options_items(groupe_id);

CREATE TABLE IF NOT EXISTS public.vente_ligne_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vente_ligne_id uuid NOT NULL REFERENCES public.vente_lignes(id) ON DELETE CASCADE,
  groupe_nom text NOT NULL,
  item_libelle text NOT NULL,
  prix_supplement numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vente_ligne_options TO authenticated;
GRANT ALL ON public.vente_ligne_options TO service_role;
ALTER TABLE public.vente_ligne_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read vente opts" ON public.vente_ligne_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert vente opts" ON public.vente_ligne_options FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CEO manage vente opts" ON public.vente_ligne_options FOR ALL TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_vente_opts_ligne ON public.vente_ligne_options(vente_ligne_id);


-- ============================================================
-- 20260612071800_339c50bc-d538-4bc3-aab6-6840171c92fc.sql
-- ============================================================

-- 0) Ã‰tendre la contrainte profiles.role pour accepter 'developer' (et 'bar', 'cuisine', 'economat' au passage)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['ceo','labo_patisserie','labo_viennoiserie','cuisine_salee','salle','developer','bar','cuisine','economat']));

-- 1) COMPTE DÃ‰VELOPPEUR CACHÃ‰
DO $$
DECLARE
  v_uid uuid;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM auth.users WHERE email = 'dev@saade.com';
  IF v_existing IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      v_uid, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'dev@saade.com',
      crypt('__CHANGEZ_CE_MOT_DE_PASSE_APRES_MIGRATION__', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Developer"}'::jsonb,
      false
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', 'dev@saade.com', 'email_verified', true),
      'email', v_uid::text, now(), now(), now()
    );
  ELSE
    v_uid := v_existing;
    UPDATE auth.users
       SET encrypted_password = crypt('__CHANGEZ_CE_MOT_DE_PASSE_APRES_MIGRATION__', gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = v_uid;
  END IF;

  INSERT INTO public.profiles (id, full_name, role, is_hidden)
  VALUES (v_uid, 'Developer', 'developer', true)
  ON CONFLICT (id) DO UPDATE SET full_name = 'Developer', role = 'developer', is_hidden = true;

  DELETE FROM public.user_roles WHERE user_id = v_uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'developer'::public.app_role);
END $$;

-- 2) FORMULES POS
WITH p AS (
  SELECT id FROM public.produits WHERE upper(nom) LIKE '%PAIN BRO%' AND categorie = 'PAIN_BRO'
), g AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'SupplÃ©ments', 0, 0, 4, false FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'SupplÃ©ments')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g.id, x.libelle, 0, x.ord
FROM g, (VALUES ('Mayo',1),('Tomate',2),('Oignon',3),('Piment vert',4)) AS x(libelle, ord);

WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE EXPRESS%' AND categorie = 'FORMULES'),
g1 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Boisson chaude', 0, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Boisson chaude')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g1.id, x.libelle, 0, x.ord
FROM g1, (VALUES ('CafÃ©',1),('CafÃ© au lait',2),('Cappuccino',3),('ThÃ©',4),('Chocolat chaud',5)) AS x(libelle,ord);

WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE EXPRESS%' AND categorie = 'FORMULES'),
g2 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Viennoiserie', 1, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Viennoiserie')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g2.id, x.libelle, 0, x.ord
FROM g2, (VALUES ('Croissant',1),('Pain au chocolat',2),('Pain aux raisins',3),('Brioche',4)) AS x(libelle,ord);

WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE EXPRESS%' AND categorie = 'FORMULES'),
g3 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Eau', 2, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Eau')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g3.id, x.libelle, 0, x.ord
FROM g3, (VALUES ('Eau plate',1),('Eau gazeuse',2)) AS x(libelle,ord);

-- GOÃ›TER
WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE GOÃ›TER%' AND categorie = 'FORMULES'),
g1 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Dessert', 0, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Dessert')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g1.id, x.libelle, 0, x.ord
FROM g1, (VALUES ('Donut',1),('Ã‰clair',2),('Tarte du jour',3),('Cookie',4),('Muffin',5)) AS x(libelle,ord);

WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE GOÃ›TER%' AND categorie = 'FORMULES'),
g2 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Boisson', 1, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Boisson')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g2.id, x.libelle, 0, x.ord
FROM g2, (VALUES ('CafÃ©',1),('ThÃ©',2),('Chocolat chaud',3),('Jus',4),('Limonade',5)) AS x(libelle,ord);

-- SNACK
WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE SNACK%' AND categorie = 'FORMULES'),
g1 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Plat', 0, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Plat')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g1.id, x.libelle, 0, x.ord
FROM g1, (VALUES ('Hot Dog classique',1),('Hot Dog poulet',2),('Pain Bro simple',3),('Pain Bro complet',4)) AS x(libelle,ord);

WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE SNACK%' AND categorie = 'FORMULES'),
g2 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Boisson', 1, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Boisson')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g2.id, x.libelle, 0, x.ord
FROM g2, (VALUES ('Ice tea',1),('Tonic',2),('Eau gazeuse',3),('Eau plate',4),('Word cola',5),('Youki orange',6)) AS x(libelle,ord);

-- HEALTHY
WITH p AS (SELECT id FROM public.produits WHERE upper(nom) LIKE 'FORMULE HEALTHY%' AND categorie = 'FORMULES'),
g AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Boisson', 0, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Boisson')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g.id, x.libelle, 0, x.ord
FROM g, (VALUES ('Eau plate',1),('Jus Hugs ananas',2),('Jus Hugs bissap',3),('Jus Hugs multifruits',4),('Limonade',5)) AS x(libelle,ord);

-- MENU ENFANT
WITH p AS (SELECT id FROM public.produits WHERE categorie = 'MENU_ENFANT'),
g1 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Plat', 0, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Plat')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g1.id, x.libelle, 0, x.ord
FROM g1, (VALUES ('Mini Croq Dog',1),('Mini Panini Jambon-Fromage',2)) AS x(libelle,ord);

WITH p AS (SELECT id FROM public.produits WHERE categorie = 'MENU_ENFANT'),
g2 AS (
  INSERT INTO public.produit_options_groupes (produit_id, nom, ordre, min_choix, max_choix, obligatoire)
  SELECT p.id, 'Boisson', 1, 1, 1, true FROM p
  WHERE NOT EXISTS (SELECT 1 FROM public.produit_options_groupes g WHERE g.produit_id = p.id AND g.nom = 'Boisson')
  RETURNING id
)
INSERT INTO public.produit_options_items (groupe_id, libelle, prix_supplement, ordre)
SELECT g2.id, x.libelle, 0, x.ord
FROM g2, (VALUES ('Eau plate',1),('Hugs ananas',2),('Hugs bissap',3),('Hugs multifruits',4)) AS x(libelle,ord);


-- ============================================================
-- 20260612072432_14821095-14b2-473d-a030-19b08dd18ec2.sql
-- ============================================================
DROP POLICY IF EXISTS "Auth insert vente opts" ON public.vente_ligne_options;
CREATE POLICY "Auth insert vente opts" ON public.vente_ligne_options
FOR INSERT TO authenticated
WITH CHECK (can_perform(auth.uid(), 'pos'::text, 'create'::text));

REVOKE EXECUTE ON FUNCTION public.is_user_hidden(uuid) FROM anon, PUBLIC;

-- ============================================================
-- 20260612073727_220d3df7-cd49-4581-a24b-b57f3cf78f2e.sql
-- ============================================================
UPDATE auth.users SET encrypted_password = crypt('__CHANGEZ_CE_MOT_DE_PASSE_APRES_MIGRATION__', gen_salt('bf')), email_confirmed_at = COALESCE(email_confirmed_at, now()), updated_at = now() WHERE email = 'dev@saade.com';

-- ============================================================
-- 20260612074649_b64e2011-37f7-465f-b8ef-8a3e6c08017e.sql
-- ============================================================

-- 1) profiles : SELECT ne rÃ©vÃ¨le plus les comptes cachÃ©s
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select_non_hidden_or_self_or_ceo"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  COALESCE(is_hidden, false) = false
  OR auth.uid() = id
  OR public.is_ceo(auth.uid())
);

-- 2) profiles : UPDATE par l'utilisateur restreint au nom uniquement
DROP POLICY IF EXISTS "Users can update own profile name only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

CREATE POLICY "profiles_update_self_name_only"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND COALESCE(is_hidden, false) IS NOT DISTINCT FROM COALESCE((SELECT p.is_hidden FROM public.profiles p WHERE p.id = auth.uid()), false)
);

-- CEO/developer conservent leur droit d'update via leur policy existante (non touchÃ©e).

-- 3) vente_ligne_options : SELECT exige la permission
DROP POLICY IF EXISTS "vente_ligne_options_select" ON public.vente_ligne_options;
DROP POLICY IF EXISTS "Authenticated can read vente_ligne_options" ON public.vente_ligne_options;

CREATE POLICY "vente_ligne_options_select_permission"
ON public.vente_ligne_options
FOR SELECT
TO authenticated
USING (
  public.can_perform(auth.uid(), 'ventes', 'read')
  OR public.can_perform(auth.uid(), 'pos', 'read')
);


-- ============================================================
-- 20260612081942_3be966aa-49f3-4f40-94c3-576061f03433.sql
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;

-- ============================================================
-- 20260612090305_2950dde5-cffc-4b64-9339-70812e12ebb7.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_ceo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ceo', 'developer')
  )
$$;

-- ============================================================
-- 20260615100920_32c524fc-608e-40a8-b958-1941cd8de40d.sql
-- ============================================================

-- 1) Seed module 'bon_attente' for known roles (uses existing app_role enum values present in DB)
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete)
SELECT r::app_role, 'bon_attente', true, true, true, true
FROM (VALUES ('ceo'), ('developer'), ('salle')) AS roles(r)
WHERE EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='app_role' AND e.enumlabel = roles.r)
ON CONFLICT DO NOTHING;

INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete)
SELECT r::app_role, 'bon_attente', true, false, false, false
FROM (VALUES ('labo_patisserie'),('labo_viennoiserie'),('cuisine_salee'),('economat'),('caissier'),('manager')) AS roles(r)
WHERE EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='app_role' AND e.enumlabel = roles.r)
ON CONFLICT DO NOTHING;

-- 2) New DELETE policies: allow deletion of EN_COURS tickets to users with 'bon_attente'.'delete'
DROP POLICY IF EXISTS "perm delete ventes en attente" ON public.ventes;
CREATE POLICY "perm delete ventes en attente" ON public.ventes
  FOR DELETE TO authenticated
  USING (statut = 'en_cours' AND public.can_perform(auth.uid(), 'bon_attente', 'delete'));

DROP POLICY IF EXISTS "perm delete vlignes en attente" ON public.vente_lignes;
CREATE POLICY "perm delete vlignes en attente" ON public.vente_lignes
  FOR DELETE TO authenticated
  USING (
    public.can_perform(auth.uid(), 'bon_attente', 'delete')
    AND EXISTS (SELECT 1 FROM public.ventes v WHERE v.id = vente_id AND v.statut = 'en_cours')
  );

DROP POLICY IF EXISTS "perm delete vopts en attente" ON public.vente_ligne_options;
CREATE POLICY "perm delete vopts en attente" ON public.vente_ligne_options
  FOR DELETE TO authenticated
  USING (
    public.can_perform(auth.uid(), 'bon_attente', 'delete')
    AND EXISTS (
      SELECT 1 FROM public.vente_lignes vl
      JOIN public.ventes v ON v.id = vl.vente_id
      WHERE vl.id = vente_ligne_id AND v.statut = 'en_cours'
    )
  );


-- ============================================================
-- 20260616122309_823bdfb1-2586-48e3-b96f-6348bf82d5e9.sql
-- ============================================================

-- Fix audits_ceo policies to use is_ceo() (user_roles) instead of profiles.role
DROP POLICY IF EXISTS "CEO can view audits" ON public.audits_ceo;
DROP POLICY IF EXISTS "CEO can insert audits" ON public.audits_ceo;
DROP POLICY IF EXISTS "CEO can update audits" ON public.audits_ceo;
DROP POLICY IF EXISTS "CEO can delete audits" ON public.audits_ceo;

CREATE POLICY "CEO can view audits" ON public.audits_ceo FOR SELECT USING (public.is_ceo(auth.uid()));
CREATE POLICY "CEO can insert audits" ON public.audits_ceo FOR INSERT WITH CHECK (public.is_ceo(auth.uid()));
CREATE POLICY "CEO can update audits" ON public.audits_ceo FOR UPDATE USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));
CREATE POLICY "CEO can delete audits" ON public.audits_ceo FOR DELETE USING (public.is_ceo(auth.uid()));

-- Remove permissive SELECT policy that bypasses the permission-based one
DROP POLICY IF EXISTS "Auth read vente opts" ON public.vente_ligne_options;


-- ============================================================
-- 20260616122724_0ebe455c-d4fe-401b-9ad5-c2ed0fb03f74.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_produit_prix_cout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid UUID;
  v_total NUMERIC;
  v_qte_recette NUMERIC;
  v_prix_cout NUMERIC;
BEGIN
  v_pid := COALESCE(NEW.produit_id, OLD.produit_id);

  SELECT COALESCE(SUM(quantite_mp * cout_unitaire_mp), 0)
    INTO v_total
    FROM public.fiches_techniques
    WHERE produit_id = v_pid;

  SELECT qte_recette
    INTO v_qte_recette
    FROM public.fiches_techniques_meta
    WHERE produit_id = v_pid;

  v_prix_cout := CASE
    WHEN COALESCE(v_qte_recette, 0) > 0 THEN v_total / v_qte_recette
    ELSE v_total
  END;

  UPDATE public.produits
     SET prix_cout = v_prix_cout,
         updated_at = now()
   WHERE id = v_pid;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_recalc_produit_prix_cout ON public.fiches_techniques;
CREATE TRIGGER trg_recalc_produit_prix_cout
AFTER INSERT OR UPDATE OR DELETE ON public.fiches_techniques
FOR EACH ROW EXECUTE FUNCTION public.recalc_produit_prix_cout();

DROP TRIGGER IF EXISTS trg_recalc_produit_prix_cout_meta ON public.fiches_techniques_meta;
CREATE TRIGGER trg_recalc_produit_prix_cout_meta
AFTER INSERT OR UPDATE OF qte_recette OR DELETE ON public.fiches_techniques_meta
FOR EACH ROW EXECUTE FUNCTION public.recalc_produit_prix_cout();

UPDATE public.fiches_techniques_meta m
   SET qte_recette = 15,
       rendement = COALESCE(NULLIF(rendement, 1), 15),
       rendement_unite = COALESCE(rendement_unite, 'piÃ¨ces'),
       updated_at = now()
  FROM public.produits p
 WHERE m.produit_id = p.id
   AND p.nom = 'Cake Citron'
   AND COALESCE(m.qte_recette, 0) = 1;

UPDATE public.fiches_techniques f
   SET matiere_premiere_id = mp.id,
       cout_unitaire_mp = mp.prix_unitaire
  FROM public.produits p,
       public.matieres_premieres mp
 WHERE f.produit_id = p.id
   AND p.nom = 'Cake Citron'
   AND lower(trim(f.matiere_premiere)) = 'sucre'
   AND lower(trim(mp.nom)) = 'sucre en poudre';

UPDATE public.produits p
   SET prix_cout = CASE
         WHEN COALESCE(m.qte_recette, 0) > 0 THEN COALESCE(t.total, 0) / m.qte_recette
         ELSE COALESCE(t.total, 0)
       END,
       updated_at = now()
  FROM public.fiches_techniques_meta m
  LEFT JOIN (
    SELECT produit_id, SUM(quantite_mp * cout_unitaire_mp) AS total
      FROM public.fiches_techniques
     GROUP BY produit_id
  ) t ON t.produit_id = m.produit_id
 WHERE p.id = m.produit_id;

UPDATE public.produits p
   SET prix_cout = COALESCE(t.total, 0),
       updated_at = now()
  FROM (
    SELECT produit_id, SUM(quantite_mp * cout_unitaire_mp) AS total
      FROM public.fiches_techniques
     GROUP BY produit_id
  ) t
 WHERE p.id = t.produit_id
   AND NOT EXISTS (
     SELECT 1 FROM public.fiches_techniques_meta m WHERE m.produit_id = p.id
   );

-- ============================================================
-- 20260616122936_dd6896ce-c219-4564-907d-abe9e639ff62.sql
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.can_perform(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_ceo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_user_hidden(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 20260617031459_dfe43041-d46d-48e4-8386-ce5de3f39ef0.sql
-- ============================================================
-- Restore EXECUTE on permission functions used by RLS policies.
-- SECURITY DEFINER functions need EXECUTE for the calling role even when referenced in policies.
GRANT EXECUTE ON FUNCTION public.is_ceo(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_perform(uuid, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_user_hidden(uuid) TO authenticated, anon;

-- ============================================================
-- 20260618101955_242aa24f-235f-4e4a-9d85-840019b450cc.sql
-- ============================================================

-- 1) Champ type_production sur produits
ALTER TABLE public.produits ADD COLUMN IF NOT EXISTS type_production text NOT NULL DEFAULT 'labo';
ALTER TABLE public.produits DROP CONSTRAINT IF EXISTS produits_type_production_check;
ALTER TABLE public.produits ADD CONSTRAINT produits_type_production_check CHECK (type_production IN ('labo','minute','revente'));

UPDATE public.produits SET type_production = 'minute'
WHERE categorie IN ('BURGERS','HOT_DOG','PANINI','PIZZA','FORMULES','MENU_ENFANT','PANCAKE/CREPE','PTIT_DEJ','ACCOMPAGNEMENT');
UPDATE public.produits SET type_production = 'revente'
WHERE categorie IN ('BOISSONS_CHAUDES','BOISSONS_FROIDES','BOISSONS_SIGNATURES','DOGEL','BOUGIE/_CARTE','DIVERS');

-- 2) Table mp_mouvements
CREATE TABLE IF NOT EXISTS public.mp_mouvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matiere_premiere_id uuid NOT NULL REFERENCES public.matieres_premieres(id) ON DELETE CASCADE,
  date_mouvement date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('achat','conso_labo','conso_minute','perte','ajustement','inventaire')),
  quantite numeric NOT NULL,
  source_table text,
  source_id uuid,
  stock_avant numeric,
  stock_apres numeric,
  regularisation_requise boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  motif text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_mvt_mp ON public.mp_mouvements(matiere_premiere_id);
CREATE INDEX IF NOT EXISTS idx_mp_mvt_date ON public.mp_mouvements(date_mouvement DESC);
CREATE INDEX IF NOT EXISTS idx_mp_mvt_anomalie ON public.mp_mouvements(regularisation_requise) WHERE regularisation_requise = true;
CREATE INDEX IF NOT EXISTS idx_mp_mvt_source ON public.mp_mouvements(source_table, source_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mp_mouvements TO authenticated;
GRANT ALL ON public.mp_mouvements TO service_role;

ALTER TABLE public.mp_mouvements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mp_mvt_read_auth" ON public.mp_mouvements;
DROP POLICY IF EXISTS "mp_mvt_insert_auth" ON public.mp_mouvements;
DROP POLICY IF EXISTS "mp_mvt_update_ceo_eco" ON public.mp_mouvements;
DROP POLICY IF EXISTS "mp_mvt_delete_ceo" ON public.mp_mouvements;

CREATE POLICY "mp_mvt_read_auth" ON public.mp_mouvements FOR SELECT TO authenticated USING (true);
CREATE POLICY "mp_mvt_insert_auth" ON public.mp_mouvements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mp_mvt_update_ceo_eco" ON public.mp_mouvements FOR UPDATE TO authenticated
  USING (public.is_ceo(auth.uid()) OR public.can_perform(auth.uid(),'suivi_stock','update'))
  WITH CHECK (public.is_ceo(auth.uid()) OR public.can_perform(auth.uid(),'suivi_stock','update'));
CREATE POLICY "mp_mvt_delete_ceo" ON public.mp_mouvements FOR DELETE TO authenticated USING (public.is_ceo(auth.uid()));

-- 3) Fonction stock actuel MP
CREATE OR REPLACE FUNCTION public.mp_stock_actuel(_mp_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(quantite), 0) FROM public.mp_mouvements WHERE matiere_premiere_id = _mp_id;
$$;

-- 4) Trigger achats_mp
CREATE OR REPLACE FUNCTION public.trg_achat_mp_to_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mp_id uuid; v_stock_avant numeric;
BEGIN
  v_mp_id := NEW.matiere_premiere_id;
  IF v_mp_id IS NULL THEN
    SELECT id INTO v_mp_id FROM public.matieres_premieres
     WHERE lower(trim(nom)) = lower(trim(NEW.produit)) LIMIT 1;
  END IF;
  IF v_mp_id IS NULL THEN RETURN NEW; END IF;
  v_stock_avant := public.mp_stock_actuel(v_mp_id);
  INSERT INTO public.mp_mouvements (matiere_premiere_id, date_mouvement, type, quantite, source_table, source_id, stock_avant, stock_apres, motif, created_by)
  VALUES (v_mp_id, NEW.date_achat, 'achat', NEW.quantite, 'achats_mp', NEW.id,
          v_stock_avant, v_stock_avant + NEW.quantite,
          'Achat â€” '||COALESCE(NEW.fournisseur,''), NEW.created_by);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_achat_mp_stock ON public.achats_mp;
CREATE TRIGGER trg_achat_mp_stock AFTER INSERT ON public.achats_mp
  FOR EACH ROW EXECUTE FUNCTION public.trg_achat_mp_to_stock();

-- 5) Fonction dÃ©duction MP depuis fiche
CREATE OR REPLACE FUNCTION public.deduire_mps_from_fiche(
  _produit_id uuid, _qte_units numeric, _type text,
  _source_table text, _source_id uuid, _date date, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD; v_qte_rec numeric; v_qte_conso numeric;
  v_stock_avant numeric; v_stock_apres numeric; v_requires_reg boolean;
  v_produit_nom text;
BEGIN
  SELECT qte_recette INTO v_qte_rec FROM public.fiches_techniques_meta WHERE produit_id = _produit_id;
  v_qte_rec := COALESCE(NULLIF(v_qte_rec,0), 1);
  SELECT nom INTO v_produit_nom FROM public.produits WHERE id = _produit_id;

  FOR r IN
    SELECT matiere_premiere_id, quantite_mp, matiere_premiere
      FROM public.fiches_techniques
     WHERE produit_id = _produit_id AND matiere_premiere_id IS NOT NULL
  LOOP
    v_qte_conso := (r.quantite_mp * _qte_units) / v_qte_rec;
    IF v_qte_conso <= 0 THEN CONTINUE; END IF;
    v_stock_avant := public.mp_stock_actuel(r.matiere_premiere_id);
    v_stock_apres := v_stock_avant - v_qte_conso;
    v_requires_reg := v_stock_apres < 0;

    INSERT INTO public.mp_mouvements
      (matiere_premiere_id, date_mouvement, type, quantite, source_table, source_id,
       stock_avant, stock_apres, regularisation_requise, motif, created_by)
    VALUES
      (r.matiere_premiere_id, _date, _type, -v_qte_conso, _source_table, _source_id,
       v_stock_avant, v_stock_apres, v_requires_reg,
       CASE _type WHEN 'conso_labo' THEN 'Production: '||COALESCE(v_produit_nom,'')
                  WHEN 'conso_minute' THEN 'Vente minute: '||COALESCE(v_produit_nom,'')
                  ELSE COALESCE(v_produit_nom,'') END, _user);

    IF v_requires_reg THEN
      INSERT INTO public.notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','rupture_mp','Rupture MP dÃ©tectÃ©e',
              COALESCE(r.matiere_premiere,'MP')||' : sur-consommation de '||ABS(v_stock_apres)::text||' lors de '||COALESCE(v_produit_nom,'?'),
              'danger', r.matiere_premiere_id::text);
      INSERT INTO public.notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('economat','rupture_mp','Rupture MP dÃ©tectÃ©e',
              COALESCE(r.matiere_premiere,'MP')||' : rÃ©gulariser stock',
              'danger', r.matiere_premiere_id::text);
    END IF;
  END LOOP;
END $$;

-- 6) Trigger production_labo
CREATE OR REPLACE FUNCTION public.trg_production_to_mp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN v_delta := COALESCE(NEW.qte_produite, 0);
  ELSIF TG_OP = 'UPDATE' THEN v_delta := COALESCE(NEW.qte_produite, 0) - COALESCE(OLD.qte_produite, 0);
  END IF;
  IF v_delta <> 0 THEN
    PERFORM public.deduire_mps_from_fiche(NEW.produit_id, v_delta, 'conso_labo',
            'production_labo', NEW.id, NEW.date_production, NEW.created_by);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prod_labo_mp ON public.production_labo;
CREATE TRIGGER trg_prod_labo_mp AFTER INSERT OR UPDATE OF qte_produite ON public.production_labo
  FOR EACH ROW EXECUTE FUNCTION public.trg_production_to_mp();

-- 7) Trigger vente_lignes (minute)
CREATE OR REPLACE FUNCTION public.trg_vente_minute_to_mp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text; v_statut text; v_user uuid;
BEGIN
  IF NEW.produit_id IS NULL THEN RETURN NEW; END IF;
  SELECT type_production INTO v_type FROM public.produits WHERE id = NEW.produit_id;
  IF v_type <> 'minute' THEN RETURN NEW; END IF;
  SELECT statut, created_by INTO v_statut, v_user FROM public.ventes WHERE id = NEW.vente_id;
  IF v_statut IN ('annulee','credit_pending') THEN RETURN NEW; END IF;
  PERFORM public.deduire_mps_from_fiche(NEW.produit_id, NEW.quantite, 'conso_minute',
          'vente_lignes', NEW.id, CURRENT_DATE, v_user);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vente_minute_mp ON public.vente_lignes;
CREATE TRIGGER trg_vente_minute_mp AFTER INSERT ON public.vente_lignes
  FOR EACH ROW EXECUTE FUNCTION public.trg_vente_minute_to_mp();

-- 8) Vue v_mp_stock
CREATE OR REPLACE VIEW public.v_mp_stock AS
SELECT
  mp.id, mp.nom, mp.unite, mp.fournisseur, mp.prix_unitaire, mp.stock_min,
  COALESCE(SUM(m.quantite) FILTER (WHERE m.type = 'achat'), 0) AS total_achete,
  ABS(COALESCE(SUM(m.quantite) FILTER (WHERE m.quantite < 0), 0)) AS total_consomme,
  COALESCE(SUM(m.quantite), 0) AS stock_actuel,
  COALESCE(SUM(m.quantite), 0) * COALESCE(mp.prix_unitaire,0) AS valeur_stock,
  MAX(m.created_at) FILTER (WHERE m.type = 'achat') AS derniere_entree,
  MAX(m.created_at) FILTER (WHERE m.quantite < 0) AS derniere_sortie,
  ABS(COALESCE(SUM(m.quantite) FILTER (WHERE m.quantite < 0 AND m.date_mouvement >= CURRENT_DATE - 30), 0)) AS conso_30j,
  (COALESCE(SUM(m.quantite), 0) <= COALESCE(mp.stock_min, 0)) AS alerte_stock,
  EXISTS(SELECT 1 FROM public.mp_mouvements x WHERE x.matiere_premiere_id = mp.id AND x.regularisation_requise = true AND x.resolved_at IS NULL) AS a_anomalies
FROM public.matieres_premieres mp
LEFT JOIN public.mp_mouvements m ON m.matiere_premiere_id = mp.id
WHERE mp.actif = true
GROUP BY mp.id;

GRANT SELECT ON public.v_mp_stock TO authenticated;

-- 9) Permissions suivi_stock (sans ON CONFLICT, on insÃ¨re si absent)
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete)
SELECT v.role, 'suivi_stock', v.r, v.c, v.u, v.d
FROM (VALUES
  ('ceo'::app_role, true, true, true, true),
  ('economat'::app_role, true, true, true, false),
  ('labo_patisserie'::app_role, true, false, false, false),
  ('labo_viennoiserie'::app_role, true, false, false, false),
  ('cuisine_salee'::app_role, true, false, false, false),
  ('salle'::app_role, false, false, false, false)
) AS v(role, r, c, u, d)
WHERE NOT EXISTS (SELECT 1 FROM public.module_permissions mp WHERE mp.role = v.role AND mp.module = 'suivi_stock');

-- 10) Backfill achats_mp -> mp_mouvements
INSERT INTO public.mp_mouvements (matiere_premiere_id, date_mouvement, type, quantite, source_table, source_id, motif, created_by, created_at)
SELECT
  COALESCE(a.matiere_premiere_id,
           (SELECT id FROM public.matieres_premieres mp WHERE lower(trim(mp.nom)) = lower(trim(a.produit)) LIMIT 1)),
  a.date_achat, 'achat', a.quantite, 'achats_mp', a.id,
  'Backfill achat â€” '||COALESCE(a.fournisseur,''), a.created_by, a.created_at
FROM public.achats_mp a
WHERE NOT EXISTS (SELECT 1 FROM public.mp_mouvements m WHERE m.source_table='achats_mp' AND m.source_id = a.id)
AND COALESCE(a.matiere_premiere_id,
           (SELECT id FROM public.matieres_premieres mp WHERE lower(trim(mp.nom)) = lower(trim(a.produit)) LIMIT 1)) IS NOT NULL;

-- Backfill production_labo
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.production_labo WHERE qte_produite > 0
           AND NOT EXISTS (SELECT 1 FROM public.mp_mouvements m WHERE m.source_table='production_labo' AND m.source_id = production_labo.id)
  LOOP
    PERFORM public.deduire_mps_from_fiche(r.produit_id, r.qte_produite, 'conso_labo', 'production_labo', r.id, r.date_production, r.created_by);
  END LOOP;
END $$;

UPDATE public.mp_mouvements SET regularisation_requise = false
WHERE motif LIKE 'Backfill%' OR motif LIKE 'Production:%' AND created_at < now() - interval '1 hour';


-- ============================================================
-- 20260619095450_da01d361-1a84-41be-b7bb-95da0df3a48c.sql
-- ============================================================
ALTER VIEW public.v_mp_stock SET (security_invoker = true);

DROP POLICY IF EXISTS mp_mvt_insert_auth ON public.mp_mouvements;
CREATE POLICY mp_mvt_insert_ceo ON public.mp_mouvements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY notifications_insert_ceo ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

-- ============================================================
-- 20260622004415_750a870a-17e4-47a9-835c-c52240e671a4.sql
-- ============================================================
CREATE POLICY "rapports_journaliers_delete_ceo" ON public.rapports_journaliers FOR DELETE TO authenticated USING (public.is_ceo(auth.uid()));

-- ============================================================
-- 20260701120000_add_production_consumption_trigger.sql
-- ============================================================
create or replace function public.update_consommation_mp() returns trigger language plpgsql as $$
begin
  -- When a new production_labo row is inserted, update the corresponding bon_transfert ligne
  -- Assuming a relation via bon_transfert_id stored in production_labo; adjust as needed
  if NEW.bon_transfert_id is not null then
    update public.bon_transfert_lignes
    set qte_prevue = qte_prevue + NEW.quantite_produite
    where bon_transfert_id = NEW.bon_transfert_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_update_consommation_mp
after insert on public.production_labo
for each row execute function public.update_consommation_mp();


-- ============================================================
-- 20260908111007_cbc9ab5d-724b-4a21-8544-f9326673db34.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parametres_email (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  destinataire text NOT NULL DEFAULT 'al.fanar@hotmail.fr',
  copies text[] NOT NULL DEFAULT ARRAY['nkro006@gmail.com'],
  expediteur_nom text NOT NULL DEFAULT 'SAADÃ‰ Rapports',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.parametres_email TO authenticated;
GRANT ALL ON public.parametres_email TO service_role;

ALTER TABLE public.parametres_email ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ceo_manage_parametres_email" ON public.parametres_email;
CREATE POLICY "ceo_manage_parametres_email" ON public.parametres_email
  FOR ALL TO authenticated
  USING (public.is_ceo(auth.uid()))
  WITH CHECK (public.is_ceo(auth.uid()));

INSERT INTO public.parametres_email (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 20260909000748_4f0d3543-2e5a-4ec9-8ebe-996558573991.sql
-- ============================================================
ALTER TABLE public.parametres_email
  ADD COLUMN IF NOT EXISTS expediteur_email text NOT NULL DEFAULT 'onboarding@resend.dev',
  ADD COLUMN IF NOT EXISTS domaine_verifie boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS derniere_erreur text;

-- ============================================================
-- 20260910065655_ad468e53-1354-4170-9906-3cdcfa22513f.sql
-- ============================================================
ALTER TABLE public.parametres_email ADD COLUMN IF NOT EXISTS cron_token UUID NOT NULL DEFAULT gen_random_uuid();
UPDATE public.parametres_email SET expediteur_email = 'rapports@saadenobaddays.store', domaine_verifie = true WHERE id = true;

-- ============================================================
-- 20260910120000_mp_mouvements_insert_suivi_stock.sql
-- ============================================================
-- Correctif RLS : l'Ã‰conomat ne peut plus insÃ©rer de mouvement MP
-- (erreur rapportÃ©e : "new row violates row level security policy for table mp_mouvements")
--
-- Contexte :
--   La migration 20260619095450 a remplacÃ© la politique d'INSERT permissive
--   (mp_mvt_insert_auth : WITH CHECK true) par mp_mvt_insert_ceo qui ne permet
--   QUE les CEO. Or la matrice module_permissions donne au rÃ´le 'economat'
--   can_create=true sur le module 'suivi_stock', et l'Ã©cran
--   "Suivi de Stock â†’ MP temps rÃ©el â†’ Ajuster" (SuiviStock.tsx) insÃ¨re un
--   mouvement de type 'ajustement' dans public.mp_mouvements.
--
--   can_perform() short-circuite dÃ©jÃ  le CEO (retourne true), donc une
--   seule politique alignÃ©e sur la matrice suffit, cohÃ©rente avec les
--   politiques UPDATE (mp_mvt_update_ceo_eco) et le reste du schÃ©ma.

DROP POLICY IF EXISTS mp_mvt_insert_ceo ON public.mp_mouvements;
DROP POLICY IF EXISTS mp_mvt_insert_suivi_stock ON public.mp_mouvements;

CREATE POLICY mp_mvt_insert_suivi_stock ON public.mp_mouvements
  FOR INSERT TO authenticated
  WITH CHECK (public.can_perform(auth.uid(), 'suivi_stock', 'create'));

