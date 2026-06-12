import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export function ProductOptionsManager({
  open, onOpenChange, produitId, produitNom,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produitId: string;
  produitNom: string;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: groupes = [], refetch } = useQuery({
    queryKey: ['produit_options', produitId],
    enabled: open && !!produitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produit_options_groupes' as any)
        .select('*, produit_options_items(*)')
        .eq('produit_id', produitId)
        .order('ordre');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const addGroupe = async () => {
    const nom = prompt('Nom du groupe (ex : "Boisson", "Suppléments") :');
    if (!nom) return;
    const obligatoire = confirm('Ce groupe est-il obligatoire ?');
    const multi = confirm('Permettre plusieurs choix dans ce groupe ?');
    await supabase.from('produit_options_groupes' as any).insert({
      produit_id: produitId, nom, ordre: groupes.length,
      min_choix: obligatoire ? 1 : 0,
      max_choix: multi ? 99 : 1,
      obligatoire,
    });
    refetch();
  };

  const deleteGroupe = async (id: string) => {
    if (!confirm('Supprimer ce groupe et tous ses choix ?')) return;
    await supabase.from('produit_options_groupes' as any).delete().eq('id', id);
    refetch();
  };

  const addItem = async (groupeId: string) => {
    const libelle = prompt('Libellé du choix (ex : "Ice tea", "Mayo") :');
    if (!libelle) return;
    const prixStr = prompt('Supplément de prix (FCFA, 0 si inclus) :', '0');
    const prix_supplement = Number(prixStr) || 0;
    await supabase.from('produit_options_items' as any).insert({ groupe_id: groupeId, libelle, prix_supplement });
    refetch();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('produit_options_items' as any).delete().eq('id', id);
    refetch();
  };

  const updateGroupe = async (id: string, patch: any) => {
    await supabase.from('produit_options_groupes' as any).update(patch).eq('id', id);
    refetch();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Options — {produitNom}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Configurez les choix proposés à la caisse quand on ajoute ce produit (formules, suppléments, etc.).
          </p>
          {groupes.map((g: any) => {
            const items = (g.produit_options_items || []).sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0));
            const isOpen = expanded[g.id] ?? true;
            return (
              <div key={g.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => setExpanded(p => ({ ...p, [g.id]: !isOpen }))}>
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                  <Input className="flex-1 h-8" value={g.nom}
                    onChange={e => updateGroupe(g.id, { nom: e.target.value })}
                    onBlur={() => refetch()} />
                  <Button size="icon" variant="ghost" onClick={() => deleteGroupe(g.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {isOpen && (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <Label className="text-xs">Min choix</Label>
                        <Input type="number" className="h-7" value={g.min_choix}
                          onChange={e => updateGroupe(g.id, { min_choix: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-xs">Max choix</Label>
                        <Input type="number" className="h-7" value={g.max_choix}
                          onChange={e => updateGroupe(g.id, { max_choix: Number(e.target.value) || 1 })} />
                      </div>
                      <div className="flex items-end gap-2">
                        <Switch checked={g.obligatoire}
                          onCheckedChange={v => updateGroupe(g.id, { obligatoire: v, min_choix: v ? Math.max(1, g.min_choix) : 0 })} />
                        <Label className="text-xs">Obligatoire</Label>
                      </div>
                    </div>
                    <div className="space-y-1 pl-4 border-l-2">
                      {items.map((i: any) => (
                        <div key={i.id} className="flex items-center gap-2">
                          <span className="text-sm flex-1">{i.libelle}</span>
                          {Number(i.prix_supplement) > 0 && (
                            <span className="text-xs text-muted-foreground">+{Number(i.prix_supplement).toLocaleString('fr-FR')} F</span>
                          )}
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteItem(i.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => addItem(g.id)}>
                        <Plus className="h-3 w-3 mr-1" /> Ajouter un choix
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <Button onClick={addGroupe} variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Nouveau groupe d'options
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
