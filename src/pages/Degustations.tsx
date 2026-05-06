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
import { PhotoUpload } from '@/components/PhotoUpload';
import { exportToExcel, exportToPDF, parseExcelFile, findProductByName } from '@/hooks/useExcelImportExport';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';
import { Save, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function Degustations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: entries = [] } = useQuery({
    queryKey: ['degustations', selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('degustations')
        .select('*, produits(nom, categorie)')
        .eq('date_degustation', selectedDate);
      return data || [];
    },
  });

  const [local, setLocal] = useState<Record<string, { quantite: number; motif: string; photo_url?: string | null }>>({});

  const getQty = (pid: string) => {
    if (local[pid]?.quantite !== undefined) return local[pid].quantite;
    const e = entries.find((x: any) => x.produit_id === pid);
    return e?.quantite ?? 0;
  };

  const getMotif = (pid: string) => {
    if (local[pid]?.motif !== undefined) return local[pid].motif;
    const e = entries.find((x: any) => x.produit_id === pid);
    return e?.motif ?? '';
  };

  const getPhoto = (pid: string): string | null => {
    if (local[pid]?.photo_url !== undefined) return local[pid].photo_url ?? null;
    const e = entries.find((x: any) => x.produit_id === pid);
    return (e as any)?.photo_url ?? null;
  };

  const setQty = (pid: string, val: number) => {
    setLocal(prev => ({ ...prev, [pid]: { quantite: val, motif: prev[pid]?.motif ?? getMotif(pid), photo_url: prev[pid]?.photo_url ?? getPhoto(pid) } }));
  };

  const setMotif = (pid: string, val: string) => {
    setLocal(prev => ({ ...prev, [pid]: { quantite: prev[pid]?.quantite ?? getQty(pid), motif: val, photo_url: prev[pid]?.photo_url ?? getPhoto(pid) } }));
  };

  const setPhoto = (pid: string, url: string | null) => {
    setLocal(prev => ({ ...prev, [pid]: { quantite: prev[pid]?.quantite ?? getQty(pid), motif: prev[pid]?.motif ?? getMotif(pid), photo_url: url } }));
  };

  const save = useMutation({
    mutationFn: async () => {
      for (const [pid, vals] of Object.entries(local)) {
        if (vals.quantite === 0 && !vals.motif && !vals.photo_url) continue;
        const existing = entries.find((e: any) => e.produit_id === pid);
        const payload: any = { quantite: vals.quantite, motif: vals.motif, photo_url: vals.photo_url ?? null };
        if (existing) {
          await supabase.from('degustations').update(payload).eq('id', existing.id);
        } else {
          await supabase.from('degustations').insert({
            produit_id: pid, date_degustation: selectedDate,
            ...payload, created_by: user?.id,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['degustations'] });
      setLocal({});
      toast.success('Dégustations sauvegardées');
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('degustations').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['degustations'] }); setDeleteId(null); toast.success('Dégustation supprimée'); },
    onError: () => toast.error('Erreur'),
  });

  const getEntryId = (pid: string) => entries.find((e: any) => e.produit_id === pid)?.id as string | undefined;

  const grouped = products.reduce((acc, p) => {
    const cat = p.categorie || 'DIVERS';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, typeof products>);

  const totalDegustation = products.reduce((s, p) => s + getQty(p.id), 0);

  const handleExport = () => {
    const data = products.map(p => ({ Produit: p.nom, Quantité: getQty(p.id), Motif: getMotif(p.id) }));
    exportToExcel(data, `degustations_${selectedDate}`);
  };

  const handleExportPDF = () => {
    exportToPDF(`Dégustations — ${selectedDate}`,
      ['Produit', 'Quantité', 'Motif'],
      products.map(p => [p.nom, getQty(p.id), getMotif(p.id)]));
  };

  const handleImport = async (file: File) => {
    try {
      const rows = await parseExcelFile(file);
      let imported = 0;
      for (const row of rows) {
        const name = String(row['Produit'] || Object.values(row)[0] || '');
        const pid = findProductByName(name, products);
        if (pid) {
          setLocal(prev => ({
            ...prev,
            [pid]: { quantite: Number(row['Quantité'] || row['quantite'] || 0), motif: String(row['Motif'] || row['motif'] || '') },
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
        <div>
          <h1 className="text-2xl font-heading font-bold">Dégustations</h1>
          <p className="text-sm text-muted-foreground">Total du jour : <span className="font-semibold text-foreground">{totalDegustation}</span> pièces</p>
        </div>
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
          <CardContent className="overflow-x-auto p-3 sm:p-6">
            {/* Mobile cards */}
            <div className="block md:hidden space-y-2">
              {prods.map(p => (
                <div key={p.id} className="border rounded-lg p-2.5 space-y-2">
                  <p className="font-medium text-sm">{p.nom}</p>
                  <div className="flex gap-2 items-center">
                    <Input type="number" className="w-20 h-9" placeholder="Qté" value={getQty(p.id) || ''}
                      onChange={e => setQty(p.id, parseFloat(e.target.value) || 0)} />
                    <Input placeholder="Motif" className="flex-1 h-9" value={getMotif(p.id)}
                      onChange={e => setMotif(p.id, e.target.value)} />
                    <PhotoUpload size="sm" value={getPhoto(p.id)} onChange={url => setPhoto(p.id, url)} />
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Produit</TableHead>
                  <TableHead className="w-24">Quantité</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead className="w-32">Photo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prods.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nom}</TableCell>
                    <TableCell>
                      <Input type="number" className="w-20" value={getQty(p.id) || ''}
                        onChange={e => setQty(p.id, parseFloat(e.target.value) || 0)} />
                    </TableCell>
                    <TableCell>
                      <Input placeholder="Client, événement..." className="w-full" value={getMotif(p.id)}
                        onChange={e => setMotif(p.id, e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <PhotoUpload size="sm" value={getPhoto(p.id)} onChange={url => setPhoto(p.id, url)} />
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
