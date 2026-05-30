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
import { Plus, Minus, Trash2, Search, Printer, Lock, Unlock, X, ShoppingCart, PauseCircle, Utensils } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Produit, useProducts } from '@/hooks/useProducts';

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

const POSTE_LABELS: Record<string, string> = {
  cuisine: 'CUISINE',
  bar: 'BAR / BOISSONS',
  labo_patisserie: 'LABO PÂTISSERIE',
  labo_viennoiserie: 'LABO VIENNOISERIE',
};

interface TableResto { id: string; numero: string; zone: string | null; places: number; }

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
  const [cartOpen, setCartOpen] = useState(false);
  const [tableId, setTableId] = useState<string>('comptoir');
  const [serveur, setServeur] = useState<string>('');
  const [tabsOpen, setTabsOpen] = useState(false);
  const [currentTabId, setCurrentTabId] = useState<string | null>(null);

  // Produits
  const { data: produits = [] } = useProducts();

  // Templates de tickets (cuisine / caisse) gérés par la CEO
  const { data: ticketTemplates = [] } = useQuery({
    queryKey: ['ticket_templates'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_templates' as any).select('*');
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });
  const tplCuisine = ticketTemplates.find(t => t.type === 'cuisine') || null;
  const tplCaisse = ticketTemplates.find(t => t.type === 'caisse') || null;

  const { data: tables = [] } = useQuery({
    queryKey: ['tables-resto'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tables_restaurant' as any).select('*').eq('actif', true).order('numero');
      if (error) throw error;
      return (data || []) as unknown as TableResto[];
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

  // Stock disponible du jour (production envoyée en salle - ventes - dégustations)
  const today = new Date().toISOString().slice(0, 10);
  const { data: stockMap = {} } = useQuery({
    queryKey: ['pos-stock-jour', today],
    refetchInterval: 30000,
    queryFn: async () => {
      const [prod, vl, deg] = await Promise.all([
        supabase.from('production_labo').select('produit_id, qte_sortie_en_salle').eq('date_production', today),
        supabase.from('vente_lignes').select('produit_id, quantite, ventes!inner(date_vente, statut)').gte('ventes.date_vente', today + 'T00:00:00').in('ventes.statut', ['validee', 'en_cours']),
        supabase.from('degustations').select('produit_id, quantite').eq('date_degustation', today),
      ]);
      const m: Record<string, number> = {};
      (prod.data || []).forEach((r: any) => { m[r.produit_id] = (m[r.produit_id] || 0) + Number(r.qte_sortie_en_salle || 0); });
      (vl.data || []).forEach((r: any) => { if (m[r.produit_id] !== undefined) m[r.produit_id] -= Number(r.quantite || 0); });
      (deg.data || []).forEach((r: any) => { if (m[r.produit_id] !== undefined) m[r.produit_id] -= Number(r.quantite || 0); });
      return m;
    },
  });

  const getStockDispo = (pid: string) => {
    const base = stockMap[pid];
    if (base === undefined) return null; // produit non suivi (boisson, etc.)
    const inCart = cart.find(l => l.produit.id === pid)?.quantite || 0;
    return base - inCart;
  };

  // Tickets en attente (tabs ouverts)
  const { data: openTabs = [], refetch: refetchTabs } = useQuery({
    queryKey: ['open-tabs', session?.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventes')
        .select('id, numero_ticket, total, table_id, serveur_id, client_nom, notes, created_at, vente_lignes(*)')
        .eq('session_id', session!.id)
        .eq('statut', 'en_cours')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
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
    const dispo = getStockDispo(p.id);
    if (dispo !== null && dispo <= 0) {
      toast.error(`Stock épuisé : ${p.nom}`);
      return;
    }
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
  const clearCart = () => {
    setCart([]); setRemiseGlobale(0); setClientNom(''); setNotes('');
    setTableId('comptoir'); setServeur(''); setCurrentTabId(null);
  };

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

  // Construit payload vente + lignes
  const buildVentePayload = (statut: 'validee' | 'en_cours') => {
    const tId = tableId === 'comptoir' ? null : tableId;
    return {
      vente: {
        session_id: session!.id,
        total: totalTicket,
        remise_globale: remiseGlobale,
        mode_paiement: statut === 'validee' ? paymentMode : 'especes',
        montant_recu: statut === 'validee' && paymentMode === 'especes' ? montantRecu : totalTicket,
        rendu: statut === 'validee' ? rendu : 0,
        encaisse_par: statut === 'validee' ? user?.id : null,
        client_nom: clientNom || null,
        notes: notes || null,
        statut,
        table_id: tId,
        serveur_id: null as any,
      } as any,
      serveurNom: serveur,
    };
  };

  // Mettre en attente (tab)
  const holdTab = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Ouvrez la caisse');
      if (cart.length === 0) throw new Error('Panier vide');
      const payload = buildVentePayload('en_cours');
      // Note serveur in notes field (pas de table profiles cohérente ici)
      const noteWithServer = serveur ? `[Serveur: ${serveur}] ${notes || ''}`.trim() : (notes || null);
      let venteId = currentTabId;
      if (currentTabId) {
        await supabase.from('vente_lignes').delete().eq('vente_id', currentTabId);
        const { error } = await supabase.from('ventes').update({
          total: totalTicket, remise_globale: remiseGlobale, table_id: payload.vente.table_id,
          client_nom: clientNom || null, notes: noteWithServer,
        }).eq('id', currentTabId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('ventes').insert({
          ...payload.vente, notes: noteWithServer,
        }).select('id').single();
        if (error) throw error;
        venteId = data.id;
      }
      const lignes = cart.map(l => ({
        vente_id: venteId,
        produit_id: l.produit.id,
        produit_nom: l.produit.nom,
        quantite: l.quantite,
        prix_unitaire: l.produit.prix_vente || 0,
        remise: l.remise,
        total_ligne: (l.produit.prix_vente || 0) * l.quantite - l.remise,
      }));
      const { error: e2 } = await (supabase.from('vente_lignes') as any).insert(lignes);
      if (e2) throw e2;
      // Plus d'impression auto ici : la cuisine s'imprime via le bouton dédié
      return venteId;
    },
    onSuccess: () => {
      toast.success('Ticket mis en attente');
      refetchTabs();
      clearCart();
      setCartOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Reprendre un tab
  const resumeTab = (tab: any) => {
    const lignes = (tab.vente_lignes || []) as any[];
    const newCart: CartLine[] = lignes.map(l => {
      const p = produits.find(pr => pr.id === l.produit_id) || {
        id: l.produit_id, nom: l.produit_nom, categorie: 'DIVERS', prix_vente: l.prix_unitaire,
      } as Produit;
      return { produit: p, quantite: Number(l.quantite), remise: Number(l.remise || 0) };
    });
    setCart(newCart);
    setCurrentTabId(tab.id);
    setTableId(tab.table_id || 'comptoir');
    setClientNom(tab.client_nom || '');
    const m = (tab.notes || '').match(/^\[Serveur: ([^\]]+)\]\s*(.*)$/);
    if (m) { setServeur(m[1]); setNotes(m[2]); } else { setNotes(tab.notes || ''); }
    setTabsOpen(false);
    setCartOpen(true);
  };

  const cancelTab = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('vente_lignes').delete().eq('vente_id', id);
      const { error } = await supabase.from('ventes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Ticket annulé'); refetchTabs(); },
    onError: (e: any) => toast.error(e.message),
  });

  const validateSale = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Ouvrez la caisse');
      if (cart.length === 0) throw new Error('Panier vide');
      const payload = buildVentePayload('validee');
      const noteWithServer = serveur ? `[Serveur: ${serveur}] ${notes || ''}`.trim() : (notes || null);
      let vente: any;
      if (currentTabId) {
        // Convertit le tab en vente validée
        await supabase.from('vente_lignes').delete().eq('vente_id', currentTabId);
        const { data, error } = await supabase.from('ventes').update({
          ...payload.vente, notes: noteWithServer,
        }).eq('id', currentTabId).select('*').single();
        if (error) throw error;
        vente = data;
      } else {
        const { data, error } = await supabase.from('ventes').insert({
          ...payload.vente, notes: noteWithServer,
        }).select('*').single();
        if (error) throw error;
        vente = data;
      }
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
      if (paymentMode === 'credit' && clientNom) {
        await supabase.from('credits_clients').insert({
          client_nom: clientNom, vente_id: vente.id,
          montant_initial: totalTicket, montant_restant: totalTicket,
          notes: notes || null, created_by: user?.id,
        });
      }
      return { vente, lignes };
    },
    onSuccess: ({ vente, lignes }) => {
      toast.success('Vente enregistrée');
      setLastTicket({ vente, lignes });
      setPayOpen(false);
      qc.invalidateQueries({ queryKey: ['ventes'] });
      qc.invalidateQueries({ queryKey: ['pos-stock-jour'] });
      refetchTabs();
      setTimeout(() => {
        printTicket({ vente, lignes });
      }, 100);
      clearCart();
      setCartOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Imprime un ticket par poste de préparation (cuisine, labo…) — applique le template cuisine
  const printPrepTickets = (lines: CartLine[], ctx: { tableNum: string; serveur: string; numero: string }) => {
    const groups: Record<string, CartLine[]> = {};
    const excludeBoissons = tplCuisine?.exclude_boissons ?? true;
    lines.forEach(l => {
      const cat = (l.produit.categorie || '').toUpperCase();
      const isBoisson = /BOISSON|SOFT|EAU|JUS|COLA|BAR/.test(cat);
      // Toute boisson va au bar ; tout le reste va en cuisine (par défaut)
      // sauf si le produit a un poste explicitement défini (labo, etc.)
      let poste = l.produit.poste_preparation || '';
      if (!poste || poste === 'salle') poste = isBoisson ? 'bar' : 'cuisine';
      if (excludeBoissons && (poste === 'bar' || isBoisson)) return;
      (groups[poste] = groups[poste] || []).push(l);
    });
    if (Object.keys(groups).length === 0) {
      toast.info('Aucun article à préparer (uniquement des boissons ?)');
      return;
    }
    Object.entries(groups).forEach(([poste, grp]) => printPrepTicket(poste, grp, ctx));
  };

  // Imprime un bon cuisine à la demande (depuis le panier en cours)
  const printCuisineFromCart = () => {
    if (cart.length === 0) { toast.error('Panier vide'); return; }
    const tableNum = tables.find(t => t.id === tableId)?.numero || 'Comptoir';
    printPrepTickets(cart, { tableNum, serveur, numero: currentTabId ? 'EN ATTENTE' : 'BROUILLON' });
  };

  // Impression via iframe cachée · évite le blocage des popups
  const printViaIframe = (html: string, label: string) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (!doc) throw new Error('iframe doc indisponible');
      doc.open();
      doc.write(html);
      doc.close();
      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          toast.success(`🖨️ ${label} envoyé à l'imprimante`);
        } catch (err: any) {
          toast.error(`Impression ${label} : ${err?.message || 'erreur'}`);
        }
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 2000);
      };
      // Laisse le temps au DOM de se peindre
      if (iframe.contentWindow?.document.readyState === 'complete') {
        setTimeout(triggerPrint, 200);
      } else {
        iframe.onload = () => setTimeout(triggerPrint, 200);
      }
    } catch (err: any) {
      toast.error(`Impression échouée : ${err?.message || 'erreur'}`);
    }
  };

  const printPrepTicket = (poste: string, lines: CartLine[], ctx: { tableNum: string; serveur: string; numero: string }) => {
    const t = tplCuisine;
    const headerTitle = t?.header_title || 'SAADÉ';
    const subtitle = t?.header_subtitle || POSTE_LABELS[poste] || poste.toUpperCase();
    const footer = t?.footer_message || '';
    const fontPx = t?.font_size_px || 13;
    const paperMm = t?.paper_width_mm || 80;
    const date = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    const showPrices = !!t?.show_prices;
    const rows = lines.map(l => {
      const price = showPrices ? ` <span style="float:right;font-weight:normal;">${(l.produit.prix_vente || 0).toLocaleString('fr-FR')} F</span>` : '';
      return `<div class="big">${l.quantite}× ${l.produit.nom.toUpperCase()}${price}</div>`;
    }).join('');
    const metaBits: string[] = [];
    if (t?.show_datetime !== false) metaBits.push(date);
    if (t?.show_ticket_number !== false) metaBits.push(`N° ${ctx.numero}`);
    const html = `<html><head><title>BON ${POSTE_LABELS[poste] || poste}</title>
      <style>
        @page { size: ${paperMm}mm auto; margin: 2mm; }
        body { font-family: 'Courier New', monospace; padding: 0; margin: 0; width: ${paperMm - 4}mm; font-size: ${fontPx}px; color:#000; }
        .head { text-align:center; font-weight:bold; font-size:16px; border:2px solid #000; padding:4px; margin-bottom:6px; }
        .sub  { text-align:center; font-size:12px; font-weight:bold; letter-spacing:1px; margin-bottom:4px; }
        .info { display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px; }
        .big { font-size: 16px; font-weight: bold; padding: 4px 0; border-bottom: 1px dashed #000; }
        hr { border:none; border-top:2px solid #000; margin:6px 0; }
        ${t?.extra_css || ''}
      </style></head><body>
      <div class="head">${headerTitle}</div>
      <div class="sub">--- ${subtitle} ---</div>
      ${metaBits.length ? `<div class="info">${metaBits.map(m => `<span>${m}</span>`).join('')}</div>` : ''}
      ${(t?.show_table !== false || t?.show_serveur !== false) ? `<div class="info">${t?.show_table !== false ? `<span>Table: <b>${ctx.tableNum}</b></span>` : ''}${t?.show_serveur !== false ? `<span>Serveur: ${ctx.serveur || '-'}</span>` : ''}</div>` : ''}
      <hr/>
      ${rows}
      <hr/>
      <div style="text-align:center;font-size:11px;">${footer || 'À PRÉPARER'}</div>
      </body></html>`;
    printViaIframe(html, `Bon ${POSTE_LABELS[poste] || poste}`);
  };

  const printTicket = (data: any) => {
    if (!data) return;
    const v = data.vente;
    const lignes = data.lignes || [];
    const fmt = (n: number) => Number(n || 0).toLocaleString('fr-FR').replace(/,/g, ' ');
    const date = new Date(v.date_vente).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
    const caissier = (user?.email || 'CAISSIER').split('@')[0].toUpperCase();
    const modeLabel = (PAYMENT_LABELS[v.mode_paiement as PaymentMode] || '').toUpperCase();
    const tableNum = tables.find(t => t.id === v.table_id)?.numero || '';
    const serveurMatch = (v.notes || '').match(/^\[Serveur: ([^\]]+)\]/);
    const serveurNom = serveurMatch ? serveurMatch[1] : '';

    const W = 42;
    const padRow = (left: string, right: string) => {
      const l = left.slice(0, W - right.length - 1);
      return l + ' '.repeat(Math.max(1, W - l.length - right.length)) + right;
    };
    const articlesHeader = padRow('ARTICLES', 'P.U  Qté   MONT');
    const articlesRows = lignes.map((l: any) => {
      const nom = String(l.produit_nom).toUpperCase();
      const c1 = nom.slice(0, 22).padEnd(22, ' ');
      const c2 = fmt(l.prix_unitaire).padStart(7, ' ') + ' ';
      const c3 = String(l.quantite).padStart(3, ' ') + ' ';
      const c4 = (Number(l.total_ligne) === 0 ? 'offert' : fmt(l.total_ligne)).padStart(8, ' ');
      return `<div class="mono">${c1}${c2}${c3}${c4}</div>`;
    }).join('');

    const t = tplCaisse;
    const headerTitle = t?.header_title || 'SAADÉ';
    const subtitle = t?.header_subtitle || 'PÂTISSERIE · SNACK · CONCEPT STORE';
    const address = t?.header_address || 'Lomé · Togo';
    const phone = t?.header_phone || '';
    const footer = t?.footer_message || 'Merci de votre visite';
    const legal = t?.footer_legal || '';
    const fontPx = t?.font_size_px || 12;
    const paperMm = t?.paper_width_mm || 80;

    const html = `<html><head><title>Ticket ${v.numero_ticket}</title>
      <style>
        @page { size: ${paperMm}mm auto; margin: 2mm; }
        body { font-family: 'Courier New', monospace; padding: 0; margin: 0; width: ${paperMm - 4}mm; font-size: ${fontPx}px; line-height: 1.35; color: #000; }
        h2 { text-align: center; margin: 2px 0 0; font-family: Georgia, serif; font-size: 18px; font-weight: bold; }
        .sub { text-align: center; font-size: 11px; font-weight: bold; letter-spacing: 1px; }
        .addr { text-align: center; font-size: 11px; }
        hr { border: none; border-top: 1px solid #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; gap: 4px; }
        .mono { white-space: pre; font-size: ${fontPx}px; }
        .total { font-weight: bold; }
        .footer { text-align: center; margin-top: 8px; font-size: 11px; }
        ${t?.extra_css || ''}
      </style></head><body>
      <h2>${headerTitle}</h2>
      ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
      ${address ? `<div class="addr">${address}</div>` : ''}
      ${phone ? `<div class="addr">${phone}</div>` : ''}
      ${(t?.show_datetime !== false || t?.show_ticket_number !== false) ? `<div class="row" style="font-size:11px;margin-top:2px;">${t?.show_datetime !== false ? `<span>${date}</span>` : '<span></span>'}${t?.show_ticket_number !== false ? `<span>Ticket N° ${v.numero_ticket}</span>` : ''}</div>` : ''}
      <div style="font-size:11px;">CLIENT : ${(v.client_nom || 'CLIENT CASH').toUpperCase()}</div>
      <hr/>
      <div class="mono">${articlesHeader}</div>
      ${articlesRows}
      <hr/>
      ${t?.show_prices !== false ? `
        <div class="row"><span>Montant TTC</span><span>${fmt(Number(v.total) + Number(v.remise_globale || 0))} CFA</span></div>
        <div class="row"><span>Remise</span><span>${fmt(v.remise_globale)} CFA</span></div>
        <div class="row total"><span>Net à payer</span><span>${fmt(v.total)} CFA</span></div>
      ` : ''}
      ${t?.show_payment_mode !== false ? `<div class="row"><span>${modeLabel}</span><span>${fmt(v.montant_recu)} CFA</span></div>` : ''}
      ${(t?.show_change !== false && Number(v.rendu) > 0) ? `<div class="row"><span>Relicat</span><span>${fmt(v.rendu)} CFA</span></div>` : ''}
      <hr/>
      ${(t?.show_serveur !== false || t?.show_table !== false) ? `<div style="font-size:11px;">${t?.show_serveur !== false ? `serveur : ${serveurNom || '....'}   ` : ''}${t?.show_table !== false ? `table : ${tableNum || '....'}` : ''}</div>` : ''}
      ${t?.show_caissier !== false ? `<div style="font-size:11px;">caissier : ${caissier}</div>` : ''}
      <hr/>
      <div class="footer">${footer}</div>
      ${legal ? `<div class="footer" style="font-size:10px;color:#444;">${legal}</div>` : ''}
      </body></html>`;
    printViaIframe(html, `Ticket caisse #${v.numero_ticket}`);
  };

  return (
    <div className="space-y-3">
      {/* Header session */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-heading font-bold flex items-center gap-2">Caisse</h1>
            {session ? (
              <p className="text-xs text-muted-foreground">Session ouverte depuis {new Date(session.ouvert_at).toLocaleTimeString('fr-FR')} · Fond {Number(session.fond_initial).toLocaleString()} F</p>
            ) : <p className="text-xs text-destructive">Caisse fermée · ouvrez une session pour encaisser</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {session && (
              <Button size="sm" variant="outline" onClick={() => setTabsOpen(true)}>
                <Utensils className="h-4 w-4 mr-1" />Tickets en attente
                {openTabs.length > 0 && <Badge variant="secondary" className="ml-2">{openTabs.length}</Badge>}
              </Button>
            )}
            {!session && <Button size="sm" onClick={() => setOpenSessionDialog(true)}><Unlock className="h-4 w-4 mr-1" />Ouvrir caisse</Button>}
            {session && <Button size="sm" variant="outline" onClick={() => setCloseSessionDialog(true)}><Lock className="h-4 w-4 mr-1" />Fermer caisse</Button>}
          </div>
        </CardContent>
      </Card>

      {/* Sélecteur Table + Serveur */}
      {session && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Label className="text-xs whitespace-nowrap">Table</Label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comptoir">Comptoir / À emporter</SelectItem>
                  {tables.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      Table {t.numero}{t.zone ? ` · ${t.zone}` : ''} ({t.places}p)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Label className="text-xs whitespace-nowrap">Serveur</Label>
              <Input value={serveur} onChange={e => setServeur(e.target.value)} placeholder="Nom du serveur" className="h-9" />
            </div>
            {currentTabId && <Badge variant="outline" className="text-xs">Reprise ticket</Badge>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3">
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
            {filtered.map(p => {
              const dispo = getStockDispo(p.id);
              const rupture = dispo !== null && dispo <= 0;
              const bas = dispo !== null && dispo > 0 && dispo <= 5;
              return (
                <button key={p.id} onClick={() => addToCart(p)} disabled={rupture}
                  className={`relative border rounded-lg p-2 text-left transition-colors flex flex-col gap-1 active:scale-95 ${rupture ? 'opacity-50 cursor-not-allowed bg-muted' : 'hover:bg-accent hover:border-primary'}`}>
                  <span className={`absolute top-1 right-1 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    dispo === null ? 'bg-muted-foreground/70 text-background'
                      : rupture ? 'bg-destructive text-destructive-foreground'
                      : bas ? 'bg-orange-500 text-white'
                      : 'bg-green-600 text-white'
                  }`}>
                    {dispo === null ? 'Dispo' : rupture ? 'Rupture' : `${dispo}`}
                  </span>
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.nom} className="w-full h-16 object-cover rounded" />
                  ) : <div className="w-full h-16 bg-muted rounded flex items-center justify-center text-2xl">🍰</div>}
                  <div className="text-xs font-medium line-clamp-2">{p.nom}</div>
                  <div className="text-xs font-bold text-primary">{(p.prix_vente || 0).toLocaleString()} F</div>
                </button>
              );
            })}
            {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-6 text-sm">Aucun produit</div>}
          </div>
        </div>

        {/* Panier desktop */}
        <Card className="hidden lg:block lg:sticky lg:top-16 self-start">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold">Ticket en cours</h2>
              {cart.length > 0 && <Button size="icon" variant="ghost" onClick={clearCart}><X className="h-4 w-4" /></Button>}
            </div>
            <ScrollArea className="h-[280px] border rounded">
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
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={!session || cart.length === 0 || holdTab.isPending} onClick={() => holdTab.mutate()}>
                <PauseCircle className="h-4 w-4 mr-1" />En attente
              </Button>
              <Button disabled={!session || cart.length === 0} onClick={() => setPayOpen(true)}>Encaisser</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" disabled={cart.length === 0} onClick={printCuisineFromCart}>
                <Utensils className="h-4 w-4 mr-1" />Bon Cuisine
              </Button>
              {lastTicket
                ? <Button variant="outline" size="sm" onClick={() => printTicket(lastTicket)}><Printer className="h-4 w-4 mr-1" />Ticket Caisse</Button>
                : <Button variant="outline" size="sm" disabled><Printer className="h-4 w-4 mr-1" />Ticket Caisse</Button>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAB mobile */}
      {cart.length > 0 && (
        <Button onClick={() => setCartOpen(true)}
          className="lg:hidden fixed bottom-4 right-4 z-40 h-14 px-5 rounded-full shadow-2xl gap-2 text-base">
          <ShoppingCart className="h-5 w-5" />
          <span className="font-bold">{totalTicket.toLocaleString()} F</span>
          <span className="bg-primary-foreground/20 px-2 py-0.5 rounded-full text-xs">{cart.reduce((s, l) => s + l.quantite, 0)}</span>
        </Button>
      )}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[90vh] flex flex-col p-4 lg:hidden">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Ticket en cours</span>
              {cart.length > 0 && <Button size="sm" variant="ghost" onClick={clearCart}>Vider</Button>}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 -mx-4 px-4 my-2">
            {cart.length === 0 && <div className="text-center text-muted-foreground py-12 text-sm">Cliquez sur des produits</div>}
            {cart.map(l => (
              <div key={l.produit.id} className="flex items-center gap-2 py-3 border-b">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{l.produit.nom}</div>
                  <div className="text-xs text-muted-foreground">{(l.produit.prix_vente || 0).toLocaleString()} F × {l.quantite}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(l.produit.id, -1)}><Minus className="h-4 w-4" /></Button>
                  <span className="w-7 text-center font-medium">{l.quantite}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(l.produit.id, 1)}><Plus className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeLine(l.produit.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </ScrollArea>
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Remise</Label>
              <Input type="number" inputMode="decimal" value={remiseGlobale || ''} placeholder="0" onChange={e => setRemiseGlobale(Number(e.target.value) || 0)} />
            </div>
            <div className="flex justify-between text-2xl font-bold">
              <span>Total</span><span className="text-primary">{totalTicket.toLocaleString()} F</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" disabled={!session || cart.length === 0 || holdTab.isPending} onClick={() => holdTab.mutate()}>
                <PauseCircle className="h-4 w-4 mr-1" />En attente
              </Button>
              <Button size="lg" disabled={!session || cart.length === 0} onClick={() => setPayOpen(true)}>Encaisser</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={cart.length === 0} onClick={printCuisineFromCart}>
                <Utensils className="h-4 w-4 mr-1" />Bon Cuisine
              </Button>
              {lastTicket
                ? <Button variant="outline" onClick={() => printTicket(lastTicket)}><Printer className="h-4 w-4 mr-1" />Ticket Caisse</Button>
                : <Button variant="outline" disabled><Printer className="h-4 w-4 mr-1" />Ticket Caisse</Button>}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Tickets en attente */}
      <Dialog open={tabsOpen} onOpenChange={setTabsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Tickets en attente ({openTabs.length})</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {openTabs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Aucun ticket en attente</p>}
            {openTabs.map((tab: any) => {
              const t = tables.find(tt => tt.id === tab.table_id);
              const lignesCount = (tab.vente_lignes || []).length;
              return (
                <div key={tab.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Table {t?.numero || 'Comptoir'} · #{tab.numero_ticket}</div>
                    <div className="text-xs text-muted-foreground">
                      {lignesCount} article{lignesCount > 1 ? 's' : ''} · {Number(tab.total).toLocaleString()} F
                      {tab.client_nom && ` · ${tab.client_nom}`}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => resumeTab(tab)}>Reprendre</Button>
                  <Button size="icon" variant="ghost" onClick={() => cancelTab.mutate(tab.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog paiement */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Encaissement · {totalTicket.toLocaleString()} F</DialogTitle></DialogHeader>
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
