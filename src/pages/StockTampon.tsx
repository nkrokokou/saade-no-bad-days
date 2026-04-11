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
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';

export default function StockTampon() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: stockEntries = [] } = useQuery({
    queryKey: ['stock_tampon', selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('stock_tampon')
        .select('*, produits(nom, categorie)')
        .eq('date_stock', selectedDate);
      return data || [];
    },
  });

  const [localQty, setLocalQty] = useState<Record<string, number>>({});

  const saveStock = useMutation({
    mutationFn: async () => {
      const entries = products.map(p => ({
        date_stock: selectedDate,
        produit_id: p.id,
        quantite: localQty[p.id] ?? stockEntries.find((s: any) => s.produit_id === p.id)?.quantite ?? 0,
        created_by: user?.id,
      }));
      for (const entry of entries) {
        const existing = stockEntries.find((s: any) => s.produit_id === entry.produit_id);
        if (existing) {
          await supabase.from('stock_tampon').update({ quantite: entry.quantite }).eq('id', existing.id);
        } else {
          await supabase.from('stock_tampon').insert(entry);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock_tampon'] });
      setLocalQty({});
      toast.success('Stock tampon sauvegardé');
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  });

  const getQty = (productId: string) => {
    if (localQty[productId] !== undefined) return localQty[productId];
    const entry = stockEntries.find((s: any) => s.produit_id === productId);
    return entry?.quantite ?? 0;
  };

  const grouped = products.reduce((acc, p) => {
    const cat = p.categorie || 'DIVERS';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, typeof products>);

  const handleExport = () => {
    const data = products.map(p => ({ Produit: p.nom, Catégorie: p.categorie, Quantité: getQty(p.id) }));
    exportToExcel(data, `stock_tampon_${selectedDate}`);
  };

  const handleExportPDF = () => {
    exportToPDF(`Stock Tampon — ${selectedDate}`,
      ['Produit', 'Catégorie', 'Quantité'],
      products.map(p => [p.nom, p.categorie, getQty(p.id)]));
  };

  const handleImport = async (file: File) => {
    try {
      const rows = await parseExcelFile(file);
      let imported = 0;
      const updates: Record<string, number> = {};
      for (const row of rows) {
        const name = String(row['Produit'] || row['PRODUITS'] || row['produit'] || Object.values(row)[0] || '');
        const qty = Number(row['Quantité'] || row['QTE'] || row['quantite'] || Object.values(row)[1] || 0);
        const pid = findProductByName(name, products);
        if (pid && qty > 0) { updates[pid] = qty; imported++; }
      }
      setLocalQty(prev => ({ ...prev, ...updates }));
      toast.success(`${imported} produits importés — pensez à sauvegarder`);
    } catch { toast.error('Erreur de lecture du fichier'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold">Stock Tampon</h1>
        <div className="flex gap-2 flex-wrap">
          <ExcelImportExport onExport={handleExport} onExportPDF={handleExportPDF} onImport={handleImport} />
          <Button onClick={() => saveStock.mutate()} disabled={saveStock.isPending}>
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
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="w-32">Quantité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prods.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.nom}</TableCell>
                    <TableCell>
                      <Input type="number" className="w-24" value={getQty(p.id)}
                        onChange={e => setLocalQty(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))} />
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
