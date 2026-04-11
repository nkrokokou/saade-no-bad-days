import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';
import { Save, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Degustations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: entries = [] } = useQuery({
    queryKey: ['degustations', selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('degustations')
        .select('*, produits(nom, categorie)')
        .eq('date_degustation', selectedDate);
      return data || [];
    },
  });

  const [local, setLocal] = useState<Record<string, { quantite: number; motif: string }>>({});

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

  const setQty = (pid: string, val: number) => {
    setLocal(prev => ({ ...prev, [pid]: { quantite: val, motif: prev[pid]?.motif ?? getMotif(pid) } }));
  };

  const setMotif = (pid: string, val: string) => {
    setLocal(prev => ({ ...prev, [pid]: { quantite: prev[pid]?.quantite ?? getQty(pid), motif: val } }));
  };

  const save = useMutation({
    mutationFn: async () => {
      for (const [pid, vals] of Object.entries(local)) {
        if (vals.quantite === 0 && !vals.motif) continue;
        const existing = entries.find((e: any) => e.produit_id === pid);
        if (existing) {
          await supabase.from('degustations').update(vals).eq('id', existing.id);
        } else {
          await supabase.from('degustations').insert({
            produit_id: pid,
            date_degustation: selectedDate,
            quantite: vals.quantite,
            motif: vals.motif,
            created_by: user?.id,
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

  const grouped = products.reduce((acc, p) => {
    const cat = p.categorie || 'DIVERS';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, typeof products>);

  const totalDegustation = products.reduce((s, p) => s + getQty(p.id), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-heading font-bold">Dégustations</h1>
          <p className="text-sm text-muted-foreground">Total du jour : <span className="font-semibold text-foreground">{totalDegustation}</span> pièces</p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-1" /> Sauvegarder
        </Button>
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
                  <TableHead className="min-w-[180px]">Produit</TableHead>
                  <TableHead className="w-24">Quantité</TableHead>
                  <TableHead>Motif</TableHead>
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
