/**
 * Assistant CEO local — GRATUIT et ILLIMITÉ.
 * Aucune dépendance à un LLM payant. Toutes les réponses sont calculées
 * à partir de requêtes Supabase (RLS CEO) et formatées en Markdown.
 *
 * Pour ajouter une question : déclarer un nouvel intent dans INTENTS avec
 * un test (regex/keywords) et un handler async qui renvoie du Markdown.
 */
import { supabase } from '@/lib/supabase';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0));
const fmtF = (n: number) => `${fmt(n)} F`;

function todayIso() { return new Date().toISOString().slice(0, 10); }
function isoNDaysAgo(n: number) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
function startOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }

function detectPeriod(text: string): { from: string; to: string; label: string } {
  const t = text.toLowerCase();
  const today = todayIso();
  if (/aujourd'?hui|today|jour/.test(t)) return { from: today, to: today, label: "aujourd'hui" };
  if (/hier|yesterday/.test(t)) { const d = isoNDaysAgo(1); return { from: d, to: d, label: 'hier' }; }
  if (/semaine|7\s*j|week/.test(t)) return { from: isoNDaysAgo(7), to: today, label: '7 derniers jours' };
  if (/mois|month|30\s*j/.test(t)) return { from: startOfMonth(), to: today, label: 'ce mois-ci' };
  if (/an|year|année|annee/.test(t)) return { from: isoNDaysAgo(365), to: today, label: '12 derniers mois' };
  return { from: today, to: today, label: "aujourd'hui" };
}

type Handler = (text: string) => Promise<string>;
type Intent = { match: (t: string) => boolean; handle: Handler; help: string };

// ─────────── Helpers de requêtes ───────────

async function getVentes(from: string, to: string) {
  const { data, error } = await supabase
    .from('ventes')
    .select('id, total, mode_paiement, statut, date_vente, client_nom, numero_ticket')
    .gte('date_vente', `${from}T00:00:00.000Z`)
    .lte('date_vente', `${to}T23:59:59.999Z`)
    .neq('statut', 'annulee');
  if (error) throw error;
  return data || [];
}

// ─────────── Intents ───────────

const INTENTS: Intent[] = [
  // CA / Ventes / Panier moyen
  {
    help: "📊 Chiffre d'affaires (jour/semaine/mois)",
    match: (t) => /(ca|chiffre.*affaire|vente|panier|ticket)/.test(t),
    handle: async (text) => {
      const p = detectPeriod(text);
      const ventes = await getVentes(p.from, p.to);
      const ca = ventes.reduce((s, v: any) => s + Number(v.total || 0), 0);
      const nb = ventes.length;
      const moy = nb ? ca / nb : 0;
      const parMode: Record<string, number> = {};
      ventes.forEach((v: any) => { const m = v.mode_paiement || 'autre'; parMode[m] = (parMode[m] || 0) + Number(v.total || 0); });
      const modeLines = Object.entries(parMode).map(([m, v]) => `- **${m}** : ${fmtF(v)}`).join('\n') || '_aucun paiement_';
      return `## 📊 Ventes — ${p.label}\n\n` +
        `- **Chiffre d'affaires** : **${fmtF(ca)}**\n` +
        `- **Tickets** : ${fmt(nb)}\n` +
        `- **Panier moyen** : ${fmtF(moy)}\n\n` +
        `### Par mode de paiement\n${modeLines}`;
    },
  },

  // Top produits
  {
    help: '🏆 Top produits vendus',
    match: (t) => /(top|meilleur|plus.*vendu|best.*seller)/.test(t),
    handle: async (text) => {
      const p = detectPeriod(text);
      const ventes = await getVentes(p.from, p.to);
      if (!ventes.length) return `_Aucune vente sur la période **${p.label}**._`;
      const { data: lignes } = await supabase.from('vente_lignes')
        .select('produit_nom, quantite, total_ligne')
        .in('vente_id', ventes.map((v: any) => v.id));
      const map: Record<string, { qte: number; ca: number }> = {};
      (lignes || []).forEach((l: any) => {
        const n = l.produit_nom || '?';
        if (!map[n]) map[n] = { qte: 0, ca: 0 };
        map[n].qte += Number(l.quantite || 0);
        map[n].ca += Number(l.total_ligne || 0);
      });
      const top = Object.entries(map).map(([nom, v]) => ({ nom, ...v })).sort((a, b) => b.ca - a.ca).slice(0, 10);
      const rows = top.map((p, i) => `| ${i + 1} | ${p.nom} | ${fmt(p.qte)} | ${fmtF(p.ca)} |`).join('\n');
      return `## 🏆 Top 10 produits — ${p.label}\n\n| # | Produit | Quantité | CA |\n|---|---|---:|---:|\n${rows}`;
    },
  },

  // Stock économat
  {
    help: '📦 Stock économat (alertes & critiques)',
    match: (t) => /(stock).*(econ|économ|epicerie|épicerie)|economat|économat/.test(t),
    handle: async () => {
      const { data: articles } = await supabase.from('economat_articles')
        .select('id, nom, unite, stock_min, stock_initial').eq('actif', true);
      const { data: mvts } = await supabase.from('economat_mouvements').select('article_id, type, quantite');
      const stocks = new Map<string, number>();
      (mvts || []).forEach((m: any) => {
        const cur = stocks.get(m.article_id) || 0;
        stocks.set(m.article_id, cur + (m.type === 'entree' ? Number(m.quantite) : -Number(m.quantite)));
      });
      const list = (articles || []).map((a: any) => ({
        nom: a.nom, unite: a.unite, stock: (Number(a.stock_initial) || 0) + (stocks.get(a.id) || 0), min: Number(a.stock_min || 0),
      })).filter(x => x.min > 0 && x.stock <= x.min).sort((a, b) => a.stock - b.stock);
      if (!list.length) return `✅ **Aucune alerte économat.** Tous les articles suivis sont au-dessus de leur seuil.`;
      const rows = list.slice(0, 30).map(x => `| ${x.nom} | ${fmt(x.stock)} ${x.unite} | ${fmt(x.min)} ${x.unite} |`).join('\n');
      return `## ⚠ Économat — ${list.length} article(s) en alerte\n\n| Article | Stock actuel | Seuil min |\n|---|---:|---:|\n${rows}`;
    },
  },

  // Stock MP / rupture
  {
    help: '🧂 Stock matières premières & ruptures',
    match: (t) => /(stock.*(mp|matière|matiere)|rupture|matière première|matiere premiere)/.test(t),
    handle: async () => {
      const { data: mps } = await supabase.from('matieres_premieres').select('id, nom, unite, stock_min').eq('actif', true);
      const { data: mvts } = await supabase.from('mp_mouvements').select('matiere_premiere_id, quantite');
      const stocks = new Map<string, number>();
      (mvts || []).forEach((m: any) => {
        const cur = stocks.get(m.matiere_premiere_id) || 0;
        stocks.set(m.matiere_premiere_id, cur + Number(m.quantite || 0));
      });
      const list = (mps || []).map((mp: any) => ({
        nom: mp.nom, unite: mp.unite, stock: stocks.get(mp.id) || 0, min: Number(mp.stock_min || 0),
      })).filter(x => x.stock <= 0 || (x.min > 0 && x.stock <= x.min))
        .sort((a, b) => a.stock - b.stock);
      if (!list.length) return `✅ **Aucune rupture matière première.**`;
      const rows = list.slice(0, 30).map(x => `| ${x.nom} | ${fmt(x.stock)} ${x.unite} | ${x.stock <= 0 ? '🔴 Rupture' : '⚠ Alerte'} |`).join('\n');
      return `## 🧂 MP — ${list.length} alerte(s)\n\n| Matière | Stock | État |\n|---|---:|:--|\n${rows}`;
    },
  },

  // Écart caisse
  {
    help: '💵 Écarts de caisse',
    match: (t) => /(écart|ecart|fond|cash|caisse)/.test(t),
    handle: async (text) => {
      const p = detectPeriod(text);
      const { data } = await supabase.from('sessions_caisse')
        .select('id, ouvert_at, ferme_at, ecart, fond_final_attendu, fond_final_compte, statut, notes')
        .gte('ouvert_at', `${p.from}T00:00:00.000Z`).lte('ouvert_at', `${p.to}T23:59:59.999Z`);
      const sessions = data || [];
      const ecartTot = sessions.reduce((s: number, x: any) => s + Number(x.ecart || 0), 0);
      const anomalies = sessions.filter((s: any) => Math.abs(Number(s.ecart || 0)) > 0);
      let body = `## 💵 Caisse — ${p.label}\n\n- **Sessions** : ${sessions.length}\n- **Écart total** : **${fmtF(ecartTot)}**\n- **Sessions avec écart** : ${anomalies.length}\n`;
      if (anomalies.length) {
        body += `\n### Causes possibles\n`;
        body += `- Rendu de monnaie incorrect\n- Vente non saisie / annulée tardivement\n- Fond initial mal compté\n- Sortie caisse non documentée\n`;
        body += `\n### Détail\n| Session | Attendu | Compté | Écart |\n|---|---:|---:|---:|\n`;
        body += anomalies.slice(0, 20).map((s: any, i: number) =>
          `| ${i + 1} | ${fmtF(s.fond_final_attendu)} | ${fmtF(s.fond_final_compte)} | ${fmtF(s.ecart)} |`).join('\n');
      }
      return body;
    },
  },

  // Pertes
  {
    help: '🗑 Pertes & invendus',
    match: (t) => /perte|invendu|jeté|jete|gaspil/.test(t),
    handle: async (text) => {
      const p = detectPeriod(text);
      const { data } = await supabase.from('pertes')
        .select('jour, produit, quantite, valeur, motif')
        .gte('jour', p.from).lte('jour', p.to)
        .order('jour', { ascending: false });
      const list = data || [];
      const total = list.reduce((s: number, x: any) => s + Number(x.valeur || 0), 0);
      if (!list.length) return `✅ Aucune perte enregistrée sur **${p.label}**.`;
      const rows = list.slice(0, 30).map((x: any) => `| ${x.jour} | ${x.produit} | ${fmt(x.quantite)} | ${fmtF(x.valeur)} | ${x.motif || '-'} |`).join('\n');
      return `## 🗑 Pertes — ${p.label}\n\n- **Valeur totale** : **${fmtF(total)}**\n- **Lignes** : ${list.length}\n\n| Date | Produit | Qté | Valeur | Motif |\n|---|---|---:|---:|---|\n${rows}`;
    },
  },

  // Crédits clients
  {
    help: '👥 Crédits / ardoises clients',
    match: (t) => /credit|crédit|ardoise|client.*doit|dette/.test(t),
    handle: async () => {
      const { data } = await supabase.from('credits_clients')
        .select('id, client_nom, date_credit, montant_initial, montant_restant, statut')
        .eq('statut', 'ouvert')
        .order('date_credit');
      const list = data || [];
      const total = list.reduce((s: number, x: any) => s + Number(x.montant_restant || 0), 0);
      if (!list.length) return `✅ Aucune ardoise ouverte.`;
      const old = list.filter((c: any) => new Date(c.date_credit) < new Date(Date.now() - 30 * 86400000));
      const rows = list.slice(0, 30).map((c: any) =>
        `| ${c.client_nom || '?'} | ${c.date_credit} | ${fmtF(c.montant_initial)} | ${fmtF(c.montant_restant)} |`).join('\n');
      return `## 👥 Ardoises ouvertes\n\n- **Encours total** : **${fmtF(total)}**\n- **Comptes** : ${list.length}${old.length ? `\n- ⚠ **${old.length} crédit(s) > 30j**` : ''}\n\n| Client | Depuis | Initial | Restant |\n|---|---|---:|---:|\n${rows}`;
    },
  },

  // Production
  {
    help: '🥐 Production labo',
    match: (t) => /production|labo|fabriqu/.test(t),
    handle: async (text) => {
      const p = detectPeriod(text);
      const { data } = await supabase.from('production_labo')
        .select('date_production, produit_id, qte_produite, produits(nom)')
        .gte('date_production', p.from).lte('date_production', p.to);
      const list = (data || []).map((r: any) => ({ jour: r.date_production, nom: r.produits?.nom || '?', qte: Number(r.qte_produite || 0) }));
      if (!list.length) return `_Aucune production sur **${p.label}**._`;
      const agg: Record<string, number> = {};
      list.forEach(l => { agg[l.nom] = (agg[l.nom] || 0) + l.qte; });
      const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 20);
      const rows = sorted.map(([n, q], i) => `| ${i + 1} | ${n} | ${fmt(q)} |`).join('\n');
      return `## 🥐 Production — ${p.label}\n\n${list.length} ligne(s) de production.\n\n| # | Produit | Quantité |\n|---|---|---:|\n${rows}`;
    },
  },

  // Achats MP
  {
    help: '🛒 Achats matières premières',
    match: (t) => /achat|fournisseur|approvision/.test(t),
    handle: async (text) => {
      const p = detectPeriod(text);
      const { data } = await supabase.from('achats_mp')
        .select('date_achat, produit, fournisseur, quantite, prix_total')
        .gte('date_achat', p.from).lte('date_achat', p.to).order('date_achat', { ascending: false });
      const list = data || [];
      const total = list.reduce((s: number, x: any) => s + Number(x.prix_total || 0), 0);
      if (!list.length) return `_Aucun achat enregistré sur **${p.label}**._`;
      const rows = list.slice(0, 30).map((x: any) =>
        `| ${x.date_achat} | ${x.produit} | ${x.fournisseur || '-'} | ${fmt(x.quantite)} | ${fmtF(x.prix_total)} |`).join('\n');
      return `## 🛒 Achats MP — ${p.label}\n\n- **Total** : **${fmtF(total)}**\n- **Lignes** : ${list.length}\n\n| Date | Produit | Fournisseur | Qté | Total |\n|---|---|---|---:|---:|\n${rows}`;
    },
  },
];

