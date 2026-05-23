import { useTranslation } from 'react-i18next';
import useSupabaseRealtime from '@/hooks/useSupabaseRealtime';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, TrendingDown, Package, ChefHat, ShoppingCart, AlertTriangle, ArrowRight, TrendingUp, Minus, DollarSign, Receipt, Users, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, CartesianGrid, Legend } from 'recharts';
import { format, startOfWeek, endOfWeek, subDays, subWeeks, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';

import { useState } from 'react';

const COLORS = ['hsl(33, 45%, 56%)', 'hsl(142, 50%, 45%)', 'hsl(0, 60%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(220, 50%, 50%)', 'hsl(280, 50%, 55%)'];

export default function Dashboard() {
  useSupabaseRealtime('ventes', ['ventes']);
  useSupabaseRealtime('pertes', ['pertes']);
  useSupabaseRealtime('production_labo', ['production_labo']);
  useSupabaseRealtime('cloture_journaliere', ['cloture_journaliere']);
  useSupabaseRealtime('bons_transfert', ['transfers-today']);
  const { profile } = useAuth();
  const isCeo = profile?.role === 'ceo';
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const prevWeekStart = format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const prevWeekEnd = format(endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const prevMonthStart = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd');
  const prevMonthEnd = format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd');
  const periodDates = Array.from({ length: days }, (_, i) => format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd'));
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
      const start = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const { data } = await supabase.from('achats_mp').select('prix_total, date_achat').gte('date_achat', start);
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

  // === Sales (POS) data — strategic KPIs ===
  const { data: ventesPeriode = [] } = useQuery({
    queryKey: ['ventes-periode', period],
    queryFn: async () => {
      const start = periodDates[0];
      const { data } = await supabase
        .from('ventes')
        .select('id, total, mode_paiement, created_at, vente_lignes(produit_id, quantite, prix_unitaire, total_ligne, produits(nom, prix_cout))')
        .gte('created_at', start + 'T00:00:00')
        .order('created_at', { ascending: true });
      return data || [];
    },
  });

  const { data: ventesMoisCourant = [] } = useQuery({
    queryKey: ['ventes-mois-courant'],
    queryFn: async () => {
      const { data } = await supabase.from('ventes').select('total, created_at').gte('created_at', monthStart + 'T00:00:00');
      return data || [];
    },
  });

  const { data: ventesMoisPrec = [] } = useQuery({
    queryKey: ['ventes-mois-prec'],
    queryFn: async () => {
      const { data } = await supabase.from('ventes').select('total').gte('created_at', prevMonthStart + 'T00:00:00').lte('created_at', prevMonthEnd + 'T23:59:59');
      return data || [];
    },
  });

  // Comparaisons
  const { data: prevWeekLosses = [] } = useQuery({
    queryKey: ['prev-week-losses'],
    queryFn: async () => {
      const { data } = await supabase.from('pertes').select('quantite').gte('semaine_debut', prevWeekStart).lte('semaine_debut', prevWeekEnd);
      return data || [];
    },
  });
  const { data: prevWeekCloture = [] } = useQuery({
    queryKey: ['prev-week-cloture'],
    queryFn: async () => {
      const { data } = await supabase.from('cloture_journaliere').select('qte_vendue, qte_perte').gte('date_cloture', prevWeekStart).lte('date_cloture', prevWeekEnd);
      return data || [];
    },
  });

  // Aggregations opérationnelles
  const totalLosses = weeklyLosses.reduce((s: number, l: any) => s + (l.quantite || 0), 0);
  const totalAchats = monthAchats.reduce((s: number, a: any) => s + (a.prix_total || 0), 0);
  const totalProd = weekProduction.reduce((s: number, p: any) => s + (p.qte_produite || 0), 0);
  const totalVendu = weekCloture.reduce((s: number, c: any) => s + (c.qte_vendue || 0), 0);
  const totalSortie = weekProduction.reduce((s: number, p: any) => s + (p.qte_sortie_en_salle || 0), 0);
  const totalInvendu = weekCloture.reduce((s: number, c: any) => s + (c.qte_invendu || 0), 0);
  const totalPertesCloture = weekCloture.reduce((s: number, c: any) => s + (c.qte_perte || 0), 0);

  const prevLosses = prevWeekLosses.reduce((s: number, l: any) => s + (l.quantite || 0), 0);
  const prevVendu = prevWeekCloture.reduce((s: number, c: any) => s + (c.qte_vendue || 0), 0);
  const evolLosses = prevLosses === 0 ? 0 : ((totalLosses - prevLosses) / prevLosses) * 100;
  const evolVentes = prevVendu === 0 ? 0 : ((totalVendu - prevVendu) / prevVendu) * 100;

  // === KPIs stratégiques (POS) ===
  const caTotal = ventesPeriode.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
  const nbTickets = ventesPeriode.length;
  const panierMoyen = nbTickets > 0 ? caTotal / nbTickets : 0;

  const caMoisCourant = ventesMoisCourant.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
  const caMoisPrec = ventesMoisPrec.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
  const evolCa = caMoisPrec === 0 ? 0 : ((caMoisCourant - caMoisPrec) / caMoisPrec) * 100;

  // Marge brute estimée
  let revenue = 0, cost = 0;
  ventesPeriode.forEach((v: any) => {
    (v.vente_lignes || []).forEach((l: any) => {
      revenue += Number(l.total_ligne || 0);
      cost += Number(l.quantite || 0) * Number(l.produits?.prix_cout || 0);
    });
  });
  const margeBrute = revenue - cost;
  const tauxMarge = revenue > 0 ? (margeBrute / revenue) * 100 : 0;

  // CA par jour
  const caParJour = periodDates.map(d => {
    const dayVentes = ventesPeriode.filter((v: any) => v.created_at.slice(0, 10) === d);
    return {
      date: format(new Date(d), days > 30 ? 'dd/MM' : 'dd/MM'),
      ca: dayVentes.reduce((s: number, v: any) => s + Number(v.total || 0), 0),
      tickets: dayVentes.length,
    };
  });

  // Top produits par CA
  const produitStats: Record<string, { nom: string; qte: number; ca: number }> = {};
  ventesPeriode.forEach((v: any) => {
    (v.vente_lignes || []).forEach((l: any) => {
      const key = l.produit_id;
      if (!produitStats[key]) produitStats[key] = { nom: l.produits?.nom || '—', qte: 0, ca: 0 };
      produitStats[key].qte += Number(l.quantite || 0);
      produitStats[key].ca += Number(l.total_ligne || 0);
    });
  });
  const topProduits = Object.values(produitStats).sort((a, b) => b.ca - a.ca).slice(0, 8);

  // Mix paiement
  const paiementStats: Record<string, number> = {};
  ventesPeriode.forEach((v: any) => {
    const m = v.mode_paiement || 'autre';
    paiementStats[m] = (paiementStats[m] || 0) + Number(v.total || 0);
  });
  const paiementData = Object.entries(paiementStats).map(([name, value], i) => ({
    name: name === 'especes' ? 'Espèces' : name === 'mobile_money' ? 'Mobile Money' : name === 'carte' ? 'Carte' : name === 'credit' ? 'Crédit' : name === 'ticket' ? 'Tickets' : name,
    value,
    color: COLORS[i % COLORS.length],
  }));

  // Heures de pointe
  const heuresStats: Record<number, number> = {};
  ventesPeriode.forEach((v: any) => {
    const h = new Date(v.created_at).getHours();
    heuresStats[h] = (heuresStats[h] || 0) + 1;
  });
  const heuresData = Array.from({ length: 14 }, (_, i) => i + 7).map(h => ({
    heure: `${h}h`,
    tickets: heuresStats[h] || 0,
  }));

  const Trend = ({ value, inverse = false }: { value: number; inverse?: boolean }) => {
    if (Math.abs(value) < 1) return <span className="text-xs text-muted-foreground flex items-center gap-1"><Minus className="h-3 w-3" /> stable</span>;
    const isUp = value > 0;
    const isGood = inverse ? !isUp : isUp;
    return (
      <span className={`text-xs flex items-center gap-1 ${isGood ? 'text-success' : 'text-destructive'}`}>
        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {value > 0 ? '+' : ''}{value.toFixed(0)}%
      </span>
    );
  };

  // Trend opérationnelle
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

  const alerts: { message: string; type: 'warning' | 'danger' }[] = [];
  if (totalLosses > 20) alerts.push({ message: `Pertes élevées cette semaine : ${totalLosses} unités`, type: 'danger' });
  if (totalProd > 0 && totalSortie / totalProd < 0.7) alerts.push({ message: `Seulement ${Math.round(totalSortie / totalProd * 100)}% de la production arrive en salle`, type: 'warning' });
  if (totalVendu > 0 && totalInvendu / totalVendu > 0.2) alerts.push({ message: `Taux d'invendus élevé : ${Math.round(totalInvendu / totalVendu * 100)}%`, type: 'warning' });
  if (isCeo && tauxMarge > 0 && tauxMarge < 30) alerts.push({ message: `Marge brute faible : ${tauxMarge.toFixed(0)}% (cible >40%)`, type: 'warning' });

  const statusLabel: Record<string, string> = { brouillon: 'Brouillon', livre: 'Livré', recu: 'Reçu', cloture: 'Clôturé' };

  const fmt = (n: number) => n.toLocaleString('fr-FR');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-heading font-bold">Tableau de bord</h1>
        {isCeo && (
          <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
            <TabsList>
              <TabsTrigger value="7d">7 jours</TabsTrigger>
              <TabsTrigger value="30d">30 jours</TabsTrigger>
              <TabsTrigger value="90d">90 jours</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

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

      {/* KPIs stratégiques (CEO) */}
      {isCeo && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">CA ({period})</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{fmt(Math.round(caTotal))} <span className="text-xs text-muted-foreground">FCFA</span></p>
              <Trend value={evolCa} />
              <p className="text-[10px] text-muted-foreground mt-1">vs mois précédent</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Tickets</CardTitle>
              <Receipt className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{nbTickets}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{(nbTickets / days).toFixed(1)} / jour</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Panier moyen</CardTitle>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{fmt(Math.round(panierMoyen))} <span className="text-xs text-muted-foreground">FCFA</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Marge brute</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{tauxMarge.toFixed(0)}%</p>
              <p className="text-[10px] text-muted-foreground mt-1">{fmt(Math.round(margeBrute))} FCFA</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CA évolution + mix paiement */}
      {isCeo && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Évolution du chiffre d'affaires</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={caParJour}>
                  <defs>
                    <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(33, 45%, 56%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(33, 45%, 56%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip formatter={(v: any) => `${fmt(Math.round(v))} FCFA`} />
                  <Area type="monotone" dataKey="ca" stroke="hsl(33, 45%, 56%)" fill="url(#caGrad)" strokeWidth={2} name="CA" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Modes de paiement</CardTitle></CardHeader>
            <CardContent className="h-72">
              {paiementData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paiementData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paiementData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${fmt(Math.round(v))} FCFA`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Aucune vente sur la période</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top produits + heures de pointe */}
      {isCeo && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Top 8 produits (CA)</CardTitle></CardHeader>
            <CardContent className="h-72">
              {topProduits.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProduits} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <YAxis dataKey="nom" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => `${fmt(Math.round(v))} FCFA`} />
                    <Bar dataKey="ca" fill="hsl(33, 45%, 56%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Aucune donnée</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Heures de pointe (tickets)</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heuresData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="heure" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="hsl(142, 50%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* KPIs opérationnels */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Transferts auj.</CardTitle><FileText className="h-4 w-4 text-primary" /></CardHeader><CardContent><p className="text-2xl font-bold">{transfersToday.length}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Pertes (sem.)</CardTitle><TrendingDown className="h-4 w-4 text-destructive" /></CardHeader><CardContent><p className="text-2xl font-bold">{totalLosses}</p><Trend value={evolLosses} inverse /></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Ventes (sem.)</CardTitle><ChefHat className="h-4 w-4 text-primary" /></CardHeader><CardContent><p className="text-2xl font-bold">{totalVendu}</p><Trend value={evolVentes} /></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Achats MP (mois)</CardTitle><ShoppingCart className="h-4 w-4 text-primary" /></CardHeader><CardContent><p className="text-lg font-bold">{fmt(totalAchats)} <span className="text-xs text-muted-foreground">FCFA</span></p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Réconciliation (7 jours)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-2 text-center text-sm">
            <div className="bg-primary/10 rounded-lg p-3 min-w-[100px]"><p className="text-2xl font-bold text-primary">{totalProd}</p><p className="text-xs text-muted-foreground">Produit</p></div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <div className="bg-primary/10 rounded-lg p-3 min-w-[100px]"><p className="text-2xl font-bold text-primary">{totalSortie}</p><p className="text-xs text-muted-foreground">→ Salle</p></div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <div className="bg-green-500/10 rounded-lg p-3 min-w-[100px]"><p className="text-2xl font-bold text-green-600">{totalVendu}</p><p className="text-xs text-muted-foreground">Vendu</p></div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <div className="bg-warning/10 rounded-lg p-3 min-w-[100px]"><p className="text-2xl font-bold text-warning">{totalInvendu}</p><p className="text-xs text-muted-foreground">Invendu</p></div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <div className="bg-destructive/10 rounded-lg p-3 min-w-[100px]"><p className="text-2xl font-bold text-destructive">{totalLosses + totalPertesCloture}</p><p className="text-xs text-muted-foreground">Pertes</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Production vs Ventes (7j)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
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
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
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
