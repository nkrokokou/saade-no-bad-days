import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Unlock, Lock } from 'lucide-react';

interface SessionRow {
  id: string;
  ouvert_par: string | null;
  ouvert_at: string;
  ferme_at: string | null;
  fond_initial: number;
  fond_final_attendu: number | null;
  fond_final_compte: number | null;
  ecart: number | null;
  statut: string;
  notes: string | null;
  caissier?: string;
  ventes_count?: number;
  total_ventes?: number;
}

export default function CaissesLive() {
  const [open, setOpen] = useState<SessionRow[]>([]);
  const [closedToday, setClosedToday] = useState<SessionRow[]>([]);
  const [ecarts, setEcarts] = useState<SessionRow[]>([]);

  const load = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isoStart = today.toISOString();

    const { data: sessions } = await supabase
      .from('sessions_caisse')
      .select('*')
      .or(`statut.eq.ouverte,ouvert_at.gte.${isoStart}`)
      .order('ouvert_at', { ascending: false });

    const userIds = Array.from(new Set((sessions || []).map(s => s.ouvert_par).filter(Boolean))) as string[];
    const { data: profs } = userIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] as any[] };
    const nameMap = new Map((profs || []).map(p => [p.id, p.full_name]));

    const sessionIds = (sessions || []).map(s => s.id);
    const { data: ventes } = sessionIds.length
      ? await supabase.from('ventes').select('session_id, total').in('session_id', sessionIds)
      : { data: [] as any[] };
    const totalsMap = new Map<string, { count: number; total: number }>();
    (ventes || []).forEach(v => {
      const cur = totalsMap.get(v.session_id) || { count: 0, total: 0 };
      cur.count += 1; cur.total += Number(v.total || 0);
      totalsMap.set(v.session_id, cur);
    });

    const enriched: SessionRow[] = (sessions || []).map(s => ({
      ...s,
      caissier: nameMap.get(s.ouvert_par || '') || '—',
      ventes_count: totalsMap.get(s.id)?.count || 0,
      total_ventes: totalsMap.get(s.id)?.total || 0,
    }));

    setOpen(enriched.filter(s => s.statut === 'ouverte'));
    setClosedToday(enriched.filter(s => s.statut !== 'ouverte'));
    setEcarts(enriched.filter(s => s.statut !== 'ouverte' && Math.abs(Number(s.ecart || 0)) > 2000));
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('caisses-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions_caisse' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventes' }, load)
      .subscribe();
    const i = setInterval(load, 30_000);
    return () => { supabase.removeChannel(channel); clearInterval(i); };
  }, []);

  const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('fr-FR') + ' F');

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Unlock className="h-4 w-4 text-emerald-600" />Sessions ouvertes</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{open.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" />Fermées aujourd'hui</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{closedToday.length}</p></CardContent>
        </Card>
        <Card className={ecarts.length ? 'border-destructive' : ''}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Écarts &gt; 2 000 F</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-destructive">{ecarts.length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Sessions ouvertes en temps réel</CardTitle></CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune session ouverte actuellement.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Caissier</TableHead><TableHead>Ouverte</TableHead>
                <TableHead className="text-right">Fond initial</TableHead>
                <TableHead className="text-right">Ventes</TableHead>
                <TableHead className="text-right">CA</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {open.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.caissier}</TableCell>
                    <TableCell>{new Date(s.ouvert_at).toLocaleTimeString('fr-FR')}</TableCell>
                    <TableCell className="text-right">{fmt(s.fond_initial)}</TableCell>
                    <TableCell className="text-right">{s.ventes_count}</TableCell>
                    <TableCell className="text-right">{fmt(s.total_ventes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Journal des écarts (aujourd'hui)</CardTitle></CardHeader>
        <CardContent>
          {closedToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune clôture aujourd'hui.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Caissier</TableHead><TableHead>Statut</TableHead>
                <TableHead className="text-right">Attendu</TableHead>
                <TableHead className="text-right">Compté</TableHead>
                <TableHead className="text-right">Écart</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {closedToday.map(s => {
                  const ec = Number(s.ecart || 0);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.caissier}</TableCell>
                      <TableCell>
                        <Badge variant={s.statut === 'fermee_auto' ? 'destructive' : 'secondary'}>
                          {s.statut === 'fermee_auto' ? 'Auto 23h59' : 'Fermée'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmt(s.fond_final_attendu)}</TableCell>
                      <TableCell className="text-right">{fmt(s.fond_final_compte)}</TableCell>
                      <TableCell className={`text-right font-semibold ${Math.abs(ec) > 2000 ? 'text-destructive' : ec !== 0 ? 'text-yellow-600' : ''}`}>
                        {fmt(s.ecart)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
