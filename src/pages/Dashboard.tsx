import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, TrendingDown, Package, Activity, ShoppingCart, DollarSign, ChefHat } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const COLORS = ['hsl(33, 45%, 56%)', 'hsl(33, 45%, 40%)', 'hsl(33, 45%, 70%)', 'hsl(20, 50%, 50%)', 'hsl(45, 60%, 55%)'];

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
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
      const { data } = await supabase.from('pertes')
        .select('type_labo, quantite')
        .gte('semaine_debut', weekStart).lte('semaine_debut', weekEnd);
      return data || [];
    },
  });

  const { data: weekProduction = [] } = useQuery({
    queryKey: ['week-production'],
    queryFn: async () => {
      const { data } = await supabase.from('production_labo')
        .select('date_production, qte_produite, qte_sortie_en_salle, qte_perte')
        .gte('date_production', last7[0]).lte('date_production', last7[6]);
      return data || [];
    },
  });

  const { data: weekCloture = [] } = useQuery({
    queryKey: ['week-cloture'],
    queryFn: async () => {
      const { data } = await supabase.from('cloture_journaliere')
        .select('date_cloture, qte_vendue, qte_invendu, qte_perte, prix_invendu_50')
        .gte('date_cloture', last7[0]).lte('date_cloture', last7[6]);
      return data || [];
    },
  });

  const { data: monthAchats = [] } = useQuery({
    queryKey: ['month-achats'],
    queryFn: async () => {
      const monthStart = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const { data } = await supabase.from('achats_mp').select('prix_total, date_achat')
        .gte('date_achat', monthStart);
      return data || [];
    },
  });

  const { data: recentBons = [] } = useQuery({
    queryKey: ['recent-bons'],
    queryFn: async () => {
      const { data } = await supabase.from('bons_transfert')
        .select('id, date_transfert, statut, created_at')
        .order('created_at', { ascending: false }).limit(5);
      return data || [];
    },
  });

  const totalLosses = weeklyLosses.reduce((s: number, l: any) => s + (l.quantite || 0), 0);
  const totalAchats = monthAchats.reduce((s: number, a: any) => s + (a.prix_total || 0), 0);
  const totalProd = weekProduction.reduce((s: number, p: any) => s + (p.qte_produite || 0), 0);
  const totalVendu = weekCloture.reduce((s: number, c: any) => s + (c.qte_vendue || 0), 0);

  const lossChartData = ['labo_patisserie', 'labo_viennoiserie', 'cuisine_salee'].map(lab => ({
    name: lab === 'labo_patisserie' ? 'Pâtisserie' : lab === 'labo_viennoiserie' ? 'Viennoiserie' : 'Cuisine',
    total: weeklyLosses.filter((l: any) => l.type_labo === lab).reduce((s: number, l: any) => s + (l.quantite || 0), 0),
  }));

  // Production vs Ventes trend
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

  // Reconciliation pie
  const reconcData = [
    { name: 'Vendu', value: totalVendu },
    { name: 'Pertes', value: totalLosses },
    { name: 'Invendus', value: weekCloture.reduce((s: number, c: any) => s + (c.qte_invendu || 0), 0) },
  ].filter(d => d.value > 0);

  const statusLabel: Record<string, string> = { brouillon: 'Brouillon', livre: 'Livré', recu: 'Reçu', cloture: 'Clôturé' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">Tableau de bord</h1>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Transferts auj.</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{transfersToday.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pertes (sem.)</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalLosses}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Production (sem.)</CardTitle>
            <ChefHat className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalProd}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Achats MP (mois)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-lg font-bold">{totalAchats.toLocaleString('fr-FR')} <span className="text-xs text-muted-foreground">FCFA</span></p></CardContent>
        </Card>
      </div>

      {/* Charts row */}
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
                    {reconcData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                  <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                    {statusLabel[bon.statut] || bon.statut}
                  </span>
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
