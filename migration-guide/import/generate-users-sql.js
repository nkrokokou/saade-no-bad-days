// generate-users-sql.js
// Génère un script SQL pour recréer les utilisateurs dans auth.users avec les MÊMES IDs.
// Usage : node generate-users-sql.js
// Le mot de passe initial est lu depuis la variable d'environnement INITIAL_PASSWORD
// (jamais de secret en dur dans le code).
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mot de passe initial depuis l'environnement (12-factor) — pas de valeur en dur.
const INITIAL_PASSWORD = process.env.INITIAL_PASSWORD || "";
if (!INITIAL_PASSWORD || INITIAL_PASSWORD.length < 8) {
  console.error("❌ Variable INITIAL_PASSWORD manquante ou trop courte (min 8).");
  console.error("   Exemple :  $env:INITIAL_PASSWORD='VotreMdpFort!'; node generate-users-sql.js");
  process.exit(1);
}

// Charge la config des utilisateurs (JSON)
const usersRaw = readFileSync(path.join(__dirname, "users.config.json"), "utf8");
const users = JSON.parse(usersRaw);

// Vérifie qu'aucun email n'est encore un placeholder
const missing = users.filter(u => !u.email || String(u.email).includes("???"));
if (missing.length) {
  console.error("⚠️  Certains emails sont encore des placeholders (???@saade.local) :");
  missing.forEach(u => console.error(`   - ${u.id} (${u.full_name})`));
  console.error("➜  Modifiez users.config.json puis relancez le script.");
  process.exit(1);
}

// Génère le SQL
let sql = `-- Création des utilisateurs auth (contrôle total)
-- À exécuter dans le SQL Editor de SUPABASE (nouveau projet)
-- Mot de passe initial fourni via INITIAL_PASSWORD / déjà changé après connexion.

-- Extension nécessaire pour crypt()/gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

`;

for (const u of users) {
  sql += `-- ${u.full_name} (${u.role}) — cleanup si déjà présent (ré-exécutable)
DELETE FROM public.user_roles WHERE user_id = '${u.id}';
DELETE FROM public.profiles WHERE id = '${u.id}';
DELETE FROM auth.identities WHERE user_id = '${u.id}';
DELETE FROM auth.users WHERE id = '${u.id}' OR email = '${u.email}';

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '${u.id}',
  'authenticated',
  'authenticated',
  '${u.email}',
  crypt('${INITIAL_PASSWORD.replace(/'/g, "''")}', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"${u.full_name.replace(/'/g, "''")}"}'::jsonb,
  '',
  '',
  '',
  '',
  now(), now()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  confirmation_token = '',
  recovery_token = '',
  email_change = '',
  email_change_token_new = '',
  updated_at = now();

-- Identité (pour la connexion email/password)
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES (
  '${u.id}', '${u.id}',
  jsonb_build_object('sub', '${u.id}', 'email', '${u.email}', 'email_verified', true, 'phone_verified', false),
  'email', now(), now(), now()
) ON CONFLICT (provider, provider_id) DO NOTHING;

-- Profil (trigger handle_new_user peut avoir déjà créé la ligne → UPDATE dans ce cas)
INSERT INTO public.profiles (id, full_name, role, created_at, is_hidden)
VALUES ('${u.id}', '${u.full_name.replace(/'/g, "''")}', '${u.role}', now(), false)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_hidden = EXCLUDED.is_hidden;

-- Rôle (table user_roles)
INSERT INTO public.user_roles (user_id, role, created_at)
VALUES ('${u.id}', '${u.role}', now())
ON CONFLICT DO NOTHING;

`;
}

writeFileSync(path.join(__dirname, "generated-users.sql"), sql, "utf8");
console.log("✅ Script SQL généré : migration-guide/import/generated-users.sql");
console.log("➜  À exécuter dans le SQL Editor de votre nouveau Supabase.");