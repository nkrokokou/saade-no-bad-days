import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

function safeFilename(name: string) {
  return name.replace(/[^a-z0-9_\-]+/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
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
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), `${safeFilename(fileName)}.xlsx`);
    toast.success('Export Excel téléchargé');
  } catch (e) {
    console.error('exportToExcel', e);
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
    const pageW = doc.internal.pageSize.getWidth();

    // Header band
    doc.setFillColor(196, 154, 90); // caramel
    doc.rect(0, 0, pageW, 60, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('SAADÉ', 40, 28);
    doc.setFontSize(11);
    doc.text(title, 40, 46);

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 40, 76);

    autoTable(doc, {
      head: [headers],
      body: rows.map(r => r.map(c => (c ?? '').toString())),
      startY: 90,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [196, 154, 90], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 246, 240] },
      margin: { left: 30, right: 30 },
      didDrawPage: () => {
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('SAADÉ — Laboratoire & Boutique de Pâtisserie Libanaise — Lomé, Togo',
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
          // defval: '' => empty cells stay empty (not 0), allows required-string detection
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, any>[];
          // Drop fully-empty rows
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
  // Exact match
  const exact = products.find(p => clean(p.nom) === target);
  if (exact) return exact.id;
  // Contains match
  const contains = products.find(p => clean(p.nom).includes(target) || target.includes(clean(p.nom)));
  if (contains) return contains.id;
  return null;
}
