// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const CEO_EMAIL = "nkro006@gmail.com";
const FROM = "SAADÉ Rapports <onboarding@resend.dev>";

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

  const modeRows = Object.entries(r.parMode)
    .map(
      ([m, val]: any) =>
        `<tr><td style="padding:6px 12px">${m}</td><td style="padding:6px 12px;text-align:right;font-weight:600">${fmtXOF(val)}</td></tr>`,
    )
    .join("") || `<tr><td colspan="2" style="padding:6px 12px;color:#888">Aucun paiement</td></tr>`;

  const topRows = r.topProduits
    .map(
      (p: any, i: number) =>
        `<tr><td style="padding:6px 12px">${i + 1}. ${p.nom}</td><td style="padding:6px 12px;text-align:center">${p.qte}</td><td style="padding:6px 12px;text-align:right;font-weight:600">${fmtXOF(p.ca)}</td></tr>`,
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

function b64(str: string): string {
  // UTF-8 -> base64 (Deno)
  return btoa(unescape(encodeURIComponent(str)));
}

async function buildAttachments(supabase: any, date: string): Promise<any[]> {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  const atts: any[] = [];

  // 1. Ventes du jour
  const { data: ventes } = await supabase
    .from('ventes')
    .select('numero_ticket, date_vente, total, mode_paiement, statut, client_nom')
    .gte('date_vente', dayStart).lte('date_vente', dayEnd);
  if (ventes?.length) {
    atts.push({
      filename: `ventes-${date}.csv`,
      content: b64(toCsv(ventes, ['numero_ticket', 'date_vente', 'total', 'mode_paiement', 'statut', 'client_nom'])),
    });
  }

  // 2. Stock économat (état courant)
  const { data: articles } = await supabase
    .from('economat_articles')
    .select('categorie, nom, unite, stock_initial, stock_min, prix_unitaire')
    .eq('actif', true)
    .order('categorie').order('nom');
  if (articles?.length) {
    // Calcul stock courant via mouvements
    const { data: mvts } = await supabase
      .from('economat_mouvements')
      .select('article_id, type, quantite');
    const stockBy: Record<string, number> = {};
    (mvts || []).forEach((m: any) => {
      const sign = m.type === 'entree' ? 1 : -1;
      stockBy[m.article_id] = (stockBy[m.article_id] || 0) + sign * Number(m.quantite || 0);
    });
    const rows = articles.map((a: any) => ({
      ...a,
      stock_courant: Number(a.stock_initial || 0) + (stockBy[a.id] || 0),
      alerte: (Number(a.stock_initial || 0) + (stockBy[a.id] || 0)) <= Number(a.stock_min || 0) ? 'OUI' : '',
    }));
    atts.push({
      filename: `economat-stock-${date}.csv`,
      content: b64(toCsv(rows, ['categorie', 'nom', 'unite', 'stock_courant', 'stock_min', 'prix_unitaire', 'alerte'])),
    });
  }

  // 3. Achats MP du jour
  const { data: achats } = await supabase
    .from('achats_mp')
    .select('date_achat, fournisseur, produit, quantite, unite, prix_unitaire, prix_total')
    .eq('date_achat', date);
  if (achats?.length) {
    atts.push({
      filename: `achats-mp-${date}.csv`,
      content: b64(toCsv(achats, ['date_achat', 'fournisseur', 'produit', 'quantite', 'unite', 'prix_unitaire', 'prix_total'])),
    });
  }

  return atts;
}

async function sendEmail(subject: string, html: string, attachments: any[] = []): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [CEO_EMAIL],
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
    // ── Auth : exiger un JWT et le rôle CEO ──
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
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isCeo } = await supabase.rpc("is_ceo", { _user_id: userData.user.id });
    if (!isCeo) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
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

    const sendRes = await sendEmail(subject, html);

    const payload = {
      report,
      subject,
    };

    if (existing) {
      await supabase
        .from("rapports_journaliers")
        .update({
          payload,
          email_destinataire: CEO_EMAIL,
          status: sendRes.ok ? "sent" : "failed",
          error_message: sendRes.ok ? null : sendRes.error,
          sent_at: sendRes.ok ? new Date().toISOString() : null,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("rapports_journaliers").insert({
        date_rapport: date,
        payload,
        email_destinataire: CEO_EMAIL,
        status: sendRes.ok ? "sent" : "failed",
        error_message: sendRes.ok ? null : sendRes.error,
        sent_at: sendRes.ok ? new Date().toISOString() : null,
      });
    }

    return new Response(
      JSON.stringify({ ok: sendRes.ok, date, error: sendRes.error }),
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
