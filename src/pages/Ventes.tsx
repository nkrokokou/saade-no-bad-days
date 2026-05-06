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
import { exportToExcel, exportToPDF } from '@/hooks/useExcelImportExport';
import { Download } from 'lucide-react';
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

    // Par produit
    const byProd: Record<string, { nom: string; qte: number; ca: number }> = {};
    allLines.forEach(l => {
      if (!byProd[l.produit_id]) byProd[l.produit_id] = { nom: l.produit_nom, qte: 0, ca: 0 };
      byProd[l.produit_id].qte += Number(l.quantite);
      byProd[l.produit_id].ca += Number(l.total_ligne);
    });
    const topProduits = Object.values(byProd).sort((a, b) => b.ca - a.ca).slice(0, 20);

    // Par mode paiement
    const byPay: Record<string, number> = {};
    ventes.forEach(v => { byPay[v.mode_paiement] = (byPay[v.mode_paiement] || 0) + Number(v.total); });
    const paymentChart = Object.entries(byPay).map(([k, v]) => ({ name: PAYMENT_LABELS[k] || k, value: v }));

    // Par heure
    const byHour: Record<number, number> = {};
    for (let i = 6; i < 24; i++) byHour[i] = 0;
    ventes.forEach(v => { const h = new Date(v.date_vente).getHours(); byHour[h] = (byHour[h] || 0) + 1; });
    const hourChart = Object.entries(byHour).map(([h, n]) => ({ heure: `${h}h`, nb: n }));

    return { totalCA, nbTickets, panierMoyen, qteTotal, dailyChart, topProduits, paymentChart, hourChart };
  }, [ventes]);

  const exportVentes = () => {
    exportToExcel(ventes.map(v => ({
      Ticket: v.numero_ticket, Date: new Date(v.date_vente).toLocaleString('fr-FR'),
      Client: v.client_nom || '', Mode: PAYMENT_LABELS[v.mode_paiement], Total: v.total, Remise: v.remise_globale,
    })), `ventes_${from}_${to}`);
  };
  const exportTopPDF = () => {
    exportToPDF(`Top produits ${from} → ${to}`, ['Produit', 'Quantité', 'CA (F)'],
      stats.topProduits.map(p => [p.nom, p.qte, p.ca.toLocaleString()]));
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

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi title="Chiffre d'affaires" value={`${stats.totalCA.toLocaleString()} F`} />
        <Kpi title="Nombre de tickets" value={stats.nbTickets.toLocaleString()} />
        <Kpi title="Panier moyen" value={`${Math.round(stats.panierMoyen).toLocaleString()} F`} />
        <Kpi title="Articles vendus" value={stats.qteTotal.toLocaleString()} />
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
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Top 20 produits</CardTitle>
              <Button size="sm" variant="outline" onClick={exportTopPDF}>Export PDF</Button></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Produit</TableHead><TableHead className="text-right">Quantité</TableHead><TableHead className="text-right">CA</TableHead></TableRow></TableHeader>
                <TableBody>{stats.topProduits.map((p, i) => (
                  <TableRow key={i}><TableCell>{i + 1}</TableCell><TableCell>{p.nom}</TableCell><TableCell className="text-right">{p.qte}</TableCell><TableCell className="text-right">{p.ca.toLocaleString()} F</TableCell></TableRow>
                ))}</TableBody>
              </Table>
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
              <TableHeader><TableRow><TableHead>Ticket</TableHead><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Paiement</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{ventes.slice(0, 100).map(v => (
                <TableRow key={v.id}>
                  <TableCell>#{v.numero_ticket}</TableCell>
                  <TableCell>{new Date(v.date_vente).toLocaleString('fr-FR')}</TableCell>
                  <TableCell>{v.client_nom || '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{PAYMENT_LABELS[v.mode_paiement]}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{Number(v.total).toLocaleString()} F</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
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
