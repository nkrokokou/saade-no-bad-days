import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

function safeFilename(name: string) {
  return name.replace(/[^a-z0-9_\-]+/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Nettoie les caractères qui font crasher jsPDF (espaces insécables, espaces fines, etc.)
 * Sans ça l'export sort des "&1 /&5&0&0& &F" illisibles.
 */
export function pdfSafe(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u202F\u00A0\u2009\u2007\u200A\u2008]/g, ' ') // NNBSP / NBSP / espaces typographiques
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")        // apostrophes typographiques
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')        // guillemets typographiques
    .replace(/[\u2013\u2014\u2212]/g, '-')                    // tirets
    .replace(/\u2026/g, '...')                                // ellipsis
    .replace(/[^\x00-\xFF]/g, (ch) => {                       // tout caractère hors Latin-1
      const map: Record<string, string> = { '€': 'EUR', '°': 'deg', '×': 'x' };
      return map[ch] ?? '?';
    });
}

/** Format monétaire safe pour PDF (sans NNBSP fr-FR). */
export function fmtMoneyPdf(n: number, suffix = 'F'): string {
  const v = Math.round(Number(n) || 0);
  // Groupes de 3 avec espace simple
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${v < 0 ? '-' : ''}${s} ${suffix}`;
}

/** Trigger a real file download from a Blob (works inside iframes & on mobile). */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

export function exportToExcel(data: Record<string, any>[], fileName: string, sheetName = 'Données') {
  try {
    if (!data || data.length === 0) {
      toast.warning('Aucune donnée à exporter');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), `${safeFilename(fileName)}.xlsx`);
    toast.success('Export Excel téléchargé');
  } catch (e) {
    console.error('exportToExcel', e);
    toast.error('Erreur export Excel');
  }
}

/**
 * Export Excel multi-feuilles. Permet des rapports détaillés (Résumé + Tickets + Lignes + ...).
 */
export function exportToExcelMulti(
  sheets: { name: string; rows: Record<string, any>[] }[],
  fileName: string,
) {
  try {
    const nonEmpty = sheets.filter(s => s.rows && s.rows.length > 0);
    if (nonEmpty.length === 0) {
      toast.warning('Aucune donnée à exporter');
      return;
    }
    const wb = XLSX.utils.book_new();
    for (const s of nonEmpty) {
      const ws = XLSX.utils.json_to_sheet(s.rows);
      XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
    }
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), `${safeFilename(fileName)}.xlsx`);
    toast.success('Export Excel téléchargé');
  } catch (e) {
    console.error('exportToExcelMulti', e);
    toast.error('Erreur export Excel');
  }
}

export function exportToPDF(title: string, headers: string[], rows: (string | number)[][]) {
  try {
    if (!rows || rows.length === 0) {
      toast.warning('Aucune donnée à exporter');
      return;
    }
    const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    const pageW = doc.internal.pageSize.getWidth();
    const safeTitle = pdfSafe(title);

    // Header band
    doc.setFillColor(196, 154, 90); // caramel
    doc.rect(0, 0, pageW, 60, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('SAADE', 40, 28);
    doc.setFontSize(11);
    doc.text(safeTitle, 40, 46);

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    const date = new Date();
    const dateStr = `${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR')}`;
    doc.text(pdfSafe(`Exporte le ${dateStr}`), 40, 76);

    autoTable(doc, {
      head: [headers.map(h => pdfSafe(h))],
      body: rows.map(r => r.map(c => pdfSafe(c))),
      startY: 90,
      styles: { fontSize: 9, cellPadding: 5, font: 'helvetica', overflow: 'linebreak' },
      headStyles: { fillColor: [196, 154, 90], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 246, 240] },
      margin: { left: 30, right: 30 },
      didDrawPage: () => {
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(pdfSafe('SAADE - Laboratoire & Boutique de Patisserie Libanaise - Lome, Togo'),
          pageW / 2, pageH - 15, { align: 'center' });
      },
    });

    const blob = doc.output('blob');
    downloadBlob(blob, `${safeFilename(title)}.pdf`);
    toast.success('Export PDF téléchargé');
  } catch (e) {
    console.error('exportToPDF', e);
    toast.error('Erreur export PDF');
  }
}

/**
 * PDF multi-sections : un titre puis plusieurs tableaux. Évite les coupures
 * laides en demandant à autoTable de gérer les sauts de page.
 */
export function exportToPDFSections(
  title: string,
  sections: { heading: string; headers: string[]; rows: (string | number)[][] }[],
  fileName?: string,
) {
  try {
    const allEmpty = sections.every(s => !s.rows || s.rows.length === 0);
    if (allEmpty) { toast.warning('Aucune donnée à exporter'); return; }

    const wide = sections.some(s => s.headers.length > 6);
    const doc = new jsPDF({ orientation: wide ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(196, 154, 90);
    doc.rect(0, 0, pageW, 60, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.text('SAADE', 40, 28);
    doc.setFontSize(11); doc.text(pdfSafe(title), 40, 46);

    let cursor = 90;
    sections.forEach((s, idx) => {
      if (!s.rows || s.rows.length === 0) return;
      doc.setFontSize(12); doc.setTextColor(60, 40, 20);
      doc.text(pdfSafe(s.heading), 30, cursor);
      autoTable(doc, {
        head: [s.headers.map(h => pdfSafe(h))],
        body: s.rows.map(r => r.map(c => pdfSafe(c))),
        startY: cursor + 8,
        styles: { fontSize: 8, cellPadding: 4, font: 'helvetica', overflow: 'linebreak' },
        headStyles: { fillColor: [196, 154, 90], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 246, 240] },
        margin: { left: 30, right: 30 },
        didDrawPage: () => {
          const pageH = doc.internal.pageSize.getHeight();
          doc.setFontSize(8); doc.setTextColor(150);
          doc.text(pdfSafe('SAADE - Lome, Togo'), pageW / 2, pageH - 15, { align: 'center' });
        },
      });
      cursor = (doc as any).lastAutoTable.finalY + 24;
      const pageH = doc.internal.pageSize.getHeight();
      if (cursor > pageH - 80 && idx < sections.length - 1) {
        doc.addPage(); cursor = 60;
      }
    });

    const blob = doc.output('blob');
    downloadBlob(blob, `${safeFilename(fileName || title)}.pdf`);
    toast.success('Export PDF téléchargé');
  } catch (e) {
    console.error('exportToPDFSections', e);
    toast.error('Erreur export PDF');
  }
}

export interface ParsedSheet {
  name: string;
  rows: Record<string, any>[];
  columns: string[];
}

export function parseExcelFile(file: File): Promise<Record<string, any>[]> {
  return parseExcelAllSheets(file).then(s => s[0]?.rows || []);
}

export function parseExcelAllSheets(file: File): Promise<ParsedSheet[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheets: ParsedSheet[] = wb.SheetNames.map(name => {
          const sheet = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, any>[];
          const filtered = rows.filter(r => Object.values(r).some(v => v !== '' && v !== null && v !== undefined));
          const columns = filtered.length ? Object.keys(filtered[0]) : [];
          return { name, rows: filtered, columns };
        }).filter(s => s.rows.length > 0);
        resolve(sheets);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Smart matcher: find a product by approximate name
export function findProductByName(name: string, products: { id: string; nom: string }[]): string | null {
  if (!name || !name.trim()) return null;
  const clean = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const target = clean(name);
  const exact = products.find(p => clean(p.nom) === target);
  if (exact) return exact.id;
  const contains = products.find(p => clean(p.nom).includes(target) || target.includes(clean(p.nom)));
  if (contains) return contains.id;
  return null;
}
