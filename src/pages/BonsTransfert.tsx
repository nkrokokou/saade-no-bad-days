import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Eye, Send, CheckCircle, Lock } from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  brouillon: 'bg-secondary text-secondary-foreground',
  livre: 'bg-warning text-warning-foreground',
  recu: 'bg-success text-success-foreground',
  cloture: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  brouillon: 'Brouillon', livre: 'Livré', recu: 'Reçu', cloture: 'Clôturé',
};

export default function BonsTransfert() {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [selectedBon, setSelectedBon] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: bons = [] } = useQuery({
    queryKey: ['bons_transfert'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bons_transfert')
        .select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: lignes = [] } = useQuery({
    queryKey: ['bon_lignes', selectedBon],
    enabled: !!selectedBon,
    queryFn: async () => {
      const { data } = await supabase.from('bon_transfert_lignes')
        .select('*, produits(nom)').eq('bon_transfert_id', selectedBon);
      return data || [];
    },
  });

  const createBon = useMutation({
    mutationFn: async () => {
      const { data: bon, error } = await supabase.from('bons_transfert')
        .insert({ date_transfert: format(new Date(), 'yyyy-MM-dd'), statut: 'brouillon', created_by: user?.id })
        .select().single();
      if (error) throw error;
      // Create lines for all products
      const lines = products.map(p => ({
        bon_transfert_id: bon.id, produit_id: p.id,
        qte_prevue: 0, solde_ouverture: 0, qte_recue: 0, perte: 0, solde_fin: 0,
      }));
      if (lines.length > 0) {
        await supabase.from('bon_transfert_lignes').insert(lines);
      }
      return bon;
    },
    onSuccess: (bon) => {
      qc.invalidateQueries({ queryKey: ['bons_transfert'] });
      setSelectedBon(bon.id);
      setCreating(false);
      toast.success('Bon de transfert créé');
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('bons_transfert').update({ statut: status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bons_transfert'] });
      toast.success('Statut mis à jour');
    },
  });

  const updateLigne = async (ligneId: string, field: string, value: number) => {
    const ligne = lignes.find((l: any) => l.id === ligneId);
    if (!ligne) return;
    const updated = { ...ligne, [field]: value };
    const solde_fin = (updated.solde_ouverture || 0) + (updated.qte_recue || 0) - (updated.perte || 0);
    const updateData: Record<string, number> = { [field]: value, solde_fin };
    await supabase.from('bon_transfert_lignes')
      .update(updateData as any).eq('id', ligneId);
    qc.invalidateQueries({ queryKey: ['bon_lignes', selectedBon] });
  };

  const currentBon = bons.find((b: any) => b.id === selectedBon);
  const canEdit = currentBon?.statut === 'brouillon' && ['ceo', 'labo_patisserie', 'labo_viennoiserie'].includes(profile?.role || '');
  const canDeliver = currentBon?.statut === 'brouillon' && ['ceo', 'labo_patisserie', 'labo_viennoiserie'].includes(profile?.role || '');
  const canReceive = currentBon?.statut === 'livre' && ['ceo', 'salle'].includes(profile?.role || '');
  const canClose = currentBon?.statut === 'recu' && ['ceo', 'salle'].includes(profile?.role || '');

  if (selectedBon && currentBon) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setSelectedBon(null)}>← Retour</Button>
            <h1 className="text-xl font-heading font-bold">Bon #{currentBon.id.slice(0, 8)}</h1>
            <Badge className={statusColors[currentBon.statut]}>{statusLabels[currentBon.statut]}</Badge>
          </div>
          <div className="flex gap-2">
            {canDeliver && (
              <Button size="sm" onClick={() => updateStatus.mutate({ id: currentBon.id, status: 'livre' })}>
                <Send className="h-4 w-4 mr-1" /> Marquer livré
              </Button>
            )}
            {canReceive && (
              <Button size="sm" onClick={() => updateStatus.mutate({ id: currentBon.id, status: 'recu' })}>
                <CheckCircle className="h-4 w-4 mr-1" /> Confirmer réception
              </Button>
            )}
            {canClose && (
              <Button size="sm" variant="secondary" onClick={() => updateStatus.mutate({ id: currentBon.id, status: 'cloture' })}>
                <Lock className="h-4 w-4 mr-1" /> Clôturer
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">Date: {currentBon.date_transfert}</p>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Produit</TableHead>
                <TableHead>Qté Prévue</TableHead>
                <TableHead>Solde Ouverture</TableHead>
                <TableHead>Qté Reçue</TableHead>
                <TableHead>Perte</TableHead>
                <TableHead>Solde Fin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.produits?.nom || '—'}</TableCell>
                  {['qte_prevue', 'solde_ouverture', 'qte_recue', 'perte'].map(f => (
                    <TableCell key={f}>
                      <Input type="number" className="w-20" value={l[f] || 0} disabled={!canEdit}
                        onChange={e => updateLigne(l.id, f, parseFloat(e.target.value) || 0)} />
                    </TableCell>
                  ))}
                  <TableCell className="font-semibold">{l.solde_fin || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Bons de Transfert</h1>
        {['ceo', 'labo_patisserie', 'labo_viennoiserie'].includes(profile?.role || '') && (
          <Button onClick={() => createBon.mutate()} disabled={createBon.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Nouveau Bon
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {bons.map((bon: any) => (
          <Card key={bon.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedBon(bon.id)}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">Bon #{bon.id.slice(0, 8)}</p>
                <p className="text-sm text-muted-foreground">{bon.date_transfert}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusColors[bon.statut]}>{statusLabels[bon.statut]}</Badge>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
        {bons.length === 0 && <p className="text-muted-foreground text-center py-8">Aucun bon de transfert</p>}
      </div>
    </div>
  );
}
