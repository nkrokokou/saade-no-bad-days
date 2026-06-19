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

function Kpi({ title, value, onClick }: { title: string; value: string | number; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left group focus:outline-none focus:ring-2 focus:ring-primary rounded-lg" disabled={!onClick}>
      <Card className={onClick ? 'transition hover:border-primary hover:shadow-md cursor-pointer' : ''}>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center justify-between">
            {title}
            {onClick && <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />}
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        </CardContent>
      </Card>
    </button>
  );
}

function KpiDetailDialog({ type, onClose, ventes, stats, from, to, onOpenTicket }: {
  type: 'ca' | 'tickets' | 'panier' | 'articles' | null;
  onClose: () => void;
  ventes: any[];
  stats: any;
  from: string;
  to: string;
  onOpenTicket: (id: string) => void;
}) {
  const titles: Record<string, string> = {
    ca: "Détail du chiffre d'affaires", tickets: 'Liste des tickets',
    panier: 'Détail du panier moyen', articles: 'Articles vendus',
  };
  if (!type) return null;

  const exportCurrent = (kind: 'excel' | 'pdf') => {
    if (type === 'ca') {
      const rows = stats.dailyFull.map((d: any) => ({ Date: d.date, 'CA (F)': d.total }));
      const payRows = Object.entries(stats.byPay).map(([k, v]: any) => ({ Mode: PAYMENT_LABELS[k] || k, 'CA (F)': v }));
      const catRows = Object.entries(stats.byCat).map(([k, v]: any) => ({ Catégorie: k, 'CA (F)': v }));
      if (kind === 'excel') {
        exportToExcel([...rows, {}, ...payRows.map(p => ({ Date: 'Paiement: ' + p.Mode, 'CA (F)': p['CA (F)'] })), {}, ...catRows.map(c => ({ Date: 'Catégorie: ' + c.Catégorie, 'CA (F)': c['CA (F)'] }))], `CA_${from}_${to}`);
      } else {
        exportToPDF(`CA du ${from} au ${to}`, ['Détail', 'CA (F)'], [
          ...rows.map((r: any) => [r.Date, r['CA (F)'].toLocaleString()]),
          ...payRows.map(p => [`Paiement: ${p.Mode}`, (p['CA (F)'] as number).toLocaleString()]),
          ...catRows.map(c => [`Catégorie: ${c.Catégorie}`, (c['CA (F)'] as number).toLocaleString()]),
        ]);
      }
    } else if (type === 'tickets') {
      const rows = ventes.map(v => ({ Ticket: v.numero_ticket, Date: new Date(v.date_vente).toLocaleString('fr-FR'), Client: v.client_nom || '', Paiement: PAYMENT_LABELS[v.mode_paiement] || v.mode_paiement, 'Total (F)': v.total }));
      if (kind === 'excel') exportToExcel(rows, `tickets_${from}_${to}`);
      else exportToPDF(`Tickets ${from} → ${to}`, ['Ticket', 'Date', 'Client', 'Paiement', 'Total'], rows.map(r => [`#${r.Ticket}`, r.Date, r.Client, r.Paiement, `${(r['Total (F)'] as number).toLocaleString()} F`]));
    } else if (type === 'panier') {
      const sorted = [...ventes].sort((a, b) => Number(b.total) - Number(a.total));
      const rows = sorted.map(v => ({ Ticket: v.numero_ticket, Date: new Date(v.date_vente).toLocaleString('fr-FR'), 'Total (F)': v.total }));
      if (kind === 'excel') exportToExcel(rows, `panier_${from}_${to}`);
      else exportToPDF(`Panier moyen ${from} → ${to}`, ['Ticket', 'Date', 'Total'], rows.map(r => [`#${r.Ticket}`, r.Date, `${(r['Total (F)'] as number).toLocaleString()} F`]));
    } else if (type === 'articles') {
      const rows = stats.sortedSold.map((p: any, i: number) => ({ Rang: i + 1, Produit: p.nom, Quantité: p.qte, 'CA (F)': p.ca }));
      if (kind === 'excel') exportToExcel(rows, `articles_vendus_${from}_${to}`);
      else exportToPDF(`Articles vendus ${from} → ${to}`, ['#', 'Produit', 'Qté', 'CA'], rows.map((r: any) => [r.Rang, r.Produit, r.Quantité, `${(r['CA (F)'] as number).toLocaleString()} F`]));
    }
  };

  // Computed views
  const sortedByAmount = useMemo(() => [...ventes].sort((a, b) => Number(b.total) - Number(a.total)), [ventes]);
  const medianTicket = useMemo(() => {
    if (!ventes.length) return 0;
    const arr = ventes.map(v => Number(v.total)).sort((a, b) => a - b);
    return arr[Math.floor(arr.length / 2)];
  }, [ventes]);

  return (
    <Dialog open={!!type} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titles[type]} · {from} → {to}</DialogTitle>
        </DialogHeader>

        {type === 'ca' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="CA total" value={<span className="text-lg font-bold text-primary">{stats.totalCA.toLocaleString()} F</span>} />
              <Info label="Période" value={`${stats.dailyFull.length} jours avec ventes`} />
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Par jour</h4>
              <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">CA</TableHead></TableRow></TableHeader>
                <TableBody>{stats.dailyFull.map((d: any) => (
                  <TableRow key={d.date}><TableCell>{d.date}</TableCell><TableCell className="text-right font-medium">{Number(d.total).toLocaleString()} F</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Par mode de paiement</h4>
                <Table><TableBody>{Object.entries(stats.byPay).map(([k, v]: any) => (
                  <TableRow key={k}><TableCell>{PAYMENT_LABELS[k] || k}</TableCell><TableCell className="text-right">{Number(v).toLocaleString()} F</TableCell></TableRow>
                ))}</TableBody></Table>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Par catégorie</h4>
                <Table><TableBody>{Object.entries(stats.byCat).map(([k, v]: any) => (
                  <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">{Number(v).toLocaleString()} F</TableCell></TableRow>
                ))}</TableBody></Table>
              </div>
            </div>
          </div>
        )}

        {type === 'tickets' && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">{ventes.length} tickets · clique sur une ligne pour ouvrir le détail</p>
            <Table>
              <TableHeader><TableRow><TableHead>Ticket</TableHead><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Paiement</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{ventes.map(v => (
                <TableRow key={v.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpenTicket(v.id)}>
                  <TableCell>#{v.numero_ticket}</TableCell>
                  <TableCell className="text-xs">{new Date(v.date_vente).toLocaleString('fr-FR')}</TableCell>
                  <TableCell>{v.client_nom || '—'}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{PAYMENT_LABELS[v.mode_paiement] || v.mode_paiement}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{Number(v.total).toLocaleString()} F</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        )}

        {type === 'panier' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Info label="Min" value={`${Math.min(...(ventes.length ? ventes.map(v => Number(v.total)) : [0])).toLocaleString()} F`} />
              <Info label="Médiane" value={`${Math.round(medianTicket).toLocaleString()} F`} />
              <Info label="Max" value={`${Math.max(...(ventes.length ? ventes.map(v => Number(v.total)) : [0])).toLocaleString()} F`} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Top 10 plus gros tickets</h4>
                <Table><TableBody>{sortedByAmount.slice(0, 10).map(v => (
                  <TableRow key={v.id} className="cursor-pointer" onClick={() => onOpenTicket(v.id)}>
                    <TableCell>#{v.numero_ticket}</TableCell>
                    <TableCell className="text-right">{Number(v.total).toLocaleString()} F</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Top 10 plus petits</h4>
                <Table><TableBody>{[...sortedByAmount].reverse().slice(0, 10).map(v => (
                  <TableRow key={v.id} className="cursor-pointer" onClick={() => onOpenTicket(v.id)}>
                    <TableCell>#{v.numero_ticket}</TableCell>
                    <TableCell className="text-right">{Number(v.total).toLocaleString()} F</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
              </div>
            </div>
          </div>
        )}

        {type === 'articles' && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">{stats.qteTotal.toLocaleString()} articles vendus · {stats.sortedSold.length} produits distincts</p>
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Produit</TableHead><TableHead className="text-right">Qté</TableHead><TableHead className="text-right">CA</TableHead></TableRow></TableHeader>
              <TableBody>{stats.sortedSold.map((p: any, i: number) => (
                <TableRow key={p.id || i}><TableCell>{i + 1}</TableCell><TableCell>{p.nom}</TableCell><TableCell className="text-right">{p.qte}</TableCell><TableCell className="text-right">{p.ca.toLocaleString()} F</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCurrent('excel')}><Download className="h-4 w-4 mr-1" />Excel</Button>
          <Button variant="outline" size="sm" onClick={() => exportCurrent('pdf')}><Download className="h-4 w-4 mr-1" />PDF</Button>
          <Button size="sm" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
