import * as XLSX from 'xlsx';

export type ParsedIngredient = {
  nom: string;
  quantite: number;
  unite: string;
  cout_unitaire: number;
  mp_id?: string | null;
};

export type ParsedFiche = {
  sheetName: string;
  productName: string;
  productId?: string | null;
  ingredients: ParsedIngredient[];
  etapes: string[];
  meta: {
    rendement?: number;
    rendement_unite?: string;
    temps_preparation_min?: number;
    temps_cuisson_min?: number;
    temperature_cuisson?: number;
    conservation?: string;
  };
};

const norm = (s: any) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const parseNum = (v: any): number => {
  const m = String(v ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
};

const findProductName = (grid: any[][]): string => {
  for (let i = 0; i < Math.min(grid.length, 60); i++) {
    const row = grid[i] || [];
    for (let j = 0; j < row.length; j++) {
      const k = norm(row[j]);
      if (['produit', 'recette', 'nom du produit', 'article', 'designation', 'fiche technique'].includes(k)) {
        for (let c = j + 1; c < row.length; c++) {
          const v = String(row[c] ?? '').trim();
          if (v) return v;
        }
      }
      // pattern "PRODUIT: xxx" in single cell
      const m = String(row[j] ?? '').match(/^\s*(produit|recette|article|fiche\s+technique)\s*[:\-]\s*(.+)$/i);
      if (m && m[2].trim()) return m[2].trim();
    }
  }
  return '';
};

const findIngredientsHeader = (grid: any[][]) => {
  for (let i = 0; i < grid.length; i++) {
    const row = (grid[i] || []).map(norm);
    const ing = row.findIndex(c => c.includes('ingredient') || c.includes('matiere') || c === 'nom' || c.includes('designation'));
    if (ing < 0) continue;
    const qte = row.findIndex(c => c.includes('qte') || c.includes('quantite') || c === 'q');
    if (qte < 0) continue;
    return {
      headerIdx: i,
      colNom: ing,
      colQte: qte,
      colUnite: row.findIndex(c => c.includes('unite') || c === 'u' || c === 'um'),
      colCout: row.findIndex(c => c.includes('prix') || c.includes('cout') || c === 'pu'),
    };
  }
  return null;
};

const isStepSectionHeader = (s: string) => {
  const n = norm(s);
  return /(realisation|etapes|mode\s*operatoire|preparation|process|fabrication|methode)/.test(n);
};

const extractMeta = (grid: any[][]): ParsedFiche['meta'] => {
  const meta: ParsedFiche['meta'] = {};
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i] || [];
    for (let j = 0; j < row.length; j++) {
      const k = norm(row[j]);
      const next = () => {
        for (let c = j + 1; c < row.length; c++) {
          const v = row[c];
          if (v !== '' && v != null) return v;
        }
        return '';
      };
      if (!k) continue;
      if (k.startsWith('rendement') || k === 'quantite produite' || k === 'production') {
        const v = next();
        const n = parseNum(v);
        if (n > 0) {
          meta.rendement = n;
          const txt = String(v).replace(/[\d.,\s-]+/, '').trim();
          if (txt) meta.rendement_unite = txt;
        }
      } else if (k.includes('temps') && k.includes('cuisson')) {
        const n = parseNum(next()); if (n > 0) meta.temps_cuisson_min = Math.round(n);
      } else if (k.includes('temps') && (k.includes('prep') || k.includes('repos'))) {
        const n = parseNum(next()); if (n > 0) meta.temps_preparation_min = Math.round(n);
      } else if (k.startsWith('temperature') || k === 'temp' || k === 't°' || k.includes('temp cuisson')) {
        const n = parseNum(next()); if (n > 0) meta.temperature_cuisson = Math.round(n);
      } else if (k.startsWith('dlc') || k.startsWith('conservation') || k.includes('duree de vie')) {
        const v = String(next()).trim(); if (v) meta.conservation = v;
      }
    }
  }
  return meta;
};

