import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Armchair } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { usePermissions } from '@/hooks/usePermissions';

type T = { id: string; numero: string; zone: string | null; places: number; actif: boolean };

export default function TablesRestaurant() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canCreate = can('tables_restaurant', 'create');
  const canUpdate = can('tables_restaurant', 'update');
  const canDelete = can('tables_restaurant', 'delete');
  const [editing, setEditing] = useState<Partial<T> | null>(null);
  const [toDelete, setToDelete] = useState<T | null>(null);

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['tables_restaurant'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tables_restaurant').select('*').order('numero');
      if (error) throw error;
      return (data || []) as T[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (t: Partial<T>) => {
      const payload: any = { numero: (t.numero || '').trim(), zone: t.zone || null, places: Number(t.places) || 2, actif: t.actif !== false };
      if (t.id) {
        const { error } = await supabase.from('tables_restaurant').update(payload).eq('id', t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tables_restaurant').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tables_restaurant'] }); toast.success('Table enregistrée'); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (t: T) => { const { error } = await supabase.from('tables_restaurant').delete().eq('id', t.id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tables_restaurant'] }); toast.success('Table supprimée'); setToDelete(null); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Armchair className="h-6 w-6 text-primary" /> Tables Restaurant</h1>
        {canCreate && <Button size="sm" onClick={() => setEditing({ numero: '', zone: '', places: 2, actif: true })}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{tables.length} table(s)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Zone</TableHead><TableHead className="text-center">Places</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Chargement…</TableCell></TableRow>}
              {!isLoading && tables.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Aucune table</TableCell></TableRow>}
              {tables.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.numero}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.zone}</TableCell>
                  <TableCell className="text-center">{t.places}</TableCell>
                  <TableCell>{t.actif ? <span className="text-primary text-sm">Active</span> : <span className="text-muted-foreground text-sm">Inactive</span>}</TableCell>
                  <TableCell className="text-right">
                    {canUpdate && <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>}
                    {canDelete && <Button size="icon" variant="ghost" onClick={() => setToDelete(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
            <DialogHeader><DialogTitle>{editing.id ? 'Modifier' : 'Ajouter'} une table</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Numéro *</Label><Input value={editing.numero || ''} onChange={e => setEditing({ ...editing, numero: e.target.value })} placeholder="ex. T1, B2…" /></div>
              <div><Label>Zone</Label><Input value={editing.zone || ''} onChange={e => setEditing({ ...editing, zone: e.target.value })} placeholder="ex. Terrasse, Salle…" /></div>
              <div><Label>Places</Label><Input type="number" value={editing.places ?? 2} onChange={e => setEditing({ ...editing, places: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.actif !== false} onCheckedChange={v => setEditing({ ...editing, actif: v })} /><Label>Active</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
              <Button onClick={() => saveMut.mutate(editing)} disabled={!editing.numero || saveMut.isPending}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog open={!!toDelete} onOpenChange={v => !v && setToDelete(null)}
        title="Supprimer la table"
        description={`Confirmer la suppression de la table "${toDelete?.numero}" ?`}
        destructive onConfirm={() => toDelete && deleteMut.mutate(toDelete)} />
    </div>
  );
}
