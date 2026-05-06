import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseExcelFile } from '@/hooks/useExcelImportExport';
import { Upload, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'boolean';
  /** Aliases (lowercased, accent-stripped) used for auto-mapping */
  aliases?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  fields: FieldDef[];
  /** Called with validated rows mapped to {key: value}. Should throw on error. */
  onImport: (rows: Record<string, any>[]) => Promise<{ inserted: number; failed?: number }>;
  /** Provide a downloadable template */
  templateName?: string;
}

const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

export function ExcelImportWizard({ open, onOpenChange, title, fields, onImport, templateName }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; failed?: number; errors: string[] } | null>(null);

  const reset = () => {
    setStep(1); setRawRows([]); setColumns([]); setMapping({}); setResult(null); setProgress(0);
  };

  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const handleFile = async (file: File) => {
    try {
      const rows = await parseExcelFile(file);
      if (!rows.length) { toast.error('Fichier vide'); return; }
      const cols = Object.keys(rows[0]);
      setRawRows(rows);
      setColumns(cols);
      // Auto-mapping
      const auto: Record<string, string> = {};
      fields.forEach(f => {
        const candidates = [f.key, f.label, ...(f.aliases || [])].map(norm);
        const found = cols.find(c => candidates.includes(norm(c)));
        if (found) auto[f.key] = found;
      });
      setMapping(auto);
      setStep(2);
    } catch (e: any) {
      toast.error('Lecture impossible : ' + e.message);
    }
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
          mapped[f.key] = n;
        } else if (f.type === 'date') {
          if (val instanceof Date) mapped[f.key] = val.toISOString().slice(0, 10);
          else {
            const d = new Date(val);
            mapped[f.key] = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
          }
        } else mapped[f.key] = String(val).trim();
      });
      return { _index: idx + 2, _errors: errors, ...mapped };
    });
  }, [step, rawRows, mapping, fields]);

  const validRows = validatedRows.filter(r => r._errors.length === 0);
  const invalidRows = validatedRows.filter(r => r._errors.length > 0);

  const doImport = async () => {
    setImporting(true);
    try {
      setProgress(20);
      const cleaned = validRows.map(({ _index, _errors, ...rest }) => rest);
      setProgress(50);
      const r = await onImport(cleaned);
      setProgress(100);
      setResult({ inserted: r.inserted, failed: r.failed, errors: invalidRows.map(r => `Ligne ${r._index}: ${r._errors.join(', ')}`) });
      setStep(4);
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer Excel — {title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === 1 && (
            <div className="space-y-4 py-6 text-center">
              <div className="border-2 border-dashed rounded-lg p-8">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="mb-3 text-sm text-muted-foreground">Sélectionnez un fichier .xlsx, .xls ou .csv</p>
                <input type="file" accept=".xlsx,.xls,.csv" id="wizard-file"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <Button asChild><label htmlFor="wizard-file" className="cursor-pointer">Choisir un fichier</label></Button>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Télécharger le modèle
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground">
                {rawRows.length} lignes détectées. Associez chaque champ à une colonne :
              </p>
              <div className="grid gap-2">
                {fields.map(f => (
                  <div key={f.key} className="flex items-center gap-2">
                    <div className="w-1/3 text-sm">
                      {f.label} {f.required && <span className="text-destructive">*</span>}
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
                  <thead className="bg-muted sticky top-0">
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
                        {fields.map(f => <td key={f.key} className="p-2">{String(r[f.key] ?? '')}</td>)}
                        <td className="p-2 text-destructive">{r._errors.join(', ') || '✓'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              {importing && <Progress value={progress} />}
            </div>
          )}

          {step === 4 && result && (
            <div className="text-center space-y-3 py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <p className="text-lg font-medium">{result.inserted} ligne(s) importée(s)</p>
              {result.errors.length > 0 && (
                <div className="text-left">
                  <p className="text-sm text-destructive mb-2">{result.errors.length} ligne(s) ignorée(s) :</p>
                  <ScrollArea className="h-32 border rounded p-2"><ul className="text-xs space-y-1">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step > 1 && step < 4 && <Button variant="outline" onClick={() => setStep((step - 1) as any)} disabled={importing}>Retour</Button>}
          {step === 2 && <Button onClick={() => setStep(3)}>Valider mapping</Button>}
          {step === 3 && <Button onClick={doImport} disabled={importing || validRows.length === 0}>Importer {validRows.length} ligne(s)</Button>}
          {step === 4 && <Button onClick={() => handleClose(false)}>Terminer</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
