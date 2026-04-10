
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
  unite text default 'pièce',
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
