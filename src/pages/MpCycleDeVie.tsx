import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, FileDown, FileSpreadsheet, Activity, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { exportToExcelMulti, exportToPDFSections, fmtMoneyPdf } from '@/hooks/useExcelImportExport';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const fmt = (n: number, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, ...opts }).format(Number(n) || 0);

const TYPE_LABEL: Record<string, string> = {
  achat: 'Achat',
  conso_labo: 'Conso. labo',
  conso_minute: 'Conso. minute',
  perte: 'Perte',
  inventaire: 'Inventaire',
  transfert_in: 'Transfert entrant',
  transfert_out: 'Transfert sortant',
  ajustement: 'Ajustement',
};

const TYPE_BADGE: Record<string, string> = {
  achat: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30',
  conso_labo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30',
  conso_minute: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30',
  perte: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30',
  inventaire: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30',
};

export default function MpCycleDeVie() {
  const { id } = useParams();

  const { data: mp } = useQuery({
    queryKey: ['mp', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('matieres_premieres').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: mvts = [] } = useQuery({
    queryKey: ['mp_mouvements', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mp_mouvements')
        .select('*')
        .eq('matiere_premiere_id', id)
        .order('date_mouvement', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
    refetchInterval: 30000,
  });

  const stats = useMemo(() => {
    const stockActuel = mvts.reduce((s: number, m: any) => s + Number(m.quantite || 0), 0);
    const entrees = mvts.filter((m: any) => Number(m.quantite) > 0);
    const sorties = mvts.filter((m: any) => Number(m.quantite) < 0);
    const totalEntrees = entrees.reduce((s: number, m: any) => s + Number(m.quantite), 0);
    const totalSorties = sorties.reduce((s: number, m: any) => s + Math.abs(Number(m.quantite)), 0);
    const ruptures = mvts.filter((m: any) => m.regularisation_requise);
    const last30 = mvts.filter((m: any) => new Date(m.date_mouvement) >= new Date(Date.now() - 30 * 86400000));
    return { stockActuel, totalEntrees, totalSorties, nbMvts: mvts.length, ruptures: ruptures.length, last30: last30.length };
  }, [mvts]);

  const byType = useMemo(() => {
    const map: Record<string, { count: number; qte: number }> = {};
    mvts.forEach((m: any) => {
      if (!map[m.type]) map[m.type] = { count: 0, qte: 0 };
      map[m.type].count++;
      map[m.type].qte += Math.abs(Number(m.quantite || 0));
    });
    return map;
  }, [mvts]);

  const handleExportExcel = () => {
    const resume = [
      { Champ: 'Matière première', Valeur: mp?.nom },
      { Champ: 'Unité', Valeur: mp?.unite },
      { Champ: 'Fournisseur principal', Valeur: mp?.fournisseur || '-' },
      { Champ: 'Stock actuel', Valeur: stats.stockActuel },
      { Champ: 'Total entrées', Valeur: stats.totalEntrees },
      { Champ: 'Total sorties', Valeur: stats.totalSorties },
      { Champ: 'Mouvements (30 derniers j)', Valeur: stats.last30 },
      { Champ: 'Anomalies / ruptures', Valeur: stats.ruptures },
    ];
    const mouvements = mvts.map((m: any) => ({
      Date: m.date_mouvement,
      Type: TYPE_LABEL[m.type] || m.type,
      Quantité: m.quantite,
      'Stock avant': m.stock_avant,
      'Stock après': m.stock_apres,
      Source: m.source_table || '-',
      Motif: m.motif || '-',
      Anomalie: m.regularisation_requise ? 'OUI' : '',
    }));
    const parType = Object.entries(byType).map(([t, v]) => ({
      Type: TYPE_LABEL[t] || t, 'Nb mouvements': v.count, 'Quantité totale': v.qte,
    }));
    exportToExcelMulti(
      [
        { name: 'Résumé', rows: resume },
        { name: 'Mouvements', rows: mouvements },
        { name: 'Par type', rows: parType },
      ],
      `cycle_mp_${mp?.nom || id}`,
    );
  };

  const handleExportPDF = () => {
    exportToPDFSections(
      `Cycle de vie - ${mp?.nom || ''}`,
      [
        {
          heading: 'Résumé',
          headers: ['Indicateur', 'Valeur'],
          rows: [
            ['Stock actuel', `${fmt(stats.stockActuel)} ${mp?.unite || ''}`],
            ['Total entrées', `${fmt(stats.totalEntrees)} ${mp?.unite || ''}`],
            ['Total sorties', `${fmt(stats.totalSorties)} ${mp?.unite || ''}`],
            ['Mouvements (30j)', String(stats.last30)],
            ['Anomalies', String(stats.ruptures)],
          ],
        },
        {
          heading: 'Mouvements détaillés',
          headers: ['Date', 'Type', 'Quantité', 'Stock après', 'Motif'],
          rows: mvts.slice(0, 200).map((m: any) => [
            m.date_mouvement,
            TYPE_LABEL[m.type] || m.type,
            fmt(m.quantite),
            fmt(m.stock_apres),
            m.motif || '-',
          ]),
        },
      ],
      `cycle_mp_${mp?.nom || id}`,
    );
  };

  if (!mp) return <div className="p-6 text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link to="/matieres-premieres"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Retour</Button></Link>
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" /> Cycle de vie — {mp.nom}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mp.fournisseur || 'Fournisseur ?'} · Unité <strong>{mp.unite}</strong> · Prix unitaire {fmt(mp.prix_unitaire)} F
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportPDF} variant="outline"><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
          <Button onClick={handleExportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Stock actuel" value={`${fmt(stats.stockActuel)} ${mp.unite}`} highlight={stats.stockActuel <= 0} icon={<Activity className="h-4 w-4" />} />
        <KpiCard label="Entrées totales" value={`${fmt(stats.totalEntrees)} ${mp.unite}`} icon={<TrendingUp className="h-4 w-4 text-emerald-600" />} />
        <KpiCard label="Sorties totales" value={`${fmt(stats.totalSorties)} ${mp.unite}`} icon={<TrendingDown className="h-4 w-4 text-amber-600" />} />
        <KpiCard label="Anomalies" value={String(stats.ruptures)} highlight={stats.ruptures > 0} icon={<AlertTriangle className="h-4 w-4 text-rose-600" />} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Répartition par type</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byType).map(([t, v]) => (
              <Badge key={t} className={`${TYPE_BADGE[t] || 'bg-muted'} border-0 font-normal`}>
                {TYPE_LABEL[t] || t} · {v.count} mvts · {fmt(v.qte)} {mp.unite}
              </Badge>
            ))}
            {!Object.keys(byType).length && <span className="text-sm text-muted-foreground">Aucun mouvement enregistré.</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Historique complet ({mvts.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Stock après</TableHead>
                <TableHead>Motif / Source</TableHead>
                <TableHead className="text-right">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mvts.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucun mouvement</TableCell></TableRow>
              )}
              {mvts.map((m: any) => (
                <TableRow key={m.id} className={m.regularisation_requise ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''}>
                  <TableCell className="text-sm">
                    {format(new Date(m.date_mouvement + 'T12:00:00'), 'dd MMM yyyy', { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${TYPE_BADGE[m.type] || 'bg-muted'} border-0 font-normal`}>{TYPE_LABEL[m.type] || m.type}</Badge>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${Number(m.quantite) >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {Number(m.quantite) >= 0 ? '+' : ''}{fmt(m.quantite)} {mp.unite}
                  </TableCell>
                  <TableCell className="text-right">{fmt(m.stock_apres)} {mp.unite}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.motif || m.source_table || '-'}</TableCell>
                  <TableCell className="text-right">
                    {m.regularisation_requise && <Badge variant="destructive" className="text-[10px]">À régulariser</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-destructive/50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className={`text-xl font-heading font-bold mt-1 ${highlight ? 'text-destructive' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
