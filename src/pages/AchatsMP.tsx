import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCardClickable } from '@/components/KpiCardClickable';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ExcelImportExport } from '@/components/ExcelImportExport';
import { SearchFilter } from '@/components/SearchFilter';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToExcel, exportToPDF, parseExcelFile } from '@/hooks/useExcelImportExport';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';
import { Plus, ChevronLeft, ChevronRight, Trash2, ShoppingCart } from 'lucide-react';

export default function AchatsMP() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<{ fournisseur: string; produit: string; quantite: number; unite: string; prix_unitaire: number; matiere_premiere_id: string | null }>({ fournisseur: '', produit: '', quantite: 0, unite: 'kg', prix_unitaire: 0, matiere_premiere_id: null });

  const { data: achats = [] } = useQuery({
    queryKey: ['achats_mp', selectedDate],
    queryFn: async () => { const { data } = await supabase.from('achats_mp').select('*').eq('date_achat', selectedDate).order('created_at', { ascending: false }); return data || []; },
  });

  const { data: mps = [] } = useQuery({
    queryKey: ['matieres_premieres', 'select'],
    queryFn: async () => { const { data } = await supabase.from('matieres_premieres').select('id, nom, unite, prix_unitaire, fournisseur').eq('actif', true).order('nom'); return (data || []) as any[]; },
  });

  const filteredAchats = useMemo(() => {
    if (!search) return achats;
    const s = search.toLowerCase();
    return achats.filter((a: any) => a.produit.toLowerCase().includes(s) || a.fournisseur.toLowerCase().includes(s));
  }, [achats, search]);

  const addAchat = useMutation({
    mutationFn: async () => {
      if (!form.produit?.trim()) throw new Error('Le nom du produit est obligatoire');
      if (!form.quantite || form.quantite <= 0) throw new Error('La quantité doit être supérieure à 0');
      if (!form.prix_unitaire || form.prix_unitaire <= 0) throw new Error('Le prix unitaire doit être supérieur à 0');
      const { error } = await supabase.from('achats_mp').insert({
        date_achat: selectedDate,
        fournisseur: form.fournisseur || '',
        produit: form.produit.trim(),
        quantite: form.quantite,
        unite: form.unite || 'kg',
        prix_unitaire: form.prix_unitaire,
        prix_total: form.quantite * form.prix_unitaire,
        matiere_premiere_id: form.matiere_premiere_id,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['achats_mp'] }); qc.invalidateQueries({ queryKey: ['v_stock_mp'] }); setShowAdd(false); setForm({ fournisseur: '', produit: '', quantite: 0, unite: 'kg', prix_unitaire: 0, matiere_premiere_id: null }); toast.success('Achat ajouté · stock MP mis à jour'); },
    onError: (e: any) => toast.error(e?.message || 'Erreur lors de l\'ajout'),
  });

  const deleteAchat = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('achats_mp').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['achats_mp'] }); qc.invalidateQueries({ queryKey: ['v_stock_mp'] }); setDeleteId(null); toast.success('Achat supprimé'); },
  });

  const totalJour = achats.reduce((s: number, a: any) => s + (a.prix_total || 0), 0);

  const handleExport = () => {
    exportToExcel(achats.map((a: any) => ({ Fournisseur: a.fournisseur, Produit: a.produit, Quantité: a.quantite, Unité: a.unite, 'Prix Unit.': a.prix_unitaire, 'Prix Total': a.prix_total })), `achats_mp_${selectedDate}`);
  };
  const handleExportPDF = () => {
    exportToPDF(`Achats MP · ${selectedDate}`, ['Fournisseur', 'Produit', 'Qté', 'Unité', 'P.U.', 'Total'],
      achats.map((a: any) => [a.fournisseur, a.produit, a.quantite, a.unite, a.prix_unitaire, a.prix_total]));
  };
  const handleImport = async (file: File) => {
    try {
      const rows = await parseExcelFile(file);
      let imported = 0;
      for (const row of rows) {
        const produit = String(row['Produit'] || Object.values(row)[1] || '');
        const fournisseur = String(row['Fournisseur'] || Object.values(row)[0] || '');
        const quantite = Number(row['Quantité'] || 0);
        const prix_unitaire = Number(row['Prix Unit.'] || 0);
        if (produit) {
          await supabase.from('achats_mp').insert({ date_achat: selectedDate, fournisseur, produit, quantite, unite: String(row['Unité'] || 'kg'), prix_unitaire, prix_total: quantite * prix_unitaire, created_by: user?.id });
          imported++;
        }
      }
      qc.invalidateQueries({ queryKey: ['achats_mp'] });
      toast.success(`${imported} achats importés`);
    } catch (e: any) { toast.error(`Import : ${e?.message || 'Erreur inconnue'}`); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><ShoppingCart className="h-6 w-6 text-primary" /> Achats MP</h1>
        <div className="flex gap-2 flex-wrap">
          <SearchFilter value={search} onChange={setSearch} placeholder="Rechercher…" className="w-48" />
          <ExcelImportExport onExport={handleExport} onExportPDF={handleExportPDF} onImport={handleImport} />
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Ajouter</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvel achat</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Matière première (référentiel)</Label>
                  <Select value={form.matiere_premiere_id || ''} onValueChange={v => {
                    const mp = mps.find((m: any) => m.id === v);
                    if (mp) setForm(p => ({ ...p, matiere_premiere_id: mp.id, produit: mp.nom, unite: mp.unite, prix_unitaire: mp.prix_unitaire || p.prix_unitaire, fournisseur: mp.fournisseur || p.fournisseur }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Choisir une MP du référentiel…" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {mps.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Fournisseur</Label><Input value={form.fournisseur} onChange={e => setForm(p => ({ ...p, fournisseur: e.target.value }))} /></div>
                <div><Label>Produit / MP</Label><Input value={form.produit} onChange={e => setForm(p => ({ ...p, produit: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Quantité</Label><Input type="number" value={form.quantite || ''} onChange={e => setForm(p => ({ ...p, quantite: parseFloat(e.target.value) || 0 }))} /></div>
                  <div><Label>Unité</Label><Input value={form.unite} onChange={e => setForm(p => ({ ...p, unite: e.target.value }))} /></div>
                </div>
                <div><Label>Prix unitaire (FCFA)</Label><Input type="number" value={form.prix_unitaire || ''} onChange={e => setForm(p => ({ ...p, prix_unitaire: parseFloat(e.target.value) || 0 }))} /></div>
                <p className="text-sm text-muted-foreground">Total : {((form.quantite || 0) * (form.prix_unitaire || 0)).toLocaleString('fr-FR')} FCFA</p>
                <Button className="w-full" onClick={() => addAchat.mutate()} disabled={addAchat.isPending || !form.produit}>{addAchat.isPending ? 'Ajout...' : 'Ajouter'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" className="w-44" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCardClickable
          title="Total achats du jour"
          value={<>{totalJour.toLocaleString('fr-FR')} F</>}
          detailTitle={`Achats du ${selectedDate}`}
          exportFilename={`achats-${selectedDate}`}
          columns={[
            { key: 'fournisseur', label: 'Fournisseur' },
            { key: 'produit', label: 'Produit' },
            { key: 'quantite', label: 'Qté' },
            { key: 'unite', label: 'Unité' },
            { key: 'prix_unitaire', label: 'PU (F)', format: (v: any) => Number(v).toLocaleString('fr-FR') },
            { key: 'prix_total', label: 'Total (F)', format: (v: any) => Number(v).toLocaleString('fr-FR') },
          ]}
          rows={achats as any[]}
        />
        <KpiCardClickable
          title="Nombre d'achats"
          value={achats.length}
          detailTitle="Liste des achats"
          exportFilename={`achats-list-${selectedDate}`}
          columns={[
            { key: 'fournisseur', label: 'Fournisseur' },
            { key: 'produit', label: 'Produit' },
            { key: 'prix_total', label: 'Total (F)', format: (v: any) => Number(v).toLocaleString('fr-FR') },
          ]}
          rows={achats as any[]}
        />
        <KpiCardClickable
          title="Fournisseurs distincts"
          value={new Set((achats as any[]).map((a: any) => a.fournisseur)).size}
          detailTitle="Total par fournisseur"
          exportFilename={`achats-fournisseurs-${selectedDate}`}
          columns={[
            { key: 'fournisseur', label: 'Fournisseur' },
            { key: 'nb', label: 'Nb achats' },
            { key: 'total', label: 'Total (F)', format: (v: any) => Number(v).toLocaleString('fr-FR') },
          ]}
          rows={Object.values((achats as any[]).reduce((acc: any, a: any) => {
            const k = a.fournisseur || '·';
            if (!acc[k]) acc[k] = { fournisseur: k, nb: 0, total: 0 };
            acc[k].nb += 1; acc[k].total += Number(a.prix_total || 0);
            return acc;
          }, {} as any))}
        />
        <KpiCardClickable
          title="Produits distincts"
          value={new Set((achats as any[]).map((a: any) => a.produit)).size}
          detailTitle="Total par produit"
          exportFilename={`achats-produits-${selectedDate}`}
          columns={[
            { key: 'produit', label: 'Produit' },
            { key: 'qte', label: 'Qté totale' },
            { key: 'total', label: 'Total (F)', format: (v: any) => Number(v).toLocaleString('fr-FR') },
          ]}
          rows={Object.values((achats as any[]).reduce((acc: any, a: any) => {
            const k = a.produit || '·';
            if (!acc[k]) acc[k] = { produit: k, qte: 0, total: 0 };
            acc[k].qte += Number(a.quantite || 0); acc[k].total += Number(a.prix_total || 0);
            return acc;
          }, {} as any))}
        />
      </div>


      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex justify-between"><span>Achats du jour</span><span className="text-primary font-bold">{totalJour.toLocaleString('fr-FR')} FCFA</span></CardTitle></CardHeader>
        <CardContent>
          {/* Mobile */}
          <div className="block md:hidden space-y-3">
            {filteredAchats.map((a: any) => (
              <div key={a.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div><p className="font-medium text-sm">{a.produit}</p><p className="text-xs text-muted-foreground">{a.fournisseur}</p></div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteId(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{a.quantite} {a.unite}</span>
                  <span>P.U. {a.prix_unitaire?.toLocaleString('fr-FR')}</span>
                  <span className="font-medium text-foreground">{a.prix_total?.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>
            ))}
            {filteredAchats.length === 0 && <p className="text-center text-muted-foreground py-4">Aucun achat</p>}
          </div>
          {/* Desktop */}
          <Table className="hidden md:table">
            <TableHeader><TableRow><TableHead>Fournisseur</TableHead><TableHead>Produit</TableHead><TableHead>Qté</TableHead><TableHead>Unité</TableHead><TableHead>P.U.</TableHead><TableHead>Total</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredAchats.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>{a.fournisseur}</TableCell><TableCell className="font-medium">{a.produit}</TableCell><TableCell>{a.quantite}</TableCell><TableCell>{a.unite}</TableCell>
                  <TableCell>{a.prix_unitaire?.toLocaleString('fr-FR')}</TableCell><TableCell className="font-medium">{a.prix_total?.toLocaleString('fr-FR')}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => setDeleteId(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
              {filteredAchats.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun achat ce jour</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Supprimer cet achat ?" description="Cette action est irréversible." destructive onConfirm={() => deleteId && deleteAchat.mutate(deleteId)} />
    </div>
  );
}
