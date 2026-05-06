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
import { exportToExcel, exportToPDF, parseExcelFile, findProductByName } from '@/hooks/useExcelImportExport';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';
import { Save, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function ClotureJournaliere() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: entries = [] } = useQuery({
    queryKey: ['cloture_journaliere', selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('cloture_journaliere').select('*, produits(nom, categorie)').eq('date_cloture', selectedDate);
      return data || [];
    },
  });

  const [local, setLocal] = useState<Record<string, Record<string, number>>>({});
  const fields = ['stock_ouverture', 'qte_recue', 'qte_vendue', 'qte_invendu', 'prix_invendu_50', 'qte_perte', 'qte_degustation'] as const;
  const fieldLabels: Record<string, string> = { stock_ouverture: 'Ouv.', qte_recue: 'Reçu', qte_vendue: 'Vendu', qte_invendu: 'Inv.', prix_invendu_50: '-50%', qte_perte: 'Perte', qte_degustation: 'Dég.' };

  const getVal = (pid: string, field: string) => { if (local[pid]?.[field] !== undefined) return local[pid][field]; return entries.find((x: any) => x.produit_id === pid)?.[field] ?? 0; };
  const setVal = (pid: string, field: string, val: number) => setLocal(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: val } }));
  const getStockFin = (pid: string) => getVal(pid, 'stock_ouverture') + getVal(pid, 'qte_recue') - getVal(pid, 'qte_vendue') - getVal(pid, 'qte_invendu') - getVal(pid, 'qte_perte') - getVal(pid, 'qte_degustation');

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

  const save = useMutation({
    mutationFn: async () => {
      for (const [pid, vals] of Object.entries(local)) {
        const existing = entries.find((e: any) => e.produit_id === pid);
        const fullVals: any = {};
        for (const f of fields) fullVals[f] = vals[f] ?? getVal(pid, f);
        if (existing) await supabase.from('cloture_journaliere').update(fullVals).eq('id', existing.id);
        else await supabase.from('cloture_journaliere').insert({ produit_id: pid, date_cloture: selectedDate, ...fullVals, created_by: user?.id });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cloture_journaliere'] }); setLocal({}); toast.success('Clôture sauvegardée'); },
    onError: () => toast.error('Erreur'),
  });

  const handleExport = () => {
    exportToExcel(products.map(p => ({
      Produit: p.nom, 'Stock Ouv.': getVal(p.id, 'stock_ouverture'), Reçu: getVal(p.id, 'qte_recue'),
      Vendus: getVal(p.id, 'qte_vendue'), Invendus: getVal(p.id, 'qte_invendu'), '-50%': getVal(p.id, 'prix_invendu_50'),
      Pertes: getVal(p.id, 'qte_perte'), Dégustations: getVal(p.id, 'qte_degustation'), 'Stock Fin': getStockFin(p.id),
    })), `cloture_${selectedDate}`);
  };
  const handleExportPDF = () => {
    exportToPDF(`Clôture — ${selectedDate}`, ['Produit', ...Object.values(fieldLabels), 'Fin'],
      products.map(p => [p.nom, ...fields.map(f => getVal(p.id, f)), getStockFin(p.id)]));
  };
  const handleImport = async (file: File) => {
    try {
      const rows = await parseExcelFile(file);
      let imported = 0;
      for (const row of rows) {
        const name = String(row['Produit'] || Object.values(row)[0] || '');
        const pid = findProductByName(name, products);
        if (pid) {
          setLocal(prev => ({ ...prev, [pid]: {
            stock_ouverture: Number(row['Stock Ouv.'] || 0), qte_recue: Number(row['Reçu'] || 0),
            qte_vendue: Number(row['Vendus'] || 0), qte_invendu: Number(row['Invendus'] || 0),
            prix_invendu_50: Number(row['-50%'] || 0), qte_perte: Number(row['Pertes'] || 0), qte_degustation: Number(row['Dégustations'] || 0),
          } }));
          imported++;
        }
      }
      toast.success(`${imported} importés — sauvegardez`);
    } catch { toast.error('Erreur de lecture'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold">Clôture Journalière</h1>
        <div className="flex gap-2 flex-wrap">
          <SearchFilter value={search} onChange={setSearch} className="w-48" />
          <ExcelImportExport onExport={handleExport} onExportPDF={handleExportPDF} onImport={handleImport} />
          <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-1" /> Sauvegarder</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" className="w-44" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Formule : Stock Fin = Ouverture + Reçu − Vendu − Invendu − Perte − Dégustation
      </p>

      {Object.entries(grouped).map(([cat, prods]) => (
        <Card key={cat}>
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase text-muted-foreground tracking-wider">{cat}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {/* Mobile cards */}
            <div className="block md:hidden space-y-3">
              {prods.map(p => (
                <div key={p.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm">{p.nom}</p>
                    <span className={`text-sm font-bold ${getStockFin(p.id) < 0 ? 'text-destructive' : 'text-primary'}`}>Fin: {getStockFin(p.id)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {fields.map(f => (
                      <div key={f}>
                        <p className="text-[10px] text-muted-foreground">{fieldLabels[f]}</p>
                        <Input type="number" className="h-8 text-xs text-center px-1" value={getVal(p.id, f) || ''} onChange={e => setVal(p.id, f, parseFloat(e.target.value) || 0)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px] sticky left-0 bg-card z-10">Produit</TableHead>
                  {fields.map(f => <TableHead key={f} className="text-center">{fieldLabels[f]}</TableHead>)}
                  <TableHead className="text-center font-bold">Stock Fin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prods.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium sticky left-0 bg-card z-10">{p.nom}</TableCell>
                    {fields.map(f => (
                      <TableCell key={f}><Input type="number" className="w-16 text-center" value={getVal(p.id, f) || ''} onChange={e => setVal(p.id, f, parseFloat(e.target.value) || 0)} /></TableCell>
                    ))}
                    <TableCell className={`text-center font-bold ${getStockFin(p.id) < 0 ? 'text-destructive' : 'text-primary'}`}>{getStockFin(p.id)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