const HELP_MESSAGE = `Je suis votre **Assistant SAADÉ local** — gratuit et illimité 🎁.

Je réponds en consultant directement la base de données. Voici ce que je sais faire :

${INTENTS.map(i => `- ${i.help}`).join('\n')}

**Exemples :**
- _CA de la semaine_
- _Top produits ce mois-ci_
- _Stock économat_
- _Ruptures matières premières_
- _Écart de caisse aujourd'hui_
- _Pertes du mois_
- _Ardoises clients_
- _Production hier_
- _Achats fournisseurs cette semaine_`;

export async function answerCeoQuestion(text: string): Promise<string> {
  const norm = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/aide|help|que peux.*tu|comment.*utiliser/.test(norm) || !norm.trim()) return HELP_MESSAGE;
  for (const intent of INTENTS) {
    if (intent.match(norm)) {
      try {
        return await intent.handle(norm);
      } catch (e: any) {
        return `❌ Erreur en récupérant les données : ${e?.message || 'inconnue'}.\n\n${HELP_MESSAGE}`;
      }
    }
  }
  return `Je n'ai pas compris votre question. ${HELP_MESSAGE}`;
}

export const CEO_SUGGESTIONS = [
  "CA aujourd'hui",
  "Top produits cette semaine",
  "Stock économat",
  "Ruptures MP",
  "Écart de caisse aujourd'hui",
  "Pertes du mois",
  "Ardoises clients",
  "Production hier",
  "Achats fournisseurs cette semaine",
];
