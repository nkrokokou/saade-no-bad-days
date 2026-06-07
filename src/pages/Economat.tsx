import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { SearchFilter } from '@/components/SearchFilter';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ExcelImportExport } from '@/components/ExcelImportExport';
import { exportToExcel, exportToPDF, parseExcelAllSheets } from '@/hooks/useExcelImportExport';
import { toast } from 'sonner';
import { Warehouse, Plus, ArrowDownToLine, AlertTriangle, Trash2, Boxes, TrendingDown, Package } from 'lucide-react';

type StockRow = {
  id: string; categorie: string; nom: string; unite: string; prix_unitaire: number;
  stock_initial: number; stock_min: number; actif: boolean;
  total_entrees: number; total_sorties: number; total_pertes: number;
  stock_courant: number; valeur_stock: number;
};

const TYPE_LABELS: Record<string, string> = {
  entree: 'Entrée', sortie: 'Sortie', perte: 'Perte / Avarie', inventaire: 'Inventaire',
};

export default function Economat() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categorieFilter, setCategorieFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showMouv, setShowMouv] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<any | null>(null);

  const [newArt, setNewArt] = useState({ categorie: '', nom: '', unite: 'G', prix_unitaire: 0, stock_initial: 0, stock_min: 0 });
  const [mouv, setMouv] = useState({ article_id: '', type: 'entree' as 'entree'|'sortie'|'perte', quantite: 0, motif: '', date_mouvement: new Date().toISOString().slice(0, 10) });

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['v_economat_stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_economat_stock' as any).select('*').order('categorie').order('nom');
      if (error) throw error;
      return (data || []) as unknown as StockRow[];
    },
  });

  const { data: mouvements = [] } = useQuery({
    queryKey: ['economat_mouvements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('economat_mouvements').select('*, economat_articles(nom, unite)').order('date_mouvement', { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const categories = useMemo(() => Array.from(new Set(stock.map(s => s.categorie))).sort(), [stock]);

  const filtered = useMemo(() => {
    let rows = stock;
    if (categorieFilter !== 'all') rows = rows.filter(r => r.categorie === categorieFilter);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(r => r.nom.toLowerCase().includes(s) || r.categorie.toLowerCase().includes(s));
    }
    return rows;
  }, [stock, search, categorieFilter]);

  const totals = useMemo(() => ({
    nb: stock.length,
    valeur: stock.reduce((s, r) => s + (Number(r.valeur_stock) || 0), 0),
    pertes: stock.reduce((s, r) => s + (Number(r.total_pertes) || 0) * (Number(r.prix_unitaire) || 0), 0),
    alertes: stock.filter(r => Number(r.stock_courant) <= Number(r.stock_min) && Number(r.stock_min) > 0).length,
  }), [stock]);

  const addArticle = useMutation({
    mutationFn: async () => {
      if (!newArt.nom.trim()) throw new Error('Nom requis');
      const { error } = await supabase.from('economat_articles').insert({
        categorie: newArt.categorie.trim() || 'DIVERS',
        nom: newArt.nom.trim(),
        unite: newArt.unite || 'G',
        prix_unitaire: newArt.prix_unitaire || 0,
        stock_initial: newArt.stock_initial || 0,
        stock_min: newArt.stock_min || 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['v_economat_stock'] });
      setShowAdd(false);
      setNewArt({ categorie: '', nom: '', unite: 'G', prix_unitaire: 0, stock_initial: 0, stock_min: 0 });
      toast.success('Article ajouté');
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  });

  const updateArticle = useMutation({
    mutationFn: async () => {
      const { id, ...rest } = editingArticle;
      const { error } = await supabase.from('economat_articles').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['v_economat_stock'] });
      setEditingArticle(null);
      toast.success('Article modifié');
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  });

  const addMouv = useMutation({
    mutationFn: async () => {
      if (!mouv.article_id) throw new Error('Choisir un article');
      if (!mouv.quantite || mouv.quantite <= 0) throw new Error('Quantité > 0 requise');
      const { error } = await supabase.from('economat_mouvements').insert({
        article_id: mouv.article_id,
        type: mouv.type,
        quantite: mouv.quantite,
        motif: mouv.motif || '',
        date_mouvement: mouv.date_mouvement,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['v_economat_stock'] });
      qc.invalidateQueries({ queryKey: ['economat_mouvements'] });
      setShowMouv(false);
      setMouv({ article_id: '', type: 'entree', quantite: 0, motif: '', date_mouvement: new Date().toISOString().slice(0, 10) });
      toast.success('Mouvement enregistré');
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  });

  const deleteArticle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('economat_articles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['v_economat_stock'] });
      setDeleteId(null);
      toast.success('Article supprimé');
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  });

  const handleExport = () => {
    exportToExcel(stock.map(s => ({
      'Catégorie': s.categorie, 'Désignation': s.nom, 'Unité': s.unite,
      'Stock initial': s.stock_initial, 'Entrées': s.total_entrees, 'Sorties': s.total_sorties,
      'Pertes': s.total_pertes, 'Stock final': s.stock_courant,
      'Prix unitaire': s.prix_unitaire, 'Valeur totale': s.valeur_stock,
      'Stock min': s.stock_min,
    })), 'economat_stock');
  };

  const handleExportPDF = () => {
    exportToPDF('Économat — État des stocks',
      ['Catégorie', 'Désignation', 'Unité', 'Stock', 'P.U.', 'Valeur'],
      stock.map(s => [s.categorie, s.nom, s.unite, s.stock_courant, s.prix_unitaire, s.valeur_stock]));
  };

  const handleImport = async (file: File) => {
    try {
      const sheets = await parseExcelAllSheets(file);
      const rows = sheets[0]?.rows || [];
      if (!rows.length) { toast.warning('Fichier vide'); return; }
      let currentCat = 'DIVERS';
      const articles: any[] = [];
      for (const r of rows) {
        const nom = String(r['MATIERES/DESIGNATION'] || r['Désignation'] || r['Designation'] || r['Nom'] || '').trim();
        if (!nom) continue;
        const initial = Number(r['SOTCKS INITIAL'] || r['STOCKS INITIAL'] || r['Stock initial'] || 0);
        const unite = String(r['UNITE/G'] || r['Unité'] || r['Unite'] || '').trim();
        const pu = Number(r['PRIX UNITAIRE'] || r['Prix unitaire'] || 0);
        // Ligne d'en-tête de catégorie : pas d'unité ni de prix → on stocke comme catégorie courante
        if (!initial && !unite && !pu && nom === nom.toUpperCase()) {
          currentCat = nom;
          continue;
        }
        articles.push({
          categorie: currentCat, nom, unite: unite || 'G',
          stock_initial: initial, prix_unitaire: pu, stock_min: 0, actif: true,
        });
      }
      if (!articles.length) { toast.warning('Aucun article à importer'); return; }
      // Upsert par (categorie, nom)
      const { error } = await supabase.from('economat_articles').upsert(articles, { onConflict: 'categorie,nom' } as any);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['v_economat_stock'] });
      toast.success(`${articles.length} articles importés / mis à jour`);
    } catch (e: any) {
      toast.error(`Import : ${e?.message || 'Erreur'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Warehouse className="h-6 w-6 text-primary" /> Économat
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={showMouv} onOpenChange={setShowMouv}>
            <DialogTrigger asChild>
              <Button variant="secondary"><ArrowDownToLine className="h-4 w-4 mr-1" /> Mouvement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouveau mouvement de stock</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Article</Label>
                  <Select value={mouv.article_id} onValueChange={v => setMouv(p => ({ ...p, article_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir un article…" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {stock.map(s => <SelectItem key={s.id} value={s.id}>{s.nom} ({s.categorie})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={mouv.type} onValueChange={(v: any) => setMouv(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entree">Entrée (réception, achat)</SelectItem>
                      <SelectItem value="sortie">Sortie (consommation, transfert)</SelectItem>
                      <SelectItem value="perte">Perte / Avarie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Quantité</Label><Input type="number" value={mouv.quantite || ''} onChange={e => setMouv(p => ({ ...p, quantite: parseFloat(e.target.value) || 0 }))} /></div>
                  <div><Label>Date</Label><Input type="date" value={mouv.date_mouvement} onChange={e => setMouv(p => ({ ...p, date_mouvement: e.target.value }))} /></div>
                </div>
                <div><Label>Motif / Notes</Label><Input value={mouv.motif} onChange={e => setMouv(p => ({ ...p, motif: e.target.value }))} placeholder="Ex : livraison fournisseur, transfert cuisine…" /></div>
                <Button className="w-full" onClick={() => addMouv.mutate()} disabled={addMouv.isPending}>{addMouv.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Nouvel article</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvel article économat</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Catégorie</Label>
                  <Input list="econ-cats" value={newArt.categorie} onChange={e => setNewArt(p => ({ ...p, categorie: e.target.value }))} placeholder="Ex : FRUITS ET LEGUMES" />
                  <datalist id="econ-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div><Label>Nom</Label><Input value={newArt.nom} onChange={e => setNewArt(p => ({ ...p, nom: e.target.value }))} /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Unité</Label><Input value={newArt.unite} onChange={e => setNewArt(p => ({ ...p, unite: e.target.value }))} /></div>
                  <div><Label>Prix unit.</Label><Input type="number" value={newArt.prix_unitaire || ''} onChange={e => setNewArt(p => ({ ...p, prix_unitaire: parseFloat(e.target.value) || 0 }))} /></div>
                  <div><Label>Stock min</Label><Input type="number" value={newArt.stock_min || ''} onChange={e => setNewArt(p => ({ ...p, stock_min: parseFloat(e.target.value) || 0 }))} /></div>
                </div>
                <div><Label>Stock initial</Label><Input type="number" value={newArt.stock_initial || ''} onChange={e => setNewArt(p => ({ ...p, stock_initial: parseFloat(e.target.value) || 0 }))} /></div>
                <Button className="w-full" onClick={() => addArticle.mutate()} disabled={addArticle.isPending}>{addArticle.isPending ? 'Ajout…' : 'Ajouter'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Articles</p><p className="text-xl font-bold">{totals.nb}</p></div><Boxes className="h-5 w-5 text-primary" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Valeur stock</p><p className="text-xl font-bold">{totals.valeur.toLocaleString('fr-FR')} F</p></div><Package className="h-5 w-5 text-primary" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Pertes (FCFA)</p><p className="text-xl font-bold text-destructive">{totals.pertes.toLocaleString('fr-FR')}</p></div><TrendingDown className="h-5 w-5 text-destructive" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Alertes stock</p><p className="text-xl font-bold text-orange-600">{totals.alertes}</p></div><AlertTriangle className="h-5 w-5 text-orange-600" /></div></CardContent></Card>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <SearchFilter value={search} onChange={setSearch} placeholder="Rechercher un article…" className="w-64" />
            <Select value={categorieFilter} onValueChange={setCategorieFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead className="text-right">Initial</TableHead>
                    <TableHead className="text-right">Entrées</TableHead>
                    <TableHead className="text-right">Sorties</TableHead>
                    <TableHead className="text-right">Pertes</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">P.U.</TableHead>
                    <TableHead className="text-right">Valeur</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>}
                  {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Aucun article</TableCell></TableRow>}
                  {filtered.map(r => {
                    const alert = Number(r.stock_courant) <= Number(r.stock_min) && Number(r.stock_min) > 0;
                    return (
                      <TableRow key={r.id} className={alert ? 'bg-orange-50 dark:bg-orange-950/20' : ''}>
                        <TableCell><Badge variant="outline" className="text-xs">{r.categorie}</Badge></TableCell>
                        <TableCell className="font-medium">{r.nom}{alert && <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-orange-600" />}</TableCell>
                        <TableCell className="text-xs">{r.unite}</TableCell>
                        <TableCell className="text-right">{Number(r.stock_initial).toLocaleString('fr-FR')}</TableCell>
                        <TableCell className="text-right text-green-600">{Number(r.total_entrees).toLocaleString('fr-FR')}</TableCell>
                        <TableCell className="text-right">{Number(r.total_sorties).toLocaleString('fr-FR')}</TableCell>
                        <TableCell className="text-right text-destructive">{Number(r.total_pertes).toLocaleString('fr-FR')}</TableCell>
                        <TableCell className="text-right font-bold">{Number(r.stock_courant).toLocaleString('fr-FR')}</TableCell>
                        <TableCell className="text-right">{Number(r.prix_unitaire).toLocaleString('fr-FR')}</TableCell>
                        <TableCell className="text-right font-medium">{Number(r.valeur_stock).toLocaleString('fr-FR')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingArticle({ id: r.id, categorie: r.categorie, nom: r.nom, unite: r.unite, prix_unitaire: r.prix_unitaire, stock_min: r.stock_min, stock_initial: r.stock_initial })}>Éditer</Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mouvements">
          <Card>
            <CardHeader><CardTitle className="text-base">Historique des mouvements (200 derniers)</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Date</TableHead><TableHead>Article</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qté</TableHead><TableHead>Motif</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {mouvements.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun mouvement</TableCell></TableRow>}
                  {mouvements.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{m.date_mouvement}</TableCell>
                      <TableCell>{m.economat_articles?.nom || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={m.type === 'entree' ? 'default' : m.type === 'perte' ? 'destructive' : 'secondary'}>{TYPE_LABELS[m.type] || m.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{Number(m.quantite).toLocaleString('fr-FR')} {m.economat_articles?.unite}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.motif}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit article dialog */}
      <Dialog open={!!editingArticle} onOpenChange={v => !v && setEditingArticle(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'article</DialogTitle></DialogHeader>
          {editingArticle && (
            <div className="space-y-3">
              <div><Label>Catégorie</Label><Input value={editingArticle.categorie} onChange={e => setEditingArticle((p: any) => ({ ...p, categorie: e.target.value }))} /></div>
              <div><Label>Nom</Label><Input value={editingArticle.nom} onChange={e => setEditingArticle((p: any) => ({ ...p, nom: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Unité</Label><Input value={editingArticle.unite} onChange={e => setEditingArticle((p: any) => ({ ...p, unite: e.target.value }))} /></div>
                <div><Label>Prix unit.</Label><Input type="number" value={editingArticle.prix_unitaire || ''} onChange={e => setEditingArticle((p: any) => ({ ...p, prix_unitaire: parseFloat(e.target.value) || 0 }))} /></div>
                <div><Label>Stock min</Label><Input type="number" value={editingArticle.stock_min || ''} onChange={e => setEditingArticle((p: any) => ({ ...p, stock_min: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
              <div><Label>Stock initial</Label><Input type="number" value={editingArticle.stock_initial || ''} onChange={e => setEditingArticle((p: any) => ({ ...p, stock_initial: parseFloat(e.target.value) || 0 }))} /></div>
              <Button className="w-full" onClick={() => updateArticle.mutate()} disabled={updateArticle.isPending}>{updateArticle.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Supprimer cet article ?" description="Tous les mouvements liés seront aussi supprimés." destructive onConfirm={() => deleteId && deleteArticle.mutate(deleteId)} />
    </div>
  );
}
