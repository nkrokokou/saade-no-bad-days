/**
 * Assistant CEO local — GRATUIT et ILLIMITÉ.
 * Aucune dépendance à un LLM payant. Toutes les réponses sont calculées
 * à partir de requêtes Supabase (RLS CEO) et formatées en Markdown.
 *
 * Capacités étendues :
 *  - Dates relatives ET absolues : "aujourd'hui", "hier", "semaine", "mois",
 *    "18/06/2026", "2026-06-18", "depuis le 1er juin", "entre le 1/6 et le 15/6"
 *  - Mémoire de conversation : la dernière période détectée est réutilisée
 *    si la question suivante ne précise pas de date.
 *  - Intents : CA, top produits, top jamais vendus, écarts de caisse (avec
 *    explication détaillée de la formule), stock économat & MP, pertes,
 *    ardoises clients, production, achats, comparaison périodes, marges.
 */
import { supabase } from '@/lib/supabase';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0));
const fmtF = (n: number) => `${fmt(n)} F`;

function todayIso() { return new Date().toISOString().slice(0, 10); }
function isoNDaysAgo(n: number) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
function startOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }

export type Period = { from: string; to: string; label: string };
export type ConversationCtx = { lastPeriod?: Period };

function parseDateFr(s: string): string | null {
  // dd/mm/yyyy or dd-mm-yyyy or d/m/yy
  const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // yyyy-mm-dd
  const iso = s.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  return null;
}

