import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, TrendingDown, Package, ChefHat, ShoppingCart, AlertTriangle, ArrowRight, TrendingUp, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, startOfWeek, endOfWeek, subDays, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

const COLORS = ['hsl(33, 45%, 56%)', 'hsl(142, 50%, 45%)', 'hsl(0, 60%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(220, 50%, 50%)'];

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const prevWeekStart = format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const prevWeekEnd = format(endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'));

  const { data: transfersToday = [] } = useQuery({
    queryKey: ['transfers-today'],
    queryFn: async () => {
      const { data } = await supabase.from('bons_transfert').select('id').eq('date_transfert', today);
      return data || [];
    },
  });

  const { data: weeklyLosses = [] } = useQuery({
    queryKey: ['weekly-losses'],
    queryFn: async () => {
      const { data } = await supabase.from('pertes').select('type_labo, quantite').gte('semaine_debut', weekStart).lte('semaine_debut', weekEnd);
      return data || [];
    },
  });

  const { data: weekProduction = [] } = useQuery({
    queryKey: ['week-production'],
    queryFn: async () => {
      const { data } = await supabase.from('production_labo').select('date_production, qte_produite, qte_sortie_en_salle, qte_perte, produit_id, produits(nom)').gte('date_production', last7[0]).lte('date_production', last7[6]);
      return data || [];
    },
  });

  const { data: weekCloture = [] } = useQuery({
    queryKey: ['week-cloture'],
    queryFn: async () => {
      const { data } = await supabase.from('cloture_journaliere').select('date_cloture, qte_vendue, qte_invendu, qte_perte, prix_invendu_50, produit_id, produits(nom)').gte('date_cloture', last7[0]).lte('date_cloture', last7[6]);
      return data || [];
    },
  });

  const { data: monthAchats = [] } = useQuery({
    queryKey: ['month-achats'],
    queryFn: async () => {
      const monthStart = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const { data } = await supabase.from('achats_mp').select('prix_total, date_achat').gte('date_achat', monthStart);
      return data || [];
    },
  });

  const { data: recentBons = [] } = useQuery({
    queryKey: ['recent-bons'],
    queryFn: async () => {
      const { data } = await supabase.from('bons_transfert').select('id, date_transfert, statut, created_at').order('created_at', { ascending: false }).limit(5);
      return data || [];
    },
  });

  const totalLosses = weeklyLosses.reduce((s: number, l: any) => s + (l.quantite || 0), 0);
  const totalAchats = monthAchats.reduce((s: number, a: any) => s + (a.prix_total || 0), 0);
  const totalProd = weekProduction.reduce((s: number, p: any) => s + (p.qte_produite || 0), 0);
  const totalVendu = weekCloture.reduce((s: number, c: any) => s + (c.qte_vendue || 0), 0);
  const totalSortie = weekProduction.reduce((s: number, p: any) => s + (p.qte_sortie_en_salle || 0), 0);
  const totalInvendu = weekCloture.reduce((s: number, c: any) => s + (c.qte_invendu || 0), 0);
  const totalPertesCloture = weekCloture.reduce((s: number, c: any) => s + (c.qte_perte || 0), 0);

  // Trend data
  const trendData = last7.map(d => {
    const dayProd = weekProduction.filter((p: any) => p.date_production === d);
    const dayClo = weekCloture.filter((c: any) => c.date_cloture === d);
    return {
      date: format(new Date(d), 'dd/MM'),
      production: dayProd.reduce((s: number, p: any) => s + (p.qte_produite || 0), 0),
      ventes: dayClo.reduce((s: number, c: any) => s + (c.qte_vendue || 0), 0),
      pertes: dayClo.reduce((s: number, c: any) => s + (c.qte_perte || 0), 0),
    };
  });

  // Reconciliation
  const reconcData = [
    { name: 'Vendu', value: totalVendu, color: COLORS[1] },
    { name: 'Invendu', value: totalInvendu, color: COLORS[3] },
    { name: 'Pertes Salle', value: totalPertesCloture, color: COLORS[2] },
    { name: 'Pertes Labo', value: totalLosses, color: 'hsl(0, 40%, 65%)' },
  ].filter(d => d.value > 0);

  const lossChartData = ['labo_patisserie', 'labo_viennoiserie', 'cuisine_salee'].map(lab => ({
    name: lab === 'labo_patisserie' ? 'Pâtisserie' : lab === 'labo_viennoiserie' ? 'Viennoiserie' : 'Cuisine',
    total: weeklyLosses.filter((l: any) => l.type_labo === lab).reduce((s: number, l: any) => s + (l.quantite || 0), 0),
  }));

  // Alerts
  const alerts: { message: string; type: 'warning' | 'danger' }[] = [];
  if (totalLosses > 20) alerts.push({ message: `⚠️ Pertes élevées cette semaine : ${totalLosses} unités`, type: 'danger' });
  if (totalProd > 0 && totalSortie / totalProd < 0.7) alerts.push({ message: `⚠️ Seulement ${Math.round(totalSortie / totalProd * 100)}% de la production arrive en salle`, type: 'warning' });
  if (totalVendu > 0 && totalInvendu / totalVendu > 0.2) alerts.push({ message: `⚠️ Taux d'invendus élevé : ${Math.round(totalInvendu / totalVendu * 100)}%`, type: 'warning' });

  const statusLabel: Record<string, string> = { brouillon: 'Brouillon', livre: 'Livré', recu: 'Reçu', cloture: 'Clôturé' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">Tableau de bord</h1>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 p-3 rounded-lg text-sm ${a.type === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Transferts auj.</CardTitle><FileText className="h-4 w-4 text-primary" /></CardHeader><CardContent><p className="text-2xl font-bold">{transfersToday.length}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Pertes (sem.)</CardTitle><TrendingDown className="h-4 w-4 text-destructive" /></CardHeader><CardContent><p className="text-2xl font-bold">{totalLosses}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Production (sem.)</CardTitle><ChefHat className="h-4 w-4 text-primary" /></CardHeader><CardContent><p className="text-2xl font-bold">{totalProd}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Achats MP (mois)</CardTitle><ShoppingCart className="h-4 w-4 text-primary" /></CardHeader><CardContent><p className="text-lg font-bold">{totalAchats.toLocaleString('fr-FR')} <span className="text-xs text-muted-foreground">FCFA</span></p></CardContent></Card>
      </div>

      {/* Reconciliation Flow */}
      <Card>
        <CardHeader><CardTitle className="text-base">Réconciliation (7 jours)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-2 text-center text-sm">
            <div className="bg-primary/10 rounded-lg p-3 min-w-[100px]">
              <p className="text-2xl font-bold text-primary">{totalProd}</p>
              <p className="text-xs text-muted-foreground">Produit</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <div className="bg-primary/10 rounded-lg p-3 min-w-[100px]">
              <p className="text-2xl font-bold text-primary">{totalSortie}</p>
              <p className="text-xs text-muted-foreground">→ Salle</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <div className="bg-green-500/10 rounded-lg p-3 min-w-[100px]">
              <p className="text-2xl font-bold text-green-600">{totalVendu}</p>
              <p className="text-xs text-muted-foreground">Vendu</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <div className="bg-warning/10 rounded-lg p-3 min-w-[100px]">
              <p className="text-2xl font-bold text-warning">{totalInvendu}</p>
              <p className="text-xs text-muted-foreground">Invendu</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <div className="bg-destructive/10 rounded-lg p-3 min-w-[100px]">
              <p className="text-2xl font-bold text-destructive">{totalLosses + totalPertesCloture}</p>
              <p className="text-xs text-muted-foreground">Pertes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Production vs Ventes (7j)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="production" stroke="hsl(33, 45%, 56%)" strokeWidth={2} name="Production" />
                <Line type="monotone" dataKey="ventes" stroke="hsl(142, 50%, 45%)" strokeWidth={2} name="Ventes" />
                <Line type="monotone" dataKey="pertes" stroke="hsl(0, 60%, 50%)" strokeWidth={2} name="Pertes" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Répartition (semaine)</CardTitle></CardHeader>
          <CardContent className="h-64">
            {reconcData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={reconcData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {reconcData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Pas de données cette semaine</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Pertes par labo (semaine)</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lossChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(33, 45%, 56%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Activité récente</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentBons.map((bon: any) => (
                <div key={bon.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">Bon #{bon.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(bon.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                  <Badge variant="secondary">{statusLabel[bon.statut] || bon.statut}</Badge>
                </div>
              ))}
              {recentBons.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité récente</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
