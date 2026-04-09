import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Save, Trash2 } from 'lucide-react';

const UNITS = ['g', 'pièce', 'litre', 'tranche', 'kg', 'ml'];

export default function Inventaire() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeSection, setActiveSection] = useState('mise_en_place');

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

  const addRow = () => setNewItems(prev => [...prev, { nom_produit: '', quantite: 0, unite: 'g' }]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold">Inventaire Cuisine</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
          <Button onClick={() => saveAll.mutate()} disabled={saveAll.isPending}>
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
