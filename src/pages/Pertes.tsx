import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExcelImportExport } from '@/components/ExcelImportExport';
import { SearchFilter } from '@/components/SearchFilter';
import { exportToExcel, exportToPDF, parseExcelFile, findProductByName } from '@/hooks/useExcelImportExport';
import { toast } from 'sonner';
import { format, startOfWeek, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Save, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const LABS = [
  { key: 'labo_patisserie', label: 'Pâtisserie' },
  { key: 'labo_viennoiserie', label: 'Viennoiserie' },
  { key: 'cuisine_salee', label: 'Cuisine' },
] as const;

export default function Pertes() {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7), [weekOffset]);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const defaultTab = profile?.role === 'cuisine_salee' ? 'cuisine_salee' : profile?.role === 'labo_viennoiserie' ? 'labo_viennoiserie' : 'labo_patisserie';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const { data: pertes = [] } = useQuery({
    queryKey: ['pertes', weekStartStr, activeTab],
    queryFn: async () => {
      const { data } = await supabase.from('pertes').select('*, produits(nom)').eq('semaine_debut', weekStartStr).eq('type_labo', activeTab);
      return data || [];
    },
  });

  const [localData, setLocalData] = useState<Record<string, Record<string, number>>>({});
  const getVal = (pid: string, day: string) => { if (localData[pid]?.[day] !== undefined) return localData[pid][day]; return pertes.find((p: any) => p.produit_id === pid && p.jour === day)?.quantite ?? 0; };
  const setVal = (pid: string, day: string, val: number) => setLocalData(prev => ({ ...prev, [pid]: { ...(prev[pid] || {}), [day]: val } }));
  const getTotal = (pid: string) => DAYS.reduce((s, d) => s + getVal(pid, d), 0);

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p => p.nom.toLowerCase().includes(s));
  }, [products, search]);

  const save = useMutation({
    mutationFn: async () => {
      for (const pid of Object.keys(localData)) {
        for (const [day, qty] of Object.entries(localData[pid])) {
          const existing = pertes.find((p: any) => p.produit_id === pid && p.jour === day);
          if (existing) await supabase.from('pertes').update({ quantite: qty }).eq('id', existing.id);
          else await supabase.from('pertes').insert({ produit_id: pid, jour: day, quantite: qty, semaine_debut: weekStartStr, type_labo: activeTab, created_by: user?.id });
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pertes'] }); setLocalData({}); toast.success('Pertes sauvegardées'); },
  });

  const allowedTabs = profile?.role === 'ceo' ? LABS : LABS.filter(l => l.key === profile?.role);

  const handleExport = () => {
    const data = products.map(p => {
      const row: Record<string, any> = { Produit: p.nom };
      DAYS.forEach(d => { row[d.charAt(0).toUpperCase() + d.slice(1)] = getVal(p.id, d); });
      row['Total'] = getTotal(p.id);
      return row;
    });
    exportToExcel(data, `pertes_${activeTab}_${weekStartStr}`);
  };

  const handleExportPDF = () => {
    exportToPDF(`Pertes ${LABS.find(l => l.key === activeTab)?.label} — ${format(weekStart, 'dd/MM/yyyy')}`,
      ['Produit', ...DAYS.map(d => d.slice(0, 3).toUpperCase()), 'Total'],
      products.map(p => [p.nom, ...DAYS.map(d => getVal(p.id, d)), getTotal(p.id)]));
  };

  const handleImport = async (file: File) => {
    try {
      const rows = await parseExcelFile(file);
      let imported = 0;
      for (const row of rows) {
        const name = String(row['Produit'] || row['PRODUITS'] || Object.values(row)[0] || '');
        const pid = findProductByName(name, products);
        if (pid) {
          const updates: Record<string, number> = {};
          for (const day of DAYS) {
            const val = Number(row[day] || row[day.charAt(0).toUpperCase() + day.slice(1)] || row[day.slice(0, 3).toUpperCase()] || 0);
            if (val > 0) updates[day] = val;
          }
          if (Object.keys(updates).length > 0) { setLocalData(prev => ({ ...prev, [pid]: { ...(prev[pid] || {}), ...updates } })); imported++; }
        }
      }
      toast.success(`${imported} produits importés — pensez à sauvegarder`);
    } catch { toast.error('Erreur de lecture du fichier'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold">Pertes Hebdomadaires</h1>
        <div className="flex gap-2 flex-wrap">
          <SearchFilter value={search} onChange={setSearch} className="w-48" />
          <ExcelImportExport onExport={handleExport} onExportPDF={handleExportPDF} onImport={handleImport} />
          <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-1" /> Sauvegarder</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">{format(weekStart, 'dd MMM', { locale: fr })} — {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: fr })}</span>
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>{allowedTabs.map(l => <TabsTrigger key={l.key} value={l.key}>{l.label}</TabsTrigger>)}</TabsList>
        {allowedTabs.map(lab => (
          <TabsContent key={lab.key} value={lab.key}>
            <Card>
              <CardContent className="overflow-x-auto pt-4">
                {/* Mobile: card view */}
                <div className="block md:hidden space-y-3">
                  {filteredProducts.map(p => {
                    const total = getTotal(p.id);
                    if (!search && total === 0 && !Object.keys(localData[p.id] || {}).length) return null;
                    return (
                      <div key={p.id} className="border rounded-lg p-3 space-y-2">
                        <p className="font-medium text-sm">{p.nom} <span className="text-primary font-bold ml-2">Total: {total}</span></p>
                        <div className="grid grid-cols-4 gap-1">
                          {DAYS.map(d => (
                            <div key={d} className="text-center">
                              <p className="text-[10px] text-muted-foreground uppercase">{d.slice(0, 3)}</p>
                              <Input type="number" className="h-8 text-xs text-center px-1" value={getVal(p.id, d) || ''}
                                onChange={e => setVal(p.id, d, parseFloat(e.target.value) || 0)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {search && filteredProducts.length === 0 && <p className="text-center text-muted-foreground py-4">Aucun résultat</p>}
                </div>
                {/* Desktop: table */}
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px] sticky left-0 bg-card">Produit</TableHead>
                      {DAYS.map(d => <TableHead key={d} className="text-center capitalize min-w-[70px]">{d.slice(0, 3)}</TableHead>)}
                      <TableHead className="text-center font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium sticky left-0 bg-card">{p.nom}</TableCell>
                        {DAYS.map(d => (
                          <TableCell key={d}>
                            <Input type="number" className="w-16 text-center" value={getVal(p.id, d) || ''} onChange={e => setVal(p.id, d, parseFloat(e.target.value) || 0)} />
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold">{getTotal(p.id)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
