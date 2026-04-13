import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExcelImportExport } from '@/components/ExcelImportExport';
import { exportToExcel, exportToPDF, parseExcelFile, findProductByName } from '@/hooks/useExcelImportExport';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';
import { Save, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ClotureJournaliere() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: entries = [] } = useQuery({
    queryKey: ['cloture_journaliere', selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('cloture_journaliere')
        .select('*, produits(nom, categorie)')
        .eq('date_cloture', selectedDate);
      return data || [];
    },
  });

  const [local, setLocal] = useState<Record<string, Record<string, number>>>({});

  const fields = ['stock_ouverture', 'qte_recue', 'qte_vendue', 'qte_invendu', 'prix_invendu_50', 'qte_perte', 'qte_degustation'] as const;
  const fieldLabels: Record<string, string> = {
    stock_ouverture: 'Stock Ouv.', qte_recue: 'Reçu', qte_vendue: 'Vendus',
    qte_invendu: 'Invendus', prix_invendu_50: '-50%', qte_perte: 'Pertes', qte_degustation: 'Dégust.',
  };

  const getVal = (pid: string, field: string) => {
    if (local[pid]?.[field] !== undefined) return local[pid][field];
    const e = entries.find((x: any) => x.produit_id === pid);
    return e?.[field] ?? 0;
  };

  const setVal = (pid: string, field: string, val: number) => {
    setLocal(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: val } }));
  };

  // Calculate stock fin = stock_ouverture + qte_recue - qte_vendue - qte_invendu - qte_perte - qte_degustation
  const getStockFin = (pid: string) => {
    const ouv = getVal(pid, 'stock_ouverture');
    const recu = getVal(pid, 'qte_recue');
    const vendu = getVal(pid, 'qte_vendue');
    const invendu = getVal(pid, 'qte_invendu');
    const perte = getVal(pid, 'qte_perte');
    const degust = getVal(pid, 'qte_degustation');
    return ouv + recu - vendu - invendu - perte - degust;
  };

  const save = useMutation({
    mutationFn: async () => {
      for (const [pid, vals] of Object.entries(local)) {
        const existing = entries.find((e: any) => e.produit_id === pid);
        const fullVals: any = {};
        for (const f of fields) {
          fullVals[f] = vals[f] ?? getVal(pid, f);
        }
        if (existing) {
          await supabase.from('cloture_journaliere').update(fullVals).eq('id', existing.id);
        } else {
          await supabase.from('cloture_journaliere').insert({
            produit_id: pid, date_cloture: selectedDate, ...fullVals, created_by: user?.id,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cloture_journaliere'] });
      setLocal({});
      toast.success('Clôture sauvegardée');
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  });

  const grouped = products.reduce((acc, p) => {
    const cat = p.categorie || 'DIVERS';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, typeof products>);

  const handleExport = () => {
    const data = products.map(p => ({
      Produit: p.nom, Catégorie: p.categorie,
      'Stock Ouv.': getVal(p.id, 'stock_ouverture'), 'Reçu': getVal(p.id, 'qte_recue'),
      Vendus: getVal(p.id, 'qte_vendue'), Invendus: getVal(p.id, 'qte_invendu'),
      '-50%': getVal(p.id, 'prix_invendu_50'), Pertes: getVal(p.id, 'qte_perte'),
      Dégustations: getVal(p.id, 'qte_degustation'), 'Stock Fin': getStockFin(p.id),
    }));
    exportToExcel(data, `cloture_${selectedDate}`);
  };

  const handleExportPDF = () => {
    exportToPDF(`Clôture Journalière — ${selectedDate}`,
      ['Produit', 'Ouv.', 'Reçu', 'Vendus', 'Inv.', '-50%', 'Pertes', 'Dég.', 'Fin'],
      products.map(p => [p.nom, getVal(p.id, 'stock_ouverture'), getVal(p.id, 'qte_recue'),
        getVal(p.id, 'qte_vendue'), getVal(p.id, 'qte_invendu'), getVal(p.id, 'prix_invendu_50'),
        getVal(p.id, 'qte_perte'), getVal(p.id, 'qte_degustation'), getStockFin(p.id)]));
  };

  const handleImport = async (file: File) => {
    try {
      const rows = await parseExcelFile(file);
      let imported = 0;
      for (const row of rows) {
        const name = String(row['Produit'] || row['PRODUITS'] || Object.values(row)[0] || '');
        const pid = findProductByName(name, products);
        if (pid) {
          setLocal(prev => ({
            ...prev,
            [pid]: {
              stock_ouverture: Number(row['Stock Ouv.'] || row['stock_ouverture'] || 0),
              qte_recue: Number(row['Reçu'] || row['qte_recue'] || 0),
              qte_vendue: Number(row['Vendus'] || row['qte_vendue'] || 0),
              qte_invendu: Number(row['Invendus'] || row['qte_invendu'] || 0),
              prix_invendu_50: Number(row['-50%'] || row['prix_invendu_50'] || 0),
              qte_perte: Number(row['Pertes'] || row['qte_perte'] || 0),
              qte_degustation: Number(row['Dégustations'] || row['qte_degustation'] || 0),
            },
          }));
          imported++;
        }
      }
      toast.success(`${imported} produits importés — pensez à sauvegarder`);
    } catch { toast.error('Erreur de lecture du fichier'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold">Clôture Journalière</h1>
        <div className="flex gap-2 flex-wrap">
          <ExcelImportExport onExport={handleExport} onExportPDF={handleExportPDF} onImport={handleImport} />
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-1" /> Sauvegarder
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input type="date" className="w-44" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {Object.entries(grouped).map(([cat, prods]) => (
        <Card key={cat}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase text-muted-foreground tracking-wider">{cat}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
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
                      <TableCell key={f}>
                        <Input type="number" className="w-16 text-center" value={getVal(p.id, f) || ''}
                          onChange={e => setVal(p.id, f, parseFloat(e.target.value) || 0)} />
                      </TableCell>
                    ))}
                    <TableCell className={`text-center font-bold ${getStockFin(p.id) < 0 ? 'text-destructive' : 'text-primary'}`}>
                      {getStockFin(p.id)}
                    </TableCell>
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
