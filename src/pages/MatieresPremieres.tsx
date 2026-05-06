import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Boxes } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ExcelImportExport } from '@/components/ExcelImportExport';
import { SearchFilter } from '@/components/SearchFilter';
import { exportToExcel, exportToPDF, parseExcelFile } from '@/hooks/useExcelImportExport';
import { usePermissions } from '@/hooks/usePermissions';

type MP = {
  id: string; nom: string; marque: string | null; fournisseur: string | null;
  colisage: number; unite: string; prix_achat: number; prix_unitaire: number;
  notes: string | null; actif: boolean; stock_min?: number;
};
type StockRow = { id: string; total_achete: number; total_consomme: number; stock_actuel: number; alerte_stock: boolean };

const empty: Partial<MP> = { nom: '', marque: '', fournisseur: '', colisage: 1, unite: 'G', prix_achat: 0, prix_unitaire: 0, actif: true, stock_min: 0 };

export default function MatieresPremieres() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canCreate = can('matieres_premieres', 'create');
  const canUpdate = can('matieres_premieres', 'update');
  const canDelete = can('matieres_premieres', 'delete');
  const [search, setSearch] = useState('');
  const [fournisseur, setFournisseur] = useState<string>('all');
  const [editing, setEditing] = useState<Partial<MP> | null>(null);
  const [toDelete, setToDelete] = useState<MP | null>(null);

  const { data: mps = [], isLoading } = useQuery({
    queryKey: ['matieres_premieres'],
    queryFn: async () => {
      const { data, error } = await supabase.from('matieres_premieres').select('*').order('nom');
      if (error) throw error;
      return (data || []) as MP[];
    },
  });

  const fournisseurs = useMemo(() => Array.from(new Set(mps.map(m => m.fournisseur).filter(Boolean))).sort() as string[], [mps]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return mps.filter(m =>
      (fournisseur === 'all' || m.fournisseur === fournisseur) &&
      (!s || m.nom.toLowerCase().includes(s) || (m.marque || '').toLowerCase().includes(s) || (m.fournisseur || '').toLowerCase().includes(s))
    );
  }, [mps, search, fournisseur]);

  const saveMut = useMutation({
    mutationFn: async (m: Partial<MP>) => {
      const colisage = Number(m.colisage) || 1;
      const prix_achat = Number(m.prix_achat) || 0;
      const prix_unitaire = colisage > 0 ? prix_achat / colisage : 0;
      const payload: any = {
        nom: (m.nom || '').trim(),
        marque: m.marque || null,
        fournisseur: m.fournisseur || null,
        colisage, unite: m.unite || 'G',
        prix_achat, prix_unitaire,
        notes: m.notes || null,
        actif: m.actif !== false,
      };
      if (m.id) {
        const { error } = await supabase.from('matieres_premieres').update(payload).eq('id', m.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('matieres_premieres').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['matieres_premieres'] }); toast.success('Matière première enregistrée'); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (m: MP) => {
      const { error } = await supabase.from('matieres_premieres').delete().eq('id', m.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['matieres_premieres'] }); toast.success('Matière première supprimée'); setToDelete(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleExport = () => {
    exportToExcel(mps.map(m => ({
      Nom: m.nom, Marque: m.marque || '', Fournisseur: m.fournisseur || '',
      Colisage: m.colisage, Unité: m.unite, 'Prix achat': m.prix_achat, 'Prix unitaire': m.prix_unitaire,
      Actif: m.actif ? 'Oui' : 'Non', Notes: m.notes || '',
    })), 'matieres_premieres');
  };
  const handleExportPDF = () => {
    exportToPDF('Matières Premières', ['Nom', 'Marque', 'Fournisseur', 'Colisage', 'Unité', 'P.Achat', 'P.Unit.'],
      mps.map(m => [m.nom, m.marque || '', m.fournisseur || '', m.colisage, m.unite, m.prix_achat, m.prix_unitaire]));
  };
  const handleImport = async (file: File) => {
    try {
      const rows = await parseExcelFile(file);
      let imported = 0;
      for (const row of rows) {
        const nom = String(row['Nom'] || row['nom'] || '').trim();
        if (!nom) continue;
        const colisage = Number(row['Colisage'] || row['colisage'] || 1) || 1;
        const prix_achat = Number(row['Prix achat'] || row['prix_achat'] || 0) || 0;
        await supabase.from('matieres_premieres').upsert({
          nom,
          marque: String(row['Marque'] || row['marque'] || '') || null,
          fournisseur: String(row['Fournisseur'] || row['fournisseur'] || '') || null,
          colisage,
          unite: String(row['Unité'] || row['unite'] || 'G'),
          prix_achat,
          prix_unitaire: colisage > 0 ? prix_achat / colisage : 0,
          notes: String(row['Notes'] || row['notes'] || '') || null,
          actif: true,
        } as any, { onConflict: 'nom' as any });
        imported++;
      }
      qc.invalidateQueries({ queryKey: ['matieres_premieres'] });
      toast.success(`${imported} matières premières importées`);
    } catch (e: any) { toast.error(e.message || 'Erreur d\'import'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Boxes className="h-6 w-6 text-primary" /> Matières Premières</h1>
        <div className="flex gap-2 flex-wrap">
          <SearchFilter value={search} onChange={setSearch} placeholder="Rechercher…" className="w-48" />
          <Select value={fournisseur} onValueChange={setFournisseur}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Fournisseur" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous fournisseurs</SelectItem>
              {fournisseurs.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <ExcelImportExport onExport={handleExport} onExportPDF={handleExportPDF} onImport={handleImport} />
          {canCreate && <Button size="sm" onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{filtered.length} / {mps.length} matière(s)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nom</TableHead><TableHead>Marque</TableHead><TableHead>Fournisseur</TableHead>
              <TableHead className="text-right">Colisage</TableHead><TableHead>Unité</TableHead>
              <TableHead className="text-right">Prix achat</TableHead><TableHead className="text-right">Prix unitaire</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Chargement…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Aucune matière première</TableCell></TableRow>}
              {filtered.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nom}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.marque}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.fournisseur}</TableCell>
                  <TableCell className="text-right">{m.colisage}</TableCell>
                  <TableCell>{m.unite}</TableCell>
                  <TableCell className="text-right">{m.prix_achat?.toLocaleString('fr-FR')}</TableCell>
                  <TableCell className="text-right font-medium">{m.prix_unitaire?.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">
                    {canUpdate && <Button size="icon" variant="ghost" onClick={() => setEditing(m)}><Pencil className="h-4 w-4" /></Button>}
                    {canDelete && <Button size="icon" variant="ghost" onClick={() => setToDelete(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
            <DialogHeader><DialogTitle>{editing.id ? 'Modifier' : 'Ajouter'} une matière première</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nom *</Label><Input value={editing.nom || ''} onChange={e => setEditing({ ...editing, nom: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Marque</Label><Input value={editing.marque || ''} onChange={e => setEditing({ ...editing, marque: e.target.value })} /></div>
                <div><Label>Fournisseur</Label><Input value={editing.fournisseur || ''} onChange={e => setEditing({ ...editing, fournisseur: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Colisage</Label><Input type="number" step="0.01" value={editing.colisage ?? 1} onChange={e => setEditing({ ...editing, colisage: Number(e.target.value) })} /></div>
                <div><Label>Unité</Label>
                  <Select value={editing.unite || 'G'} onValueChange={v => setEditing({ ...editing, unite: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['G', 'KG', 'ML', 'L', 'PIECE', 'UNITE'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Prix achat (FCFA)</Label><Input type="number" value={editing.prix_achat ?? 0} onChange={e => setEditing({ ...editing, prix_achat: Number(e.target.value) })} /></div>
              </div>
              <p className="text-xs text-muted-foreground">
                Prix unitaire calculé : <strong>{(((Number(editing.prix_achat) || 0) / (Number(editing.colisage) || 1)) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA / {editing.unite}</strong>
              </p>
              <div><Label>Notes</Label><Input value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.actif !== false} onCheckedChange={v => setEditing({ ...editing, actif: v })} /><Label>Active</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
              <Button onClick={() => saveMut.mutate(editing)} disabled={!editing.nom || saveMut.isPending}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog open={!!toDelete} onOpenChange={v => !v && setToDelete(null)}
        title="Supprimer la matière première"
        description={`Confirmer la suppression de "${toDelete?.nom}" ?`}
        destructive onConfirm={() => toDelete && deleteMut.mutate(toDelete)} />
    </div>
  );
}
