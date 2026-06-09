import { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchFilter } from '@/components/SearchFilter';
import { toast } from 'sonner';
import { BookOpen, Calculator, Upload, FileDown, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToExcel } from '@/hooks/useExcelImportExport';
import { FicheExcelView } from '@/components/FicheExcelView';
import { parseFicheWorkbook, type ParsedFiche } from '@/lib/parseFicheExcel';
import { FicheImportPreviewDialog } from '@/components/FicheImportPreviewDialog';

type MP = { id: string; nom: string; unite: string; prix_unitaire: number };

export default function FichesTechniques() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

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
      // Anti-doublons : supprime d'abord les ingrédients existants pour chaque produit importé
      const productIds = Array.from(new Set(selected.map(r => r.productId)));
      if (productIds.length) {
        const { error: delErr } = await supabase
          .from('fiches_techniques')
          .delete()
          .in('produit_id', productIds);
        if (delErr) throw delErr;
      }

      const rows = selected.flatMap(r => r.ingredients.map((ing, idx) => ({
        produit_id: r.productId,
        section: ing.section || null,
        ordre: idx,
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
      // Upsert meta complète par produit
      for (const r of selected) {
        const payload: any = {
          produit_id: r.productId,
          created_by: user?.id,
          moule: r.meta.moule ?? null,
          taille_longueur: r.meta.taille_longueur ?? null,
          taille_hauteur: r.meta.taille_hauteur ?? null,
          diametre: r.meta.diametre ?? null,
          diametre_secondaire: r.meta.diametre_secondaire ?? null,
          qte_recette: r.meta.qte_recette ?? null,
          rendement: r.meta.rendement ?? null,
          rendement_unite: r.meta.rendement_unite ?? null,
          temps_cuisson_min: r.meta.temps_cuisson_min ?? null,
          temps_preparation_min: r.meta.temps_preparation_min ?? null,
          temperature_cuisson: r.meta.temperature_cuisson ?? null,
          conservation: r.meta.conservation ?? null,
          etapes: r.etapes.length ? r.etapes.map((e, i) => `${i + 1}. ${e}`).join('\n') : null,
        };
        await supabase.from('fiches_techniques_meta').upsert(payload, { onConflict: 'produit_id' });
      }
      qc.invalidateQueries({ queryKey: ['fiches_techniques'] });
      qc.invalidateQueries({ queryKey: ['fiches_meta'] });
      qc.invalidateQueries({ queryKey: ['catalogue'] });
      qc.invalidateQueries({ queryKey: ['produits'] });
      toast.success(`Import OK : ${rows.length} ingrédient(s) sur ${selected.length} fiche(s) (anciennes lignes remplacées)`);
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
        <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
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
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer fiche
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) runImportPreview(f, true); e.target.value = ''; }}
            />
          </div>
        </div>


        <div className="grid gap-3 grid-cols-3 print:hidden">
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Coût de revient</p>
            <p className="text-xl font-bold text-primary">{coutTotal.toLocaleString('fr-FR')} <span className="text-xs">FCFA</span></p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Prix de vente</p>
            <p className="text-xl font-bold">{(selectedProd.prix_vente || 0).toLocaleString('fr-FR')} <span className="text-xs">FCFA</span></p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Marge</p>
            <p className={`text-xl font-bold ${(selectedProd.prix_vente || 0) - coutTotal > 0 ? 'text-green-600' : 'text-destructive'}`}>
              {((selectedProd.prix_vente || 0) - coutTotal).toLocaleString('fr-FR')} <span className="text-xs">FCFA</span>
            </p>
          </CardContent></Card>
        </div>

        <FicheExcelView
          productId={selectedProduct!}
          productName={selectedProd.nom}
          mps={mps}
          userId={user?.id}
        />

        <FicheImportPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          results={previewResults}
          products={products as any}
          isLoading={importing}
          onConfirm={confirmImport}
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
            onChange={e => { const f = e.target.files?.[0]; if (f) runImportPreview(f, false); e.target.value = ''; }} />
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

      <FicheImportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        results={previewResults}
        products={products as any}
        onConfirm={confirmImport}
        isLoading={importing}
      />
    </div>
  );
}
