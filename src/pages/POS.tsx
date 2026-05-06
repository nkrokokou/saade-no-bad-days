import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Minus, Trash2, Search, Printer, Lock, Unlock, X } from 'lucide-react';
import { toast } from 'sonner';
import { Produit } from '@/hooks/useProducts';

type PaymentMode = 'especes' | 'mobile_money' | 'carte' | 'credit' | 'ticket';

interface CartLine {
  produit: Produit;
  quantite: number;
  remise: number;
}

const PAYMENT_LABELS: Record<PaymentMode, string> = {
  especes: 'Espèces',
  mobile_money: 'Mobile Money',
  carte: 'Carte',
  credit: 'Crédit',
  ticket: 'Ticket / Bon',
};

export default function POS() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('especes');
  const [montantRecu, setMontantRecu] = useState<number>(0);
  const [clientNom, setClientNom] = useState('');
  const [notes, setNotes] = useState('');
  const [openSessionDialog, setOpenSessionDialog] = useState(false);
  const [closeSessionDialog, setCloseSessionDialog] = useState(false);
  const [fondInitial, setFondInitial] = useState(0);
  const [fondCompte, setFondCompte] = useState(0);
  const [lastTicket, setLastTicket] = useState<any>(null);

  // Produits
  const { data: produits = [] } = useQuery({
    queryKey: ['pos-produits'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produits').select('*').eq('actif', true).order('nom');
      if (error) throw error;
      return data as Produit[];
    },
  });

  // Session ouverte
  const { data: session, refetch: refetchSession } = useQuery({
    queryKey: ['session-caisse'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sessions_caisse').select('*').eq('statut', 'ouverte').order('ouvert_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const categories = useMemo(() => Array.from(new Set(produits.map(p => p.categorie))).sort(), [produits]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return produits.filter(p => {
      if (activeCat !== 'all' && p.categorie !== activeCat) return false;
      if (s && !p.nom.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [produits, search, activeCat]);

  const totalLignes = useMemo(
    () => cart.reduce((s, l) => s + (l.produit.prix_vente || 0) * l.quantite - l.remise, 0),
    [cart]
  );
  const totalTicket = Math.max(0, totalLignes - remiseGlobale);
  const rendu = paymentMode === 'especes' ? Math.max(0, montantRecu - totalTicket) : 0;

  useEffect(() => { if (payOpen) setMontantRecu(totalTicket); }, [payOpen, totalTicket]);

  const addToCart = (p: Produit) => {
    setCart(c => {
      const i = c.findIndex(l => l.produit.id === p.id);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], quantite: n[i].quantite + 1 }; return n; }
      return [...c, { produit: p, quantite: 1, remise: 0 }];
    });
  };
  const updateQty = (id: string, delta: number) => {
    setCart(c => c.map(l => l.produit.id === id ? { ...l, quantite: Math.max(0, l.quantite + delta) } : l).filter(l => l.quantite > 0));
  };
  const removeLine = (id: string) => setCart(c => c.filter(l => l.produit.id !== id));
  const clearCart = () => { setCart([]); setRemiseGlobale(0); setClientNom(''); setNotes(''); };

  const openSessionMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sessions_caisse').insert({ ouvert_par: user?.id, fond_initial: fondInitial, statut: 'ouverte' });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Caisse ouverte'); refetchSession(); setOpenSessionDialog(false); setFondInitial(0); },
    onError: (e: any) => toast.error(e.message),
  });

  const closeSessionMut = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Aucune session');
      const { data: ventesData } = await supabase.from('ventes').select('total, mode_paiement').eq('session_id', session.id).eq('statut', 'validee');
      const totalEspeces = (ventesData || []).filter(v => v.mode_paiement === 'especes').reduce((s, v) => s + Number(v.total), 0);
      const fondAttendu = Number(session.fond_initial) + totalEspeces;
      const ecart = fondCompte - fondAttendu;
      const { error } = await supabase.from('sessions_caisse').update({
        statut: 'fermee', ferme_par: user?.id, ferme_at: new Date().toISOString(),
        fond_final_attendu: fondAttendu, fond_final_compte: fondCompte, ecart,
      }).eq('id', session.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Caisse fermée'); refetchSession(); setCloseSessionDialog(false); setFondCompte(0); },
    onError: (e: any) => toast.error(e.message),
  });

  const validateSale = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Ouvrez la caisse');
      if (cart.length === 0) throw new Error('Panier vide');
      const { data: vente, error: e1 } = await supabase.from('ventes').insert({
        session_id: session.id,
        total: totalTicket,
        remise_globale: remiseGlobale,
        mode_paiement: paymentMode,
        montant_recu: paymentMode === 'especes' ? montantRecu : totalTicket,
        rendu,
        encaisse_par: user?.id,
        client_nom: clientNom || null,
        notes: notes || null,
      }).select('*').single();
      if (e1) throw e1;
      const lignes = cart.map(l => ({
        vente_id: vente.id,
        produit_id: l.produit.id,
        produit_nom: l.produit.nom,
        quantite: l.quantite,
        prix_unitaire: l.produit.prix_vente || 0,
        remise: l.remise,
        total_ligne: (l.produit.prix_vente || 0) * l.quantite - l.remise,
      }));
      const { error: e2 } = await supabase.from('vente_lignes').insert(lignes);
      if (e2) throw e2;
      return { vente, lignes };
    },
    onSuccess: ({ vente, lignes }) => {
      toast.success('Vente enregistrée');
      setLastTicket({ vente, lignes });
      setPayOpen(false);
      clearCart();
      qc.invalidateQueries({ queryKey: ['ventes'] });
      setTimeout(() => printTicket({ vente, lignes }), 100);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const printTicket = (data: any) => {
    if (!data) return;
    const html = `<html><head><title>Ticket ${data.vente.numero_ticket}</title>
      <style>body{font-family:monospace;padding:8px;width:280px}h2{text-align:center;margin:4px 0;font-family:serif}
      hr{border:none;border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between}
      .total{font-size:14px;font-weight:bold}small{color:#555}</style></head><body>
      <h2>SAADÉ</h2><div style="text-align:center"><small>Lomé, Togo</small></div><hr/>
      <div class="row"><span>Ticket #${data.vente.numero_ticket}</span><span>${new Date(data.vente.date_vente).toLocaleString('fr-FR')}</span></div>
      ${data.vente.client_nom ? `<div>Client: ${data.vente.client_nom}</div>` : ''}<hr/>
      ${data.lignes.map((l: any) => `<div class="row"><span>${l.quantite}× ${l.produit_nom}</span><span>${Number(l.total_ligne).toLocaleString()} F</span></div>`).join('')}
      <hr/>${data.vente.remise_globale > 0 ? `<div class="row"><span>Remise</span><span>-${Number(data.vente.remise_globale).toLocaleString()} F</span></div>` : ''}
      <div class="row total"><span>TOTAL</span><span>${Number(data.vente.total).toLocaleString()} F</span></div>
      <div class="row"><span>${PAYMENT_LABELS[data.vente.mode_paiement as PaymentMode]}</span><span>${Number(data.vente.montant_recu).toLocaleString()} F</span></div>
      ${data.vente.rendu > 0 ? `<div class="row"><span>Rendu</span><span>${Number(data.vente.rendu).toLocaleString()} F</span></div>` : ''}
      <hr/><div style="text-align:center"><small>Merci de votre visite ❤</small></div>
      </body></html>`;
    const w = window.open('', '_blank', 'width=320,height=600');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
  };

  return (
    <div className="space-y-3">
      {/* Header session */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-heading font-bold">Caisse / POS</h1>
            {session ? (
              <p className="text-xs text-muted-foreground">Session ouverte depuis {new Date(session.ouvert_at).toLocaleTimeString('fr-FR')} · Fond {Number(session.fond_initial).toLocaleString()} F</p>
            ) : <p className="text-xs text-destructive">Caisse fermée — ouvrez une session pour encaisser</p>}
          </div>
          <div className="flex gap-2">
            {!session && <Button size="sm" onClick={() => setOpenSessionDialog(true)}><Unlock className="h-4 w-4 mr-1" />Ouvrir caisse</Button>}
            {session && <Button size="sm" variant="outline" onClick={() => setCloseSessionDialog(true)}><Lock className="h-4 w-4 mr-1" />Fermer caisse</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3">
        {/* Produits */}
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" /></div>
          </div>
          <Tabs value={activeCat} onValueChange={setActiveCat}>
            <ScrollArea className="w-full"><TabsList className="w-max">
              <TabsTrigger value="all">Tous</TabsTrigger>
              {categories.map(c => <TabsTrigger key={c} value={c}>{c.replace(/_/g, ' ')}</TabsTrigger>)}
            </TabsList></ScrollArea>
          </Tabs>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addToCart(p)}
                className="border rounded-lg p-2 text-left hover:bg-accent hover:border-primary transition-colors flex flex-col gap-1 active:scale-95">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.nom} className="w-full h-16 object-cover rounded" />
                ) : <div className="w-full h-16 bg-muted rounded flex items-center justify-center text-2xl">🍰</div>}
                <div className="text-xs font-medium line-clamp-2">{p.nom}</div>
                <div className="text-xs font-bold text-primary">{(p.prix_vente || 0).toLocaleString()} F</div>
              </button>
            ))}
            {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-6 text-sm">Aucun produit</div>}
          </div>
        </div>

        {/* Panier */}
        <Card className="lg:sticky lg:top-16 self-start">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold">Ticket en cours</h2>
              {cart.length > 0 && <Button size="icon" variant="ghost" onClick={clearCart}><X className="h-4 w-4" /></Button>}
            </div>
            <ScrollArea className="h-[300px] border rounded">
              {cart.length === 0 && <div className="text-center text-muted-foreground py-12 text-sm">Cliquez sur des produits</div>}
              {cart.map(l => (
                <div key={l.produit.id} className="flex items-center gap-2 p-2 border-b">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{l.produit.nom}</div>
                    <div className="text-xs text-muted-foreground">{(l.produit.prix_vente || 0).toLocaleString()} F × {l.quantite}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(l.produit.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center text-sm">{l.quantite}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(l.produit.id, 1)}><Plus className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(l.produit.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </ScrollArea>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Remise</Label>
              <Input type="number" value={remiseGlobale} onChange={e => setRemiseGlobale(Number(e.target.value) || 0)} className="h-8" />
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span><span className="text-primary">{totalTicket.toLocaleString()} F</span>
            </div>
            <Button className="w-full" disabled={!session || cart.length === 0} onClick={() => setPayOpen(true)}>Encaisser</Button>
            {lastTicket && <Button variant="outline" className="w-full" onClick={() => printTicket(lastTicket)}><Printer className="h-4 w-4 mr-1" />Réimprimer dernier ticket</Button>}
          </CardContent>
        </Card>
      </div>

      {/* Dialog paiement */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Encaissement — {totalTicket.toLocaleString()} F</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PAYMENT_LABELS) as PaymentMode[]).map(m => (
                <Button key={m} variant={paymentMode === m ? 'default' : 'outline'} onClick={() => setPaymentMode(m)} className="h-auto py-2 text-xs">{PAYMENT_LABELS[m]}</Button>
              ))}
            </div>
            {paymentMode === 'especes' && (
              <>
                <div><Label>Montant reçu (F)</Label><Input type="number" value={montantRecu} onChange={e => setMontantRecu(Number(e.target.value) || 0)} /></div>
                <div className="text-sm">Rendu : <span className="font-bold text-primary">{rendu.toLocaleString()} F</span></div>
              </>
            )}
            {paymentMode === 'credit' && <div><Label>Nom du client</Label><Input value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="Obligatoire" /></div>}
            <div><Label>Notes (optionnel)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Annuler</Button>
            <Button onClick={() => validateSale.mutate()} disabled={validateSale.isPending || (paymentMode === 'credit' && !clientNom)}>Valider et imprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ouverture caisse */}
      <Dialog open={openSessionDialog} onOpenChange={setOpenSessionDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ouverture de caisse</DialogTitle></DialogHeader>
          <div><Label>Fond de caisse initial (F)</Label><Input type="number" value={fondInitial} onChange={e => setFondInitial(Number(e.target.value) || 0)} /></div>
          <DialogFooter><Button onClick={() => openSessionMut.mutate()}>Ouvrir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog fermeture caisse */}
      <Dialog open={closeSessionDialog} onOpenChange={setCloseSessionDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Clôture de caisse</DialogTitle></DialogHeader>
          <div><Label>Espèces comptées en caisse (F)</Label><Input type="number" value={fondCompte} onChange={e => setFondCompte(Number(e.target.value) || 0)} /></div>
          <p className="text-xs text-muted-foreground">L'écart (théorique vs compté) sera enregistré automatiquement.</p>
          <DialogFooter><Button onClick={() => closeSessionMut.mutate()} variant="destructive">Fermer la caisse</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
