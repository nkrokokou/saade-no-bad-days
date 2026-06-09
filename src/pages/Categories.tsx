import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCategories, Categorie } from '@/hooks/useCategories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Tags, Flame, Snowflake, Receipt, Minus, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { usePermissions } from '@/hooks/usePermissions';

const IMPR_ICONS: Record<string, React.ReactElement> = {
  chaud:  <Flame className="h-3.5 w-3.5 text-orange-500" />,
  froid:  <Snowflake className="h-3.5 w-3.5 text-sky-500" />,
  caisse: <Receipt className="h-3.5 w-3.5 text-muted-foreground" />,
  aucune: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
};
const IMPR_LABELS: Record<string, string> = {
  chaud: 'Cuisine chaude', froid: 'Cuisine froide', caisse: 'Caisse uniquement', aucune: 'Pas d\'impression',
};

export default function Categories() {
  const qc = useQueryClient();
  const { isCeo } = usePermissions();
  const { data: categories = [], isLoading } = useCategories(false);
  const [editing, setEditing] = useState<Partial<Categorie> | null>(null);
  const [toDelete, setToDelete] = useState<Categorie | null>(null);

  // Arborescence : parents d'abord, puis enfants
  const tree = useMemo(() => {
    const parents = categories.filter(c => !c.parent_id);
    return parents.map(p => ({
      parent: p,
      children: categories.filter(c => c.parent_id === p.id),
    }));
  }, [categories]);

  const orphans = useMemo(
    () => categories.filter(c => c.parent_id && !categories.find(p => p.id === c.parent_id)),
    [categories],
  );

  const saveMut = useMutation({
    mutationFn: async (c: Partial<Categorie>) => {
      const payload: any = {
        nom: (c.nom || '').toUpperCase().trim().replace(/\s+/g, '_'),
        ordre: c.ordre ?? 0,
        actif: c.actif !== false,
        parent_id: c.parent_id || null,
        imprimante_cible: c.imprimante_cible || 'chaud',
      };
      if (c.id) {
        const oldNom = categories.find(x => x.id === c.id)?.nom;
        const { error } = await supabase.from('categories_produits' as any).update(payload).eq('id', c.id);
        if (error) throw error;
        if (oldNom && oldNom !== payload.nom) {
          await supabase.from('produits').update({ categorie: payload.nom }).eq('categorie', oldNom);
        }
      } else {
        const { error } = await supabase.from('categories_produits' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories_produits'] });
      qc.invalidateQueries({ queryKey: ['catalogue'] });
      qc.invalidateQueries({ queryKey: ['produits'] });
      toast.success('Catégorie enregistrée');
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  });

  const deleteMut = useMutation({
    mutationFn: async (c: Categorie) => {
      const { count } = await supabase.from('produits').select('id', { count: 'exact', head: true }).eq('categorie', c.nom);
      if ((count || 0) > 0) throw new Error(`${count} produit(s) utilisent cette catégorie. Réaffectez-les d'abord.`);
      const childrenCount = categories.filter(x => x.parent_id === c.id).length;
      if (childrenCount > 0) throw new Error(`${childrenCount} sous-catégorie(s) rattachée(s). Supprimez-les d'abord.`);
      const { error } = await supabase.from('categories_produits' as any).delete().eq('id', c.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories_produits'] }); toast.success('Catégorie supprimée'); setToDelete(null); },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  });

  if (!isCeo) return <div className="p-6 text-muted-foreground">Réservé à la CEO.</div>;

  const renderRow = (c: Categorie, isChild = false) => (
    <TableRow key={c.id} className={isChild ? 'bg-muted/30' : ''}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {isChild && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-4" />}
          <span>{c.nom.replace(/_/g, ' ')}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">{c.ordre}</TableCell>
      <TableCell>
        <Badge variant="outline" className="gap-1 font-normal">
          {IMPR_ICONS[c.imprimante_cible || 'chaud']}
          <span className="text-xs">{IMPR_LABELS[c.imprimante_cible || 'chaud']}</span>
        </Badge>
      </TableCell>
      <TableCell>{c.actif ? <span className="text-primary text-sm">Active</span> : <span className="text-muted-foreground text-sm">Inactive</span>}</TableCell>
      <TableCell className="text-right">
        <Button size="icon" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => setToDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Tags className="h-6 w-6 text-primary" /> Catégories & Sous-catégories</h1>
        <Button size="sm" onClick={() => setEditing({ nom: '', ordre: 0, actif: true, imprimante_cible: 'chaud' })}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            {categories.length} catégorie(s) · {tree.length} parente(s) · {categories.length - tree.length - orphans.length} sous-catégorie(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="text-center w-20">Ordre</TableHead>
                <TableHead>Imprimante cible</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Chargement…</TableCell></TableRow>}
              {!isLoading && categories.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Aucune catégorie</TableCell></TableRow>}
              {tree.map(({ parent, children }) => (
                <>
                  {renderRow(parent)}
                  {children.map(ch => renderRow(ch, true))}
                </>
              ))}
              {orphans.map(o => renderRow(o, true))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <Dialog open onOpenChange={v => !v && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? 'Modifier' : 'Ajouter'} une catégorie</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nom *</Label>
                <Input value={editing.nom || ''} onChange={e => setEditing({ ...editing, nom: e.target.value })} placeholder="ex. BURGERS" />
              </div>
              <div>
                <Label>Catégorie parente (laisser vide pour une catégorie racine)</Label>
                <Select
                  value={editing.parent_id || '__none__'}
                  onValueChange={v => setEditing({ ...editing, parent_id: v === '__none__' ? null : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Aucune (racine) —</SelectItem>
                    {categories.filter(c => !c.parent_id && c.id !== editing.id).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nom.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Imprimante cible</Label>
                <Select
                  value={editing.imprimante_cible || 'chaud'}
                  onValueChange={v => setEditing({ ...editing, imprimante_cible: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chaud">🔥 Cuisine chaude (burgers, hot dogs, grillades)</SelectItem>
                    <SelectItem value="froid">❄️ Cuisine froide (salades, desserts, donuts)</SelectItem>
                    <SelectItem value="caisse">🧾 Caisse uniquement (boissons, à emporter)</SelectItem>
                    <SelectItem value="aucune">— Pas d'impression cuisine —</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Détermine vers quelle imprimante le bon est envoyé.</p>
              </div>
              <div>
                <Label>Ordre d'affichage</Label>
                <Input type="number" value={editing.ordre ?? 0} onChange={e => setEditing({ ...editing, ordre: Number(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.actif !== false} onCheckedChange={v => setEditing({ ...editing, actif: v })} />
                <Label>Active</Label>
              </div>
              {editing.id && <p className="text-xs text-muted-foreground">Renommer cette catégorie mettra à jour tous les produits liés automatiquement.</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
              <Button onClick={() => saveMut.mutate(editing)} disabled={!editing.nom || saveMut.isPending}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={v => !v && setToDelete(null)}
        title="Supprimer la catégorie"
        description={`Confirmer la suppression de "${toDelete?.nom}" ? (Impossible si des produits ou sous-catégories l'utilisent)`}
        destructive
        onConfirm={() => toDelete && deleteMut.mutate(toDelete)}
      />
    </div>
  );
}
