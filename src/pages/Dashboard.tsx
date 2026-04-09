import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, TrendingDown, Package, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

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
        .gte('semaine_debut', weekStart)
        .lte('semaine_debut', weekEnd);
      return data || [];
    },
  });

  const { data: recentBons = [] } = useQuery({
    queryKey: ['recent-bons'],
    queryFn: async () => {
      const { data } = await supabase.from('bons_transfert')
        .select('id, date_transfert, statut, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const totalLosses = weeklyLosses.reduce((s: number, l: any) => s + (l.quantite || 0), 0);

  const lossChartData = ['labo_patisserie', 'labo_viennoiserie', 'cuisine_salee'].map(lab => ({
    name: lab === 'labo_patisserie' ? 'Pâtisserie' : lab === 'labo_viennoiserie' ? 'Viennoiserie' : 'Cuisine Salée',
    total: weeklyLosses.filter((l: any) => l.type_labo === lab).reduce((s: number, l: any) => s + (l.quantite || 0), 0),
  }));

  const statusLabel: Record<string, string> = {
    brouillon: 'Brouillon', livre: 'Livré', recu: 'Reçu', cloture: 'Clôturé',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">Tableau de bord</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transferts aujourd'hui</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{transfersToday.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pertes cette semaine</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalLosses}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dernière activité</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-sm">{recentBons[0] ? format(new Date(recentBons[0].created_at), 'dd MMM HH:mm', { locale: fr }) : '—'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Pertes par laboratoire (semaine)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lossChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
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
