import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCardClickable } from '@/components/KpiCardClickable';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Warehouse, AlertTriangle, TrendingUp, Package, History, BarChart3, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, addDays, parseISO } from 'date-fns';
import { exportToExcel } from '@/hooks/useExcelImportExport';
import { SearchFilter } from '@/components/SearchFilter';

type MpStock = {
  id: string; nom: string; unite: string; fournisseur: string | null;
  prix_unitaire: number; stock_min: number;
  total_achete: number; total_consomme: number; stock_actuel: number;
  valeur_stock: number; derniere_entree: string | null; derniere_sortie: string | null;
  conso_30j: number; alerte_stock: boolean; a_anomalies: boolean;
};

type Mvt = {
  id: string; matiere_premiere_id: string; date_mouvement: string; type: string;
  quantite: number; source_table: string | null; source_id: string | null;
  stock_avant: number | null; stock_apres: number | null;
  regularisation_requise: boolean; resolved_at: string | null;
  motif: string | null; created_at: string;
  matieres_premieres?: { nom: string; unite: string };
};

const typeLabel: Record<string, string> = {
  achat: 'Achat', conso_labo: 'Conso Labo', conso_minute: 'Conso Minute',
  perte: 'Perte', ajustement: 'Ajustement', inventaire: 'Inventaire',
};

const typeBadge: Record<string, string> = {
  achat: 'bg-green-100 text-green-800',
  conso_labo: 'bg-blue-100 text-blue-800',
  conso_minute: 'bg-purple-100 text-purple-800',
  perte: 'bg-red-100 text-red-800',
  ajustement: 'bg-orange-100 text-orange-800',
  inventaire: 'bg-gray-100 text-gray-800',
};

