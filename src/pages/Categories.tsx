import { useState } from 'react';
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
import { Plus, Pencil, Trash2, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { usePermissions } from '@/hooks/usePermissions';

export default function Categories() {
  const qc = useQueryClient();
  const { isCeo } = usePermissions();
  const { data: categories = [], isLoading } = useCategories(false);
  const [editing, setEditing] = useState<Partial<Categorie> | null>(null);
  const [toDelete, setToDelete] = useState<Categorie | null>(null);

  const saveMut = useMutation({
    mutationFn: async (c: Partial<Categorie>) => {
      const payload = { nom: (c.nom || '').toUpperCase().trim().replace(/\s+/g, '_'), ordre: c.ordre ?? 0, actif: c.actif !== false };
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories_produits'] }); qc.invalidateQueries({ queryKey: ['catalogue'] }); qc.invalidateQueries({ queryKey: ['produits'] }); toast.success('Catégorie enregistrée'); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (c: Categorie) => {
      const { count } = await supabase.from('produits').select('id', { count: 'exact', head: true }).eq('categorie', c.nom);
      if ((count || 0) > 0) throw new Error(`${count} produit(s) utilisent cette catégorie. Réaffectez-les d'abord.`);
      const { error } = await supabase.from('categories_produits' as any).delete().eq('id', c.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories_produits'] }); toast.success('Catégorie supprimée'); setToDelete(null); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isCeo) return <div className="p-6 text-muted-foreground">Réservé à la CEO.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Tags className="h-6 w-6 text-primary" /> Catégories Produits</h1>
        <Button size="sm" onClick={() => setEditing({ nom: '', ordre: 0, actif: true })}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{categories.length} catégorie(s)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead className="text-center">Ordre</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Chargement…</TableCell></TableRow>}
              {!isLoading && categories.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Aucune catégorie</TableCell></TableRow>}
              {categories.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nom.replace(/_/g, ' ')}</TableCell>
                  <TableCell className="text-center">{c.ordre}</TableCell>
                  <TableCell>{c.actif ? <span className="text-primary text-sm">Active</span> : <span className="text-muted-foreground text-sm">Inactive</span>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setToDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <Dialog open onOpenChange={v => !v && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? 'Modifier' : 'Ajouter'} une catégorie</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nom *</Label><Input value={editing.nom || ''} onChange={e => setEditing({ ...editing, nom: e.target.value })} placeholder="ex. PATISSERIE" /></div>
              <div><Label>Ordre d'affichage</Label><Input type="number" value={editing.ordre ?? 0} onChange={e => setEditing({ ...editing, ordre: Number(e.target.value) || 0 })} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.actif !== false} onCheckedChange={v => setEditing({ ...editing, actif: v })} /><Label>Active</Label></div>
              {editing.id && <p className="text-xs text-muted-foreground">Renommer cette catégorie mettra à jour tous les produits liés automatiquement.</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
              <Button onClick={() => saveMut.mutate(editing)} disabled={!editing.nom || saveMut.isPending}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog open={!!toDelete} onOpenChange={v => !v && setToDelete(null)}
        title="Supprimer la catégorie"
        description={`Confirmer la suppression de "${toDelete?.nom}" ? (Impossible si des produits l'utilisent encore)`}
        destructive onConfirm={() => toDelete && deleteMut.mutate(toDelete)} />
    </div>
  );
}
