import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Save, Trash2, FileDown, Upload } from 'lucide-react';
import { exportToExcel } from '@/hooks/useExcelImportExport';
import * as XLSX from 'xlsx';

const UNITS = ['G', 'KG', 'L', 'ML', 'pièce', 'tranche'];

export default function Inventaire() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeSection, setActiveSection] = useState('mise_en_place');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: entries = [] } = useQuery({
    queryKey: ['inventaire', selectedDate, activeSection],
    queryFn: async () => {
      const { data } = await supabase.from('inventaire')
        .select('*')
        .eq('date_inventaire', selectedDate)
        .eq('section', activeSection)
        .order('created_at');
      return data || [];
    },
  });

  const [newItems, setNewItems] = useState<{ nom_produit: string; quantite: number; unite: string }[]>([]);

  const addRow = () => setNewItems(prev => [...prev, { nom_produit: '', quantite: 0, unite: 'G' }]);

  const saveAll = useMutation({
    mutationFn: async () => {
      const toInsert = newItems.filter(i => i.nom_produit.trim()).map(i => ({
        ...i, section: activeSection, date_inventaire: selectedDate, created_by: user?.id,
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('inventaire').insert(toInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventaire'] });
      setNewItems([]);
      toast.success('Inventaire sauvegardé');
    },
  });

  const deleteEntry = async (id: string) => {
    await supabase.from('inventaire').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['inventaire'] });
  };

  const handleExport = () => {
    const rows = entries.map((e: any) => ({
      INGREDIENTS: e.nom_produit,
      QTE: e.quantite,
      UNITE: e.unite,
    }));
    if (rows.length === 0) rows.push({ INGREDIENTS: '', QTE: 0, UNITE: 'G' });
    exportToExcel(rows, `inventaire_${activeSection}_${selectedDate}`, 'Inventaire');
  };

  const handleImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const norm = (s: any) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const parseNum = (v: any) => {
        const m = String(v ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/);
        return m ? parseFloat(m[0]) : 0;
      };
      const collected: any[] = [];
      for (const sn of wb.SheetNames) {
        const grid: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
        let headerIdx = -1, colNom = -1, colQte = -1, colUnite = -1;
        for (let i = 0; i < grid.length; i++) {
          const row = (grid[i] || []).map(norm);
          const ing = row.findIndex(c => c.includes('ingredient') || c.includes('produit') || c.includes('matiere'));
          if (ing >= 0) {
            const qte = row.findIndex(c => c.includes('qte') || c.includes('quantite'));
            if (qte >= 0) {
              headerIdx = i; colNom = ing; colQte = qte;
              colUnite = row.findIndex(c => c.includes('unite'));
              break;
            }
          }
        }
        if (headerIdx < 0) continue;
        for (let i = headerIdx + 1; i < grid.length; i++) {
          const row = grid[i] || [];
          const nom = String(row[colNom] ?? '').trim();
          if (!nom) continue;
          if (norm(nom).includes('ingredient') || norm(nom).includes('produit')) break;
          collected.push({
            section: activeSection,
            date_inventaire: selectedDate,
            nom_produit: nom,
            quantite: parseNum(row[colQte]),
            unite: String((colUnite >= 0 ? row[colUnite] : '') || 'G').trim().toUpperCase(),
            created_by: user?.id,
          });
        }
      }
      if (collected.length === 0) {
        toast.warning("Aucune ligne trouvée. Format attendu : INGREDIENTS / QTE / UNITE.");
        return;
      }
      const { error } = await supabase.from('inventaire').insert(collected);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['inventaire'] });
      toast.success(`${collected.length} ligne(s) importée(s)`);
    } catch (e: any) {
      console.error(e);
      toast.error('Erreur import : ' + (e.message || 'Format invalide'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold">Inventaire Cuisine</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Importer
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
          <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
          <Button size="sm" onClick={() => saveAll.mutate()} disabled={saveAll.isPending}>
            <Save className="h-4 w-4 mr-1" /> Sauvegarder
          </Button>
        </div>
      </div>

      <Input type="date" className="w-44" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />

      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList>
          <TabsTrigger value="mise_en_place">Mise en Place</TabsTrigger>
          <TabsTrigger value="nouvelle_carte">Nouvelle Carte</TabsTrigger>
        </TabsList>

        {['mise_en_place', 'nouvelle_carte'].map(sec => (
          <TabsContent key={sec} value={sec}>
            <Card>
              <CardContent className="overflow-x-auto pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Produit</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.nom_produit}</TableCell>
                        <TableCell>{e.quantite}</TableCell>
                        <TableCell>{e.unite}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteEntry(e.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {newItems.map((item, i) => (
                      <TableRow key={`new-${i}`}>
                        <TableCell>
                          <Input placeholder="Nom du produit" value={item.nom_produit}
                            onChange={e => setNewItems(prev => prev.map((x, j) => j === i ? { ...x, nom_produit: e.target.value } : x))} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="w-24" value={item.quantite || ''}
                            onChange={e => setNewItems(prev => prev.map((x, j) => j === i ? { ...x, quantite: parseFloat(e.target.value) || 0 } : x))} />
                        </TableCell>
                        <TableCell>
                          <Select value={item.unite} onValueChange={v => setNewItems(prev => prev.map((x, j) => j === i ? { ...x, unite: v } : x))}>
                            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setNewItems(prev => prev.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
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
