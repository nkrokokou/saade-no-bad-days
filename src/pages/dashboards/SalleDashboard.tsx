import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import useSupabaseRealtime from '@/hooks/useSupabaseRealtime';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScanLine, Receipt, DollarSign, Users, ArrowRight, AlertTriangle } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function SalleDashboard() {
  useSupabaseRealtime('ventes', ['salle-ventes-jour']);
  useSupabaseRealtime('sessions_caisse', ['salle-session']);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayStart = today + 'T00:00:00';

  const { data: ventesJour = [] } = useQuery({
    queryKey: ['salle-ventes-jour'],
    queryFn: async () => {
      const { data } = await supabase.from('ventes').select('id, total, mode_paiement, created_at, vente_lignes(quantite, total_ligne, produits(nom))').gte('created_at', todayStart).order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: sessionOuverte } = useQuery({
    queryKey: ['salle-session'],
    queryFn: async () => {
      const { data } = await supabase.from('sessions_caisse').select('*').eq('statut', 'ouverte').order('ouvert_at', { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: creditsOuverts = [] } = useQuery({
    queryKey: ['salle-credits'],
    queryFn: async () => {
      const { data } = await supabase.from('credits_clients').select('id, client_nom, montant_restant').eq('statut', 'ouvert').order('montant_restant', { ascending: false }).limit(5);
      return data || [];
    },
  });

  const caJour = ventesJour.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
  const nbTickets = ventesJour.length;
  const panier = nbTickets ? caJour / nbTickets : 0;

  // Top produits du jour
  const stats: Record<string, { nom: string; qte: number }> = {};
  ventesJour.forEach((v: any) => {
    (v.vente_lignes || []).forEach((l: any) => {
      const key = l.produits?.nom || '—';
      if (!stats[key]) stats[key] = { nom: key, qte: 0 };
      stats[key].qte += Number(l.quantite || 0);
    });
  });
  const topProduits = Object.values(stats).sort((a, b) => b.qte - a.qte).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-heading font-bold">Bonjour 👋</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de la salle — {format(new Date(), 'dd/MM/yyyy')}</p>
        </div>
        <Button asChild size="lg" className="gradient-primary">
          <Link to="/pos"><ScanLine className="h-4 w-4 mr-2" />Ouvrir la caisse</Link>
        </Button>
      </div>

      {!sessionOuverte && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Aucune session de caisse ouverte. Ouvre une session depuis la caisse pour commencer.
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">CA du jour</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(Math.round(caJour))} <span className="text-xs text-muted-foreground">FCFA</span></p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Tickets</CardTitle>
            <Receipt className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-xl font-bold">{nbTickets}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Panier moyen</CardTitle>
            <Receipt className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-xl font-bold">{fmt(Math.round(panier))} <span className="text-xs text-muted-foreground">FCFA</span></p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Session</CardTitle>
            <ScanLine className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{sessionOuverte ? 'Ouverte' : 'Fermée'}</p>
            {sessionOuverte && <p className="text-[10px] text-muted-foreground">depuis {format(new Date(sessionOuverte.ouvert_at), 'HH:mm')}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between flex-row">
            <CardTitle className="text-base">Top 5 produits du jour</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/ventes">Voir <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent>
            {topProduits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente aujourd'hui</p>
            ) : (
              <div className="space-y-2">
                {topProduits.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate">{i + 1}. {p.nom}</span>
                    <Badge variant="secondary">{p.qte}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between flex-row">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Ardoises clients</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/clients">Voir <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent>
            {creditsOuverts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun crédit ouvert</p>
            ) : (
              <div className="space-y-2">
                {creditsOuverts.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                    <span className="truncate">{c.client_nom}</span>
                    <span className="font-medium text-warning">{fmt(Math.round(c.montant_restant))} FCFA</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Derniers tickets</CardTitle></CardHeader>
        <CardContent>
          {ventesJour.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun ticket</p>
          ) : (
            <div className="space-y-2">
              {ventesJour.slice(0, 8).map((v: any) => (
                <div key={v.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{format(new Date(v.created_at), 'HH:mm')}</p>
                    <p className="text-xs text-muted-foreground capitalize">{v.mode_paiement?.replace('_', ' ')}</p>
                  </div>
                  <span className="font-medium">{fmt(Math.round(v.total))} FCFA</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
