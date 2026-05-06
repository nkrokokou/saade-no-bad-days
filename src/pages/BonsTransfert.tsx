import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Eye, Send, CheckCircle, ShieldCheck, Download, FileText, FileEdit, Search, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { exportToExcel, exportToPDF } from '@/hooks/useExcelImportExport';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const STATUSES = ['brouillon', 'envoye', 'recu', 'valide'] as const;
type Status = typeof STATUSES[number];

const statusColors: Record<string, string> = {
  brouillon: 'bg-secondary text-secondary-foreground',
  envoye: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  recu: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  valide: 'bg-green-500/15 text-green-700 dark:text-green-400',
  // legacy fallbacks
  livre: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  cloture: 'bg-green-500/15 text-green-700 dark:text-green-400',
};

const statusLabels: Record<string, string> = {
  brouillon: 'Brouillon', envoye: 'Envoyé', recu: 'Reçu', valide: 'Validé',
  livre: 'Envoyé', cloture: 'Validé',
};

export default function BonsTransfert() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const audit = useAuditLog();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [selectedBon, setSelectedBon] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteBonId, setDeleteBonId] = useState<string | null>(null);

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
      const lines = products.map(p => ({
        bon_transfert_id: bon.id, produit_id: p.id,
        qte_prevue: 0, solde_ouverture: 0, qte_recue: 0, perte: 0, solde_fin: 0,
      }));
      if (lines.length > 0) await supabase.from('bon_transfert_lignes').insert(lines);
      audit('create', 'bons_transfert', bon.id, { date: bon.date_transfert });
      return bon;
    },
    onSuccess: (bon) => {
      qc.invalidateQueries({ queryKey: ['bons_transfert'] });
      setSelectedBon(bon.id);
      toast.success('Bon de transfert créé');
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const advanceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const updates: any = { statut: status };
      const now = new Date().toISOString();
      if (status === 'envoye') { updates.sent_at = now; updates.sent_by = user?.id; }
      if (status === 'recu') { updates.received_at = now; updates.received_by = user?.id; }
      if (status === 'valide') { updates.validated_at = now; updates.validated_by = user?.id; }
      const { error } = await supabase.from('bons_transfert').update(updates).eq('id', id);
      if (error) throw error;
      audit('update', 'bons_transfert', id, { from: 'workflow', to: status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bons_transfert'] });
      toast.success('Statut mis à jour');
    },
  });

  const deleteBon = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('bon_transfert_lignes').delete().eq('bon_transfert_id', id);
      const { error } = await supabase.from('bons_transfert').delete().eq('id', id);
      if (error) throw error;
      audit('delete', 'bons_transfert', id, {});
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['bons_transfert'] });
      setDeleteBonId(null);
      if (selectedBon === id) setSelectedBon(null);
      toast.success('Bon supprimé');
    },
    onError: () => toast.error('Suppression impossible'),
  });

  const updateNotes = async (id: string, notes: string) => {
    await supabase.from('bons_transfert').update({ notes } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['bons_transfert'] });
  };

  const updateLigne = async (ligneId: string, field: string, value: number) => {
    const ligne = lignes.find((l: any) => l.id === ligneId);
    if (!ligne) return;
    const updated = { ...ligne, [field]: value };
    const solde_fin = (updated.solde_ouverture || 0) + (updated.qte_recue || 0) - (updated.perte || 0);
    const updateData: Record<string, number> = { [field]: value, solde_fin };
    await supabase.from('bon_transfert_lignes').update(updateData as any).eq('id', ligneId);
    qc.invalidateQueries({ queryKey: ['bon_lignes', selectedBon] });
  };

  const currentBon = bons.find((b: any) => b.id === selectedBon);
  // Permissions adaptées au workflow
  const isDraft = currentBon?.statut === 'brouillon';
  const isSent = currentBon?.statut === 'envoye' || currentBon?.statut === 'livre';
  const isReceived = currentBon?.statut === 'recu';
  const canEdit = isDraft && can('bons_transfert', 'update');
  const canSend = isDraft && can('bons_transfert', 'update');
  const canReceive = isSent && can('bons_transfert', 'update');
  const canValidate = isReceived && can('bons_transfert', 'update');

  if (selectedBon && currentBon) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" onClick={() => setSelectedBon(null)}>← Retour</Button>
            <h1 className="text-xl font-heading font-bold">Bon #{currentBon.id.slice(0, 8)}</h1>
            <Badge className={statusColors[currentBon.statut]}>{statusLabels[currentBon.statut]}</Badge>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => {
              const data = lignes.map((l: any) => ({
                Produit: l.produits?.nom || '', 'Qté Prévue': l.qte_prevue, 'Solde Ouverture': l.solde_ouverture,
                'Qté Reçue': l.qte_recue, Perte: l.perte, 'Solde Fin': l.solde_fin,
              }));
              exportToExcel(data, `bon_${currentBon.id.slice(0, 8)}`);
            }}><Download className="h-3.5 w-3.5 mr-1" /> Excel</Button>
            <Button size="sm" variant="outline" onClick={() => {
              exportToPDF(`Bon de Transfert #${currentBon.id.slice(0, 8)} — ${currentBon.date_transfert}`,
                ['Produit', 'Qté Prévue', 'Solde Ouv.', 'Qté Reçue', 'Perte', 'Solde Fin'],
                lignes.map((l: any) => [l.produits?.nom || '', l.qte_prevue, l.solde_ouverture, l.qte_recue, l.perte, l.solde_fin]));
            }}><FileText className="h-3.5 w-3.5 mr-1" /> PDF</Button>
            {canSend && <Button size="sm" onClick={() => advanceStatus.mutate({ id: currentBon.id, status: 'envoye' })}><Send className="h-4 w-4 mr-1" /> Envoyer</Button>}
            {canReceive && <Button size="sm" onClick={() => advanceStatus.mutate({ id: currentBon.id, status: 'recu' })}><CheckCircle className="h-4 w-4 mr-1" /> Confirmer réception</Button>}
            {canValidate && <Button size="sm" variant="default" onClick={() => advanceStatus.mutate({ id: currentBon.id, status: 'valide' })}><ShieldCheck className="h-4 w-4 mr-1" /> Valider définitivement</Button>}
            {isDraft && can('bons_transfert', 'delete') && <Button size="sm" variant="destructive" onClick={() => setDeleteBonId(currentBon.id)}><Trash2 className="h-4 w-4 mr-1" /> Supprimer</Button>}
          </div>
        </div>

        {/* Timeline workflow */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-2 overflow-x-auto">
              {[
                { key: 'brouillon', label: 'Créé', date: currentBon.created_at },
                { key: 'envoye', label: 'Envoyé', date: currentBon.sent_at },
                { key: 'recu', label: 'Reçu', date: currentBon.received_at },
                { key: 'valide', label: 'Validé', date: currentBon.validated_at },
              ].map((step, i, arr) => {
                const idx = STATUSES.indexOf(currentBon.statut === 'livre' ? 'envoye' : currentBon.statut === 'cloture' ? 'valide' : currentBon.statut as Status);
                const stepIdx = STATUSES.indexOf(step.key as Status);
                const done = stepIdx <= idx;
                return (
                  <div key={step.key} className="flex items-center gap-1 flex-1 min-w-[80px]">
                    <div className="flex flex-col items-center text-center">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{i + 1}</div>
                      <p className="text-xs mt-1 font-medium">{step.label}</p>
                      {step.date && <p className="text-[10px] text-muted-foreground">{format(new Date(step.date), 'dd/MM HH:mm', { locale: fr })}</p>}
                    </div>
                    {i < arr.length - 1 && <div className={`flex-1 h-0.5 ${done && stepIdx < idx ? 'bg-primary' : 'bg-muted'}`} />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent className="py-4">
            <label className="text-sm font-medium flex items-center gap-1 mb-2"><FileEdit className="h-4 w-4" /> Notes du bon</label>
            <Textarea
              defaultValue={currentBon.notes || ''}
              placeholder="Remarques, motifs, signatures..."
              disabled={!can('bons_transfert', 'update')}
              onBlur={e => updateNotes(currentBon.id, e.target.value)}
              rows={2}
            />
          </CardContent>
        </Card>

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
                      <Input type="number" className="w-20" value={l[f] || 0} disabled={!canEdit && !(f === 'qte_recue' && canReceive)}
                        onChange={e => updateLigne(l.id, f, parseFloat(e.target.value) || 0)} />
                    </TableCell>
                  ))}
                  <TableCell className="font-semibold">{l.solde_fin || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ConfirmDialog open={!!deleteBonId} onOpenChange={() => setDeleteBonId(null)} title="Supprimer ce bon ?" description="Toutes les lignes du bon seront supprimées définitivement." destructive onConfirm={() => deleteBonId && deleteBon.mutate(deleteBonId)} />
      </div>
    );
  }

  const filteredBons = bons.filter((b: any) =>
    !search || b.id.toLowerCase().includes(search.toLowerCase()) || b.date_transfert.includes(search)
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold">Bons de Transfert</h1>
        {can('bons_transfert', 'create') && (
          <Button onClick={() => createBon.mutate()} disabled={createBon.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Nouveau Bon
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher (ID ou date)..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3">
        {filteredBons.map((bon: any) => (
          <Card key={bon.id} className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all" onClick={() => setSelectedBon(bon.id)}>
            <CardContent className="flex items-center justify-between py-4 gap-2">
              <div className="min-w-0">
                <p className="font-medium">Bon #{bon.id.slice(0, 8)}</p>
                <p className="text-sm text-muted-foreground">{format(new Date(bon.date_transfert), 'EEEE dd MMMM yyyy', { locale: fr })}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={statusColors[bon.statut]}>{statusLabels[bon.statut]}</Badge>
                {bon.statut === 'brouillon' && can('bons_transfert', 'delete') && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeleteBonId(bon.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredBons.length === 0 && (
          <EmptyState
            icon={FileText}
            title={search ? 'Aucun bon trouvé' : 'Aucun bon de transfert'}
            description={search ? 'Essayez une autre recherche.' : 'Créez votre premier bon pour suivre les transferts vers la salle.'}
            actionLabel={!search && can('bons_transfert', 'create') ? 'Créer un bon' : undefined}
            onAction={!search && can('bons_transfert', 'create') ? () => createBon.mutate() : undefined}
          />
        )}
      </div>
      <ConfirmDialog open={!!deleteBonId} onOpenChange={() => setDeleteBonId(null)} title="Supprimer ce bon ?" description="Toutes les lignes du bon seront supprimées définitivement." destructive onConfirm={() => deleteBonId && deleteBon.mutate(deleteBonId)} />
    </div>
  );
}
