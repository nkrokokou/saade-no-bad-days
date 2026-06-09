import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ParsedFiche } from '@/lib/parseFicheExcel';
import { AlertCircle, CheckCircle2, Package, ListOrdered, Info } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  results: ParsedFiche[];
  products: { id: string; nom: string }[];
  onConfirm: (selected: Array<ParsedFiche & { productId: string }>) => void;
  isLoading?: boolean;
};

export function FicheImportPreviewDialog({ open, onOpenChange, results, products, onConfirm, isLoading }: Props) {
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [skipped, setSkipped] = useState<Record<number, boolean>>({});

  useMemo(() => {
    setOverrides({});
    setSkipped({});
  }, [results]);

  const handleConfirm = () => {
    const final = results
      .map((r, i) => ({ ...r, productId: overrides[i] ?? r.productId ?? '' }))
      .filter((r, i) => !skipped[i] && r.productId);
    onConfirm(final as Array<ParsedFiche & { productId: string }>);
  };

  const validCount = results.filter((r, i) => !skipped[i] && (overrides[i] ?? r.productId)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Aperçu import fiche technique</DialogTitle>
          <DialogDescription>
            Vérifiez ce qui sera importé avant validation. {validCount} / {results.length} fiche(s) prête(s).
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4">
            {results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune fiche détectée dans ce fichier.</p>
            )}
            {results.map((r, i) => {
              const pid = overrides[i] ?? r.productId ?? '';
              const isSkipped = skipped[i];
              return (
                <div key={i} className={`border rounded-lg p-3 space-y-2 ${isSkipped ? 'opacity-40' : ''}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!isSkipped} onCheckedChange={v => setSkipped(s => ({ ...s, [i]: !v }))} />
                      <div>
                        <p className="font-medium text-sm">Onglet : <span className="text-muted-foreground">{r.sheetName}</span></p>
                        <p className="text-xs text-muted-foreground">Produit détecté : <strong>{r.productName || '(aucun)'}</strong></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pid ? (
                        <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Produit lié</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />À assigner</Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <Select value={pid} onValueChange={v => setOverrides(o => ({ ...o, [i]: v }))} disabled={isSkipped}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Choisir le produit cible…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-semibold flex items-center gap-1 mb-1"><Package className="h-3 w-3" />Ingrédients ({r.ingredients.length})</p>
                      <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                        {r.ingredients.map((ing, j) => (
                          <li key={j} className="flex justify-between gap-2 border-b border-border/30 py-0.5">
                            <span className={ing.mp_id ? '' : 'text-amber-600'}>{ing.nom}{!ing.mp_id && ' *'}</span>
                            <span className="text-muted-foreground whitespace-nowrap">{ing.quantite} {ing.unite} × {ing.cout_unitaire.toLocaleString('fr-FR')}</span>
                          </li>
                        ))}
                        {r.ingredients.length === 0 && <li className="text-muted-foreground italic">aucun</li>}
                      </ul>
                      {r.ingredients.some(i => !i.mp_id) && <p className="text-[10px] text-amber-600 mt-1">* MP non trouvée dans le référentiel — créée libre</p>}
                    </div>
                    <div>
                      <p className="font-semibold flex items-center gap-1 mb-1"><ListOrdered className="h-3 w-3" />Étapes ({r.etapes.length})</p>
                      <ul className="space-y-0.5 max-h-32 overflow-y-auto list-decimal list-inside">
                        {r.etapes.slice(0, 8).map((e, j) => <li key={j} className="text-muted-foreground">{e}</li>)}
                        {r.etapes.length > 8 && <li className="text-muted-foreground italic">… +{r.etapes.length - 8}</li>}
                        {r.etapes.length === 0 && <li className="text-muted-foreground italic">aucune</li>}
                      </ul>
                    </div>
                  </div>

                  {(r.meta.rendement || r.meta.temps_cuisson_min || r.meta.temperature_cuisson || r.meta.conservation) && (
                    <div className="text-xs flex flex-wrap gap-2 pt-1 border-t">
                      <span className="flex items-center gap-1 text-muted-foreground"><Info className="h-3 w-3" />Méta :</span>
                      {r.meta.rendement && <Badge variant="secondary">Rendement {r.meta.rendement} {r.meta.rendement_unite || ''}</Badge>}
                      {r.meta.temps_cuisson_min && <Badge variant="secondary">Cuisson {r.meta.temps_cuisson_min} min</Badge>}
                      {r.meta.temperature_cuisson && <Badge variant="secondary">{r.meta.temperature_cuisson}°C</Badge>}
                      {r.meta.conservation && <Badge variant="secondary">DLC : {r.meta.conservation}</Badge>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={isLoading || validCount === 0}>
            {isLoading ? 'Import…' : `Importer ${validCount} fiche(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