function detectPeriod(text: string, ctx?: ConversationCtx): Period {
  const t = text.toLowerCase();
  const today = todayIso();

  // 1) Plage "du X au Y" / "entre X et Y"
  const range = t.match(/(?:du|entre|de)\s+(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?)\s+(?:au|à|a|et)\s+(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?)/);
  if (range) {
    const f = parseDateFr(range[1]); const to = parseDateFr(range[2]);
    if (f && to) return { from: f, to, label: `du ${f} au ${to}` };
  }

  // 2) Date unique absolue
  const abs = parseDateFr(t);
  if (abs) return { from: abs, to: abs, label: `le ${abs}` };

  // 3) "depuis le X"
  const since = t.match(/depuis\s+(?:le\s+)?(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?)/);
  if (since) {
    const f = parseDateFr(since[1]);
    if (f) return { from: f, to: today, label: `depuis le ${f}` };
  }

  // 4) Mots-clés relatifs
  if (/aujourd'?hui|today|du jour/.test(t)) return { from: today, to: today, label: "aujourd'hui" };
  if (/hier|yesterday/.test(t)) { const d = isoNDaysAgo(1); return { from: d, to: d, label: 'hier' }; }
  if (/avant.?hier/.test(t)) { const d = isoNDaysAgo(2); return { from: d, to: d, label: 'avant-hier' }; }
  if (/semaine|7\s*j(?!\d)|week/.test(t)) return { from: isoNDaysAgo(7), to: today, label: '7 derniers jours' };
  if (/mois|month|30\s*j(?!\d)/.test(t)) return { from: startOfMonth(), to: today, label: 'ce mois-ci' };
  if (/trimestre|90\s*j/.test(t)) return { from: isoNDaysAgo(90), to: today, label: '90 derniers jours' };
  if (/an(?!\w)|year|année|annee/.test(t)) return { from: isoNDaysAgo(365), to: today, label: '12 derniers mois' };

  // 5) Réutiliser la dernière période du contexte
  if (ctx?.lastPeriod) return ctx.lastPeriod;

  return { from: today, to: today, label: "aujourd'hui" };
}

type Handler = (text: string, ctx: ConversationCtx) => Promise<string>;
type Intent = { match: (t: string) => boolean; handle: Handler; help: string };

// ─────────── Helpers ───────────

async function getVentes(from: string, to: string) {
  const { data, error } = await supabase
    .from('ventes')
    .select('id, total, mode_paiement, statut, date_vente, client_nom, numero_ticket, encaisse_par')
    .gte('date_vente', `${from}T00:00:00.000Z`)
    .lte('date_vente', `${to}T23:59:59.999Z`)
    .neq('statut', 'annulee');
  if (error) throw error;
  return data || [];
}

// ─────────── Intents ───────────

const INTENTS: Intent[] = [
  {
    help: "📊 Chiffre d'affaires & paniers (jour/date précise/période)",
    match: (t) => /(ca|chiffre.*affaire|vente|panier|ticket)/.test(t),
    handle: async (text, ctx) => {
      const p = detectPeriod(text, ctx); ctx.lastPeriod = p;
      const ventes = await getVentes(p.from, p.to);
      const ca = ventes.reduce((s, v: any) => s + Number(v.total || 0), 0);
      const nb = ventes.length;
      const moy = nb ? ca / nb : 0;
      const parMode: Record<string, number> = {};
      ventes.forEach((v: any) => { const m = v.mode_paiement || 'autre'; parMode[m] = (parMode[m] || 0) + Number(v.total || 0); });
      const modeLines = Object.entries(parMode).map(([m, v]) => `- **${m}** : ${fmtF(v)}`).join('\n') || '_aucun paiement_';
      let body = `## 📊 Ventes — ${p.label}\n\n` +
        `- **Chiffre d'affaires** : **${fmtF(ca)}**\n` +
        `- **Tickets** : ${fmt(nb)}\n` +
        `- **Panier moyen** : ${fmtF(moy)}\n\n` +
        `### Par mode de paiement\n${modeLines}`;
      if (nb === 0) {
        body += `\n\n> 💡 Aucune vente trouvée. Vérifiez la date sélectionnée ou si les caisses étaient ouvertes. Tapez « pourquoi pas de vente le ${p.from} » pour un diagnostic.`;
      }
      return body;
    },
  },

  {
    help: '🔍 Diagnostic « pourquoi pas de vente le … »',
    match: (t) => /(pourquoi|diagnostic|aucune.*vente|0.*vente|pas.*vente)/.test(t),
    handle: async (text, ctx) => {
      const p = detectPeriod(text, ctx); ctx.lastPeriod = p;
      const ventes = await getVentes(p.from, p.to);
      const { data: sessions } = await supabase.from('sessions_caisse')
        .select('id, statut, ouvert_at, ferme_at, fond_initial, fond_final_compte, ecart, notes')
        .gte('ouvert_at', `${p.from}T00:00:00.000Z`).lte('ouvert_at', `${p.to}T23:59:59.999Z`);
      const ss = sessions || [];
      let body = `## 🔍 Diagnostic — ${p.label}\n\n`;
      body += `- Ventes trouvées : **${ventes.length}**\n`;
      body += `- Sessions de caisse ouvertes ce jour-là : **${ss.length}**\n`;
      if (ss.length) {
        body += `\n### Sessions\n| Statut | Ouverture | Fermeture | Fond initial | Compté | Écart |\n|---|---|---|---:|---:|---:|\n`;
        body += ss.map((s: any) => `| ${s.statut} | ${s.ouvert_at?.slice(11, 16) || '-'} | ${s.ferme_at?.slice(11, 16) || '-'} | ${fmtF(s.fond_initial)} | ${fmtF(s.fond_final_compte)} | ${fmtF(s.ecart)} |`).join('\n');
      }
      if (!ventes.length && !ss.length) {
        body += `\n> ⚠ Aucune session caisse + aucune vente → **personne n'a ouvert la caisse** ce jour-là, ou la date demandée est dans le futur.`;
      } else if (!ventes.length && ss.length) {
        body += `\n> ⚠ Des sessions existent mais aucune vente n'a été enregistrée. Vérifier que les tickets ont bien été clôturés (et non laissés en brouillon/crédit_pending).`;
      }
      return body;
    },
  },

  {
    help: '🏆 Top produits / jamais vendus',
    match: (t) => /(top|meilleur|plus.*vendu|best.*seller|jamais.*vendu|invendu)/.test(t),
    handle: async (text, ctx) => {
      const p = detectPeriod(text, ctx); ctx.lastPeriod = p;
      const ventes = await getVentes(p.from, p.to);
      const { data: lignes } = ventes.length ? await supabase.from('vente_lignes')
        .select('produit_id, produit_nom, quantite, total_ligne')
        .in('vente_id', ventes.map((v: any) => v.id)) : { data: [] };
      const map: Record<string, { qte: number; ca: number }> = {};
      (lignes || []).forEach((l: any) => {
        const n = l.produit_nom || '?';
        if (!map[n]) map[n] = { qte: 0, ca: 0 };
        map[n].qte += Number(l.quantite || 0);
        map[n].ca += Number(l.total_ligne || 0);
      });
      const top = Object.entries(map).map(([nom, v]) => ({ nom, ...v })).sort((a, b) => b.ca - a.ca);
      if (/jamais|invendu/.test(text)) {
        const { data: prods } = await supabase.from('produits').select('nom').eq('actif', true);
        const vendus = new Set(top.map(p => p.nom));
        const jamais = (prods || []).map((p: any) => p.nom).filter(n => !vendus.has(n));
        if (!jamais.length) return `🎉 Tous les produits actifs ont été vendus sur **${p.label}**.`;
        return `## 🚫 Produits jamais vendus — ${p.label}\n\n${jamais.length} produit(s) sans aucune vente.\n\n${jamais.slice(0, 50).map(n => `- ${n}`).join('\n')}`;
      }
      if (!top.length) return `_Aucune vente sur la période **${p.label}**._`;
      const N = 20;
      const rows = top.slice(0, N).map((p, i) => `| ${i + 1} | ${p.nom} | ${fmt(p.qte)} | ${fmtF(p.ca)} |`).join('\n');
      return `## 🏆 Top ${Math.min(N, top.length)} produits — ${p.label}\n\n| # | Produit | Quantité | CA |\n|---|---|---:|---:|\n${rows}`;
    },
  },

  {
    help: '💵 Écarts de caisse (avec explication détaillée)',
    match: (t) => /(écart|ecart|fond|cash|caisse|session.*caisse)/.test(t),
    handle: async (text, ctx) => {
      const p = detectPeriod(text, ctx); ctx.lastPeriod = p;
      const { data } = await supabase.from('sessions_caisse')
        .select('id, ouvert_at, ferme_at, ecart, fond_initial, fond_final_attendu, fond_final_compte, statut, notes')
        .gte('ouvert_at', `${p.from}T00:00:00.000Z`).lte('ouvert_at', `${p.to}T23:59:59.999Z`)
        .order('ouvert_at');
      const sessions = data || [];
      const ecartTot = sessions.reduce((s: number, x: any) => s + Number(x.ecart || 0), 0);
      const anomalies = sessions.filter((s: any) => Math.abs(Number(s.ecart || 0)) > 0);
      const autoFermees = sessions.filter((s: any) => s.statut === 'fermee_auto');

      let body = `## 💵 Écarts de caisse — ${p.label}\n\n`;
      body += `- **Sessions** : ${sessions.length}\n`;
      body += `- **Écart total** : **${fmtF(ecartTot)}** ${ecartTot > 0 ? '(surplus 💰)' : ecartTot < 0 ? '(manquant 🔴)' : '(équilibré ✅)'}\n`;
      body += `- **Sessions avec écart** : ${anomalies.length}\n`;
      body += `- **Sessions fermées automatiquement (sans comptage)** : ${autoFermees.length}\n`;

      body += `\n### 🧮 Comment se calcule l'écart\n`;
      body += `> **Écart = Fond final compté − Fond final attendu**\n`;
      body += `> où **Fond final attendu = Fond initial + Σ(ventes en espèces de la session)**\n\n`;
      body += `**Causes les plus fréquentes des écarts :**\n`;
      body += `1. 🤖 **Fermeture automatique 23h59** → le caissier n'a pas clôturé. Le système met "fond compté = 0" → écart artificiel = -(fond + ventes espèces).\n`;
      body += `2. 💴 **Fond initial mal saisi** à l'ouverture (ou oublié → considéré comme 0).\n`;
      body += `3. 🔄 **Rendu de monnaie incorrect** au client.\n`;
      body += `4. 🧾 **Crédit encaissé en espèces** mais rattaché à une session déjà fermée.\n`;
      body += `5. 🚪 **Sortie de caisse non documentée** (avance employé, achat urgent).\n`;
      body += `6. ❌ **Vente annulée après le paiement** sans rendre l'argent au client.\n`;

      if (autoFermees.length) {
        body += `\n> ⚠ **${autoFermees.length} session(s) fermée(s) auto** sur la période — c'est probablement la cause principale de vos écarts. Demandez à chaque caissier de **clôturer manuellement** avant de partir.\n`;
      }

      if (anomalies.length) {
        body += `\n### Détail des sessions à écart\n| Ouverture | Statut | Fond init. | Attendu | Compté | Écart |\n|---|---|---:|---:|---:|---:|\n`;
        body += anomalies.slice(0, 30).map((s: any) =>
          `| ${s.ouvert_at?.slice(0, 16).replace('T', ' ')} | ${s.statut} | ${fmtF(s.fond_initial)} | ${fmtF(s.fond_final_attendu)} | ${fmtF(s.fond_final_compte)} | **${fmtF(s.ecart)}** |`).join('\n');
      }
      return body;
    },
  },

  {
    help: '👤 Ventes par caissier',
    match: (t) => /caissier|encaisse|vendeur|qui.*vendu/.test(t),
    handle: async (text, ctx) => {
      const p = detectPeriod(text, ctx); ctx.lastPeriod = p;
      const ventes = await getVentes(p.from, p.to);
      const ids = Array.from(new Set(ventes.map((v: any) => v.encaisse_par).filter(Boolean)));
      const { data: profs } = ids.length ? await supabase.from('profiles').select('id, full_name').in('id', ids as any) : { data: [] };
      const noms = Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name || p.id]));
      const map: Record<string, { ca: number; n: number }> = {};
      ventes.forEach((v: any) => {
        const k = v.encaisse_par || 'inconnu';
        if (!map[k]) map[k] = { ca: 0, n: 0 };
        map[k].ca += Number(v.total || 0); map[k].n += 1;
      });
      const rows = Object.entries(map).sort((a, b) => b[1].ca - a[1].ca)
        .map(([k, v]) => `| ${noms[k] || k} | ${fmt(v.n)} | ${fmtF(v.ca)} |`).join('\n');
      if (!rows) return `_Aucune vente sur **${p.label}**._`;
      return `## 👤 Ventes par caissier — ${p.label}\n\n| Caissier | Tickets | CA |\n|---|---:|---:|\n${rows}`;
    },
  },

  {
    help: '📦 Stock économat (alertes & critiques)',
    match: (t) => /economat|économat|epicerie|épicerie/.test(t),
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
        id: mp.id, nom: mp.nom, unite: mp.unite, stock: stocks.get(mp.id) || 0, min: Number(mp.stock_min || 0),
      })).filter(x => x.stock <= 0 || (x.min > 0 && x.stock <= x.min))
        .sort((a, b) => a.stock - b.stock);
      if (!list.length) return `✅ **Aucune rupture matière première.**`;
      const rows = list.slice(0, 30).map(x => `| [${x.nom}](/mp/${x.id}/cycle) | ${fmt(x.stock)} ${x.unite} | ${x.stock <= 0 ? '🔴 Rupture' : '⚠ Alerte'} |`).join('\n');
      return `## 🧂 MP — ${list.length} alerte(s)\n\nCliquez sur un nom pour voir son **cycle de vie complet** (achats, conso, ajustements).\n\n| Matière | Stock | État |\n|---|---:|:--|\n${rows}`;
    },
  },

  {
    help: '🗑 Pertes & invendus',
    match: (t) => /perte|invendu|jeté|jete|gaspil/.test(t),
    handle: async (text, ctx) => {
      const p = detectPeriod(text, ctx); ctx.lastPeriod = p;
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

  {
    help: '🥐 Production labo',
    match: (t) => /production|labo|fabriqu/.test(t),
    handle: async (text, ctx) => {
      const p = detectPeriod(text, ctx); ctx.lastPeriod = p;
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

  {
    help: '🛒 Achats matières premières',
    match: (t) => /achat|fournisseur|approvision/.test(t),
    handle: async (text, ctx) => {
      const p = detectPeriod(text, ctx); ctx.lastPeriod = p;
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

**Exemples avancés :**
- _CA du 18/06/2026_ · _CA de la semaine_ · _CA entre le 1/6 et le 15/6_
- _Top produits ce mois-ci_ · _Produits jamais vendus_
- _Écart de caisse hier_ · _Pourquoi pas de vente le 18/06/2026 ?_
- _Ventes par caissier_ · _Ruptures MP_ · _Ardoises clients_

💡 Une fois une date choisie, je la garde en mémoire pour les questions suivantes.`;

const ctxStore: ConversationCtx = {};

export async function answerCeoQuestion(text: string, ctx: ConversationCtx = ctxStore): Promise<string> {
  const norm = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/aide|help|que peux.*tu|comment.*utiliser/.test(norm) || !norm.trim()) return HELP_MESSAGE;
  for (const intent of INTENTS) {
    if (intent.match(norm)) {
      try {
        return await intent.handle(norm, ctx);
      } catch (e: any) {
        return `❌ Erreur en récupérant les données : ${e?.message || 'inconnue'}.\n\n${HELP_MESSAGE}`;
      }
    }
  }
  return `Je n'ai pas compris votre question. ${HELP_MESSAGE}`;
}

export const CEO_SUGGESTIONS = [
  "CA aujourd'hui",
  "CA du 18/06/2026",
  "Pourquoi pas de vente le 18/06/2026",
  "Écart de caisse aujourd'hui",
  "Ventes par caissier cette semaine",
  "Top produits ce mois-ci",
  "Produits jamais vendus",
  "Ruptures MP",
  "Ardoises clients",
];
