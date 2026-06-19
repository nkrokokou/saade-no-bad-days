import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { exportToExcel, exportToPDF } from '@/hooks/useExcelImportExport';
import { Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#C49A5A', '#2C1A0E', '#8B5E3C', '#D4B483', '#5C3A1E', '#A67C52'];

const PAYMENT_LABELS: Record<string, string> = {
  especes: 'Espèces', mobile_money: 'Mobile Money', carte: 'Carte', credit: 'Crédit', ticket: 'Ticket',
};

export default function Ventes() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [selectedVenteId, setSelectedVenteId] = useState<string | null>(null);
  const [kpiDetail, setKpiDetail] = useState<null | 'ca' | 'tickets' | 'panier' | 'articles'>(null);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [topSearch, setTopSearch] = useState('');

  const { data: ventes = [] } = useQuery({
    queryKey: ['ventes', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from('ventes').select('*, vente_lignes(*)')
        .gte('date_vente', from + 'T00:00:00').lte('date_vente', to + 'T23:59:59')
        .eq('statut', 'validee').order('date_vente', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: allProduits = [] } = useQuery({
    queryKey: ['produits-min'],
    queryFn: async () => {
      const { data } = await supabase.from('produits').select('id, nom, categorie, prix_vente').order('nom');
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const totalCA = ventes.reduce((s, v) => s + Number(v.total), 0);
    const nbTickets = ventes.length;
    const panierMoyen = nbTickets ? totalCA / nbTickets : 0;
    const allLines = ventes.flatMap(v => v.vente_lignes || []);
    const qteTotal = allLines.reduce((s, l) => s + Number(l.quantite), 0);

    // Par jour
    const byDay: Record<string, number> = {};
    ventes.forEach(v => {
      const d = String(v.date_vente).slice(0, 10);
      byDay[d] = (byDay[d] || 0) + Number(v.total);
    });
    const dailyChart = Object.entries(byDay).sort().map(([date, total]) => ({ date: date.slice(5), total }));
    const dailyFull = Object.entries(byDay).sort().map(([date, total]) => ({ date, total }));

    // Par produit (vendus seulement)
    const byProd: Record<string, { id: string; nom: string; qte: number; ca: number }> = {};
    allLines.forEach(l => {
      const key = l.produit_id || l.produit_nom;
      if (!byProd[key]) byProd[key] = { id: l.produit_id, nom: l.produit_nom, qte: 0, ca: 0 };
      byProd[key].qte += Number(l.quantite);
      byProd[key].ca += Number(l.total_ligne);
    });
    const sortedSold = Object.values(byProd).sort((a, b) => b.ca - a.ca);
    const topProduits = sortedSold.slice(0, 20);

    // Tous les produits (catalogue + ventes), jamais vendus inclus
    const allProductsRanked = allProduits.map((p: any) => {
      const v = byProd[p.id] || byProd[p.nom];
      return { id: p.id, nom: p.nom, categorie: p.categorie, qte: v?.qte || 0, ca: v?.ca || 0 };
    }).sort((a: any, b: any) => b.qte - a.qte || b.ca - a.ca || a.nom.localeCompare(b.nom));

    // Par mode paiement
    const byPay: Record<string, number> = {};
    ventes.forEach(v => { byPay[v.mode_paiement] = (byPay[v.mode_paiement] || 0) + Number(v.total); });
    const paymentChart = Object.entries(byPay).map(([k, v]) => ({ name: PAYMENT_LABELS[k] || k, value: v }));

    // Par heure
    const byHour: Record<number, number> = {};
    for (let i = 6; i < 24; i++) byHour[i] = 0;
    ventes.forEach(v => { const h = new Date(v.date_vente).getHours(); byHour[h] = (byHour[h] || 0) + 1; });
    const hourChart = Object.entries(byHour).map(([h, n]) => ({ heure: `${h}h`, nb: n }));

    // Par catégorie (depuis allLines + lookup catégorie)
    const catLookup: Record<string, string> = {};
    allProduits.forEach((p: any) => { catLookup[p.id] = p.categorie || 'Autre'; });
    const byCat: Record<string, number> = {};
    allLines.forEach((l: any) => {
      const c = catLookup[l.produit_id] || 'Autre';
      byCat[c] = (byCat[c] || 0) + Number(l.total_ligne);
    });

    return { totalCA, nbTickets, panierMoyen, qteTotal, dailyChart, dailyFull, topProduits, sortedSold, allProductsRanked, paymentChart, hourChart, byPay, byCat };
  }, [ventes, allProduits]);

  const exportVentes = () => {
    exportToExcel(ventes.map(v => ({
      Ticket: v.numero_ticket, Date: new Date(v.date_vente).toLocaleString('fr-FR'),
      Client: v.client_nom || '', Mode: PAYMENT_LABELS[v.mode_paiement], Total: v.total, Remise: v.remise_globale,
    })), `ventes_${from}_${to}`);
  };

  const visibleTopProducts = useMemo(() => {
    const base = showAllProducts ? stats.allProductsRanked : stats.topProduits;
    if (!topSearch) return base;
    const s = topSearch.toLowerCase();
    return base.filter((p: any) => p.nom.toLowerCase().includes(s));
  }, [showAllProducts, stats.topProduits, stats.allProductsRanked, topSearch]);

  const exportTopPDF = () => {
    const label = showAllProducts ? `Produits ${from} → ${to} (tous)` : `Top 20 produits ${from} → ${to}`;
    exportToPDF(label, ['#', 'Produit', 'Quantité', 'CA (F)'],
      visibleTopProducts.map((p: any, i: number) => [i + 1, p.nom, p.qte, p.ca.toLocaleString()]));
  };
  const exportTopExcel = () => {
    exportToExcel(
      visibleTopProducts.map((p: any, i: number) => ({ Rang: i + 1, Produit: p.nom, Quantité: p.qte, 'CA (F)': p.ca, 'Jamais vendu': p.qte === 0 ? 'OUI' : '' })),
      showAllProducts ? `produits_complet_${from}_${to}` : `top20_${from}_${to}`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h1 className="text-2xl font-heading font-bold">Ventes & Rapports</h1>
          <p className="text-sm text-muted-foreground">Analyse stratégique de vos ventes</p>
        </div>
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">Du</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Au</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button variant="outline" size="sm" onClick={exportVentes}><Download className="h-4 w-4 mr-1" />Excel</Button>
        </div>
      </div>

      {/* KPI cliquables */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi title="Chiffre d'affaires" value={`${stats.totalCA.toLocaleString()} F`} onClick={() => setKpiDetail('ca')} />
        <Kpi title="Nombre de tickets" value={stats.nbTickets.toLocaleString()} onClick={() => setKpiDetail('tickets')} />
        <Kpi title="Panier moyen" value={`${Math.round(stats.panierMoyen).toLocaleString()} F`} onClick={() => setKpiDetail('panier')} />
        <Kpi title="Articles vendus" value={stats.qteTotal.toLocaleString()} onClick={() => setKpiDetail('articles')} />
      </div>

      <Tabs defaultValue="evolution">
        <TabsList>
          <TabsTrigger value="evolution">Évolution</TabsTrigger>
          <TabsTrigger value="top">Top produits</TabsTrigger>
          <TabsTrigger value="paiement">Paiements</TabsTrigger>
          <TabsTrigger value="heures">Heures de pointe</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="evolution">
          <Card><CardContent className="p-4">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={stats.dailyChart}>
                <XAxis dataKey="date" /><YAxis /><Tooltip formatter={(v: any) => `${v.toLocaleString()} F`} />
                <Line type="monotone" dataKey="total" stroke="#C49A5A" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="top">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <CardTitle className="text-base">{showAllProducts ? 'Tous les produits (du + vendu au jamais vendu)' : 'Top 20 produits'}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{visibleTopProducts.length} produits affichés</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Input value={topSearch} onChange={e => setTopSearch(e.target.value)} placeholder="Rechercher…" className="h-9 w-44" />
                <Button size="sm" variant="outline" onClick={exportTopExcel}><Download className="h-4 w-4 mr-1" />Excel</Button>
                <Button size="sm" variant="outline" onClick={exportTopPDF}><Download className="h-4 w-4 mr-1" />PDF</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Produit</TableHead><TableHead className="text-right">Quantité</TableHead><TableHead className="text-right">CA</TableHead></TableRow></TableHeader>
                <TableBody>{visibleTopProducts.map((p: any, i: number) => (
                  <TableRow key={p.id || i} className={p.qte === 0 ? 'text-muted-foreground' : ''}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{p.nom} {p.qte === 0 && <Badge variant="outline" className="ml-2 text-[10px]">Jamais vendu</Badge>}</TableCell>
                    <TableCell className="text-right">{p.qte}</TableCell>
                    <TableCell className="text-right">{p.ca.toLocaleString()} F</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              <div className="flex justify-center pt-4">
                <Button variant="outline" size="sm" onClick={() => setShowAllProducts(v => !v)}>
                  {showAllProducts ? 'Revenir au Top 20' : `Voir plus (tous les produits, jamais vendus compris)`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paiement">
          <Card><CardContent className="p-4">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={stats.paymentChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e: any) => `${e.name}: ${e.value.toLocaleString()} F`}>
                  {stats.paymentChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="heures">
          <Card><CardContent className="p-4">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={stats.hourChart}>
                <XAxis dataKey="heure" /><YAxis /><Tooltip />
                <Bar dataKey="nb" fill="#C49A5A" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="journal">
          <Card><CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Ticket</TableHead><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Paiement</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>{ventes.slice(0, 100).map(v => (
                <TableRow key={v.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedVenteId(v.id)}>
                  <TableCell>#{v.numero_ticket}</TableCell>
                  <TableCell>{new Date(v.date_vente).toLocaleString('fr-FR')}</TableCell>
                  <TableCell>{v.client_nom || '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{PAYMENT_LABELS[v.mode_paiement]}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{Number(v.total).toLocaleString()} F</TableCell>
                  <TableCell><Eye className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <TicketDetailDialog venteId={selectedVenteId} onClose={() => setSelectedVenteId(null)} />
      <KpiDetailDialog
        type={kpiDetail}
        onClose={() => setKpiDetail(null)}
        ventes={ventes}
        stats={stats}
        from={from}
        to={to}
        onOpenTicket={(id) => { setKpiDetail(null); setSelectedVenteId(id); }}
      />
    </div>
  );
}

function TicketDetailDialog({ venteId, onClose }: { venteId: string | null; onClose: () => void }) {
  const { data: vente, isLoading } = useQuery({
    queryKey: ['vente-detail', venteId],
    enabled: !!venteId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ventes')
        .select('*, vente_lignes(*, vente_ligne_options(*)), clients(nom, telephone), tables_restaurant(numero, zone)')
        .eq('id', venteId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const exportTicketPDF = () => {
    if (!vente) return;
    const rows: (string | number)[][] = [];
    (vente.vente_lignes || []).forEach((l: any) => {
      rows.push([l.produit_nom, Number(l.quantite), `${Number(l.prix_unitaire).toLocaleString()} F`, `${Number(l.total_ligne).toLocaleString()} F`]);
      (l.vente_ligne_options || []).forEach((o: any) => {
        rows.push([`  + ${o.groupe_nom}: ${o.item_libelle}`, '', o.prix_supplement ? `+${Number(o.prix_supplement).toLocaleString()} F` : '', '']);
      });
    });
    exportToPDF(`Ticket #${vente.numero_ticket}`, ['Produit', 'Qté', 'PU', 'Total'], rows);
  };

  return (
    <Dialog open={!!venteId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {vente ? `Ticket #${vente.numero_ticket}` : 'Détails du ticket'}
          </DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
        {vente && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Date" value={format(new Date(vente.date_vente), 'dd/MM/yyyy HH:mm:ss')} />
              <Info label="Statut" value={<Badge variant="outline">{vente.statut}</Badge>} />
              <Info label="Client" value={vente.client_nom || vente.clients?.nom || '—'} />
              <Info label="Téléphone" value={vente.clients?.telephone || '—'} />
              <Info label="Table" value={vente.tables_restaurant ? `${vente.tables_restaurant.numero}${vente.tables_restaurant.zone ? ' (' + vente.tables_restaurant.zone + ')' : ''}` : '—'} />
              <Info label="Mode de paiement" value={<Badge variant="secondary">{PAYMENT_LABELS[vente.mode_paiement] || vente.mode_paiement}</Badge>} />
              <Info label="Montant reçu" value={`${Number(vente.montant_recu || 0).toLocaleString()} F`} />
              <Info label="Rendu" value={`${Number(vente.rendu || 0).toLocaleString()} F`} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Articles</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">PU</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(vente.vente_lignes || []).flatMap((l: any) => {
                    const rows = [
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.produit_nom}</TableCell>
                        <TableCell className="text-right">{Number(l.quantite)}</TableCell>
                        <TableCell className="text-right">{Number(l.prix_unitaire).toLocaleString()} F</TableCell>
                        <TableCell className="text-right font-medium">{Number(l.total_ligne).toLocaleString()} F</TableCell>
                      </TableRow>,
                      ...(l.vente_ligne_options || []).map((o: any) => (
                        <TableRow key={o.id} className="text-xs text-muted-foreground">
                          <TableCell className="pl-6">+ {o.groupe_nom}: {o.item_libelle}</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right">{o.prix_supplement ? `+${Number(o.prix_supplement).toLocaleString()} F` : '—'}</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )),
                    ];
                    if (Number(l.remise) > 0) {
                      rows.push(
                        <TableRow key={l.id + '-r'} className="text-xs text-destructive">
                          <TableCell className="pl-6">Remise ligne</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right">−{Number(l.remise).toLocaleString()} F</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      );
                    }
                    return rows;
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="border-t pt-3 space-y-1 text-sm">
              {Number(vente.remise_globale) > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Remise globale</span>
                  <span>−{Number(vente.remise_globale).toLocaleString()} F</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{Number(vente.total).toLocaleString()} F</span>
              </div>
            </div>

            {vente.notes && (
              <div className="bg-muted/40 rounded p-2 text-xs">
                <p className="font-semibold mb-1">Notes</p>
                <p>{vente.notes}</p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={exportTicketPDF} disabled={!vente}>
            <Download className="h-4 w-4 mr-1" />Export PDF
          </Button>
          <Button size="sm" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </CardContent></Card>
  );
}
