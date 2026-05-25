import { jsPDF } from "jspdf";

export const RUBRIQUES_AUDIT = [
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

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export function buildAuditPdf(audit: {
  date_audit: string;
  rubriques: Record<string, number>;
  defauts?: string | null;
  ameliorations?: string | null;
  commentaires?: string | null;
}): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 18;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(44, 26, 14);
  doc.text("SAADE", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(196, 154, 90);
  doc.text("AUDIT CEO", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setTextColor(80);
  doc.setFontSize(11);
  doc.text(fmtDate(audit.date_audit), pageW / 2, y, { align: "center" });
  y += 10;

  const rubs = audit.rubriques || {};
  const notes = RUBRIQUES_AUDIT.map((r) => Number(rubs[r.key] || 0)).filter((n) => n > 0);
  const moy = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;

  doc.setDrawColor(196, 154, 90);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(44, 26, 14);
  doc.text("Evaluation par rubriques", margin, y);
  if (moy > 0) {
    doc.setFontSize(11);
    doc.setTextColor(196, 154, 90);
    doc.text(`Moyenne : ${moy.toFixed(1)} / 5`, pageW - margin, y, { align: "right" });
  }
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setFillColor(250, 246, 240);
  doc.rect(margin, y, pageW - 2 * margin, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text("Rubrique", margin + 2, y + 5);
  doc.text("Note", pageW - margin - 2, y + 5, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  RUBRIQUES_AUDIT.forEach((r, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (i % 2 === 1) {
      doc.setFillColor(252, 250, 246);
      doc.rect(margin, y, pageW - 2 * margin, 7, "F");
    }
    const note = Number(rubs[r.key] || 0);
    doc.setTextColor(40);
    doc.text(r.label, margin + 2, y + 5);
    const noteText = note > 0
      ? `${"*".repeat(note)}${".".repeat(5 - note)}  ${note}/5`
      : "—";
    doc.setTextColor(note > 0 ? 0 : 150);
    doc.text(noteText, pageW - margin - 2, y + 5, { align: "right" });
    y += 7;
  });

  y += 6;

  const addBlock = (titre: string, contenu?: string | null) => {
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
    const text = ((contenu || "").trim()) || "—";
    const lines = doc.splitTextToSize(text, pageW - 2 * margin);
    lines.forEach((line: string) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += 5;
    });
    y += 6;
  };

  addBlock("Defauts constates", audit.defauts);
  addBlock("Ameliorations a apporter", audit.ameliorations);
  addBlock("Commentaires generaux", audit.commentaires);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("SAADE • Lome, Togo • Audit CEO", pageW / 2, 290, { align: "center" });

  return doc;
}
