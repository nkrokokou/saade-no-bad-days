import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseExcelAllSheets, ParsedSheet } from '@/hooks/useExcelImportExport';
import { Upload, CheckCircle2, AlertCircle, Download, FileSpreadsheet, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'boolean';
  aliases?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  fields: FieldDef[];
  /** Insert one row at a time. Throw to mark the row as failed. */
  onImportRow?: (row: Record<string, any>) => Promise<void>;
  /** Bulk import — receives all valid rows, returns inserted count. */
  onImport?: (rows: Record<string, any>[]) => Promise<{ inserted: number; failed?: number }>;
  templateName?: string;
  /** Number of rows per insert batch when using onImportRow (default 50) */
  batchSize?: number;
}

const norm = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

export function ExcelImportWizard({
  open, onOpenChange, title, fields, onImport, onImportRow, templateName, batchSize = 50,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; errors: { line: number; msg: string }[] } | null>(null);

  const current = sheets[activeSheet];
  const rawRows = current?.rows || [];
  const columns = current?.columns || [];

  const reset = () => {
    setStep(1); setSheets([]); setActiveSheet(0); setMapping({});
    setResult(null); setProgress(0); setImporting(false);
  };
  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const autoMap = (cols: string[]) => {
    const auto: Record<string, string> = {};
    fields.forEach(f => {
      const candidates = [f.key, f.label, ...(f.aliases || [])].map(norm);
      const found = cols.find(c => candidates.includes(norm(c)));
      if (found) auto[f.key] = found;
    });
    return auto;
  };

  const handleFile = async (file: File) => {
    try {
      const parsed = await parseExcelAllSheets(file);
      if (!parsed.length) { toast.error('Aucune donnée détectée'); return; }
      setSheets(parsed);
      setActiveSheet(0);
      setMapping(autoMap(parsed[0].columns));
      setStep(2);
    } catch (e: any) {
      toast.error('Lecture impossible : ' + e.message);
    }
  };

  const switchSheet = (idx: number) => {
    setActiveSheet(idx);
    setMapping(autoMap(sheets[idx].columns));
  };

  const validatedRows = useMemo(() => {
    if (step < 3) return [];
    return rawRows.map((row, idx) => {
      const mapped: Record<string, any> = {};
      const errors: string[] = [];
      fields.forEach(f => {
        const col = mapping[f.key];
        let val = col ? row[col] : undefined;
        if (val === '' || val === undefined || val === null) {
          if (f.required) errors.push(`${f.label} manquant`);
          mapped[f.key] = null;
          return;
        }
        if (f.type === 'number') {
          const n = Number(String(val).replace(/[^\d.,-]/g, '').replace(',', '.'));
          if (isNaN(n)) errors.push(`${f.label} invalide`);
          mapped[f.key] = isNaN(n) ? null : n;
        } else if (f.type === 'date') {
          if (val instanceof Date) mapped[f.key] = val.toISOString().slice(0, 10);
          else {
            const d = new Date(val);
            mapped[f.key] = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
          }
        } else if (f.type === 'boolean') {
          const s = norm(String(val));
          mapped[f.key] = ['1', 'true', 'oui', 'yes', 'vrai', 'x'].includes(s);
        } else mapped[f.key] = String(val).trim();
      });
      // Detect required missing mapping
      fields.filter(f => f.required && !mapping[f.key]).forEach(f => {
        if (!errors.includes(`${f.label} manquant`)) errors.push(`Colonne "${f.label}" non mappée`);
      });
      return { _index: idx + 2, _errors: errors, ...mapped };
    });
  }, [step, rawRows, mapping, fields]);

  const validRows = validatedRows.filter(r => r._errors.length === 0);
  const invalidRows = validatedRows.filter(r => r._errors.length > 0);
  const requiredMissing = fields.filter(f => f.required && !mapping[f.key]);

  const doImport = async () => {
    setImporting(true);
    setProgress(0);
    const errors: { line: number; msg: string }[] = invalidRows.map(r => ({ line: r._index, msg: r._errors.join(', ') }));
    let inserted = 0;
    try {
      const cleaned = validRows.map(({ _index, _errors, ...rest }) => ({ _index, ...rest }));
      if (onImportRow) {
        // Per-row to capture per-line errors
        for (let i = 0; i < cleaned.length; i++) {
          const { _index, ...payload } = cleaned[i] as any;
          try {
            await onImportRow(payload);
            inserted++;
          } catch (e: any) {
            errors.push({ line: _index, msg: e?.message || 'Erreur insertion' });
          }
          if (i % 5 === 0) setProgress(Math.round((i / cleaned.length) * 100));
        }
      } else if (onImport) {
        // Bulk in chunks so a bad row doesn't kill the whole import
        for (let i = 0; i < cleaned.length; i += batchSize) {
          const chunk = cleaned.slice(i, i + batchSize).map(({ _index, ...rest }) => rest);
          try {
            const r = await onImport(chunk);
            inserted += r.inserted || 0;
          } catch (e: any) {
            errors.push({ line: cleaned[i]._index, msg: `Lot ${i}-${i + chunk.length}: ${e?.message || 'Erreur'}` });
          }
          setProgress(Math.round(((i + chunk.length) / cleaned.length) * 100));
        }
      } else {
        throw new Error('Aucun handler fourni');
      }
      setProgress(100);
      setResult({ inserted, errors });
      setStep(4);
      if (inserted > 0) toast.success(`${inserted} ligne(s) importée(s)`);
      if (errors.length > 0) toast.warning(`${errors.length} ligne(s) en échec`);
    } catch (e: any) {
      toast.error('Erreur import : ' + e.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([Object.fromEntries(fields.map(f => [f.label, '']))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modèle');
    XLSX.writeFile(wb, `modele_${templateName || 'import'}.xlsx`);
  };

  const downloadErrors = () => {
    if (!result?.errors.length) return;
    const ws = XLSX.utils.json_to_sheet(result.errors.map(e => ({ Ligne: e.line, Erreur: e.msg })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Erreurs');
    XLSX.writeFile(wb, `erreurs_import_${templateName || 'data'}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer Excel — {title}</DialogTitle>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`h-1 flex-1 rounded ${step >= s ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === 1 && (
            <div className="space-y-4 py-6 text-center">
              <div className="border-2 border-dashed rounded-lg p-8">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="mb-1 text-sm font-medium">Glissez-déposez ou cliquez</p>
                <p className="mb-3 text-xs text-muted-foreground">Formats acceptés : .xlsx, .xls, .csv</p>
                <input type="file" accept=".xlsx,.xls,.csv" id="wizard-file" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <Button asChild><label htmlFor="wizard-file" className="cursor-pointer">Choisir un fichier</label></Button>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Télécharger le modèle pré-rempli
              </Button>
              <div className="text-xs text-muted-foreground text-left bg-muted/40 rounded p-3">
                <p className="font-medium mb-1">Colonnes attendues :</p>
                <p>{fields.map(f => f.label + (f.required ? ' *' : '')).join(' · ')}</p>
              </div>
            </div>
          )}

          {step === 2 && current && (
            <div className="space-y-3 py-4">
              {sheets.length > 1 && (
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <Select value={String(activeSheet)} onValueChange={v => switchSheet(Number(v))}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {sheets.map((s, i) => <SelectItem key={i} value={String(i)}>{s.name} ({s.rows.length} lignes)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                <strong>{rawRows.length}</strong> lignes détectées dans <strong>{current.name}</strong>. Associez chaque champ à une colonne :
              </p>
              <div className="grid gap-2">
                {fields.map(f => (
                  <div key={f.key} className="flex items-center gap-2">
                    <div className="w-1/3 text-sm">
                      {f.label} {f.required && <span className="text-destructive">*</span>}
                      {f.type && <span className="text-xs text-muted-foreground ml-1">({f.type})</span>}
                    </div>
                    <Select value={mapping[f.key] || '__none__'} onValueChange={v => setMapping(m => ({ ...m, [f.key]: v === '__none__' ? '' : v }))}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="— Ignorer —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Ignorer —</SelectItem>
                        {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {requiredMissing.length > 0 && (
                <div className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Champs requis non mappés : {requiredMissing.map(f => f.label).join(', ')}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 py-4">
              <div className="flex gap-3 text-sm">
                <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />{validRows.length} valides</Badge>
                {invalidRows.length > 0 && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{invalidRows.length} avec erreurs</Badge>}
              </div>
              <ScrollArea className="h-[400px] border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr>
                      <th className="p-2 text-left">Ligne</th>
                      {fields.map(f => <th key={f.key} className="p-2 text-left">{f.label}</th>)}
                      <th className="p-2 text-left">État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validatedRows.slice(0, 200).map(r => (
                      <tr key={r._index} className={r._errors.length ? 'bg-destructive/10' : ''}>
                        <td className="p-2">{r._index}</td>
                        {fields.map(f => <td key={f.key} className="p-2 max-w-[150px] truncate">{String(r[f.key] ?? '')}</td>)}
                        <td className="p-2 text-destructive">{r._errors.join(', ') || '✓'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validatedRows.length > 200 && (
                  <div className="p-2 text-center text-xs text-muted-foreground">
                    … aperçu limité à 200 lignes (sur {validatedRows.length})
                  </div>
                )}
              </ScrollArea>
              {importing && (
                <div className="space-y-1">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground text-center">Import en cours… {progress}%</p>
                </div>
              )}
            </div>
          )}

          {step === 4 && result && (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <p className="text-lg font-medium">{result.inserted} ligne(s) importée(s) avec succès</p>
              {result.errors.length > 0 && (
                <div className="text-left">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-destructive">{result.errors.length} ligne(s) en échec :</p>
                    <Button size="sm" variant="outline" onClick={downloadErrors}>
                      <Download className="h-3 w-3 mr-1" />Exporter les erreurs
                    </Button>
                  </div>
                  <ScrollArea className="h-40 border rounded p-2">
                    <ul className="text-xs space-y-1">
                      {result.errors.map((e, i) => <li key={i}><strong>Ligne {e.line}:</strong> {e.msg}</li>)}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step > 1 && step < 4 && <Button variant="outline" onClick={() => setStep((step - 1) as any)} disabled={importing}>Retour</Button>}
          {step === 2 && <Button onClick={() => setStep(3)} disabled={requiredMissing.length > 0}>Valider mapping</Button>}
          {step === 3 && (
            <Button onClick={doImport} disabled={importing || validRows.length === 0}>
              {importing ? <><RotateCw className="h-4 w-4 mr-1 animate-spin" />Import…</> : `Importer ${validRows.length} ligne(s)`}
            </Button>
          )}
          {step === 4 && (
            <>
              {result && result.errors.length > 0 && <Button variant="outline" onClick={() => setStep(3)}>Réessayer</Button>}
              <Button onClick={() => handleClose(false)}>Terminer</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