export default function SuiviStock() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [filterFournisseur, setFilterFournisseur] = useState('all');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [adjustOpen, setAdjustOpen] = useState<MpStock | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustMotif, setAdjustMotif] = useState('');
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');

  const { data: mps = [] } = useQuery({
    queryKey: ['v_mp_stock'],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_mp_stock' as any).select('*');
      if (error) throw error;
      return ((data || []) as unknown) as MpStock[];
    },
  });

  const { data: mvts = [] } = useQuery({
    queryKey: ['mp_mouvements_recent'],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from('mp_mouvements' as any)
        .select('*, matieres_premieres(nom, unite)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return ((data || []) as unknown) as Mvt[];
    },
  });

  const { data: anomalies = [] } = useQuery({
    queryKey: ['mp_anomalies'],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from('mp_mouvements' as any)
        .select('*, matieres_premieres(nom, unite)')
        .eq('regularisation_requise', true)
        .is('resolved_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as unknown) as Mvt[];
    },
  });

  const { data: produitsLabo = [] } = useQuery({
    queryKey: ['produits_labo_stock', selectedDate],
    queryFn: async () => {
      const today = selectedDate;
      const [prods, prod, pertes, mvt] = await Promise.all([
        supabase.from('produits').select('id, nom, categorie, type_production, actif').eq('actif', true),
        supabase.from('production_labo').select('produit_id, qte_produite, qte_sortie_en_salle, qte_perte').eq('date_production', today),
        supabase.from('pertes').select('produit_id, quantite').eq('jour', today),
        supabase.from('mouvements_stock').select('produit_id, type, quantite').eq('date_mouvement', today),
      ]);
      const produitsLabo = (prods.data || []).filter((p: any) => p.type_production === 'labo');
      return produitsLabo.map((p: any) => {
        const pr = (prod.data || []).find((x: any) => x.produit_id === p.id);
        const pe = (pertes.data || []).filter((x: any) => x.produit_id === p.id).reduce((s: number, x: any) => s + Number(x.quantite || 0), 0);
        const mv = (mvt.data || []).filter((x: any) => x.produit_id === p.id);
        const entrees = mv.filter((x: any) => x.type === 'entree').reduce((s: number, x: any) => s + Number(x.quantite || 0), 0);
        const sorties = mv.filter((x: any) => x.type === 'sortie').reduce((s: number, x: any) => s + Number(x.quantite || 0), 0);
        const produit = Number(pr?.qte_produite || 0);
        const sortieSalle = Number(pr?.qte_sortie_en_salle || 0);
        const perteLabo = Number(pr?.qte_perte || 0);
        return {
          id: p.id, nom: p.nom, categorie: p.categorie,
          produit, sortieSalle, perteLabo, pertesAutres: pe,
          entrees, sorties,
          stockTheorique: produit - sortieSalle - perteLabo + entrees - sorties - pe,
        };
      });
    },
  });

  const fournisseurs = useMemo(() => Array.from(new Set(mps.map(m => m.fournisseur).filter(Boolean))).sort() as string[], [mps]);

  const filteredMps = useMemo(() => {
    const s = search.toLowerCase();
    return mps.filter(m =>
      (filterFournisseur === 'all' || m.fournisseur === filterFournisseur) &&
      (!s || m.nom.toLowerCase().includes(s))
    );
  }, [mps, search, filterFournisseur]);

  // KPIs
  const totalValeur = mps.reduce((s, m) => s + Number(m.valeur_stock || 0), 0);
  const nbAlertes = mps.filter(m => m.alerte_stock).length;
  const nbAnomalies = anomalies.length;
  const top5Ruptures = [...mps].filter(m => m.stock_actuel < 0).sort((a, b) => a.stock_actuel - b.stock_actuel).slice(0, 5);
  const dormantes = mps.filter(m => m.stock_actuel > 0 && m.conso_30j === 0);
  const rotation = mps.filter(m => m.stock_actuel > 0).map(m => ({ ...m, jours: m.conso_30j > 0 ? Math.round((m.stock_actuel / m.conso_30j) * 30) : 999 })).sort((a, b) => a.jours - b.jours);

  const ajusterMut = useMutation({
    mutationFn: async () => {
      if (!adjustOpen) return;
      const stockActuel = adjustOpen.stock_actuel;
      const ecart = adjustQty - stockActuel;
      const { error } = await supabase.from('mp_mouvements' as any).insert({
        matiere_premiere_id: adjustOpen.id,
        date_mouvement: format(new Date(), 'yyyy-MM-dd'),
        type: 'ajustement',
        quantite: ecart,
        stock_avant: stockActuel,
        stock_apres: adjustQty,
        motif: adjustMotif || `Ajustement manuel (stock physique: ${adjustQty})`,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Stock ajusté');
      qc.invalidateQueries({ queryKey: ['v_mp_stock'] });
      qc.invalidateQueries({ queryKey: ['mp_mouvements_recent'] });
      setAdjustOpen(null); setAdjustQty(0); setAdjustMotif('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resolveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('mp_mouvements' as any).update({
        resolved_at: new Date().toISOString(), resolved_by: user?.id,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Anomalie marquée résolue');
      qc.invalidateQueries({ queryKey: ['mp_anomalies'] });
      qc.invalidateQueries({ queryKey: ['mp_mouvements_recent'] });
    },
  });

  const exportMouvements = () => {
    exportToExcel(mvts.map(m => ({
      Date: m.date_mouvement, Type: typeLabel[m.type], MP: m.matieres_premieres?.nom || '',
      Quantité: m.quantite, Unité: m.matieres_premieres?.unite || '',
      'Stock avant': m.stock_avant, 'Stock après': m.stock_apres, Motif: m.motif || '',
    })), `mp_mouvements_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const exportStock = () => {
    exportToExcel(mps.map(m => ({
      MP: m.nom, Fournisseur: m.fournisseur, Stock: m.stock_actuel, Unité: m.unite,
      'Seuil min': m.stock_min, 'Valeur (F)': m.valeur_stock,
      'Conso 30j': m.conso_30j, Alerte: m.alerte_stock ? 'OUI' : '',
      Anomalies: m.a_anomalies ? 'OUI' : '',
    })), `stock_mp_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Warehouse className="h-6 w-6 text-primary" /> Suivi de Stock
        </h1>
        <Badge variant="outline" className="gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Stock & anomalies : temps réel
        </Badge>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="py-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-2">Date du snapshot</span>
          <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="date" className="w-44" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          <Button variant="ghost" size="icon" disabled={isToday} onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" variant={isToday ? 'default' : 'outline'} onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}>Aujourd'hui</Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}>Hier</Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'))}>-7 j</Button>
          {!isToday && <Badge variant="secondary" className="ml-2 text-[10px]">Onglet Produits Labo basé sur cette date</Badge>}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-1" />Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="mp"><Package className="h-4 w-4 mr-1" />MP temps réel</TabsTrigger>
          <TabsTrigger value="labo">Produits Labo</TabsTrigger>
          <TabsTrigger value="anomalies" className="relative">
            <AlertTriangle className="h-4 w-4 mr-1" />Anomalies
            {nbAnomalies > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{nbAnomalies}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />Historique</TabsTrigger>
          <TabsTrigger value="rotation"><TrendingUp className="h-4 w-4 mr-1" />Rotation</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Valeur stock MP</p>
              <p className="text-2xl font-bold">{totalValeur.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">MP en alerte</p>
              <p className="text-2xl font-bold text-orange-600">{nbAlertes}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Anomalies à régulariser</p>
              <p className="text-2xl font-bold text-destructive">{nbAnomalies}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">MP dormantes (30j)</p>
              <p className="text-2xl font-bold">{dormantes.length}</p>
            </CardContent></Card>
          </div>

          {top5Ruptures.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />Top 5 Ruptures</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {top5Ruptures.map(m => (
                    <div key={m.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <span className="font-medium">{m.nom}</span>
                      <span className="font-mono text-destructive">{m.stock_actuel.toFixed(2)} {m.unite}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* MP TEMPS RÉEL */}
        <TabsContent value="mp" className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <SearchFilter value={search} onChange={setSearch} className="w-48" />
            <Select value={filterFournisseur} onValueChange={setFilterFournisseur}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous fournisseurs</SelectItem>
                {fournisseurs.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportStock}><Download className="h-4 w-4 mr-1" />Export</Button>
          </div>
          <Card><CardContent className="pt-4 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>MP</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Seuil</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
                <TableHead className="text-right">Conso 30j</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredMps.map(m => (
                  <TableRow key={m.id} className={m.stock_actuel < 0 ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">{m.nom}<div className="text-xs text-muted-foreground">{m.fournisseur}</div></TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${m.stock_actuel < 0 ? 'text-destructive' : m.alerte_stock ? 'text-orange-600' : ''}`}>
                      {Number(m.stock_actuel).toFixed(2)} {m.unite}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{m.stock_min || '—'}</TableCell>
                    <TableCell className="text-right">{Number(m.valeur_stock).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F</TableCell>
                    <TableCell className="text-right text-xs">{Number(m.conso_30j).toFixed(1)}</TableCell>
                    <TableCell>
                      {m.stock_actuel < 0 && <Badge variant="destructive" className="text-[10px]">Négatif</Badge>}
                      {m.stock_actuel >= 0 && m.alerte_stock && <Badge className="text-[10px] bg-orange-500">Alerte</Badge>}
                      {m.a_anomalies && <Badge variant="destructive" className="text-[10px] ml-1">Anomalie</Badge>}
                      {!m.alerte_stock && !m.a_anomalies && m.stock_actuel > 0 && <Badge variant="outline" className="text-[10px]">OK</Badge>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <a href={`/mp/${m.id}/cycle`} title="Cycle de vie complet">
                        <Button size="sm" variant="ghost" className="text-primary">📈 Cycle</Button>
                      </a>
                      <Button size="sm" variant="ghost" onClick={() => { setAdjustOpen(m); setAdjustQty(Number(m.stock_actuel)); }}>Ajuster</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* LABO */}
        <TabsContent value="labo" className="space-y-3">
          <Card><CardContent className="pt-4 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Produit</TableHead>
                <TableHead className="text-right">Sortie salle</TableHead>
                <TableHead className="text-right">Pertes</TableHead>
                <TableHead className="text-right">Stock théo.</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {produitsLabo.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nom}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{p.categorie}</Badge></TableCell>
                    <TableCell className="text-right">{p.produit}</TableCell>
                    <TableCell className="text-right">{p.sortieSalle}</TableCell>
                    <TableCell className="text-right text-destructive">{p.perteLabo + p.pertesAutres}</TableCell>
                    <TableCell className={`text-right font-semibold ${p.stockTheorique < 0 ? 'text-destructive' : ''}`}>{p.stockTheorique}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* ANOMALIES */}
        <TabsContent value="anomalies" className="space-y-3">
          {anomalies.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
              Aucune anomalie à régulariser
            </CardContent></Card>
          ) : (
            <Card><CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>MP</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Stock après</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {anomalies.map(a => (
                    <TableRow key={a.id} className="bg-destructive/5">
                      <TableCell className="text-xs">{format(new Date(a.created_at), 'dd/MM HH:mm')}</TableCell>
                      <TableCell className="font-medium">{a.matieres_premieres?.nom}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-[10px] ${typeBadge[a.type]}`}>{typeLabel[a.type]}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-destructive">{Number(a.stock_apres).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{a.motif}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => resolveMut.mutate(a.id)}>Marquer résolu</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* HISTORIQUE */}
        <TabsContent value="history" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={exportMouvements}><Download className="h-4 w-4 mr-1" />Export</Button>
          </div>
          <Card><CardContent className="pt-4 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Quand</TableHead>
                <TableHead>MP</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Stock après</TableHead>
                <TableHead>Motif</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {mvts.slice(0, 200).map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(m.created_at), 'dd/MM HH:mm')}</TableCell>
                    <TableCell className="font-medium">{m.matieres_premieres?.nom}</TableCell>
                    <TableCell><Badge variant="outline" className={`text-[10px] ${typeBadge[m.type]}`}>{typeLabel[m.type]}</Badge></TableCell>
                    <TableCell className={`text-right font-mono ${m.quantite < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {m.quantite > 0 ? <ArrowDownToLine className="inline h-3 w-3 mr-0.5" /> : <ArrowUpFromLine className="inline h-3 w-3 mr-0.5" />}
                      {Number(m.quantite).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-xs">{m.stock_apres != null ? Number(m.stock_apres).toFixed(2) : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.motif}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* ROTATION */}
        <TabsContent value="rotation" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Couverture stock (jours restants à la conso actuelle)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>MP</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Conso 30j</TableHead>
                  <TableHead className="text-right">Couverture</TableHead>
                  <TableHead>Suggestion</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rotation.slice(0, 30).map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nom}</TableCell>
                      <TableCell className="text-right font-mono">{Number(m.stock_actuel).toFixed(1)} {m.unite}</TableCell>
                      <TableCell className="text-right">{Number(m.conso_30j).toFixed(1)}</TableCell>
                      <TableCell className={`text-right ${m.jours < 7 ? 'text-destructive font-semibold' : m.jours < 14 ? 'text-orange-600' : ''}`}>
                        {m.jours > 365 ? '∞' : `${m.jours} j`}
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.jours < 7 && <Badge variant="destructive">Commander urgemment</Badge>}
                        {m.jours >= 7 && m.jours < 14 && <Badge className="bg-orange-500">À commander</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {dormantes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">MP dormantes (aucune conso 30j)</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {dormantes.map(m => <Badge key={m.id} variant="outline">{m.nom} · {Number(m.stock_actuel).toFixed(1)} {m.unite}</Badge>)}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* DIALOG AJUSTEMENT */}
      <Dialog open={!!adjustOpen} onOpenChange={v => !v && setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajuster {adjustOpen?.nom}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Stock théorique actuel : <strong>{Number(adjustOpen?.stock_actuel || 0).toFixed(2)} {adjustOpen?.unite}</strong></p>
            <div><Label>Stock physique constaté</Label><Input type="number" step="0.01" value={adjustQty} onChange={e => setAdjustQty(Number(e.target.value))} /></div>
            <p className="text-xs text-muted-foreground">Écart enregistré : <strong>{(adjustQty - Number(adjustOpen?.stock_actuel || 0)).toFixed(2)}</strong></p>
            <div><Label>Motif</Label><Input value={adjustMotif} onChange={e => setAdjustMotif(e.target.value)} placeholder="Inventaire, casse, etc." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(null)}>Annuler</Button>
            <Button onClick={() => ajusterMut.mutate()} disabled={ajusterMut.isPending}>Enregistrer ajustement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
