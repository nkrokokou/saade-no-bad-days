import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import useSupabaseRealtime from '@/hooks/useSupabaseRealtime';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChefHat, TrendingDown, FileText, ArrowRight, BookOpen } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('fr-FR');

interface LaboDashboardProps {
  laboType: 'labo_patisserie' | 'labo_viennoiserie' | 'cuisine_salee';
  title: string;
}

const laboLabel: Record<string, string> = {
  labo_patisserie: 'Pâtisserie',
  labo_viennoiserie: 'Viennoiserie',
  cuisine_salee: 'Cuisine salée',
};

export default function LaboDashboard({ laboType, title }: LaboDashboardProps) {
  useSupabaseRealtime('production_labo', ['labo-prod-jour']);
  useSupabaseRealtime('pertes', ['labo-pertes-sem']);
  useSupabaseRealtime('bons_transfert', ['labo-bons']);

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'));

  const { data: prodJour = [] } = useQuery({
    queryKey: ['labo-prod-jour', laboType],
    queryFn: async () => {
      const { data } = await supabase.from('production_labo').select('id, qte_produite, qte_sortie_en_salle, qte_perte, produits(nom, poste_preparation)').eq('date_production', today);
      return (data || []).filter((p: any) => p.produits?.poste_preparation === laboType);
    },
  });

  const { data: prodSemaine = [] } = useQuery({
    queryKey: ['labo-prod-semaine', laboType],
    queryFn: async () => {
      const { data } = await supabase.from('production_labo').select('date_production, qte_produite, produits(poste_preparation)').gte('date_production', last7[0]).lte('date_production', last7[6]);
      return (data || []).filter((p: any) => p.produits?.poste_preparation === laboType);
    },
  });

  const { data: pertesSemaine = [] } = useQuery({
    queryKey: ['labo-pertes-sem', laboType],
    queryFn: async () => {
      const { data } = await supabase.from('pertes').select('quantite, jour, produits(nom)').eq('type_labo', laboType).gte('semaine_debut', weekStart).lte('semaine_debut', weekEnd);
      return data || [];
    },
  });

  const { data: bonsRecents = [] } = useQuery({
    queryKey: ['labo-bons'],
    queryFn: async () => {
      const { data } = await supabase.from('bons_transfert').select('id, date_transfert, statut, created_at').order('created_at', { ascending: false }).limit(5);
      return data || [];
    },
  });

  const totalProdJour = prodJour.reduce((s: number, p: any) => s + Number(p.qte_produite || 0), 0);
  const totalSortieJour = prodJour.reduce((s: number, p: any) => s + Number(p.qte_sortie_en_salle || 0), 0);
  const totalPertesSem = pertesSemaine.reduce((s: number, p: any) => s + Number(p.quantite || 0), 0);
  const totalProdSem = prodSemaine.reduce((s: number, p: any) => s + Number(p.qte_produite || 0), 0);

  const statusLabel: Record<string, string> = { brouillon: 'Brouillon', livre: 'Livré', recu: 'Reçu', cloture: 'Clôturé' };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-heading font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{laboLabel[laboType]} · {format(new Date(), 'dd/MM/yyyy')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/fiches-techniques"><BookOpen className="h-4 w-4 mr-1" />Fiches</Link></Button>
          <Button asChild size="sm" className="gradient-primary"><Link to="/production"><ChefHat className="h-4 w-4 mr-1" />Production</Link></Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Production aujourd'hui</CardTitle>
            <ChefHat className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(totalProdJour)}</p><p className="text-[10px] text-muted-foreground">unités</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Envoyé en salle</CardTitle>
            <ArrowRight className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(totalSortieJour)}</p><p className="text-[10px] text-muted-foreground">unités</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Pertes (semaine)</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(totalPertesSem)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Production (semaine)</CardTitle>
            <ChefHat className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(totalProdSem)}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between flex-row">
            <CardTitle className="text-base">Production du jour</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/production">Voir <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent>
            {prodJour.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune production saisie aujourd'hui</p>
            ) : (
              <div className="space-y-2">
                {prodJour.slice(0, 8).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                    <span className="truncate">{p.produits?.nom}</span>
                    <span className="font-medium">{p.qte_produite}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between flex-row">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Bons de transfert récents</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/bons-transfert">Voir <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent>
            {bonsRecents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun bon récent</p>
            ) : (
              <div className="space-y-2">
                {bonsRecents.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="font-medium">Bon #{b.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(b.created_at), 'dd/MM HH:mm')}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{statusLabel[b.statut] || b.statut}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {pertesSemaine.length > 0 && (
        <Card>
          <CardHeader className="flex items-center justify-between flex-row">
            <CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" />Pertes de la semaine</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/pertes">Voir <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pertesSemaine.slice(0, 6).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <div>
                    <span className="truncate">{p.produits?.nom || '·'}</span>
                    <span className="text-xs text-muted-foreground ml-2">{p.jour}</span>
                  </div>
                  <span className="font-medium text-destructive">{p.quantite}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
