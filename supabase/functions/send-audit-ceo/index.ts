// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEST_EMAIL = "nkro006@gmail.com";
const FROM = "SAADÉ Audits <onboarding@resend.dev>";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const RUBRIQUES: { key: string; label: string }[] = [
  { key: "qualite_produits", label: "Qualité des produits" },
  { key: "presentation_vitrine", label: "Présentation vitrine / mise en scène" },
  { key: "proprete_boutique", label: "Propreté boutique & salle" },
  { key: "proprete_labo", label: "Propreté laboratoires" },
  { key: "hygiene_equipe", label: "Hygiène & tenue de l'équipe" },
  { key: "service_client", label: "Service client & accueil" },
  { key: "rapidite_service", label: "Rapidité du service" },
  { key: "ambiance", label: "Ambiance générale" },
  { key: "gestion_caisse", label: "Gestion de la caisse" },
  { key: "respect_recettes", label: "Respect des recettes & fiches techniques" },
  { key: "gestion_stock", label: "Gestion du stock & pertes" },
  { key: "communication_equipe", label: "Communication interne équipe" },
];

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function buildPdf(audit: any): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 18;
  let y = 20;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(44, 26, 14); // espresso
  doc.text("SAADÉ", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(196, 154, 90); // caramel
  doc.text("AUDIT CEO", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setTextColor(80);
  doc.setFontSize(11);
  doc.text(formatDate(audit.date_audit), pageW / 2, y, { align: "center" });
  y += 10;

  // Moyenne
  const rubs = audit.rubriques || {};
  const notes = RUBRIQUES.map((r) => Number(rubs[r.key] || 0)).filter((n) => n > 0);
  const moy = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;

  doc.setDrawColor(196, 154, 90);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Section rubriques
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(44, 26, 14);
  doc.text("Évaluation par rubriques", margin, y);
  if (moy > 0) {
    doc.setFontSize(11);
    doc.setTextColor(196, 154, 90);
    doc.text(`Moyenne : ${moy.toFixed(1)} / 5`, pageW - margin, y, { align: "right" });
  }
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40);

  // Table headers
  doc.setFillColor(250, 246, 240);
  doc.rect(margin, y, pageW - 2 * margin, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.text("Rubrique", margin + 2, y + 5);
  doc.text("Note", pageW - margin - 2, y + 5, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  RUBRIQUES.forEach((r, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (i % 2 === 1) {
      doc.setFillColor(252, 250, 246);
      doc.rect(margin, y, pageW - 2 * margin, 7, "F");
    }
    const note = Number(rubs[r.key] || 0);
    doc.setTextColor(40);
    doc.text(r.label, margin + 2, y + 5);
    const noteText = note > 0 ? `${"*".repeat(note)}${".".repeat(5 - note)}  ${note}/5` : "—";
    doc.setTextColor(note > 0 ? 0 : 150);
    doc.text(noteText, pageW - margin - 2, y + 5, { align: "right" });
    y += 7;
  });

  y += 6;

  const addTextBlock = (titre: string, contenu: string | null) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(44, 26, 14);
    doc.text(titre, margin, y);
    y += 5;
    doc.setDrawColor(196, 154, 90);
    doc.line(margin, y, margin + 40, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);
    const text = (contenu || "—").trim() || "—";
    const lines = doc.splitTextToSize(text, pageW - 2 * margin);
    lines.forEach((line: string) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += 5;
    });
    y += 6;
  };

  addTextBlock("Défauts constatés", audit.defauts);
  addTextBlock("Améliorations à apporter", audit.ameliorations);
  addTextBlock("Commentaires généraux", audit.commentaires);

  // Footer on last page
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("SAADÉ • Lomé, Togo • Audit CEO", pageW / 2, 290, { align: "center" });

  return doc.output("datauristring").split(",")[1]; // base64
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
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isCeo } = await adminClient.rpc("is_ceo", { _user_id: userData.user.id });
    if (!isCeo) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { audit_id } = await req.json();
    if (!audit_id) {
      return new Response(JSON.stringify({ error: "audit_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = adminClient;
    const { data: audit, error } = await supabase
      .from("audits_ceo").select("*").eq("id", audit_id).maybeSingle();
    if (error || !audit) {
      return new Response(JSON.stringify({ error: "audit introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBase64 = buildPdf(audit);
    const dateLabel = formatDate(audit.date_audit);
    const filename = `audit-ceo-${audit.date_audit}.pdf`;

    const subject = `SAADÉ — Audit CEO du ${dateLabel}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1A0E">
        <h1 style="font-family:Georgia,serif;letter-spacing:2px;margin:0">SAADÉ</h1>
        <p style="color:#C49A5A;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:4px 0 16px">Audit CEO</p>
        <p>Bonjour,</p>
        <p>Veuillez trouver ci-joint l'audit CEO du <strong>${dateLabel}</strong>.</p>
        <p style="color:#666;font-size:13px;margin-top:24px">— SAADÉ, Lomé</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [DEST_EMAIL],
        subject,
        html,
        attachments: [{ filename, content: pdfBase64 }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: data }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, to: DEST_EMAIL }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
