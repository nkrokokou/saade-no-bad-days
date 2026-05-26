import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SearchFilter } from '@/components/SearchFilter';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { Plus, Trash2, BookOpen, Calculator, Download, Upload, FileDown } from 'lucide-react';
import { exportToExcel, parseExcelFile } from '@/hooks/useExcelImportExport';

type MP = { id: string; nom: string; unite: string; prix_unitaire: number };

export default function FichesTechniques() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<{ matiere_premiere_id: string; matiere_premiere: string; quantite_mp: number; unite_mp: string; cout_unitaire_mp: number }>({ matiere_premiere_id: '', matiere_premiere: '', quantite_mp: 0, unite_mp: 'G', cout_unitaire_mp: 0 });

  const { data: mps = [] } = useQuery({
    queryKey: ['matieres_premieres', 'select'],
    queryFn: async () => {
      const { data } = await supabase.from('matieres_premieres').select('id, nom, unite, prix_unitaire').eq('actif', true).order('nom');
      return (data || []) as MP[];
    },
  });

  const { data: fiches = [] } = useQuery({
    queryKey: ['fiches_techniques', selectedProduct],
    enabled: !!selectedProduct,
    queryFn: async () => {
      const { data } = await supabase.from('fiches_techniques')
        .select('*')
        .eq('produit_id', selectedProduct!)
        .order('created_at');
      return data || [];
    },
  });

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p => p.nom.toLowerCase().includes(s) || p.categorie.toLowerCase().includes(s));
  }, [products, search]);

  const grouped = filteredProducts.reduce((acc, p) => {
    const cat = p.categorie || 'DIVERS';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, typeof products>);

  const addFiche = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('fiches_techniques').insert({
        produit_id: selectedProduct!,
        matiere_premiere_id: form.matiere_premiere_id || null,
        matiere_premiere: form.matiere_premiere,
        quantite_mp: form.quantite_mp,
        unite_mp: form.unite_mp,
        cout_unitaire_mp: form.cout_unitaire_mp,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiches_techniques'] });
      qc.invalidateQueries({ queryKey: ['catalogue'] });
      qc.invalidateQueries({ queryKey: ['produits'] });
      setShowAdd(false);
      setForm({ matiere_premiere_id: '', matiere_premiere: '', quantite_mp: 0, unite_mp: 'G', cout_unitaire_mp: 0 });
      toast.success('Ingrédient ajouté');
    },
  });

  const deleteFiche = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fiches_techniques').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiches_techniques'] });
      qc.invalidateQueries({ queryKey: ['catalogue'] });
      qc.invalidateQueries({ queryKey: ['produits'] });
      setDeleteId(null);
      toast.success('Ingrédient supprimé');
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProd = products.find(p => p.id === selectedProduct);
  const coutTotal = fiches.reduce((s: number, f: any) => s + (f.quantite_mp * f.cout_unitaire_mp), 0);

  const handleExportExcel = () => {
    if (!selectedProd) return;
    const rows = fiches.map((f: any) => ({
      'Matière première': f.matiere_premiere,
      Quantité: f.quantite_mp,
      Unité: f.unite_mp,
      'Coût unitaire (FCFA)': f.cout_unitaire_mp,
      'Coût total (FCFA)': f.quantite_mp * f.cout_unitaire_mp,
    }));
    if (rows.length === 0) {
      rows.push({ 'Matière première': '', Quantité: 0, Unité: 'G', 'Coût unitaire (FCFA)': 0, 'Coût total (FCFA)': 0 });
    }
    exportToExcel(rows, `fiche_technique_${selectedProd.nom}`, 'Fiche');
  };

  const handleImportExcel = async (file: File) => {
    if (!selectedProduct) return;
    try {
      const rows = await parseExcelFile(file);
      if (rows.length === 0) { toast.warning('Fichier vide'); return; }
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const records = rows.map(r => {
        const keys = Object.keys(r);
        const get = (needle: string) => {
          const k = keys.find(k => norm(k).includes(needle));
          return k ? r[k] : '';
        };
        const nom = String(get('matiere') || get('mp') || get('ingredient') || '').trim();
        const mp = mps.find(m => norm(m.nom) === norm(nom));
        const unite = String(get('unite') || mp?.unite || 'G').trim().toUpperCase();
        const quantite = parseFloat(String(get('quantite') || get('qte') || 0).replace(',', '.')) || 0;
        const cout = parseFloat(String(get('cout unitaire') || get('cout') || get('prix') || mp?.prix_unitaire || 0).toString().replace(',', '.')) || 0;
        return nom ? {
          produit_id: selectedProduct,
          matiere_premiere_id: mp?.id || null,
          matiere_premiere: nom,
          quantite_mp: quantite,
          unite_mp: unite,
          cout_unitaire_mp: cout,
          created_by: user?.id,
        } : null;
      }).filter(Boolean) as any[];
      if (records.length === 0) { toast.warning('Aucune ligne valide trouvée'); return; }
      const { error } = await supabase.from('fiches_techniques').insert(records);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['fiches_techniques'] });
      qc.invalidateQueries({ queryKey: ['catalogue'] });
      qc.invalidateQueries({ queryKey: ['produits'] });
      toast.success(`${records.length} ingrédient(s) importé(s)`);
    } catch (e: any) {
      console.error(e);
      toast.error('Erreur import : ' + (e.message || 'Format invalide'));
    }
  };

  if (selectedProduct && selectedProd) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setSelectedProduct(null)}>← Retour</Button>
            <h1 className="text-xl font-heading font-bold">{selectedProd.nom}</h1>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Ajouter MP</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Ajouter une matière première</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Matière première *</Label>
                  <Select
                    value={form.matiere_premiere_id}
                    onValueChange={v => {
                      const mp = mps.find(m => m.id === v);
                      if (mp) setForm(p => ({ ...p, matiere_premiere_id: mp.id, matiere_premiere: mp.nom, unite_mp: mp.unite, cout_unitaire_mp: mp.prix_unitaire }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Sélectionner depuis le référentiel…" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {mps.map(m => <SelectItem key={m.id} value={m.id}>{m.nom} <span className="text-xs text-muted-foreground ml-2">({m.prix_unitaire?.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} F/{m.unite})</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Quantité ({form.unite_mp})</Label><Input type="number" step="0.001" value={form.quantite_mp || ''} onChange={e => setForm(p => ({ ...p, quantite_mp: parseFloat(e.target.value) || 0 }))} /></div>
                  <div><Label>Coût/{form.unite_mp}</Label><Input type="number" value={form.cout_unitaire_mp || ''} onChange={e => setForm(p => ({ ...p, cout_unitaire_mp: parseFloat(e.target.value) || 0 }))} /></div>
                </div>
                <p className="text-sm text-muted-foreground">Coût ingrédient : <strong>{((form.quantite_mp || 0) * (form.cout_unitaire_mp || 0)).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA</strong></p>
                <Button className="w-full" onClick={() => addFiche.mutate()} disabled={addFiche.isPending || !form.matiere_premiere}>
                  {addFiche.isPending ? 'Ajout...' : 'Ajouter'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Coût de revient</p>
              <p className="text-xl font-bold text-primary">{coutTotal.toLocaleString('fr-FR')} <span className="text-xs">FCFA</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Prix de vente</p>
              <p className="text-xl font-bold">{(selectedProd.prix_vente || 0).toLocaleString('fr-FR')} <span className="text-xs">FCFA</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Marge</p>
              <p className={`text-xl font-bold ${(selectedProd.prix_vente || 0) - coutTotal > 0 ? 'text-green-600' : 'text-destructive'}`}>
                {((selectedProd.prix_vente || 0) - coutTotal).toLocaleString('fr-FR')} <span className="text-xs">FCFA</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="overflow-x-auto pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matière première</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Unité</TableHead>
                  <TableHead>Coût/unité</TableHead>
                  <TableHead>Coût total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fiches.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.matiere_premiere}</TableCell>
                    <TableCell>{f.quantite_mp}</TableCell>
                    <TableCell>{f.unite_mp}</TableCell>
                    <TableCell>{f.cout_unitaire_mp?.toLocaleString('fr-FR')}</TableCell>
                    <TableCell className="font-medium">{(f.quantite_mp * f.cout_unitaire_mp).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(f.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {fiches.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun ingrédient · ajoutez les matières premières</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={() => setDeleteId(null)}
          title="Supprimer l'ingrédient ?"
          description="Cette action est irréversible."
          destructive
          onConfirm={() => deleteId && deleteFiche.mutate(deleteId)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Fiches Techniques
        </h1>
        <SearchFilter value={search} onChange={setSearch} className="w-64" />
      </div>

      <p className="text-sm text-muted-foreground">
        <Calculator className="h-4 w-4 inline mr-1" />
        Sélectionnez un produit pour voir/éditer sa fiche technique (recette + coût de revient)
      </p>

      {Object.entries(grouped).map(([cat, prods]) => (
        <Card key={cat}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase text-muted-foreground tracking-wider">{cat}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {prods.map(p => (
                <Button key={p.id} variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => setSelectedProduct(p.id)}>
                  <div className="text-left">
                    <p className="font-medium text-sm">{p.nom}</p>
                    {(p.prix_vente ?? 0) > 0 && <p className="text-xs text-muted-foreground">{p.prix_vente?.toLocaleString('fr-FR')} FCFA</p>}
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
