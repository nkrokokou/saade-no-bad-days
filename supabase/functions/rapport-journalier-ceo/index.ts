// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const CEO_EMAIL = "al.fanar@hotmail.fr";
const FROM = "SAADÉ Rapports <onboarding@resend.dev>";

// Réglages d'envoi modifiables depuis l'application (table parametres_email)
async function getEmailSettings(admin: any) {
  try {
    const { data } = await admin.from("parametres_email").select("*").eq("id", true).maybeSingle();
    return {
      to: data?.destinataire || CEO_EMAIL,
      cc: (data?.copies || []).filter((x: string) => !!x),
      from: `${data?.expediteur_nom || "SAADÉ Rapports"} <${data?.expediteur_email || "onboarding@resend.dev"}>`,
    };
  } catch (_e) {
    return { to: CEO_EMAIL, cc: [], from: FROM };
  }
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const fmtXOF = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " F";

function dateLome(): string {
  // Lomé = UTC, simple
  return new Date().toISOString().slice(0, 10);
}

function dayLabel(d: string): string {
  return new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function buildReport(supabase: any, date: string) {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  // Ventes du jour
  const { data: ventes } = await supabase
    .from("ventes")
    .select("id, total, mode_paiement, statut, numero_ticket")
    .gte("date_vente", dayStart)
    .lte("date_vente", dayEnd)
    .neq("statut", "annulee");

  const ventesArr = ventes || [];
  const ca = ventesArr.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
  const nbTickets = ventesArr.length;
  const panierMoyen = nbTickets > 0 ? ca / nbTickets : 0;

  const parMode: Record<string, number> = {};
  ventesArr.forEach((v: any) => {
    const m = v.mode_paiement || "autre";
    parMode[m] = (parMode[m] || 0) + Number(v.total || 0);
  });

  // Top produits
  const venteIds = ventesArr.map((v: any) => v.id);
  let topProduits: any[] = [];
  if (venteIds.length) {
    const { data: lignes } = await supabase
      .from("vente_lignes")
      .select("produit_nom, quantite, total_ligne")
      .in("vente_id", venteIds);

    const map: Record<string, { qte: number; ca: number }> = {};
    (lignes || []).forEach((l: any) => {
      const n = l.produit_nom || "?";
      if (!map[n]) map[n] = { qte: 0, ca: 0 };
      map[n].qte += Number(l.quantite || 0);
      map[n].ca += Number(l.total_ligne || 0);
    });
    topProduits = Object.entries(map)
      .map(([nom, v]) => ({ nom, qte: v.qte, ca: v.ca }))
      .sort((a, b) => b.qte - a.qte)
      .slice(0, 5);
  }

  // Sessions caisse
  const { data: sessions } = await supabase
    .from("sessions_caisse")
    .select("statut, fond_final_attendu, fond_final_compte, ecart, ferme_at, ouvert_at")
    .gte("ouvert_at", dayStart)
    .lte("ouvert_at", dayEnd);

  const sessionsArr = sessions || [];
  const sessionsFermees = sessionsArr.filter((s: any) => s.statut === "fermee");
  const sessionsOuvertes = sessionsArr.filter((s: any) => s.statut === "ouverte");
  const ecartTotal = sessionsFermees.reduce((s: number, x: any) => s + Number(x.ecart || 0), 0);

  // Clôture journalière
  const { data: clotures } = await supabase
    .from("cloture_journaliere")
    .select("qte_perte, qte_invendu, prix_invendu_50, produit_id")
    .eq("date_cloture", date);

  const cloturesArr = clotures || [];
  const nbProduitsAvecPerte = cloturesArr.filter((c: any) => Number(c.qte_perte) > 0).length;
  const valeurInvendus = cloturesArr.reduce(
    (s: number, c: any) => s + Number(c.qte_invendu || 0) * Number(c.prix_invendu_50 || 0),
    0,
  );

  // Crédits
  const { data: nouveauxCredits } = await supabase
    .from("credits_clients")
    .select("montant_initial")
    .eq("date_credit", date);
  const totalNouveauxCredits = (nouveauxCredits || []).reduce(
    (s: number, c: any) => s + Number(c.montant_initial || 0),
    0,
  );

  const { data: paiementsCredits } = await supabase
    .from("paiements_credits")
    .select("montant")
    .gte("date_paiement", dayStart)
    .lte("date_paiement", dayEnd);
  const totalPaiementsCredits = (paiementsCredits || []).reduce(
    (s: number, p: any) => s + Number(p.montant || 0),
    0,
  );

  const { data: encours } = await supabase
    .from("credits_clients")
    .select("montant_restant")
    .eq("statut", "ouvert");
  const totalEncours = (encours || []).reduce(
    (s: number, c: any) => s + Number(c.montant_restant || 0),
    0,
  );

  return {
    date,
    dayLabel: dayLabel(date),
    ca,
    nbTickets,
    panierMoyen,
    parMode,
    topProduits,
    sessions: {
      total: sessionsArr.length,
      fermees: sessionsFermees.length,
      ouvertes: sessionsOuvertes.length,
      ecartTotal,
    },
    cloture: {
      nbProduits: cloturesArr.length,
      nbProduitsAvecPerte,
      valeurInvendus,
    },
    credits: {
      nouveaux: totalNouveauxCredits,
      paiements: totalPaiementsCredits,
      encours: totalEncours,
    },
  };
}

function renderHTML(r: any): string {
  const cream = "#FAF6F0";
  const caramel = "#C49A5A";
  const espresso = "#2C1A0E";

  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

  const modeRows = Object.entries(r.parMode)
    .map(
      ([m, val]: any) =>
        `<tr><td style="padding:6px 12px">${esc(m)}</td><td style="padding:6px 12px;text-align:right;font-weight:600">${fmtXOF(val)}</td></tr>`,
    )
    .join("") || `<tr><td colspan="2" style="padding:6px 12px;color:#888">Aucun paiement</td></tr>`;

  const topRows = r.topProduits
    .map(
      (p: any, i: number) =>
        `<tr><td style="padding:6px 12px">${i + 1}. ${esc(p.nom)}</td><td style="padding:6px 12px;text-align:center">${p.qte}</td><td style="padding:6px 12px;text-align:right;font-weight:600">${fmtXOF(p.ca)}</td></tr>`,
    )
    .join("") || `<tr><td colspan="3" style="padding:6px 12px;color:#888">Aucune vente</td></tr>`;

  const block = (titre: string, contenu: string) => `
    <div style="background:#fff;border:1px solid #E8DCC4;border-radius:8px;padding:18px;margin:0 0 16px">
      <h2 style="font-family:Georgia,serif;font-size:18px;color:${espresso};margin:0 0 14px;border-bottom:2px solid ${caramel};padding-bottom:8px">${titre}</h2>
      ${contenu}
    </div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${cream};font-family:Arial,sans-serif;color:${espresso}">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="text-align:center;padding:20px 0 24px">
      <h1 style="font-family:Georgia,serif;font-size:30px;color:${espresso};margin:0;letter-spacing:2px">SAADÉ</h1>
      <p style="color:${caramel};margin:4px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:1px">Rapport journalier</p>
      <p style="color:#666;margin:8px 0 0;font-size:14px">${r.dayLabel}</p>
    </div>

    ${block(
      "Chiffre d'affaires",
      `
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 12px">CA total</td><td style="padding:6px 12px;text-align:right;font-weight:700;color:${caramel};font-size:18px">${fmtXOF(r.ca)}</td></tr>
        <tr><td style="padding:6px 12px">Nombre de tickets</td><td style="padding:6px 12px;text-align:right;font-weight:600">${r.nbTickets}</td></tr>
        <tr><td style="padding:6px 12px">Panier moyen</td><td style="padding:6px 12px;text-align:right;font-weight:600">${fmtXOF(r.panierMoyen)}</td></tr>
      </table>
      <h3 style="font-size:13px;color:#666;margin:14px 0 6px;text-transform:uppercase;letter-spacing:1px">Par mode de paiement</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${modeRows}</table>
    `,
    )}

    ${block(
      "Caisse",
      `
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 12px">Sessions ouvertes (jour)</td><td style="padding:6px 12px;text-align:right">${r.sessions.total}</td></tr>
        <tr><td style="padding:6px 12px">Sessions fermées</td><td style="padding:6px 12px;text-align:right">${r.sessions.fermees}</td></tr>
        ${r.sessions.ouvertes > 0 ? `<tr><td style="padding:6px 12px;color:#b35400">⚠ Sessions encore ouvertes</td><td style="padding:6px 12px;text-align:right;font-weight:600;color:#b35400">${r.sessions.ouvertes}</td></tr>` : ""}
        <tr><td style="padding:6px 12px">Écart de caisse total</td><td style="padding:6px 12px;text-align:right;font-weight:600;color:${r.sessions.ecartTotal !== 0 ? "#b00020" : "#0a7d2a"}">${fmtXOF(r.sessions.ecartTotal)}</td></tr>
      </table>
    `,
    )}

    ${block(
      "Top 5 produits",
      `
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="color:#666;font-size:12px;text-transform:uppercase">
          <th style="padding:6px 12px;text-align:left">Produit</th>
          <th style="padding:6px 12px;text-align:center">Qté</th>
          <th style="padding:6px 12px;text-align:right">CA</th>
        </tr></thead>
        <tbody>${topRows}</tbody>
      </table>
    `,
    )}

    ${block(
      "Clôture journalière",
      `
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 12px">Produits clôturés</td><td style="padding:6px 12px;text-align:right">${r.cloture.nbProduits}</td></tr>
        <tr><td style="padding:6px 12px">Produits avec perte</td><td style="padding:6px 12px;text-align:right;font-weight:600;color:${r.cloture.nbProduitsAvecPerte > 0 ? "#b35400" : "#0a7d2a"}">${r.cloture.nbProduitsAvecPerte}</td></tr>
        <tr><td style="padding:6px 12px">Valeur invendus -50%</td><td style="padding:6px 12px;text-align:right;font-weight:600">${fmtXOF(r.cloture.valeurInvendus)}</td></tr>
      </table>
    `,
    )}

    ${block(
      "Crédits clients",
      `
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 12px">Nouveaux crédits accordés</td><td style="padding:6px 12px;text-align:right;font-weight:600">${fmtXOF(r.credits.nouveaux)}</td></tr>
        <tr><td style="padding:6px 12px">Paiements crédits reçus</td><td style="padding:6px 12px;text-align:right;font-weight:600;color:#0a7d2a">${fmtXOF(r.credits.paiements)}</td></tr>
        <tr><td style="padding:6px 12px">Total encours</td><td style="padding:6px 12px;text-align:right;font-weight:700;color:${espresso}">${fmtXOF(r.credits.encours)}</td></tr>
      </table>
    `,
    )}

    <p style="text-align:center;color:#888;font-size:12px;margin:24px 0 0">
      Rapport automatique • ${r.dayLabel}<br/>
      SAADÉ • Lomé, Togo
    </p>
  </div>
</body></html>`;
}

function toCsv(rows: any[], headers: string[]): string {
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = headers.join(';');
  const body = rows.map(r => headers.map(h => esc(r[h])).join(';')).join('\n');
  return '\ufeff' + head + '\n' + body; // BOM pour Excel
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x1000; // petits chunks : évite tout stack overflow Deno
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    bin += String.fromCharCode.apply(null, sub as unknown as number[]);
  }
  return btoa(bin);
}

function utf8ToBase64(str: string): string {
  return bytesToBase64(new TextEncoder().encode(str));
}

async function buildAttachments(supabase: any, date: string, report?: any): Promise<any[]> {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  const atts: any[] = [];

  // ── 1) Toutes les données en PARALLÈLE (évite le timeout du runtime) ──
  const [ventesRes, sessionsRes, cloturesRes, nouveauxCreditsRes, paiementsCreditsRes, encoursRes, pertesRes] = await Promise.all([
    supabase.from("ventes").select("id, numero_ticket, date_vente, total, mode_paiement, statut, client_nom").gte("date_vente", dayStart).lte("date_vente", dayEnd).neq("statut", "annulee"),
    supabase.from("sessions_caisse").select("id, statut, ecart, ferme_at, ouvert_at, fond_initial, fond_final_attendu, fond_final_compte, notes, ouvert_par, ferme_par").gte("ouvert_at", dayStart).lte("ouvert_at", dayEnd),
    supabase.from("cloture_journaliere").select("produit_id, stock_ouverture, qte_recue, qte_vendue, qte_degustation, qte_invendu, prix_invendu_50, qte_perte, stock_fin_compte, produits(nom, categorie)").eq("date_cloture", date),
    supabase.from("credits_clients").select("client_nom, montant_initial, montant_restant").eq("date_credit", date),
    supabase.from("paiements_credits").select("montant, credit_id, date_paiement").gte("date_paiement", dayStart).lte("date_paiement", dayEnd),
    supabase.from("credits_clients").select("client_nom, montant_restant").eq("statut", "ouvert"),
    supabase.from("pertes").select("quantite, type_labo, jour, produits(nom, prix_vente)").eq("jour", date),
  ]);

  // ── 2) Achats MP + Stock économat (requêtes secondaires) ──
  const [achatsRes, economatRes] = await Promise.all([
    supabase.from("achats_mp").select("date_achat, fournisseur, produit, quantite, unite, prix_unitaire, prix_total").eq("date_achat", date),
    supabase.from("v_economat_stock").select("categorie, nom, unite, stock_courant, stock_min, prix_unitaire").order("categorie").order("nom").limit(500),
  ]);
  const ventes = ventesRes.data || [];
  const sessions = sessionsRes.data || [];
  const clotures = cloturesRes.data || [];
  const nouveauxCreditsList = nouveauxCreditsRes.data || [];
  const paiementsList = paiementsCreditsRes.data || [];
  const encoursList = encoursRes.data || [];
  const pertesRaw = pertesRes.data || [];
  const achatsRows = achatsRes.data || [];
  const stockRows = (economatRes.data || []).map((a: any) => ({
    categorie: a.categorie, nom: a.nom, unite: a.unite,
    stock_courant: Number(a.stock_courant || 0), stock_min: a.stock_min,
    prix_unitaire: a.prix_unitaire,
    alerte: Number(a.stock_courant || 0) <= Number(a.stock_min || 0) ? "OUI" : "",
  }));

  // ── 3) Lignes de vente détaillées + agrégat par produit ──
  let lignes: any[] = [];
  let parProduit: any[] = [];
  if (ventes.length) {
    const ids = ventes.map((v: any) => v.id);
    const ticketBy = new Map(ventes.map((v: any) => [v.id, v]));
    const { data: rawLignes } = await supabase
      .from("vente_lignes")
      .select("vente_id, produit_id, produit_nom, quantite, prix_unitaire, total_ligne, produits(categorie)")
      .in("vente_id", ids);
    lignes = (rawLignes || []).map((l: any) => {
      const v = ticketBy.get(l.vente_id) as any;
      return {
        Ticket: v?.numero_ticket || "", Date: v?.date_vente || "", Client: v?.client_nom || "",
        Produit: l.produit_nom, Catégorie: l.produits?.categorie || "",
        Quantité: Number(l.quantite || 0), "Prix unitaire": Number(l.prix_unitaire || 0),
        Total: Math.round(Number(l.total_ligne || 0)), Mode: v?.mode_paiement || "",
      };
    });
    const map = new Map<string, any>();
    lignes.forEach((l: any) => {
      const key = l.Produit;
      if (!map.has(key)) map.set(key, { Produit: key, Catégorie: l.Catégorie, Quantité: 0, CA: 0 });
      const cur = map.get(key);
      cur.Quantité += l.Quantité;
      cur.CA += l.Total;
    });
    parProduit = Array.from(map.values()).sort((a: any, b: any) => b.CA - a.CA);
  }

  const pertesRows = pertesRaw.map((p: any) => ({
    Produit: p.produits?.nom || "?",
    Quantité: Number(p.quantite || 0),
    "Valeur estimée": Math.round(Number(p.quantite || 0) * Number(p.produits?.prix_vente || 0)),
    Motif: p.type_labo || "",
  }));

  // ── 4) CSV utiles en pièces jointes secondaires ──
  if (ventes.length) {
    atts.push({
      filename: `ventes-${date}.csv`,
      content: utf8ToBase64(toCsv(ventes, ["numero_ticket", "date_vente", "total", "mode_paiement", "statut", "client_nom"])),
    });
  }
  if (achatsRows.length) {
    atts.push({
      filename: `achats-mp-${date}.csv`,
      content: utf8ToBase64(toCsv(achatsRows, ["date_achat", "fournisseur", "produit", "quantite", "unite", "prix_unitaire", "prix_total"])),
    });
  }

  // ── 5) EXCEL : 8 feuilles (Résumé, Tickets, Lignes de vente, Produits, Clôture, Sessions caisse, Crédits, Pertes) ──
  try {
    const wb = XLSX.utils.book_new();
    const ca = ventes.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
    const nbTickets = ventes.length;
    const panierMoyen = nbTickets ? ca / nbTickets : 0;
    const sessionsFermees = sessions.filter((s: any) => s.statut === "fermee" || s.statut === "fermee_auto");
    const ecartTotal = sessionsFermees.reduce((s: number, x: any) => s + Number(x.ecart || 0), 0);
    const nouveauxCredits = nouveauxCreditsList.reduce((s: number, c: any) => s + Number(c.montant_initial || 0), 0);
    const paiementsCredits = paiementsList.reduce((s: number, p: any) => s + Number(p.montant || 0), 0);
    const encours = encoursList.reduce((s: number, c: any) => s + Number(c.montant_restant || 0), 0);
    const valeurInvendus = clotures.reduce((s: number, c: any) => s + Number(c.qte_invendu || 0) * Number(c.prix_invendu_50 || 0), 0);
    const pertesValeur = pertesRows.reduce((s: number, p: any) => s + (p["Valeur estimée"] || 0), 0);

    const resume = [
      { Indicateur: "Date", Valeur: date },
      { Indicateur: "Chiffre d'affaires (F)", Valeur: Math.round(ca) },
      { Indicateur: "Nombre de tickets", Valeur: nbTickets },
      { Indicateur: "Panier moyen (F)", Valeur: Math.round(panierMoyen) },
      ...Object.entries(report?.parMode || {}).map(([m, v]: any) => ({ Indicateur: `Paiement ${m} (F)`, Valeur: Math.round(Number(v)) })),
      { Indicateur: "Sessions caisse (jour)", Valeur: sessions.length },
      { Indicateur: "Sessions fermées", Valeur: sessionsFermees.length },
      { Indicateur: "Sessions encore ouvertes", Valeur: sessions.length - sessionsFermees.length },
      { Indicateur: "Écart de caisse total (F)", Valeur: Math.round(ecartTotal) },
      { Indicateur: "Produits clôturés", Valeur: clotures.length },
      { Indicateur: "Valeur invendus -50% (F)", Valeur: Math.round(valeurInvendus) },
      { Indicateur: "Valeur pertes (F)", Valeur: pertesValeur },
      { Indicateur: "Nouveaux crédits (F)", Valeur: Math.round(nouveauxCredits) },
      { Indicateur: "Paiements crédits reçus (F)", Valeur: Math.round(paiementsCredits) },
      { Indicateur: "Encours crédits (F)", Valeur: Math.round(encours) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resume), "Résumé");

    const tickets = ventes.map((v: any) => ({
      Ticket: v.numero_ticket || "", Date: v.date_vente || "", Client: v.client_nom || "",
      Mode: v.mode_paiement || "", Total: Math.round(Number(v.total || 0)), Statut: v.statut || "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tickets.length ? tickets : [{ Ticket: "-", Total: 0 }]), "Tickets");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lignes.length ? lignes : [{ Ticket: "-", Produit: "Aucune vente", Quantité: 0, Total: 0 }]), "Lignes de vente");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(parProduit.length ? parProduit : [{ Produit: "Aucune vente", Quantité: 0, CA: 0 }]), "Produits");

    const clotureRows = clotures.map((c: any) => ({
      Produit: c.produits?.nom || c.produit_id,
      Catégorie: c.produits?.categorie || "",
      "Stock ouverture": c.stock_ouverture, Reçu: c.qte_recue, Vendu: c.qte_vendue,
      Dégustation: c.qte_degustation, Invendu: c.qte_invendu, "Prix -50%": c.prix_invendu_50,
      "Qté perte": c.qte_perte, "Stock fin compté": c.stock_fin_compte,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clotureRows.length ? clotureRows : [{ Produit: "Aucune clôture", "Stock ouverture": 0 }]), "Clôture");

    const sessionRows = sessions.map((s: any) => ({
      Ouverture: s.ouvert_at || "", Fermeture: s.ferme_at || "",
      "Fond initial": Number(s.fond_initial || 0), Attendu: Number(s.fond_final_attendu || 0),
      Compté: Number(s.fond_final_compte || 0), Écart: Number(s.ecart || 0),
      Statut: s.statut || "", Notes: s.notes || "", Ouvert_par: s.ouvert_par || "", Fermé_par: s.ferme_par || "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sessionRows.length ? sessionRows : [{ Statut: "Aucune session", Écart: 0 }]), "Sessions caisse");

    const creditRows = nouveauxCreditsList.map((c: any) => ({
      Client: c.client_nom || "", "Montant initial": Number(c.montant_initial || 0), Restant: Number(c.montant_restant || 0),
    }));
    const encoursRows = encoursList.map((c: any) => ({ Client: c.client_nom || "", Encours: Number(c.montant_restant || 0) }));
    const creditSheet = [
      ...creditRows,
      ...(creditRows.length && encoursRows.length ? [{ Client: "— Paiements du jour —", "Montant initial": paiementsCredits, Restant: "" }] : []),
      ...encoursRows.map((e: any) => ({ Client: e.Client, "Montant initial": "", Restant: e.Encours })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(creditSheet.length ? creditSheet : [{ Client: "Aucun crédit", "Montant initial": 0, Restant: 0 }]), "Crédits");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pertesRows.length ? pertesRows : [{ Produit: "Aucune perte", Quantité: 0, "Valeur estimée": 0 }]), "Pertes");

    if (stockRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows), "Stock économat");
    if (achatsRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(achatsRows), "Achats MP");

    // type "array" puis encodage base64 fiable — sous Deno/esm.sh, XLSX.write peut
    // renvoyer Uint8Array, ArrayBuffer ou string binaire : on gère les 3 cas.
    const wbOut: any = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    let wbBytes: Uint8Array;
    if (wbOut instanceof Uint8Array) wbBytes = wbOut;
    else if (wbOut instanceof ArrayBuffer) wbBytes = new Uint8Array(wbOut);
    else if (ArrayBuffer.isView(wbOut)) {
      const v = wbOut as ArrayBufferView;
      wbBytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    } else if (typeof wbOut === "string") {
      // string binaire (latin1) : conversion octet par octet (PAS TextEncoder !)
      wbBytes = new Uint8Array(wbOut.length);
      for (let i = 0; i < wbOut.length; i++) wbBytes[i] = wbOut.charCodeAt(i) & 0xff;
    } else {
      wbBytes = new Uint8Array(wbOut);
    }
    // Garde-fou : un .xlsx valide est un ZIP → il DOIT commencer par "PK"
    const sig = String.fromCharCode(wbBytes[0] ?? 0, wbBytes[1] ?? 0);
    if (sig !== "PK" || wbBytes.length < 100) {
      console.error(`xlsx invalide (non attaché): signature=${JSON.stringify(sig)} taille=${wbBytes.length}`);
    } else {
      console.log(`xlsx OK: ${wbBytes.length} octets`);
      atts.unshift({
        filename: `rapport-ceo-${date}.xlsx`,
        content: bytesToBase64(wbBytes),
      });
    }
  } catch (e: any) {
    console.error("xlsx build failed", e?.message || e);
  }

  // ── 6) PDF : Résumé + Produits vendus + Tickets + Sessions caisse ──
  try {
    const pdfBase64 = buildPdf(date, report, { ventes, sessions, parProduit });
    if (pdfBase64) atts.unshift({ filename: `rapport-ceo-${date}.pdf`, content: pdfBase64 });
  } catch (e: any) {
    console.error("pdf build failed", e?.message || e);
  }

  return atts;
}

function buildPdf(date: string, report: any, extra: any): string {
  const { ventes, sessions, parProduit } = extra;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 18;
  let y = 20;

  const ca = ventes.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
  const nbTickets = ventes.length;
  const panierMoyen = nbTickets ? ca / nbTickets : 0;
  const sessionsFermees = sessions.filter((s: any) => s.statut === "fermee" || s.statut === "fermee_auto");
  const ecartTotal = sessionsFermees.reduce((s: number, x: any) => s + Number(x.ecart || 0), 0);
  const valeurInvendus = (report?.cloture?.valeurInvendus) || 0;

  const header = () => {
    doc.setFillColor(44, 26, 14);
    doc.rect(0, 0, pageW, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("SAADÉ", pageW / 2, 15, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(196, 154, 90);
    doc.text("RAPPORT JOURNALIER", pageW / 2, 22, { align: "center" });
    doc.setFontSize(9);
    doc.setTextColor(220);
    doc.text(date, pageW / 2, 29, { align: "center" });
    y = 42;
  };

  const sectionTitle = (t: string) => {
    if (y > 265) { doc.addPage(); header(); }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(44, 26, 14);
    doc.text(t, margin, y);
    y += 6;
    doc.setDrawColor(196, 154, 90);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  };

  const addTable = (headers: string[], rows: any[][], widths?: number[]) => {
    if (y > 250) { doc.addPage(); header(); }
    const tableW = pageW - 2 * margin;
    const colW = widths || Array(headers.length).fill(tableW / headers.length);
    const rowH = 7;
    // Position x réelle de chaque colonne (les largeurs sont désormais utilisées)
    const colX = (i: number) => margin + colW.slice(0, i).reduce((a: number, b: number) => a + b, 0);
    const fit = (txt: string, i: number, bold: boolean) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const maxW = colW[i] - 4;
      if (doc.getTextWidth(txt) <= maxW) return txt;
      // recherche binaire du plus long préfixe tenant dans la colonne (borné : pas de boucle infinie)
      let lo = 1, hi = txt.length, ans = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (doc.getTextWidth(txt.slice(0, mid) + "...") <= maxW) { ans = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      return ans >= 1 ? txt.slice(0, ans) + "..." : "...";
    };
    const rowHAuto = (r: any[], bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(8.5);
      let lines = 1;
      r.forEach((c, i) => {
        const t = String(c ?? "");
        lines = Math.max(lines, Math.ceil(doc.getTextWidth(t) / Math.max(colW[i] - 4, 8)));
      });
      return Math.min(Math.max(rowH, lines * 4.2 + 2.8), 20);
    };
    doc.setFillColor(250, 246, 240);
    doc.rect(margin, y, tableW, rowH, "F");
    doc.setFontSize(8.5);
    doc.setTextColor(44, 26, 14);
    headers.forEach((h, i) => {
      doc.text(fit(h, i, true), colX(i) + 2, y + 5, { align: "left" });
    });
    y += rowH;
    rows.forEach((r, idx) => {
      const h = rowHAuto(r);
      if (y + h > 285) { doc.addPage(); header(); }
      if (idx % 2 === 1) {
        doc.setFillColor(252, 250, 246);
        doc.rect(margin, y, tableW, h, "F");
      }
      doc.setTextColor(40);
      doc.setFontSize(8.5);
      r.forEach((c, i) => {
        const txt = fit(String(c ?? ""), i, false);
        doc.text(txt, colX(i) + 2, y + 5, { align: "left" });
      });
      y += h;
    });
    y += 6;
  };

  header();

  // ── Résumé ──
  sectionTitle("Résumé");
  const sumRows: any[][] = [
    ["Chiffre d'affaires (F)", String(Math.round(ca))],
    ["Nombre de tickets", String(nbTickets)],
    ["Panier moyen (F)", String(Math.round(panierMoyen))],
    ...Object.entries(report?.parMode || {}).map(([m, v]: any) => [`Paiement ${m} (F)`, String(Math.round(Number(v)))]),
    ["Sessions ouvertes", String(sessions.length - sessionsFermees.length)],
    ["Sessions fermées", String(sessionsFermees.length)],
    ["Écart caisse total (F)", String(Math.round(ecartTotal))],
    ["Valeur invendus -50% (F)", String(Math.round(valeurInvendus))],
  ];
  addTable(["Indicateur", "Valeur"], sumRows, [(pageW - 2 * margin) * 0.6, (pageW - 2 * margin) * 0.4]);

  // ── Produits vendus ──
  if (parProduit.length) {
    sectionTitle(`Produits vendus (${parProduit.length})`);
    addTable(
      ["Produit", "Catégorie", "Qté", "CA (F)"],
      parProduit.map((p: any) => [p.Produit, p.Catégorie, String(p.Quantité), String(Math.round(p.CA))]),
      [(pageW - 2 * margin) * 0.4, (pageW - 2 * margin) * 0.2, (pageW - 2 * margin) * 0.15, (pageW - 2 * margin) * 0.25],
    );
  }

  // ── Tickets ──
  if (ventes.length) {
    sectionTitle(`Tickets (${ventes.length})`);
    addTable(
      ["#", "Heure", "Client", "Mode", "Total (F)"],
      ventes.map((v: any) => [
        v.numero_ticket || "",
        v.date_vente ? new Date(v.date_vente).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
        v.client_nom || "-",
        v.mode_paiement || "",
        String(Math.round(Number(v.total || 0))),
      ]),
      [(pageW - 2 * margin) * 0.15, (pageW - 2 * margin) * 0.15, (pageW - 2 * margin) * 0.3, (pageW - 2 * margin) * 0.15, (pageW - 2 * margin) * 0.25],
    );
  }

  // ── Sessions caisse ──
  if (sessions.length) {
    sectionTitle(`Sessions caisse (${sessions.length})`);
    addTable(
      ["Ouvert", "Fermé", "Attendu", "Compté", "Écart", "Statut"],
      sessions.map((s: any) => [
        s.ouvert_at ? new Date(s.ouvert_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
        s.ferme_at ? new Date(s.ferme_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "-",
        String(Math.round(Number(s.fond_final_attendu || 0))),
        String(Math.round(Number(s.fond_final_compte || 0))),
        String(Math.round(Number(s.ecart || 0))),
        s.statut || "",
      ]),
      [(pageW - 2 * margin) * 0.14, (pageW - 2 * margin) * 0.14, (pageW - 2 * margin) * 0.18, (pageW - 2 * margin) * 0.18, (pageW - 2 * margin) * 0.18, (pageW - 2 * margin) * 0.18],
    );
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("SAADÉ • Lomé, Togo • Rapport journalier", pageW / 2, 290, { align: "center" });

  return doc.output("datauristring").split(",")[1]; // base64
}

async function sendEmail(subject: string, html: string, attachments: any[] = [], settings?: any): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: settings?.from || FROM,
        to: [settings?.to || CEO_EMAIL],
        ...(settings?.cc?.length ? { cc: settings.cc } : {}),
        subject,
        html,
        attachments,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: `Resend ${res.status}: ${JSON.stringify(data)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body: any = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Auth : jeton cron interne OU JWT utilisateur avec rôle CEO ──
    let authorized = false;
    if (body.cron_token) {
      const { data: s } = await supabase
        .from("parametres_email")
        .select("cron_token")
        .eq("id", true)
        .maybeSingle();
      if (s?.cron_token && body.cron_token === s.cron_token) authorized = true;
    }
    if (!authorized) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = authHeader.replace("Bearer ", "");
      const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      // getClaims (nouvelles signing keys) — fallback getUser (legacy) si non dispo
      let userId = null;
      try {
        const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
        userId = claims?.claims?.sub;
        if (claimsErr) console.warn("getClaims failed:", claimsErr.message);
      } catch (e) {
        console.warn("getClaims threw:", (e as Error).message);
      }
      if (!userId) {
        const { data: userData, error: userErr } = await authClient.auth.getUser(token);
        if (userErr || !userData?.user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = userData.user.id;
      }
      const { data: isCeo } = await supabase.rpc("is_ceo", { _user_id: userId });
      if (!isCeo) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const date = body.date || dateLome();
    const force = body.force === true;

    // Idempotence
    const { data: existing } = await supabase
      .from("rapports_journaliers")
      .select("id, status, sent_at")
      .eq("date_rapport", date)
      .maybeSingle();

    if (existing && existing.status === "sent" && !force) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "already_sent", sent_at: existing.sent_at }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const report = await buildReport(supabase, date);
    const html = renderHTML(report);
    const subject = `SAADÉ — Rapport du ${report.dayLabel} • CA ${fmtXOF(report.ca)}`;

    const attachments = await buildAttachments(supabase, date, report);
    const settings = await getEmailSettings(supabase);
    const sendRes = await sendEmail(subject, html, attachments, settings);
    await supabase.from("parametres_email")
      .update({ derniere_erreur: sendRes.ok ? null : sendRes.error })
      .eq("id", true);



    const payload = {
      report,
      subject,
      attachments: attachments.map((a: any) => ({
        filename: a.filename,
        taille_octets: Math.round((a.content?.length || 0) * 3 / 4),
      })),
    };

    if (existing) {
      await supabase
        .from("rapports_journaliers")
        .update({
          payload,
          email_destinataire: settings.to,
          status: sendRes.ok ? "sent" : "failed",
          error_message: sendRes.ok ? null : sendRes.error,
          sent_at: sendRes.ok ? new Date().toISOString() : null,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("rapports_journaliers").insert({
        date_rapport: date,
        payload,
        email_destinataire: settings.to,
        status: sendRes.ok ? "sent" : "failed",
        error_message: sendRes.ok ? null : sendRes.error,
        sent_at: sendRes.ok ? new Date().toISOString() : null,
      });
    }

    return new Response(
      JSON.stringify({
        ok: sendRes.ok,
        date,
        error: sendRes.error,
        attachments: attachments.map((a: any) => ({
          filename: a.filename,
          taille_octets: Math.round((a.content?.length || 0) * 3 / 4),
        })),
      }),
      {
        status: sendRes.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    console.error("rapport-journalier-ceo error", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
