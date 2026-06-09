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
import { Plus, Trash2, BookOpen, Calculator, Upload, FileDown } from 'lucide-react';
import { exportToExcel } from '@/hooks/useExcelImportExport';
import { FicheMetaPanel } from '@/components/FicheMetaPanel';
import { parseFicheWorkbook, type ParsedFiche } from '@/lib/parseFicheExcel';
import { FicheImportPreviewDialog } from '@/components/FicheImportPreviewDialog';

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
  const listFileRef = useRef<HTMLInputElement>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewResults, setPreviewResults] = useState<ParsedFiche[]>([]);
  const [importing, setImporting] = useState(false);

  const runImportPreview = async (file: File, restrictToSelected: boolean) => {
    try {
      const buf = await file.arrayBuffer();
      let results = parseFicheWorkbook(buf, products as any, mps);
      if (restrictToSelected && selectedProduct) {
        results = results.map(r => ({ ...r, productId: selectedProduct }));
      }
      if (results.length === 0) {
        toast.warning('Aucune fiche détectée. Vérifiez : nom du produit + en-tête INGREDIENT / QTE / UNITE.');
        return;
      }
      setPreviewResults(results);
      setPreviewOpen(true);
    } catch (e: any) {
      console.error(e);
      toast.error('Lecture impossible : ' + (e.message || 'Format invalide'));
    }
  };

  const confirmImport = async (selected: Array<ParsedFiche & { productId: string }>) => {
    setImporting(true);
    try {
      const rows = selected.flatMap(r => r.ingredients.map(ing => ({
        produit_id: r.productId,
        matiere_premiere_id: ing.mp_id || null,
        matiere_premiere: ing.nom,
        quantite_mp: ing.quantite,
        unite_mp: ing.unite,
        cout_unitaire_mp: ing.cout_unitaire,
        created_by: user?.id,
      })));
      if (rows.length > 0) {
        const { error } = await supabase.from('fiches_techniques').insert(rows);
        if (error) throw error;
      }
      // Upsert meta (etapes + rendement + cuisson…) per produit
      for (const r of selected) {
        const hasMeta = r.etapes.length > 0 || r.meta.rendement || r.meta.temps_cuisson_min || r.meta.temperature_cuisson || r.meta.conservation;
        if (!hasMeta) continue;
        const payload: any = { produit_id: r.productId, created_by: user?.id };
        if (r.etapes.length) payload.etapes = r.etapes.map((e, i) => `${i + 1}. ${e}`).join('\n');
        if (r.meta.rendement) payload.rendement = r.meta.rendement;
        if (r.meta.rendement_unite) payload.rendement_unite = r.meta.rendement_unite;
        if (r.meta.temps_cuisson_min) payload.temps_cuisson_min = r.meta.temps_cuisson_min;
        if (r.meta.temps_preparation_min) payload.temps_preparation_min = r.meta.temps_preparation_min;
        if (r.meta.temperature_cuisson) payload.temperature_cuisson = r.meta.temperature_cuisson;
        if (r.meta.conservation) payload.conservation = r.meta.conservation;
        await supabase.from('fiches_techniques_meta').upsert(payload, { onConflict: 'produit_id' });
      }
      qc.invalidateQueries({ queryKey: ['fiches_techniques'] });
      qc.invalidateQueries({ queryKey: ['fiches_meta'] });
      qc.invalidateQueries({ queryKey: ['catalogue'] });
      qc.invalidateQueries({ queryKey: ['produits'] });
      toast.success(`Import OK : ${rows.length} ingrédient(s) sur ${selected.length} fiche(s)`);
      setPreviewOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error('Erreur import : ' + (e.message || ''));
    } finally {
      setImporting(false);
    }
  };


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





  if (selectedProduct && selectedProd) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setSelectedProduct(null)}>← Retour</Button>
            <h1 className="text-xl font-heading font-bold">{selectedProd.nom}</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileDown className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Importer
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportExcel(f); e.target.value = ''; }}
            />
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Ajouter MP</Button>
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

        <FicheMetaPanel produitId={selectedProduct!} coutTotal={coutTotal} />


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

  // ── Export / Import multi-produits depuis la liste ──
  const exportAllFiches = async () => {
    const { data: all } = await supabase.from('fiches_techniques').select('*');
    const rows = (all || []).map((f: any) => {
      const p = products.find(pp => pp.id === f.produit_id);
      return {
        Produit: p?.nom || '(inconnu)',
        Catégorie: p?.categorie || '',
        'Matière première': f.matiere_premiere,
        Quantité: f.quantite_mp,
        Unité: f.unite_mp,
        'Coût unitaire': f.cout_unitaire_mp,
        'Coût total': f.quantite_mp * f.cout_unitaire_mp,
      };
    });
    exportToExcel(rows, 'fiches_techniques_completes', 'Fiches');
  };

  const importAllFiches = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const norm = (s: any) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const parseNum = (v: any) => {
        const m = String(v ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/);
        return m ? parseFloat(m[0]) : 0;
      };
      const collected: any[] = [];

      const detectedSheets: string[] = [];
      const skippedSheets: string[] = [];

      for (const sn of wb.SheetNames) {
        const grid: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
        let headerIdx = -1, colProduit = -1, colNom = -1, colQte = -1, colUnite = -1, colCout = -1;
        // 1) Détecte un bloc méta clé/valeur "PRODUIT" | "<nom>" placé au-dessus de l'en-tête
        let metaProductName = '';
        for (let i = 0; i < Math.min(grid.length, 50); i++) {
          const row = grid[i] || [];
          for (let j = 0; j < row.length; j++) {
            const key = norm(row[j]);
            if (key === 'produit' || key === 'recette' || key === 'nom du produit' || key === 'article') {
              for (let k = j + 1; k < row.length; k++) {
                const v = String(row[k] ?? '').trim();
                if (v) { metaProductName = v; break; }
              }
              if (metaProductName) break;
            }
          }
          if (metaProductName) break;
        }
        for (let i = 0; i < Math.min(grid.length, 50); i++) {
          const row = (grid[i] || []).map(norm);
          const ing = row.findIndex(c => c.includes('ingredient') || c.includes('matiere') || c === 'nom' || c.includes('designation'));
          if (ing < 0) continue;
          const qte = row.findIndex(c => c.includes('qte') || c.includes('quantite') || c === 'q');
          headerIdx = i;
          colNom = ing;
          colQte = qte >= 0 ? qte : ing + 1;
          colUnite = row.findIndex(c => c.includes('unite') || c === 'u' || c === 'um');
          colCout = row.findIndex(c => c.includes('cout') || c.includes('prix') || c.includes('pu'));
          colProduit = row.findIndex(c => c.includes('produit') || c.includes('recette') || c.includes('article'));
          break;
        }
        if (headerIdx < 0) { skippedSheets.push(sn); continue; }
        const matchProduct = (name: string) =>
          products.find(p => norm(p.nom) === norm(name)) ||
          products.find(p => norm(name).includes(norm(p.nom)) || norm(p.nom).includes(norm(name)));
        const productFromSheet = matchProduct(sn) || (metaProductName ? matchProduct(metaProductName) : undefined);
        let sheetCount = 0;
        for (let i = headerIdx + 1; i < grid.length; i++) {
          const row = grid[i] || [];
          const nom = String(row[colNom] ?? '').trim();
          if (!nom) continue;
          if (norm(nom).includes('ingredient') || norm(nom).includes('total')) continue;
          const prodName = colProduit >= 0 ? String(row[colProduit] ?? '').trim() : '';
          const prod = prodName
            ? (products.find(p => norm(p.nom) === norm(prodName))
              || products.find(p => norm(p.nom).includes(norm(prodName)) || norm(prodName).includes(norm(p.nom))))
            : productFromSheet;
          if (!prod) continue;
          const mp = mps.find(m => norm(m.nom) === norm(nom))
            || mps.find(m => norm(m.nom).includes(norm(nom)) || norm(nom).includes(norm(m.nom)));
          collected.push({
            produit_id: prod.id,
            matiere_premiere_id: mp?.id || null,
            matiere_premiere: nom,
            quantite_mp: parseNum(row[colQte]),
            unite_mp: String((colUnite >= 0 ? row[colUnite] : '') || mp?.unite || 'G').trim().toUpperCase(),
            cout_unitaire_mp: colCout >= 0 ? parseNum(row[colCout]) : (mp?.prix_unitaire || 0),
            created_by: user?.id,
          });
          sheetCount++;
        }
        if (sheetCount > 0) detectedSheets.push(`${sn} (${sheetCount})`);
        else skippedSheets.push(sn);
      }
      if (collected.length === 0) {
        toast.warning(
          `Aucun ingrédient importé. Onglets ignorés : ${skippedSheets.join(', ') || '(aucun)'}. ` +
          `Vérifiez : nom d'onglet = nom du produit, ou ajoutez une colonne PRODUIT. ` +
          `En-têtes acceptés : INGREDIENT / QTE / UNITE.`,
          { duration: 9000 }
        );
        return;
      }
      const { error } = await supabase.from('fiches_techniques').insert(collected);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['fiches_techniques'] });
      qc.invalidateQueries({ queryKey: ['catalogue'] });
      qc.invalidateQueries({ queryKey: ['produits'] });
      toast.success(`${collected.length} ingrédient(s) importé(s) sur ${new Set(collected.map(c => c.produit_id)).size} produit(s)`);
    } catch (e: any) {
      console.error(e);
      toast.error('Erreur import : ' + (e.message || 'Format invalide'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Fiches Techniques
        </h1>
        <div className="flex gap-2 flex-wrap items-center">
          <Button variant="outline" size="sm" onClick={exportAllFiches}>
            <FileDown className="h-4 w-4 mr-1" /> Exporter Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => listFileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Importer Excel
          </Button>
          <input ref={listFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importAllFiches(f); e.target.value = ''; }} />
          <SearchFilter value={search} onChange={setSearch} className="w-56" />
        </div>
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
