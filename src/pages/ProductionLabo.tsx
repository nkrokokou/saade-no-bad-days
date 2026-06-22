import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent } from '@/components/ui/card';
import { KpiCardClickable } from '@/components/KpiCardClickable';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExcelImportExport } from '@/components/ExcelImportExport';
import { SearchFilter } from '@/components/SearchFilter';
import { exportToExcel, exportToPDF, parseExcelFile, findProductByName } from '@/hooks/useExcelImportExport';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';
import { Save, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function ProductionLabo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: entries = [] } = useQuery({
    queryKey: ['production_labo', selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('production_labo').select('*, produits(nom)').eq('date_production', selectedDate);
      return data || [];
    },
  });

  const [local, setLocal] = useState<Record<string, { qte_produite: number; qte_sortie_en_salle: number; qte_perte: number }>>({});
  const getVal = (pid: string, field: string): number => { const lp = local[pid] as any; if (lp && lp[field] !== undefined) return lp[field]; return (entries.find((x: any) => x.produit_id === pid) as any)?.[field] ?? 0; };
  const computePerte = (pid: string) => Math.max(0, Number(getVal(pid, 'qte_produite') || 0) - Number(getVal(pid, 'qte_sortie_en_salle') || 0));
  const setVal = (pid: string, field: string, val: number) => setLocal(prev => {
    const defaults: any = { qte_produite: getVal(pid, 'qte_produite'), qte_sortie_en_salle: getVal(pid, 'qte_sortie_en_salle'), qte_perte: getVal(pid, 'qte_perte') };
    const base: any = { ...defaults, ...(prev[pid] || {}), [field]: val };
    base.qte_perte = Math.max(0, Number(base.qte_produite || 0) - Number(base.qte_sortie_en_salle || 0));
    return { ...prev, [pid]: base };
  });

  // Ne montre que les produits réellement issus du Labo (exclut "minute" et "revente")
  const laboProducts = useMemo(
    () => products.filter((p: any) => (p.type_production ?? 'labo') === 'labo'),
    [products]
  );
  const filteredProducts = useMemo(() => {
    if (!search) return laboProducts;
    return laboProducts.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()));
  }, [laboProducts, search]);

  const save = useMutation({
    mutationFn: async () => {
      for (const [pid, vals] of Object.entries(local)) {
        const existing = entries.find((e: any) => e.produit_id === pid);
        if (existing) await supabase.from('production_labo').update(vals).eq('id', existing.id);
        else await supabase.from('production_labo').insert({ produit_id: pid, date_production: selectedDate, ...vals, created_by: user?.id });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production_labo'] }); qc.invalidateQueries({ queryKey: ['v_stock_mp'] }); setLocal({}); toast.success('Production sauvegardée · stock MP recalculé'); },
  });

  const deleteEntry = useMutation({
    mutationFn: async (pid: string) => {
      const eid = entries.find((e: any) => e.produit_id === pid)?.id as string | undefined;
      if (eid) { const { error } = await supabase.from('production_labo').delete().eq('id', eid); if (error) throw error; }
      setLocal(prev => { const c = { ...prev }; delete c[pid]; return c; });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production_labo'] }); setDeleteId(null); toast.success('Ligne effacée'); },
    onError: (e: any) => toast.error(`Production : ${e?.message || 'Erreur inconnue'}`),
  });

  const getEntryId = (pid: string) => entries.find((e: any) => e.produit_id === pid)?.id as string | undefined;

  const handleExport = () => {
    exportToExcel(products.map(p => ({ Produit: p.nom, 'Qté Produite': getVal(p.id, 'qte_produite'), 'Sortie en Salle': getVal(p.id, 'qte_sortie_en_salle'), Perte: getVal(p.id, 'qte_perte') })), `production_${selectedDate}`);
  };
  const handleExportPDF = () => {
    exportToPDF(`Production Labo · ${selectedDate}`, ['Produit', 'Produite', 'Sortie Salle', 'Perte'],
      products.map(p => [p.nom, getVal(p.id, 'qte_produite'), getVal(p.id, 'qte_sortie_en_salle'), getVal(p.id, 'qte_perte')]));
  };
  const handleImport = async (file: File) => {
    try {
      const rows = await parseExcelFile(file);
      let imported = 0;
      for (const row of rows) {
        const name = String(row['Produit'] || Object.values(row)[0] || '');
        const pid = findProductByName(name, products);
        if (pid) {
          setLocal(prev => ({ ...prev, [pid]: { qte_produite: Number(row['Qté Produite'] || 0), qte_sortie_en_salle: Number(row['Sortie en Salle'] || 0), qte_perte: Number(row['Perte'] || 0) } }));
          imported++;
        }
      }
      toast.success(`${imported} importés · pensez à sauvegarder`);
    } catch { toast.error('Erreur de lecture'); }
  };

  const fields = [
    { key: 'qte_produite', label: 'Produite' },
    { key: 'qte_sortie_en_salle', label: 'Sortie Salle' },
    { key: 'qte_perte', label: 'Perte (auto)' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold">Production Labo</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <SearchFilter value={search} onChange={setSearch} className="w-full sm:w-64" placeholder="Rechercher un produit labo…" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">{filteredProducts.length}/{laboProducts.length} produits</span>
          <ExcelImportExport onExport={handleExport} onExportPDF={handleExportPDF} onImport={handleImport} />
          <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-1" /> Sauvegarder</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" className="w-44" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* Mobile cards */}
      <div className="block md:hidden space-y-3">
        {filteredProducts.map(p => {
          const eid = getEntryId(p.id);
          const hasData = eid || local[p.id];
          return (
          <Card key={p.id}>
            <CardContent className="py-3 px-4">
              <div className="flex justify-between items-center mb-2">
                <p className="font-medium text-sm">{p.nom}</p>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!hasData} onClick={() => setDeleteId(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {fields.map(f => {
                  const isPerte = f.key === 'qte_perte';
                  const val = isPerte ? computePerte(p.id) : getVal(p.id, f.key);
                  return (
                    <div key={f.key}>
                      <p className="text-[10px] text-muted-foreground">{f.label}{isPerte && ' (auto)'}</p>
                      <Input type="number" readOnly={isPerte} className={`h-8 text-xs ${isPerte ? 'bg-muted text-destructive font-semibold' : ''}`} value={val || ''} onChange={e => !isPerte && setVal(p.id, f.key, parseFloat(e.target.value) || 0)} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Produit</TableHead>
                {fields.map(f => <TableHead key={f.key}>{f.label}</TableHead>)}
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map(p => {
                const eid = getEntryId(p.id);
                const hasData = eid || local[p.id];
                return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nom}</TableCell>
                  {fields.map(f => {
                    const isPerte = f.key === 'qte_perte';
                    const val = isPerte ? computePerte(p.id) : getVal(p.id, f.key);
                    return (
                      <TableCell key={f.key}>
                        <Input type="number" readOnly={isPerte} className={`w-24 ${isPerte ? 'bg-muted text-destructive font-semibold' : ''}`} value={val || ''} onChange={e => !isPerte && setVal(p.id, f.key, parseFloat(e.target.value) || 0)} />
                      </TableCell>
                    );
                  })}
                  <TableCell><Button size="icon" variant="ghost" disabled={!hasData} onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Supprimer cette entrée ?" description="L'enregistrement de production sera supprimé." destructive onConfirm={() => deleteId && deleteEntry.mutate(deleteId)} />
    </div>
  );
}
