// import-data.mjs
// Importe les CSV (databasecsv/) dans le NOUVEAU Supabase, en préservant les IDs.
// Utilise l'API REST (service_role) en lots (upsert). Ordre respecté pour les FK.
//
// Usage :
//   1. Créer le fichier .env.local dans migration-guide/import avec :
//        SUPABASE_URL=https://rgdvlqwuhyrtmzraaowt.supabase.co
//        SUPABASE_SERVICE_KEY=eyJ... (clé service_role du NOUVEAU projet)
//   2. node migration-guide/import/import-data.mjs
//
// Options : --dry-run | --table=xxx | --limit=N

import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const CSV_DIR = path.join(ROOT, "databasecsv");

function loadEnv() {
  const envPath = path.join(__dirname, ".env.local");
  if (!existsSync(envPath)) {
    console.error("❌ Fichier .env.local manquant. Créez-le dans migration-guide/import avec SUPABASE_URL et SUPABASE_SERVICE_KEY.");
    process.exit(1);
  }
  const env = {};
  for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

// Parse CSV (séparateur ";" + guillemets doubles). Retourne {cols, rows}
function parseCsv(text) {
  const lines = [];
  let line = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ";") {
      line.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      line.push(cur);
      cur = "";
      lines.push(line);
      line = [];
    } else {
      cur += c;
    }
  }
  // Dernière ligne (sans retour à la ligne final)
  if (cur !== "" || line.length > 0) {
    line.push(cur);
    lines.push(line);
  }

  if (lines.length === 0) return { cols: [], rows: [] };

  const cols = lines[0];
  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const vals = lines[r];
    const obj = {};
    cols.forEach((col, idx) => { obj[col] = vals[idx] ?? ""; });
    rows.push(obj);
  }
  return { cols, rows };
}

// Convertit une valeur CSV en type JS (pour l'API REST / PostgREST)
function toValue(raw) {
  if (raw === "" || raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "true") return true;
  if (s === "false") return false;
  // timestamps "2026-04-22 16:57:35.878122+00" → ISO 8601
  if (/^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2}(\.\d+)?)?(\+00|Z|$)/.test(s)) {
    return s.replace(" ", "T").replace("+00", "Z").replace("Z$", "Z");
  }
  // JSON (objets/tableaux échappés) → objet JS
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try { return JSON.parse(s); } catch (_e) { /* pas du JSON, on laisse la string */ }
  }
  // nombres
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return s;
}

// Ordre d'import (FK respectées). Les vues v_* sont exclues (créées par le schéma).
const ORDER = [
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

// Ignore ces tables (vues) à l'import
const IGNORE = new Set(["v_economat_stock", "v_mp_stock", "v_stock_matieres_premieres"]);

// Tables avec données SEED créées par les migrations (contraintes uniques non-PK
// entrant en conflit avec le CSV) → on vide la table avant d'importer les vraies données
const TABLES_TO_CLEAR = new Set(["tables_restaurant", "ticket_templates", "module_permissions"]);

// Valeurs par défaut : colonnes NOT NULL dont le CSV d'origine contient null
const COLUMN_DEFAULTS = {
  achats_mp: { fournisseur: "NON RENSEIGNÉ" },
};

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const tableFilter = args.find(a => a.startsWith("--table="))?.split("=")[1];
  const limit = args.find(a => a.startsWith("--limit="))?.split("=")[1];

  const env = loadEnv();
  if (!dry && !env.SUPABASE_SERVICE_KEY) {
    console.error("❌ SUPABASE_SERVICE_KEY manquante dans .env.local");
    process.exit(1);
  }

  const URL = env.SUPABASE_URL.replace(/\/$/, "");

  const files = readdirSync(CSV_DIR).filter(f => f.endsWith(".csv"));
  const byTable = {};
  for (const f of files) {
    const table = f.split("-export-")[0];
    byTable[table] = path.join(CSV_DIR, f);
  }

  let totalRows = 0;
  for (const table of ORDER) {
    if (tableFilter && table !== tableFilter) continue;
    if (IGNORE.has(table) || !byTable[table]) continue;
    const text = readFileSync(byTable[table], "utf8");
    const { cols, rows } = parseCsv(text);
    let dataRows = rows;
    if (limit) dataRows = rows.slice(0, Number(limit));
    if (dataRows.length === 0) continue;
    totalRows += dataRows.length;
    console.log(`\n📦 ${table} : ${dataRows.length} lignes`);

    const records = dataRows.map(r => {
      const obj = {};
      for (const col of cols) obj[col] = toValue(r[col]);
      return obj;
    });

    // Valeurs par défaut pour les colonnes NOT NULL vides dans le CSV
    const defaults = COLUMN_DEFAULTS[table];
    if (defaults) {
      for (const rec of records) {
        for (const [col, val] of Object.entries(defaults)) {
          if (rec[col] === null || rec[col] === undefined || rec[col] === "") {
            rec[col] = val;
          }
        }
      }
    }

    if (dry) {
      console.log(`   (dry-run : 1er enregistrement -> ${JSON.stringify(records[0]).slice(0, 160)}...)`);
      continue;
    }

    // Tables seedées par les migrations → vider avant d'importer les vraies données
    if (!dry && TABLES_TO_CLEAR.has(table)) {
      const del = await fetch(`${URL}/rest/v1/${table}?id=not.is.null`, {
        method: "DELETE",
        headers: {
          "apikey": env.SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          "Prefer": "return=minimal",
        },
      });
      if (del.ok) console.log("   🧹 table vidée (données seed)");
      else console.log(`   ⚠️ clear failed HTTP ${del.status}: ${(await del.text()).slice(0, 200)}`);
    }

    const CHUNK = 300;
    for (let i = 0; i < records.length; i += CHUNK) {
      const slice = records.slice(i, i + CHUNK);
      const res = await fetch(`${URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          "apikey": env.SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(slice),
      });
      if (!res.ok) {
        const bodyTxt = await res.text();
        console.error(`   ❌ ${table} (lot ${i / CHUNK + 1}) HTTP ${res.status}: ${bodyTxt.slice(0, 300)}`);
      } else {
        console.log(`   ✅ lot ${i / CHUNK + 1}/${Math.ceil(records.length / CHUNK)}`);
      }
    }
  }

  console.log(`\n=== Terminé. ${dry ? "(DRY-RUN) " : ""}Total : ${totalRows} lignes ===`);
}

main().catch(e => { console.error(e); process.exit(1); });