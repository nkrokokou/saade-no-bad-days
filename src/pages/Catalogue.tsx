import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Copy, Upload, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ExcelImportWizard, FieldDef } from '@/components/ExcelImportWizard';
import { exportToExcel } from '@/hooks/useExcelImportExport';
import { Produit } from '@/hooks/useProducts';

const CATEGORIES = [
  'PATISSERIE', 'VIENNOISERIE', 'PTIT_DEJ', 'PANCAKE_CREPE', 'PANINI',
  'HOT_DOG', 'BURGER', 'DOGEL', 'PIZZA', 'POKE_BOWL', 'SALADE',
  'BOISSON_CHAUDE', 'SIGNATURE', 'BOISSON_FRAICHE', 'ENFANT',
  'FORMULE', 'ACCOMPAGNEMENT', 'DIVERS',
];

const empty = (): Partial<Produit> => ({
  nom: '', categorie: 'DIVERS', sous_categorie: '', unite: 'pièce',
  prix_vente: 0, prix_cout: 0, photo_url: '', actif: true,
});

export default function Catalogue() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [statutFilter, setStatutFilter] = useState<string>('actifs');
  const [editing, setEditing] = useState<Partial<Produit> | null>(null);
  const [toDelete, setToDelete] = useState<Produit | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: produits = [], isLoading } = useQuery({
    queryKey: ['catalogue'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produits').select('*').order('nom');
      if (error) throw error;
      return data as Produit[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return produits.filter(p => {
      if (catFilter !== 'all' && p.categorie !== catFilter) return false;
      if (statutFilter === 'actifs' && p.actif === false) return false;
      if (statutFilter === 'inactifs' && p.actif !== false) return false;
      if (s && !p.nom.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [produits, search, catFilter, statutFilter]);

  const saveMut = useMutation({
    mutationFn: async (p: Partial<Produit>) => {
      const payload = {
        nom: p.nom, categorie: p.categorie, sous_categorie: p.sous_categorie || null,
        unite: p.unite || 'pièce', prix_vente: Number(p.prix_vente) || 0,
        prix_cout: Number(p.prix_cout) || 0, photo_url: p.photo_url || null,
        actif: p.actif !== false,
      };
      if (p.id) {
        const { error } = await supabase.from('produits').update(payload).eq('id', p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('produits').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['catalogue'] }); qc.invalidateQueries({ queryKey: ['produits'] }); toast.success('Produit enregistré'); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('produits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['catalogue'] }); qc.invalidateQueries({ queryKey: ['produits'] }); toast.success('Produit supprimé'); setToDelete(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicate = (p: Produit) => {
    setEditing({ ...p, id: undefined, nom: p.nom + ' (copie)' });
  };

  const importFields: FieldDef[] = [
    { key: 'nom', label: 'Nom', required: true, type: 'string', aliases: ['produit', 'designation', 'libelle'] },
    { key: 'categorie', label: 'Catégorie', type: 'string', aliases: ['categorie', 'famille'] },
    { key: 'sous_categorie', label: 'Sous-catégorie', type: 'string' },
    { key: 'unite', label: 'Unité', type: 'string' },
    { key: 'prix_vente', label: 'Prix vente', type: 'number', aliases: ['prix', 'pv', 'prixventettc'] },
    { key: 'prix_cout', label: 'Prix coût', type: 'number', aliases: ['cout', 'prixrevient', 'pr'] },
  ];

  const handleImport = async (rows: Record<string, any>[]) => {
    const payload = rows.map(r => ({
      nom: String(r.nom),
      categorie: (r.categorie || 'DIVERS').toString().toUpperCase().replace(/\s+/g, '_'),
      sous_categorie: r.sous_categorie || null,
      unite: r.unite || 'pièce',
      prix_vente: Number(r.prix_vente) || 0,
      prix_cout: Number(r.prix_cout) || 0,
      actif: true,
    }));
    const { error, data } = await supabase.from('produits').insert(payload).select('id');
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ['catalogue'] });
    qc.invalidateQueries({ queryKey: ['produits'] });
    return { inserted: data?.length || 0 };
  };

  const handleExport = () => {
    exportToExcel(produits.map(p => ({
      Nom: p.nom, Catégorie: p.categorie, 'Sous-catégorie': p.sous_categorie || '',
      Unité: p.unite, 'Prix vente': p.prix_vente, 'Prix coût': p.prix_cout, Actif: p.actif ? 'Oui' : 'Non',
    })), 'catalogue_produits');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Catalogue Produits</h1>
          <p className="text-sm text-muted-foreground">{produits.length} produits référencés</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport}>Exporter</Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" />Importer</Button>
          <Button size="sm" onClick={() => setEditing(empty())}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher un produit…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="actifs">Actifs</SelectItem>
                <SelectItem value="inactifs">Inactifs</SelectItem>
                <SelectItem value="all">Tous</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Prix vente</TableHead>
                  <TableHead className="text-right">Prix coût</TableHead>
                  <TableHead className="text-right">Marge</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun produit</TableCell></TableRow>}
                {filtered.map(p => {
                  const marge = (p.prix_vente || 0) - (p.prix_cout || 0);
                  const margePct = p.prix_vente ? Math.round((marge / p.prix_vente) * 100) : 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nom}</TableCell>
                      <TableCell><Badge variant="secondary">{p.categorie}</Badge></TableCell>
                      <TableCell className="text-right">{(p.prix_vente || 0).toLocaleString()} F</TableCell>
                      <TableCell className="text-right text-muted-foreground">{(p.prix_cout || 0).toLocaleString()} F</TableCell>
                      <TableCell className="text-right">
                        <span className={marge < 0 ? 'text-destructive' : marge > 0 ? 'text-primary' : ''}>{marge.toLocaleString()} F ({margePct}%)</span>
                      </TableCell>
                      <TableCell>{p.actif === false ? <Badge variant="outline">Inactif</Badge> : <Badge>Actif</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => duplicate(p)}><Copy className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <Dialog open onOpenChange={v => !v && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing.id ? 'Modifier' : 'Ajouter'} un produit</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Nom *</Label><Input value={editing.nom || ''} onChange={e => setEditing({ ...editing, nom: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Catégorie</Label>
                  <Select value={editing.categorie || 'DIVERS'} onValueChange={v => setEditing({ ...editing, categorie: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Sous-catégorie</Label><Input value={editing.sous_categorie || ''} onChange={e => setEditing({ ...editing, sous_categorie: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Unité</Label><Input value={editing.unite || ''} onChange={e => setEditing({ ...editing, unite: e.target.value })} /></div>
                <div><Label>Prix vente (F)</Label><Input type="number" value={editing.prix_vente ?? 0} onChange={e => setEditing({ ...editing, prix_vente: Number(e.target.value) })} /></div>
                <div><Label>Prix coût (F)</Label><Input type="number" value={editing.prix_cout ?? 0} onChange={e => setEditing({ ...editing, prix_cout: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Photo (URL)</Label><Input value={editing.photo_url || ''} onChange={e => setEditing({ ...editing, photo_url: e.target.value })} placeholder="https://…" /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.actif !== false} onCheckedChange={v => setEditing({ ...editing, actif: v })} /><Label>Produit actif</Label></div>
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
        title="Supprimer le produit"
        description={`Confirmer la suppression de "${toDelete?.nom}" ?`}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />

      <ExcelImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Catalogue produits"
        templateName="catalogue"
        fields={importFields}
        onImport={handleImport}
      />
    </div>
  );
}
