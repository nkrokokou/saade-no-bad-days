import * as XLSX from 'xlsx';

export function exportToExcel(data: Record<string, any>[], fileName: string, sheetName = 'Données') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function exportToPDF(title: string, headers: string[], rows: (string | number)[][]) {
  // Simple PDF via printable HTML
  const html = `
    <html><head><title>${title}</title>
    <style>
      body { font-family: 'DM Sans', sans-serif; padding: 20px; }
      h1 { font-family: 'Playfair Display', serif; color: #2C1A0E; margin-bottom: 5px; }
      .subtitle { color: #666; margin-bottom: 20px; font-size: 12px; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; }
      th { background: #C49A5A; color: white; padding: 8px; text-align: left; }
      td { border: 1px solid #ddd; padding: 6px 8px; }
      tr:nth-child(even) { background: #FAF6F0; }
      .footer { margin-top: 20px; font-size: 10px; color: #999; }
    </style></head><body>
    <h1>SAADÉ — ${title}</h1>
    <div class="subtitle">Exporté le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</div>
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    <div class="footer">SAADÉ — Laboratoire & Boutique de Pâtisserie Libanaise — Lomé, Togo</div>
    </body></html>`;
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
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
