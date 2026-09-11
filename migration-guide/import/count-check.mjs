// count-check.mjs — compare les comptages CSV vs base
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_DIR = path.join(__dirname, "..", "..", "databasecsv");

const env = {};
for (const raw of readFileSync(path.join(__dirname, ".env.local"), "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}
const URL = env.SUPABASE_URL.replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_KEY;

function csvCount(table) {
  const files = readdirSync(CSV_DIR).filter(f => f.startsWith(table + "-export-"));
  if (!files.length) return null;
  const text = readFileSync(path.join(CSV_DIR, files[0]), "utf8");
  const dataLines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  return dataLines.length - 1; // moins l'en-tête
}

async function dbCount(table) {
  const res = await fetch(`${URL}/rest/v1/${table}?select=id&limit=1`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  const cr = res.headers.get("content-range");
  if (!cr) return "?";
  return cr.split("/")[1];
}

const TABLES = [
  "categories_produits", "matieres_premieres", "clients", "tables_restaurant",
  "ticket_templates", "parametres_email", "module_permissions",
  "produits", "produit_options_groupes", "produit_options_items",
  "fiches_techniques_meta", "fiches_techniques",
  "achats_mp", "mp_mouvements",
  "economat_articles", "economat_mouvements",
  "sessions_caisse", "ventes", "vente_lignes", "vente_ligne_options",
  "pertes", "production_labo", "cloture_journaliere", "degustations",
  "inventaire", "stock_tampon", "bons_transfert", "bon_transfert_lignes",
  "credits_clients", "paiements_credits",
  "notifications", "audits_ceo", "rapports_journaliers", "audit_logs",
  "user_preferences", "mouvements_stock",
];

console.log(`${"TABLE".padEnd(28)} ${"CSV".padStart(7)} ${"BASE".padStart(7)}  STATUT`);
console.log("-".repeat(56));
let ok = 0, ko = 0, empty = 0;
for (const t of TABLES) {
  const csv = csvCount(t);
  const base = await dbCount(t);
  if (csv === null) continue;
  const csvN = Number(csv);
  const baseN = base === "?" ? -1 : Number(base);
  let status;
  if (csvN === 0) { status = "vide (OK)"; empty++; }
  else if (csvN === baseN) { status = "✅"; ok++; }
  else { status = `⚠️ écart`; ko++; }
  console.log(`${t.padEnd(28)} ${String(csvN).padStart(7)} ${String(baseN).padStart(7)}  ${status}`);
}
console.log("-".repeat(56));
console.log(`✅ ${ok} tables conformes | ${ko} écarts | ${empty} vides`);