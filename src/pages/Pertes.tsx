import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SearchFilter } from '@/components/SearchFilter';
import { exportToExcel, exportToPDF } from '@/hooks/useExcelImportExport';
import { format, subDays, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Lock, TrendingDown, Download, FileText } from 'lucide-react';

/**
 * Module Pertes — 100% automatique en lecture seule.
 * Source de vérité :
 *   • Pertes Clôture = Ouv + Reçu − Vendu − Invendu − Dégustation − Stock Fin Compté
 *   • Pertes Production = qte_perte saisie en Production Labo (référence du jour)
 * Personne ne saisit ici (CEO comprise) — supprime la fraude/erreurs humaines.
 */
export default function Pertes() {
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: clotures = [] } = useQuery({
    queryKey: ['pertes-cloture', selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('cloture_journaliere').select('*').eq('date_cloture', selectedDate);
      return data || [];
    },
  });

  const { data: productions = [] } = useQuery({
    queryKey: ['pertes-production', selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from('production_labo').select('*').eq('date_production', selectedDate);
      return data || [];
    },
  });

  const computePerteCloture = (pid: string) => {
    const c: any = clotures.find((x: any) => x.produit_id === pid);
    if (!c) return null;
    const fin = Number(c.stock_fin_compte ?? NaN);
    if (Number.isNaN(fin)) return null;
    const calc = Number(c.stock_ouverture || 0) + Number(c.qte_recue || 0)
      - Number(c.qte_vendue || 0) - Number(c.qte_invendu || 0) - Number(c.qte_degustation || 0) - fin;
    return Math.max(0, calc);
  };

  const computePerteProduction = (pid: string) => {
    const p: any = productions.find((x: any) => x.produit_id === pid);
    return p ? Number(p.qte_perte || 0) : 0;
  };

  const rows = useMemo(() => {
    return products
      .map(p => {
        const c = computePerteCloture(p.id);
        const prod = computePerteProduction(p.id);
        return { p, c, prod, total: (c || 0) + prod };
      })
      .filter(r => r.total > 0 || r.c !== null)
      .filter(r => !search || r.p.nom.toLowerCase().includes(search.toLowerCase()));
  }, [products, clotures, productions, search]);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  const handleExport = () => {
    exportToExcel(rows.map(r => ({
      Produit: r.p.nom, Catégorie: r.p.categorie,
      'Perte Clôture': r.c ?? '—', 'Perte Production': r.prod, Total: r.total,
    })), `pertes_${selectedDate}`);
  };
  const handleExportPDF = () => {
    exportToPDF(`Pertes — ${selectedDate}`, ['Produit', 'Cat.', 'Clôture', 'Production', 'Total'],
      rows.map(r => [r.p.nom, r.p.categorie, r.c ?? '—', r.prod, r.total]));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <TrendingDown className="h-6 w-6 text-destructive" /> Pertes
          <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground border rounded-full px-2 py-0.5"><Lock className="h-3 w-3" /> Auto · Lecture seule</span>
        </h1>
        <div className="flex gap-2 flex-wrap">
          <SearchFilter value={search} onChange={setSearch} className="w-48" />
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Excel</Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="h-4 w-4 mr-1" />PDF</Button>
        </div>
      </div>

      <Alert>
        <AlertDescription className="text-xs">
          Les pertes sont <strong>calculées automatiquement</strong> à partir de la Clôture Journalière (stock physique compté) et de la Production Labo. Aucune saisie manuelle possible — pour modifier une perte, corrige les chiffres dans Clôture ou Production.
          <br />Formule Clôture : <em>Ouverture + Reçu − Vendu − Invendu − Dégustation − Stock Fin Compté</em>
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">{format(new Date(selectedDate), 'EEEE dd MMM yyyy', { locale: fr })}</span>
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row justify-between items-center">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Pertes du jour</CardTitle>
          <span className="text-lg font-bold text-destructive">Total : {grandTotal}</span>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Aucune perte enregistrée pour cette date. Saisis le stock physique compté en Clôture Journalière pour calculer.</p>}
          {rows.length > 0 && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Produit</TableHead><TableHead>Catégorie</TableHead>
                <TableHead className="text-center">Perte Clôture</TableHead>
                <TableHead className="text-center">Perte Production</TableHead>
                <TableHead className="text-center font-bold">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.p.id}>
                    <TableCell className="font-medium">{r.p.nom}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.p.categorie}</TableCell>
                    <TableCell className="text-center">{r.c === null ? <span className="text-xs text-muted-foreground">non compté</span> : r.c}</TableCell>
                    <TableCell className="text-center">{r.prod}</TableCell>
                    <TableCell className="text-center font-bold text-destructive">{r.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
