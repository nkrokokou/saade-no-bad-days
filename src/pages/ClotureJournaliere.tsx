import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExcelImportExport } from '@/components/ExcelImportExport';
import { SearchFilter } from '@/components/SearchFilter';
import { exportToExcel, exportToPDF } from '@/hooks/useExcelImportExport';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';
import { Save, ChevronLeft, ChevronRight, Trash2, AlertTriangle, Lock } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function ClotureJournaliere() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Record<string, number>>>({});

  const dayStart = `${selectedDate}T00:00:00`;
  const dayEnd = `${selectedDate}T23:59:59.999`;
  const prevDate = format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd');

  // Clôtures du jour (saisies manuelles déjà enregistrées)
  const { data: entries = [] } = useQuery({
    queryKey: ['cloture_journaliere', selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('cloture_journaliere').select('*').eq('date_cloture', selectedDate);
      return data || [];
    },
  });

  // Stock fin de la veille -> stock ouverture du jour
  const { data: prevCloture = [] } = useQuery({
    queryKey: ['cloture_prev', prevDate],
    queryFn: async () => {
      const { data } = await supabase.from('cloture_journaliere').select('produit_id, stock_fin_compte').eq('date_cloture', prevDate);
      return data || [];
    },
  });

  // Fallback : dernier inventaire avant ce jour (par nom de produit)
  const { data: lastInv = [] } = useQuery({
    queryKey: ['cloture_last_inv', selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('inventaire')
        .select('nom_produit, quantite, date_inventaire')
        .lt('date_inventaire', selectedDate)
        .order('date_inventaire', { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const prevExists = prevCloture.length > 0;

  // Quantités reçues via bons de transfert reçus aujourd'hui
  const { data: bonsLignes = [] } = useQuery({
    queryKey: ['cloture_bons', selectedDate],
    queryFn: async () => {
      const { data: bons } = await supabase.from('bons_transfert').select('id').eq('date_transfert', selectedDate);
      const ids = (bons || []).map((b: any) => b.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('bon_transfert_lignes').select('produit_id, qte_recue, qte_prevue').in('bon_transfert_id', ids);
      return data || [];
    },
  });

  // Ventes du jour
  const { data: ventesLignes = [] } = useQuery({
    queryKey: ['cloture_ventes', selectedDate],
    queryFn: async () => {
      const { data: vs } = await supabase.from('ventes').select('id').gte('created_at', dayStart).lte('created_at', dayEnd);
      const ids = (vs || []).map((v: any) => v.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('vente_lignes').select('produit_id, quantite').in('vente_id', ids);
      return data || [];
    },
  });

  // Dégustations du jour
  const { data: degustations = [] } = useQuery({
    queryKey: ['cloture_deg', selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('degustations').select('produit_id, quantite').eq('date_degustation', selectedDate);
      return data || [];
    },
  });

  // Maps produit_id -> valeur auto
  const autoOuverture = useMemo(() => {
    const m: Record<string, number> = {};
    prevCloture.forEach((e: any) => { m[e.produit_id] = Number(e.stock_fin_compte || 0); });
    // Fallback : dernier inventaire saisi (par nom produit, le plus récent gagne)
    const seen = new Set<string>();
    lastInv.forEach((row: any) => {
      const key = row.nom_produit?.toLowerCase().trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      const prod = products.find(p => p.nom.toLowerCase().trim() === key);
      if (prod && m[prod.id] === undefined) m[prod.id] = Number(row.quantite || 0);
    });
    return m;
  }, [prevCloture, lastInv, products]);

  const autoRecue = useMemo(() => {
    const m: Record<string, number> = {};
    bonsLignes.forEach((l: any) => { m[l.produit_id] = (m[l.produit_id] || 0) + Number(l.qte_recue ?? l.qte_prevue ?? 0); });
    return m;
  }, [bonsLignes]);

  const autoVendue = useMemo(() => {
    const m: Record<string, number> = {};
    ventesLignes.forEach((l: any) => { m[l.produit_id] = (m[l.produit_id] || 0) + Number(l.quantite || 0); });
    return m;
  }, [ventesLignes]);

  const autoDeg = useMemo(() => {
    const m: Record<string, number> = {};
    degustations.forEach((d: any) => { m[d.produit_id] = (m[d.produit_id] || 0) + Number(d.quantite || 0); });
    return m;
  }, [degustations]);

  const manualFields = ['qte_invendu', 'prix_invendu_50', 'stock_fin_compte'] as const;
  const manualLabels: Record<string, string> = { qte_invendu: 'Invendu', prix_invendu_50: '-50%', stock_fin_compte: 'Compté' };

  const getAuto = (pid: string, field: string) => {
    if (field === 'stock_ouverture') return autoOuverture[pid] || 0;
    if (field === 'qte_recue') return autoRecue[pid] || 0;
    if (field === 'qte_vendue') return autoVendue[pid] || 0;
    if (field === 'qte_degustation') return autoDeg[pid] || 0;
    return 0;
  };

  const getManual = (pid: string, field: string) => {
    if (local[pid]?.[field] !== undefined) return local[pid][field];
    const v = (entries.find((x: any) => x.produit_id === pid) as any)?.[field];
    return v ?? 0;
  };

  const setManual = (pid: string, field: string, val: number) => setLocal(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: val } }));

  const getPerteAuto = (pid: string) => Math.max(0,
    getAuto(pid, 'stock_ouverture') + getAuto(pid, 'qte_recue')
    - getAuto(pid, 'qte_vendue') - getManual(pid, 'qte_invendu')
    - getAuto(pid, 'qte_degustation') - getManual(pid, 'stock_fin_compte')
  );

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    return products.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const grouped = filteredProducts.reduce((acc, p) => {
    const cat = p.categorie || 'DIVERS';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, typeof products>);

  // Sauvegarde: pour chaque produit qui a une saisie manuelle OU des valeurs auto > 0, on enregistre
  const save = useMutation({
    mutationFn: async () => {
      // Produits à enregistrer: ceux modifiés localement + ceux avec activité (auto != 0) + ceux déjà existants
      const pidsToSave = new Set<string>([
        ...Object.keys(local),
        ...products.filter(p =>
          getAuto(p.id, 'stock_ouverture') || getAuto(p.id, 'qte_recue') ||
          getAuto(p.id, 'qte_vendue') || getAuto(p.id, 'qte_degustation') ||
          entries.find((e: any) => e.produit_id === p.id)
        ).map(p => p.id),
      ]);

      for (const pid of pidsToSave) {
        const existing = entries.find((e: any) => e.produit_id === pid);
        const payload: any = {
          stock_ouverture: getAuto(pid, 'stock_ouverture'),
          qte_recue: getAuto(pid, 'qte_recue'),
          qte_vendue: getAuto(pid, 'qte_vendue'),
          qte_degustation: getAuto(pid, 'qte_degustation'),
          qte_invendu: getManual(pid, 'qte_invendu'),
          prix_invendu_50: getManual(pid, 'prix_invendu_50'),
          stock_fin_compte: getManual(pid, 'stock_fin_compte'),
        };
        payload.qte_perte = Math.max(0,
          payload.stock_ouverture + payload.qte_recue
          - payload.qte_vendue - payload.qte_invendu
          - payload.qte_degustation - payload.stock_fin_compte
        );
        if (existing) await supabase.from('cloture_journaliere').update(payload).eq('id', existing.id);
        else await supabase.from('cloture_journaliere').insert({ produit_id: pid, date_cloture: selectedDate, ...payload, created_by: user?.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cloture_journaliere'] });
      setLocal({});
      toast.success('Clôture sauvegardée');
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('cloture_journaliere').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cloture_journaliere'] }); setDeleteId(null); toast.success('Entrée supprimée'); },
    onError: () => toast.error('Erreur'),
  });

  const getEntryId = (pid: string) => entries.find((e: any) => e.produit_id === pid)?.id as string | undefined;

  const handleExport = () => {
    exportToExcel(products.map(p => ({
      Produit: p.nom,
      'Stock Ouv. (auto)': getAuto(p.id, 'stock_ouverture'),
      'Reçu (auto)': getAuto(p.id, 'qte_recue'),
      'Vendu (auto)': getAuto(p.id, 'qte_vendue'),
      'Dégust. (auto)': getAuto(p.id, 'qte_degustation'),
      Invendu: getManual(p.id, 'qte_invendu'),
      '-50%': getManual(p.id, 'prix_invendu_50'),
      'Stock Fin (compté)': getManual(p.id, 'stock_fin_compte'),
      Perte: getPerteAuto(p.id),
    })), `cloture_${selectedDate}`);
  };
  const handleExportPDF = () => {
    exportToPDF(`Clôture · ${selectedDate}`,
      ['Produit', 'Ouv.', 'Reçu', 'Vendu', 'Dég.', 'Invendu', '-50%', 'Compté', 'Perte'],
      products.map(p => [p.nom,
        getAuto(p.id, 'stock_ouverture'), getAuto(p.id, 'qte_recue'),
        getAuto(p.id, 'qte_vendue'), getAuto(p.id, 'qte_degustation'),
        getManual(p.id, 'qte_invendu'), getManual(p.id, 'prix_invendu_50'),
        getManual(p.id, 'stock_fin_compte'), getPerteAuto(p.id)]));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold">Clôture Journalière</h1>
        <div className="flex gap-2 flex-wrap">
          <SearchFilter value={search} onChange={setSearch} className="w-48" />
          <ExcelImportExport onExport={handleExport} onExportPDF={handleExportPDF} onImport={async () => toast.info("Import désactivé : les valeurs sont auto-calculées")} />
          <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-1" /> Sauvegarder</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" className="w-44" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {!prevExists && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Stock d'ouverture mis à 0 par défaut.</strong> La clôture du {format(subDays(new Date(selectedDate), 1), 'dd/MM/yyyy')} n'a pas été validée — il n'y a donc pas de stock fin reporté pour aujourd'hui.
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground p-3 rounded-md bg-muted/40 space-y-1">
        <p className="flex items-center gap-1"><Lock className="h-3 w-3" /> <strong>Champs auto (verrouillés)</strong> : Ouverture (= compté de la veille) · Reçu (bons de transfert) · Vendu (caisse) · Dégustations.</p>
        <p>✏️ <strong>À saisir manuellement</strong> : Invendu, -50%, et Stock physique compté en fin de journée.</p>
        <p>🧮 <strong>Perte calculée auto</strong> : Ouverture + Reçu − Vendu − Invendu − Dégustation − Compté.</p>
      </div>

      {Object.entries(grouped).map(([cat, prods]) => (
        <Card key={cat}>
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase text-muted-foreground tracking-wider">{cat}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {/* Mobile cards */}
            <div className="block md:hidden space-y-3">
              {prods.map(p => {
                const eid = getEntryId(p.id);
                const perte = getPerteAuto(p.id);
                return (
                <div key={p.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm">{p.nom}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-destructive font-bold">Perte: {perte}</span>
                      {eid && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteId(eid)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                    </div>
                  </div>
                  {/* Auto (locked) */}
                  <div className="grid grid-cols-4 gap-1">
                    {(['stock_ouverture','qte_recue','qte_vendue','qte_degustation'] as const).map(f => (
                      <div key={f}>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Lock className="h-2.5 w-2.5" />{f === 'stock_ouverture' ? 'Ouv.' : f === 'qte_recue' ? 'Reçu' : f === 'qte_vendue' ? 'Vendu' : 'Dég.'}</p>
                        <div className="h-8 text-xs text-center px-1 rounded-md bg-muted/60 flex items-center justify-center font-medium">{getAuto(p.id, f)}</div>
                      </div>
                    ))}
                  </div>
                  {/* Manuel */}
                  <div className="grid grid-cols-3 gap-1">
                    {manualFields.map(f => (
                      <div key={f}>
                        <p className={`text-[10px] ${f === 'stock_fin_compte' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{manualLabels[f]}</p>
                        <Input type="number" inputMode="decimal" className="h-8 text-xs text-center px-1" value={getManual(p.id, f) || ''} placeholder="0" onChange={e => setManual(p.id, f, parseFloat(e.target.value) || 0)} />
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
            {/* Desktop table */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px] sticky left-0 bg-card z-10">Produit</TableHead>
                  <TableHead className="text-center text-muted-foreground">🔒 Ouv.</TableHead>
                  <TableHead className="text-center text-muted-foreground">🔒 Reçu</TableHead>
                  <TableHead className="text-center text-muted-foreground">🔒 Vendu</TableHead>
                  <TableHead className="text-center text-muted-foreground">🔒 Dég.</TableHead>
                  <TableHead className="text-center">Invendu</TableHead>
                  <TableHead className="text-center">-50%</TableHead>
                  <TableHead className="text-center text-primary">Compté</TableHead>
                  <TableHead className="text-center font-bold text-destructive">Perte</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prods.map(p => {
                  const eid = getEntryId(p.id);
                  return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium sticky left-0 bg-card z-10">{p.nom}</TableCell>
                    {(['stock_ouverture','qte_recue','qte_vendue','qte_degustation'] as const).map(f => (
                      <TableCell key={f} className="text-center">
                        <div className="w-16 mx-auto px-2 py-1 rounded-md bg-muted/60 text-sm font-medium">{getAuto(p.id, f)}</div>
                      </TableCell>
                    ))}
                    {manualFields.map(f => (
                      <TableCell key={f}><Input type="number" inputMode="decimal" className="w-16 text-center" value={getManual(p.id, f) || ''} placeholder="0" onChange={e => setManual(p.id, f, parseFloat(e.target.value) || 0)} /></TableCell>
                    ))}
                    <TableCell className="text-center font-bold text-destructive">{getPerteAuto(p.id)}</TableCell>
                    <TableCell>{eid && <Button size="icon" variant="ghost" onClick={() => setDeleteId(eid)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Supprimer cette ligne ?" description="L'entrée de clôture pour ce produit sera supprimée." destructive onConfirm={() => deleteId && deleteEntry.mutate(deleteId)} />
    </div>
  );
}
