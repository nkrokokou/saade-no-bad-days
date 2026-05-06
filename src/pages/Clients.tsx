import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Wallet, Users, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { usePermissions } from '@/hooks/usePermissions';

interface Client {
  id: string; nom: string; telephone: string | null; email: string | null;
  adresse: string | null; notes: string | null; plafond_credit: number; actif: boolean;
}
interface Credit {
  id: string; client_id: string | null; client_nom: string; vente_id: string | null;
  montant_initial: number; montant_restant: number; date_credit: string;
  statut: string; notes: string | null;
}

export default function Clients() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { can } = usePermissions();
  const [tab, setTab] = useState('clients');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState<Credit | null>(null);
  const [payMontant, setPayMontant] = useState(0);
  const [payMode, setPayMode] = useState('especes');

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('nom');
      if (error) throw error;
      return data as Client[];
    },
  });

  const { data: credits = [] } = useQuery({
    queryKey: ['credits'],
    queryFn: async () => {
      const { data, error } = await supabase.from('credits_clients').select('*').order('date_credit', { ascending: false });
      if (error) throw error;
      return data as Credit[];
    },
  });

  const filteredClients = useMemo(() =>
    clients.filter(c => !search || c.nom.toLowerCase().includes(search.toLowerCase()) || (c.telephone || '').includes(search)),
    [clients, search]);

  const creditsOuverts = credits.filter(c => c.statut === 'ouvert');
  const totalDu = creditsOuverts.reduce((s, c) => s + Number(c.montant_restant), 0);

  const saveClient = useMutation({
    mutationFn: async (c: Partial<Client>) => {
      if (c.id) {
        const { error } = await supabase.from('clients').update(c).eq('id', c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert({ ...c, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success('Client enregistré'); qc.invalidateQueries({ queryKey: ['clients'] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const delClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Client supprimé'); qc.invalidateQueries({ queryKey: ['clients'] }); setDeleteId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const payCredit = useMutation({
    mutationFn: async () => {
      if (!payOpen) return;
      const { error } = await supabase.from('paiements_credits').insert({
        credit_id: payOpen.id, montant: payMontant, mode_paiement: payMode, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Paiement enregistré');
      qc.invalidateQueries({ queryKey: ['credits'] });
      setPayOpen(null); setPayMontant(0);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing({ id: '', nom: '', telephone: '', email: '', adresse: '', notes: '', plafond_credit: 0, actif: true }); setOpen(true); };
  const openEdit = (c: Client) => { setEditing(c); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-heading font-bold">Clients & Crédits</h1>
          <p className="text-sm text-muted-foreground">Gérez votre fichier client et les ardoises ouvertes</p>
        </div>
        {can('clients', 'create') && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nouveau client</Button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Clients</div><div className="text-2xl font-bold">{clients.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" />Ardoises ouvertes</div><div className="text-2xl font-bold">{creditsOuverts.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total dû</div><div className="text-2xl font-bold text-destructive">{totalDu.toLocaleString()} F</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Crédits soldés (30j)</div><div className="text-2xl font-bold text-primary">{credits.filter(c => c.statut === 'solde').length}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="clients">Fichier clients</TabsTrigger>
          <TabsTrigger value="credits">Ardoises / Crédits</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-2">
          <div className="relative max-w-sm"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Rechercher nom ou téléphone…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" /></div>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredClients.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.nom} {!c.actif && <Badge variant="outline" className="ml-1">inactif</Badge>}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.telephone || '—'} {c.email && `· ${c.email}`}</div>
                    </div>
                    <div className="flex gap-1">
                      {can('clients', 'update') && <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>}
                      {can('clients', 'delete') && <Button size="icon" variant="ghost" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </div>
                ))}
                {filteredClients.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Aucun client</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits" className="space-y-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Ardoises ouvertes ({creditsOuverts.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {creditsOuverts.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.client_nom}</div>
                      <div className="text-xs text-muted-foreground">Depuis le {new Date(c.date_credit).toLocaleDateString('fr-FR')} · Initial {Number(c.montant_initial).toLocaleString()} F</div>
                    </div>
                    <div className="text-right mr-2">
                      <div className="font-bold text-destructive">{Number(c.montant_restant).toLocaleString()} F</div>
                      <div className="text-xs text-muted-foreground">restant</div>
                    </div>
                    <Button size="sm" onClick={() => { setPayOpen(c); setPayMontant(Number(c.montant_restant)); }}>Encaisser</Button>
                  </div>
                ))}
                {creditsOuverts.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Aucune ardoise ouverte 🎉</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Crédits soldés / historiques</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-80 overflow-auto">
                {credits.filter(c => c.statut !== 'ouvert').map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 text-sm">
                    <div><span className="font-medium">{c.client_nom}</span> <span className="text-xs text-muted-foreground">· {new Date(c.date_credit).toLocaleDateString('fr-FR')}</span></div>
                    <div className="text-right">
                      <div>{Number(c.montant_initial).toLocaleString()} F</div>
                      <Badge variant="outline" className="text-xs">{c.statut}</Badge>
                    </div>
                  </div>
                ))}
                {credits.filter(c => c.statut !== 'ouvert').length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Aucun historique</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit / new client */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Modifier' : 'Nouveau'} client</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nom *</Label><Input value={editing.nom} onChange={e => setEditing({ ...editing, nom: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Téléphone</Label><Input value={editing.telephone || ''} onChange={e => setEditing({ ...editing, telephone: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
              </div>
              <div><Label>Adresse</Label><Input value={editing.adresse || ''} onChange={e => setEditing({ ...editing, adresse: e.target.value })} /></div>
              <div><Label>Plafond crédit (F)</Label><Input type="number" value={editing.plafond_credit} onChange={e => setEditing({ ...editing, plafond_credit: Number(e.target.value) || 0 })} /></div>
              <div><Label>Notes</Label><Textarea rows={2} value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => editing && saveClient.mutate({ ...editing, id: editing.id || undefined } as any)} disabled={!editing?.nom}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Encaisser crédit */}
      <Dialog open={!!payOpen} onOpenChange={o => !o && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Encaisser ardoise — {payOpen?.client_nom}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">Restant dû : <span className="font-bold text-destructive">{Number(payOpen?.montant_restant || 0).toLocaleString()} F</span></div>
            <div><Label>Montant reçu (F)</Label><Input type="number" value={payMontant} onChange={e => setPayMontant(Number(e.target.value) || 0)} /></div>
            <div><Label>Mode de paiement</Label>
              <Select value={payMode} onValueChange={setPayMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="especes">Espèces</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="carte">Carte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(null)}>Annuler</Button>
            <Button onClick={() => payCredit.mutate()} disabled={payMontant <= 0 || payCredit.isPending}>Valider paiement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={o => !o && setDeleteId(null)}
        title="Supprimer ce client ?"
        description="Cette action est irréversible. Les crédits associés seront aussi supprimés."
        onConfirm={() => deleteId && delClient.mutate(deleteId)}
      />
    </div>
  );
}
