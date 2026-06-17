import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { exportToExcel } from '@/hooks/useExcelImportExport';
import useSupabaseRealtime from '@/hooks/useSupabaseRealtime';
import {
  Download, Activity, ShoppingCart, ChefHat, ArrowRightLeft, TrendingDown,
  DollarSign, Package, Receipt, CreditCard, ClipboardCheck, AlertTriangle, Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type EventType =
  | 'vente' | 'achat_mp' | 'production' | 'transfert' | 'perte'
  | 'cloture' | 'mouvement_stock' | 'session_caisse' | 'credit' | 'paiement_credit' | 'audit';

interface LiveEvent {
  id: string;
  type: EventType;
  ts: string;
  title: string;
  detail: string;
  amount?: number;
  badge?: string;
  raw: any;
}

const TYPE_META: Record<EventType, { label: string; color: string; icon: any }> = {
  vente:           { label: 'Vente',          color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20', icon: Receipt },
  achat_mp:        { label: 'Achat MP',       color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20', icon: ShoppingCart },
  production:      { label: 'Production',     color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20', icon: ChefHat },
  transfert:       { label: 'Transfert',      color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20', icon: ArrowRightLeft },
  perte:           { label: 'Perte',          color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20', icon: TrendingDown },
  cloture:         { label: 'Clôture',        color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20', icon: ClipboardCheck },
  mouvement_stock: { label: 'Mouv. stock',    color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20', icon: Package },
  session_caisse:  { label: 'Caisse',         color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20', icon: DollarSign },
  credit:          { label: 'Crédit',         color: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20', icon: CreditCard },
  paiement_credit: { label: 'Paiement crédit',color: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20', icon: CreditCard },
  audit:           { label: 'Audit',          color: 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20', icon: AlertTriangle },
};

const PAY_LABELS: Record<string, string> = {
  especes: 'Espèces', mobile_money: 'Mobile Money', carte: 'Carte', credit: 'Crédit', ticket: 'Ticket',
};

export default function SaadeLive() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set(Object.keys(TYPE_META) as EventType[]));

  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;

  // Realtime — keep the feed live for today
  useSupabaseRealtime('ventes', ['live-ventes']);
  useSupabaseRealtime('achats_mp', ['live-achats']);
  useSupabaseRealtime('production_labo', ['live-prod']);
  useSupabaseRealtime('bons_transfert', ['live-bons']);
  useSupabaseRealtime('pertes', ['live-pertes']);
  useSupabaseRealtime('cloture_journaliere', ['live-cloture']);
  useSupabaseRealtime('mouvements_stock', ['live-mvts']);
  useSupabaseRealtime('sessions_caisse', ['live-sessions']);
  useSupabaseRealtime('credits_clients', ['live-credits']);
  useSupabaseRealtime('paiements_credits', ['live-paiements']);

  const { data: ventes = [] } = useQuery({
    queryKey: ['live-ventes', date],
    queryFn: async () => {
      const { data } = await supabase.from('ventes')
        .select('*, vente_lignes(produit_nom, quantite, total_ligne), clients(nom, prenom), tables_restaurant(numero)')
        .gte('date_vente', start).lte('date_vente', end).order('date_vente', { ascending: true });
      return data || [];
    },
  });

  const { data: achats = [] } = useQuery({
    queryKey: ['live-achats', date],
    queryFn: async () => {
      const { data } = await supabase.from('achats_mp').select('*').eq('date_achat', date).order('created_at', { ascending: true });
      return data || [];
    },
  });

  const { data: prods = [] } = useQuery({
    queryKey: ['live-prod', date],
    queryFn: async () => {
      const { data } = await supabase.from('production_labo')
        .select('*, produits(nom)').eq('date_production', date).order('created_at', { ascending: true });
      return data || [];
    },
  });

  const { data: bons = [] } = useQuery({
    queryKey: ['live-bons', date],
    queryFn: async () => {
      const { data } = await supabase.from('bons_transfert').select('*').eq('date_transfert', date).order('created_at', { ascending: true });
      return data || [];
    },
  });

  const { data: pertes = [] } = useQuery({
    queryKey: ['live-pertes', date],
    queryFn: async () => {
      const { data } = await supabase.from('pertes')
        .select('*, produits(nom)').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: true });
      return data || [];
    },
  });

  const { data: clotures = [] } = useQuery({
    queryKey: ['live-cloture', date],
    queryFn: async () => {
      const { data } = await supabase.from('cloture_journaliere')
        .select('*, produits(nom)').eq('date_cloture', date).order('created_at', { ascending: true });
      return data || [];
    },
  });

  const { data: mvts = [] } = useQuery({
    queryKey: ['live-mvts', date],
    queryFn: async () => {
      const { data } = await supabase.from('mouvements_stock')
        .select('*, produits(nom)').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: true });
      return data || [];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['live-sessions', date],
    queryFn: async () => {
      const { data } = await supabase.from('sessions_caisse')
        .select('*').gte('ouvert_at', start).lte('ouvert_at', end).order('ouvert_at', { ascending: true });
      return data || [];
    },
  });

  const { data: credits = [] } = useQuery({
    queryKey: ['live-credits', date],
    queryFn: async () => {
      const { data } = await supabase.from('credits_clients')
        .select('*, clients(nom, prenom)').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: true });
      return data || [];
    },
  });

  const { data: paiements = [] } = useQuery({
    queryKey: ['live-paiements', date],
    queryFn: async () => {
      const { data } = await supabase.from('paiements_credits')
        .select('*, credits_clients(client_id, clients(nom, prenom))').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: true });
      return data || [];
    },
  });

  const events: LiveEvent[] = useMemo(() => {
    const ev: LiveEvent[] = [];

    ventes.forEach((v: any) => {
      const clientName = v.client_nom || (v.clients ? `${v.clients.prenom || ''} ${v.clients.nom || ''}`.trim() : '');
      const tableLabel = v.tables_restaurant ? `Table ${v.tables_restaurant.numero}` : '';
      const items = (v.vente_lignes || []).map((l: any) => `${Number(l.quantite)}× ${l.produit_nom}`).join(', ');
      ev.push({
        id: 'v-' + v.id, type: 'vente', ts: v.date_vente,
        title: `Ticket #${v.numero_ticket} — ${Number(v.total).toLocaleString()} F`,
        detail: [tableLabel, clientName, items].filter(Boolean).join(' · ') || '—',
        amount: Number(v.total),
        badge: PAY_LABELS[v.mode_paiement] || v.mode_paiement,
        raw: v,
      });
    });

    achats.forEach((a: any) => ev.push({
      id: 'a-' + a.id, type: 'achat_mp', ts: a.created_at,
      title: `Achat MP — ${a.produit} (${a.quantite} ${a.unite || ''})`,
      detail: `${a.fournisseur || 'Fournisseur ?'} · ${Number(a.prix_total).toLocaleString()} F`,
      amount: Number(a.prix_total), raw: a,
    }));

    prods.forEach((p: any) => ev.push({
      id: 'p-' + p.id, type: 'production', ts: p.created_at,
      title: `Production — ${p.produits?.nom || p.produit_id} (${p.qte_produite} u.)`,
      detail: `Sortie salle ${p.qte_sortie_en_salle || 0} · Perte ${p.qte_perte || 0}`,
      raw: p,
    }));

    bons.forEach((b: any) => ev.push({
      id: 'b-' + b.id, type: 'transfert', ts: b.created_at,
      title: `Bon transfert #${String(b.id).slice(0, 8)}`,
      detail: `${b.origine || ''} → ${b.destination || ''} · ${b.statut}`,
      badge: b.statut, raw: b,
    }));

    pertes.forEach((p: any) => ev.push({
      id: 'pt-' + p.id, type: 'perte', ts: p.created_at,
      title: `Perte — ${p.produits?.nom || p.produit_id} (${p.quantite} u.)`,
      detail: `${p.type_labo || ''} · ${p.motif || ''}`,
      raw: p,
    }));

    clotures.forEach((c: any) => ev.push({
      id: 'c-' + c.id, type: 'cloture', ts: c.created_at,
      title: `Clôture — ${c.produits?.nom || c.produit_id}`,
      detail: `Vendu ${c.qte_vendue || 0} · Invendu ${c.qte_invendu || 0} · Perte ${c.qte_perte || 0}`,
      raw: c,
    }));

    mvts.forEach((m: any) => ev.push({
      id: 'm-' + m.id, type: 'mouvement_stock', ts: m.created_at,
      title: `${m.type === 'entree' ? 'Entrée' : 'Sortie'} stock — ${m.produits?.nom || m.produit_id} (${m.quantite})`,
      detail: m.motif || '',
      badge: m.type, raw: m,
    }));

    sessions.forEach((s: any) => {
      ev.push({
        id: 's-open-' + s.id, type: 'session_caisse', ts: s.ouvert_at,
        title: `Ouverture caisse · fond ${Number(s.fond_initial).toLocaleString()} F`,
        detail: `Session ${String(s.id).slice(0, 8)}`,
        badge: 'ouverte', raw: s,
      });
      if (s.ferme_at) ev.push({
        id: 's-close-' + s.id, type: 'session_caisse', ts: s.ferme_at,
        title: `Fermeture caisse · écart ${Number(s.ecart || 0).toLocaleString()} F`,
        detail: `Fond final ${Number(s.fond_final_compte || 0).toLocaleString()} F (attendu ${Number(s.fond_final_attendu || 0).toLocaleString()} F)`,
        badge: s.statut, raw: s,
      });
    });

    credits.forEach((c: any) => ev.push({
      id: 'cr-' + c.id, type: 'credit', ts: c.created_at,
      title: `Crédit ouvert — ${Number(c.montant_initial).toLocaleString()} F`,
      detail: c.clients ? `${c.clients.prenom || ''} ${c.clients.nom || ''}`.trim() : '—',
      amount: Number(c.montant_initial), raw: c,
    }));

    paiements.forEach((p: any) => ev.push({
      id: 'pc-' + p.id, type: 'paiement_credit', ts: p.created_at,
      title: `Paiement crédit — ${Number(p.montant).toLocaleString()} F`,
      detail: p.credits_clients?.clients ? `${p.credits_clients.clients.prenom || ''} ${p.credits_clients.clients.nom || ''}`.trim() : '—',
      amount: Number(p.montant), raw: p,
    }));

    return ev.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [ventes, achats, prods, bons, pertes, clotures, mvts, sessions, credits, paiements]);

  const filtered = events.filter(e => activeTypes.has(e.type));

  const counts = useMemo(() => {
    const c: Record<EventType, number> = {} as any;
    (Object.keys(TYPE_META) as EventType[]).forEach(t => c[t] = 0);
    events.forEach(e => c[e.type]++);
    return c;
  }, [events]);

  const summary = useMemo(() => {
    const ca = ventes.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
    const achatsTotal = achats.reduce((s: number, a: any) => s + Number(a.prix_total || 0), 0);
    const pertesTotal = pertes.reduce((s: number, p: any) => s + Number(p.quantite || 0), 0);
    const prodTotal = prods.reduce((s: number, p: any) => s + Number(p.qte_produite || 0), 0);
    return { ca, achatsTotal, pertesTotal, prodTotal, nbTickets: ventes.length };
  }, [ventes, achats, pertes, prods]);

  const toggleType = (t: EventType) => {
    const next = new Set(activeTypes);
    next.has(t) ? next.delete(t) : next.add(t);
    setActiveTypes(next);
  };

  const exportLive = () => {
    exportToExcel(
      filtered.map(e => ({
        Heure: format(new Date(e.ts), 'HH:mm:ss'),
        Type: TYPE_META[e.type].label,
        Titre: e.title,
        Détail: e.detail,
        Badge: e.badge || '',
        Montant: e.amount || '',
      })),
      `saade_live_${date}`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary animate-pulse" />
            SAADÉ en live
          </h1>
          <p className="text-sm text-muted-foreground">
            Tout ce qui se passe — en temps réel, classé par heure. Aucune section à fouiller.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setDate(today)}>Aujourd'hui</Button>
          <Button variant="outline" size="sm" onClick={() => setDate(format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'))}>Hier</Button>
          <Button size="sm" onClick={exportLive}><Download className="h-4 w-4 mr-1" />Export</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Chiffre d'affaires" value={`${summary.ca.toLocaleString()} F`} />
        <SummaryCard label="Tickets" value={summary.nbTickets} />
        <SummaryCard label="Achats MP" value={`${summary.achatsTotal.toLocaleString()} F`} />
        <SummaryCard label="Production" value={`${summary.prodTotal} u.`} />
        <SummaryCard label="Pertes" value={`${summary.pertesTotal} u.`} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(Object.keys(TYPE_META) as EventType[]).map(t => {
              const meta = TYPE_META[t];
              const active = activeTypes.has(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${active ? meta.color : 'bg-muted/40 text-muted-foreground border-transparent opacity-50'}`}
                >
                  {meta.label} <span className="ml-1 opacity-70">({counts[t]})</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Flux chronologique</span>
            <span className="text-xs font-normal text-muted-foreground">{filtered.length} événements</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Aucun événement pour cette date.</p>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <ol className="relative border-l-2 border-border ml-3 space-y-3">
                {filtered.map(e => {
                  const meta = TYPE_META[e.type];
                  const Icon = meta.icon;
                  return (
                    <li key={e.id} className="ml-6 relative">
                      <span className={`absolute -left-9 top-1 flex items-center justify-center w-6 h-6 rounded-full border ${meta.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <span className="text-xs font-mono text-muted-foreground tabular-nums w-20 shrink-0">
                          {format(new Date(e.ts), 'HH:mm:ss')}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${meta.color} shrink-0`}>{meta.label}</Badge>
                        <span className="text-sm font-medium">{e.title}</span>
                        {e.badge && <Badge variant="secondary" className="text-[10px]">{e.badge}</Badge>}
                      </div>
                      {e.detail && <p className="text-xs text-muted-foreground mt-0.5 ml-0 sm:ml-[7.25rem]">{e.detail}</p>}
                    </li>
                  );
                })}
              </ol>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Mis à jour en temps réel · {format(new Date(), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
      </p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-lg font-bold text-foreground mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
