import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format, startOfWeek, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Save, ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const LABS = [
  { key: 'labo_patisserie', label: 'Labo Pâtisserie' },
  { key: 'labo_viennoiserie', label: 'Labo Viennoiserie' },
  { key: 'cuisine_salee', label: 'Cuisine Salée' },
] as const;

export default function Pertes() {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const defaultTab = profile?.role === 'cuisine_salee' ? 'cuisine_salee'
    : profile?.role === 'labo_viennoiserie' ? 'labo_viennoiserie' : 'labo_patisserie';

  const [activeTab, setActiveTab] = useState(defaultTab);

  const { data: pertes = [] } = useQuery({
    queryKey: ['pertes', weekStartStr, activeTab],
    queryFn: async () => {
      const { data } = await supabase.from('pertes')
        .select('*, produits(nom)')
        .eq('semaine_debut', weekStartStr)
        .eq('type_labo', activeTab);
      return data || [];
    },
  });

  const [localData, setLocalData] = useState<Record<string, Record<string, number>>>({});

  const getVal = (productId: string, day: string) => {
    if (localData[productId]?.[day] !== undefined) return localData[productId][day];
    const entry = pertes.find((p: any) => p.produit_id === productId && p.jour === day);
    return entry?.quantite ?? 0;
  };

  const setVal = (productId: string, day: string, val: number) => {
    setLocalData(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [day]: val },
    }));
  };

  const getTotal = (productId: string) => DAYS.reduce((s, d) => s + getVal(productId, d), 0);

  const save = useMutation({
    mutationFn: async () => {
      for (const productId of Object.keys(localData)) {
        for (const [day, qty] of Object.entries(localData[productId])) {
          const existing = pertes.find((p: any) => p.produit_id === productId && p.jour === day);
          if (existing) {
            await supabase.from('pertes').update({ quantite: qty }).eq('id', existing.id);
          } else {
            await supabase.from('pertes').insert({
              produit_id: productId, jour: day, quantite: qty,
              semaine_debut: weekStartStr, type_labo: activeTab, created_by: user?.id,
            });
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pertes'] });
      setLocalData({});
      toast.success('Pertes sauvegardées');
    },
  });

  const allowedTabs = profile?.role === 'ceo' ? LABS : LABS.filter(l => l.key === profile?.role);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold">Pertes Hebdomadaires</h1>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-1" /> Sauvegarder
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(weekStart, 'dd MMM', { locale: fr })} — {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: fr })}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {allowedTabs.map(l => (
            <TabsTrigger key={l.key} value={l.key}>{l.label}</TabsTrigger>
          ))}
        </TabsList>

        {allowedTabs.map(lab => (
          <TabsContent key={lab.key} value={lab.key}>
            <Card>
              <CardContent className="overflow-x-auto pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px] sticky left-0 bg-card">Produit</TableHead>
                      {DAYS.map(d => <TableHead key={d} className="text-center capitalize min-w-[70px]">{d.slice(0, 3)}</TableHead>)}
                      <TableHead className="text-center font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium sticky left-0 bg-card">{p.nom}</TableCell>
                        {DAYS.map(d => (
                          <TableCell key={d}>
                            <Input type="number" className="w-16 text-center" value={getVal(p.id, d) || ''}
                              onChange={e => setVal(p.id, d, parseFloat(e.target.value) || 0)} />
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
