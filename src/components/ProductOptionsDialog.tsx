import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export type OptionChoice = {
  groupe_nom: string;
  item_libelle: string;
  prix_supplement: number;
};
export type OptionGroupe = {
  id: string;
  nom: string;
  min_choix: number;
  max_choix: number;
  obligatoire: boolean;
  ordre: number;
  items: { id: string; libelle: string; prix_supplement: number; ordre: number }[];
};

export async function fetchProductOptions(produitId: string): Promise<OptionGroupe[]> {
  const { data: groupes } = await supabase
    .from('produit_options_groupes' as any)
    .select('*, produit_options_items(*)')
    .eq('produit_id', produitId)
    .order('ordre');
  return ((groupes || []) as any[]).map(g => ({
    id: g.id, nom: g.nom, min_choix: g.min_choix, max_choix: g.max_choix,
    obligatoire: g.obligatoire, ordre: g.ordre,
    items: ((g.produit_options_items || []) as any[])
      .filter(i => i.actif !== false)
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .map(i => ({ id: i.id, libelle: i.libelle, prix_supplement: Number(i.prix_supplement) || 0, ordre: i.ordre ?? 0 })),
  }));
}

export function ProductOptionsDialog({
  open, onOpenChange, produitNom, groupes, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produitNom: string;
  groupes: OptionGroupe[];
  onConfirm: (choices: OptionChoice[]) => void;
}) {
  // selected[groupeId] = item id(s)
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  useEffect(() => { if (open) setSelected({}); }, [open, groupes]);

  const toggle = (g: OptionGroupe, itemId: string) => {
    setSelected(prev => {
      const cur = prev[g.id] || [];
      if (g.max_choix === 1) return { ...prev, [g.id]: [itemId] };
      if (cur.includes(itemId)) return { ...prev, [g.id]: cur.filter(x => x !== itemId) };
      if (cur.length >= g.max_choix) return prev;
      return { ...prev, [g.id]: [...cur, itemId] };
    });
  };

  const isValid = groupes.every(g => {
    const c = (selected[g.id] || []).length;
    if (g.obligatoire && c < g.min_choix) return false;
    if (c > g.max_choix) return false;
    return true;
  });

  const confirm = () => {
    const choices: OptionChoice[] = [];
    groupes.forEach(g => {
      (selected[g.id] || []).forEach(itemId => {
        const item = g.items.find(i => i.id === itemId);
        if (item) choices.push({ groupe_nom: g.nom, item_libelle: item.libelle, prix_supplement: item.prix_supplement });
      });
    });
    onConfirm(choices);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Options — {produitNom}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {groupes.map(g => (
            <div key={g.id} className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">{g.nom}</h4>
                <div className="flex items-center gap-1">
                  {g.obligatoire && <Badge variant="destructive" className="text-[10px]">obligatoire</Badge>}
                  <Badge variant="secondary" className="text-[10px]">
                    {g.max_choix === 1 ? '1 choix' : `${g.min_choix}-${g.max_choix} choix`}
                  </Badge>
                </div>
              </div>
              {g.max_choix === 1 ? (
                <RadioGroup
                  value={(selected[g.id] || [])[0] || ''}
                  onValueChange={v => toggle(g, v)}
                >
                  {g.items.map(i => (
                    <div key={i.id} className="flex items-center space-x-2 py-1">
                      <RadioGroupItem value={i.id} id={`opt-${i.id}`} />
                      <Label htmlFor={`opt-${i.id}`} className="flex-1 cursor-pointer text-sm">
                        {i.libelle}
                        {i.prix_supplement > 0 && <span className="text-muted-foreground ml-2">+{i.prix_supplement.toLocaleString('fr-FR')} F</span>}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-1">
                  {g.items.map(i => {
                    const checked = (selected[g.id] || []).includes(i.id);
                    return (
                      <div key={i.id} className="flex items-center space-x-2 py-1">
                        <Checkbox id={`opt-${i.id}`} checked={checked} onCheckedChange={() => toggle(g, i.id)} />
                        <Label htmlFor={`opt-${i.id}`} className="flex-1 cursor-pointer text-sm">
                          {i.libelle}
                          {i.prix_supplement > 0 && <span className="text-muted-foreground ml-2">+{i.prix_supplement.toLocaleString('fr-FR')} F</span>}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={!isValid} onClick={confirm}>Ajouter au panier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
