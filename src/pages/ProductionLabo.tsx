import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent } from '@/components/ui/card';
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
  const getVal = (pid: string, field: string) => { if (local[pid]?.[field as keyof typeof local[string]] !== undefined) return local[pid][field as keyof typeof local[string]]; return entries.find((x: any) => x.produit_id === pid)?.[field] ?? 0; };
  const setVal = (pid: string, field: string, val: number) => setLocal(prev => ({ ...prev, [pid]: { qte_produite: getVal(pid, 'qte_produite'), qte_sortie_en_salle: getVal(pid, 'qte_sortie_en_salle'), qte_perte: getVal(pid, 'qte_perte'), ...prev[pid], [field]: val } }));

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    return products.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const save = useMutation({
    mutationFn: async () => {
      for (const [pid, vals] of Object.entries(local)) {
        const existing = entries.find((e: any) => e.produit_id === pid);
        if (existing) await supabase.from('production_labo').update(vals).eq('id', existing.id);
        else await supabase.from('production_labo').insert({ produit_id: pid, date_production: selectedDate, ...vals, created_by: user?.id });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production_labo'] }); setLocal({}); toast.success('Production sauvegardée'); },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('production_labo').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production_labo'] }); setDeleteId(null); toast.success('Entrée supprimée'); },
    onError: () => toast.error('Erreur'),
  });

  const getEntryId = (pid: string) => entries.find((e: any) => e.produit_id === pid)?.id as string | undefined;

  const handleExport = () => {
    exportToExcel(products.map(p => ({ Produit: p.nom, 'Qté Produite': getVal(p.id, 'qte_produite'), 'Sortie en Salle': getVal(p.id, 'qte_sortie_en_salle'), Perte: getVal(p.id, 'qte_perte') })), `production_${selectedDate}`);
  };
  const handleExportPDF = () => {
    exportToPDF(`Production Labo — ${selectedDate}`, ['Produit', 'Produite', 'Sortie Salle', 'Perte'],
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
      toast.success(`${imported} importés — pensez à sauvegarder`);
    } catch { toast.error('Erreur de lecture'); }
  };

  const fields = [
    { key: 'qte_produite', label: 'Produite' },
    { key: 'qte_sortie_en_salle', label: 'Sortie Salle' },
    { key: 'qte_perte', label: 'Perte' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold">Production Labo</h1>
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

      {/* Mobile cards */}
      <div className="block md:hidden space-y-3">
        {filteredProducts.map(p => (
          <Card key={p.id}>
            <CardContent className="py-3 px-4">
              <p className="font-medium text-sm mb-2">{p.nom}</p>
              <div className="grid grid-cols-3 gap-2">
                {fields.map(f => (
                  <div key={f.key}>
                    <p className="text-[10px] text-muted-foreground">{f.label}</p>
                    <Input type="number" className="h-8 text-xs" value={getVal(p.id, f.key) || ''} onChange={e => setVal(p.id, f.key, parseFloat(e.target.value) || 0)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Produit</TableHead>
                {fields.map(f => <TableHead key={f.key}>{f.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nom}</TableCell>
                  {fields.map(f => (
                    <TableCell key={f.key}>
                      <Input type="number" className="w-24" value={getVal(p.id, f.key) || ''} onChange={e => setVal(p.id, f.key, parseFloat(e.target.value) || 0)} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