export function parseFicheSheet(
  sheetName: string,
  grid: any[][],
  products: { id: string; nom: string }[],
  mps: { id: string; nom: string; unite: string; prix_unitaire: number }[],
): ParsedFiche {
  const productName = findProductName(grid) || sheetName;
  const matchProduct = (name: string) =>
    products.find(p => norm(p.nom) === norm(name)) ||
    products.find(p => norm(name).includes(norm(p.nom)) && norm(p.nom).length > 3) ||
    products.find(p => norm(p.nom).includes(norm(name)) && norm(name).length > 3);
  const matched = matchProduct(productName) || matchProduct(sheetName);

  const header = findIngredientsHeader(grid);
  const ingredients: ParsedIngredient[] = [];
  let stopRow = grid.length;

  if (header) {
    for (let i = header.headerIdx + 1; i < grid.length; i++) {
      const row = grid[i] || [];
      const nom = String(row[header.colNom] ?? '').trim();
      if (!nom) {
        // empty row → check if step section follows
        let stepFound = false;
        for (let k = i + 1; k < Math.min(i + 4, grid.length); k++) {
          const cells = (grid[k] || []).map((c: any) => String(c ?? ''));
          if (cells.some(isStepSectionHeader)) { stepFound = true; break; }
        }
        if (stepFound) { stopRow = i; break; }
        continue;
      }
      if (isStepSectionHeader(nom)) { stopRow = i; break; }
      if (/^(total|sous[\s-]*total|cout)/i.test(norm(nom))) continue;
      const mp = mps.find(m => norm(m.nom) === norm(nom))
        || mps.find(m => norm(m.nom).includes(norm(nom)) && norm(nom).length > 3)
        || mps.find(m => norm(nom).includes(norm(m.nom)) && norm(m.nom).length > 3);
      const qte = parseNum(row[header.colQte]);
      if (qte <= 0) continue;
      ingredients.push({
        nom,
        quantite: qte,
        unite: String((header.colUnite >= 0 ? row[header.colUnite] : '') || mp?.unite || 'G').trim().toUpperCase(),
        cout_unitaire: header.colCout >= 0 ? parseNum(row[header.colCout]) || (mp?.prix_unitaire || 0) : (mp?.prix_unitaire || 0),
        mp_id: mp?.id || null,
      });
    }
  }

  // Steps: find any row from stopRow onwards (or whole sheet if no header) containing a step section title
  const etapes: string[] = [];
  const start = header ? stopRow : 0;
  let inSteps = false;
  for (let i = start; i < grid.length; i++) {
    const row = grid[i] || [];
    const joined = row.map((c: any) => String(c ?? '').trim()).filter(Boolean).join(' ');
    if (!joined) continue;
    if (!inSteps) {
      if (row.some((c: any) => isStepSectionHeader(c))) { inSteps = true; continue; }
    } else {
      // stop if we hit another meta keyword block like ALLERGENES, ALLERGÈNES, DLC, CONSERVATION at start of line
      const first = norm(row[0]);
      if (/^(allergenes?|dlc|conservation|cout|total|prix)/.test(first) && (row.length < 2 || !row[1])) continue;
      etapes.push(joined);
    }
  }

  return {
    sheetName,
    productName,
    productId: matched?.id || null,
    ingredients,
    etapes,
    meta: extractMeta(grid),
  };
}

export function parseFicheWorkbook(
  file: ArrayBuffer,
  products: { id: string; nom: string }[],
  mps: { id: string; nom: string; unite: string; prix_unitaire: number }[],
): ParsedFiche[] {
  const wb = XLSX.read(new Uint8Array(file), { type: 'array' });
  const results: ParsedFiche[] = [];
  for (const sn of wb.SheetNames) {
    const grid: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
    const r = parseFicheSheet(sn, grid, products, mps);
    if (r.ingredients.length || r.etapes.length) results.push(r);
  }
  return results;
}
