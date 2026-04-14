import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExcelImportExport } from '@/components/ExcelImportExport';
import { SearchFilter } from '@/components/SearchFilter';
import { exportToExcel, exportToPDF, parseExcelFile, findProductByName } from '@/hooks/useExcelImportExport';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Save, ArrowDown, ArrowUp, Package } from 'lucide-react';

export default function StockTampon() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: stockEntries = [] } = useQuery({
    queryKey: ['stock_tampon', selectedDate],
    queryFn: async () => { const { data } = await supabase.from('stock_tampon').select('*, produits(nom, categorie)').eq('date_stock', selectedDate); return data || []; },
  });

  const { data: mouvements = [] } = useQuery({
    queryKey: ['mouvements_stock', selectedDate],
    queryFn: async () => { const { data } = await supabase.from('mouvements_stock').select('*, produits(nom)').eq('date_mouvement', selectedDate).order('created_at', { ascending: false }); return data || []; },
  });

  const [localQty, setLocalQty] = useState<Record<string, number>>({});

  const saveStock = useMutation({
    mutationFn: async () => {
      const entries = products.map(p => ({ date_stock: selectedDate, produit_id: p.id, quantite: localQty[p.id] ?? stockEntries.find((s: any) => s.produit_id === p.id)?.quantite ?? 0, created_by: user?.id }));
      for (const entry of entries) {
        const existing = stockEntries.find((s: any) => s.produit_id === entry.produit_id);
        if (existing) await supabase.from('stock_tampon').update({ quantite: entry.quantite }).eq('id', existing.id);
        else await supabase.from('stock_tampon').insert(entry);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock_tampon'] }); setLocalQty({}); toast.success('Stock sauvegardé'); },
    onError: () => toast.error('Erreur'),
  });

  const getQty = (pid: string) => localQty[pid] !== undefined ? localQty[pid] : stockEntries.find((s: any) => s.produit_id === pid)?.quantite ?? 0;

  const getMouvementsSummary = (pid: string) => {
    const mvts = mouvements.filter((m: any) => m.produit_id === pid);
    return { entrees: mvts.filter((m: any) => m.type === 'entree').reduce((s: number, m: any) => s + m.quantite, 0), sorties: mvts.filter((m: any) => m.type === 'sortie').reduce((s: number, m: any) => s + m.quantite, 0) };
  };

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    return products.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const grouped = filteredProducts.reduce((acc, p) => { const cat = p.categorie || 'DIVERS'; if (!acc[cat]) acc[cat] = []; acc[cat].push(p); return acc; }, {} as Record<string, typeof products>);

  const handleExport = () => {
    exportToExcel(products.map(p => { const { entrees, sorties } = getMouvementsSummary(p.id); return { Produit: p.nom, Catégorie: p.categorie, Stock: getQty(p.id), Entrées: entrees, Sorties: sorties }; }), `stock_tampon_${selectedDate}`);
  };
  const handleExportPDF = () => {
    exportToPDF(`Stock Tampon — ${selectedDate}`, ['Produit', 'Cat.', 'Stock', 'Entrées', 'Sorties'],
      products.map(p => { const { entrees, sorties } = getMouvementsSummary(p.id); return [p.nom, p.categorie, getQty(p.id), entrees, sorties]; }));
  };
  const handleImport = async (file: File) => {
    try {
      const rows = await parseExcelFile(file);
      let imported = 0;
      const updates: Record<string, number> = {};
      for (const row of rows) {
        const name = String(row['Produit'] || Object.values(row)[0] || '');
        const qty = Number(row['Quantité'] || row['Stock'] || Object.values(row)[1] || 0);
        const pid = findProductByName(name, products);
        if (pid && qty > 0) { updates[pid] = qty; imported++; }
      }
      setLocalQty(prev => ({ ...prev, ...updates }));
      toast.success(`${imported} importés — sauvegardez`);
    } catch { toast.error('Erreur de lecture'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Package className="h-6 w-6 text-primary" /> Stock Tampon</h1>
        <div className="flex gap-2 flex-wrap">
          <SearchFilter value={search} onChange={setSearch} className="w-48" />
          <ExcelImportExport onExport={handleExport} onExportPDF={handleExportPDF} onImport={handleImport} />
          <Button onClick={() => saveStock.mutate()} disabled={saveStock.isPending}><Save className="h-4 w-4 mr-1" /> Sauvegarder</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" className="w-44" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {Object.entries(grouped).map(([cat, prods]) => (
        <Card key={cat}>
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase text-muted-foreground tracking-wider">{cat}</CardTitle></CardHeader>
          <CardContent>
            {/* Mobile */}
            <div className="block md:hidden space-y-2">
              {prods.map(p => {
                const { entrees, sorties } = getMouvementsSummary(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-2 border-b border-border pb-2 last:border-0">
                    <span className="flex-1 text-sm font-medium truncate">{p.nom}</span>
                    <Input type="number" className="w-20 h-8 text-center text-sm" value={getQty(p.id)} onChange={e => setLocalQty(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))} />
                    <div className="flex gap-1">
                      {entrees > 0 && <Badge variant="outline" className="text-[10px] gap-0.5 px-1"><ArrowDown className="h-2.5 w-2.5 text-green-600" />{entrees}</Badge>}
                      {sorties > 0 && <Badge variant="outline" className="text-[10px] gap-0.5 px-1"><ArrowUp className="h-2.5 w-2.5 text-red-500" />{sorties}</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop */}
            <Table className="hidden md:table">
              <TableHeader><TableRow><TableHead className="min-w-[140px]">Produit</TableHead><TableHead className="w-24 text-center">Stock</TableHead><TableHead className="text-center">Mouvements</TableHead></TableRow></TableHeader>
              <TableBody>
                {prods.map(p => {
                  const { entrees, sorties } = getMouvementsSummary(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nom}</TableCell>
                      <TableCell><Input type="number" className="w-20 text-center" value={getQty(p.id)} onChange={e => setLocalQty(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-center">
                          {entrees > 0 && <Badge variant="outline" className="text-xs gap-1"><ArrowDown className="h-3 w-3 text-green-600" />{entrees}</Badge>}
                          {sorties > 0 && <Badge variant="outline" className="text-xs gap-1"><ArrowUp className="h-3 w-3 text-red-500" />{sorties}</Badge>}
                          {entrees === 0 && sorties === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {mouvements.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Mouvements du jour</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mouvements.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  {m.type === 'entree' ? <ArrowDown className="h-4 w-4 text-green-600 shrink-0" /> : <ArrowUp className="h-4 w-4 text-red-500 shrink-0" />}
                  <span className="font-medium">{m.produits?.nom}</span>
                  <span className="text-muted-foreground">×{m.quantite}</span>
                  {m.motif && <span className="text-xs text-muted-foreground">— {m.motif}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
