import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, Printer, ChefHat, ReceiptText } from 'lucide-react';

type Template = {
  id?: string;
  type: 'cuisine' | 'caisse';
  header_title: string;
  header_subtitle: string;
  header_address: string;
  header_phone: string;
  footer_message: string;
  footer_legal: string;
  show_ticket_number: boolean;
  show_datetime: boolean;
  show_serveur: boolean;
  show_table: boolean;
  show_caissier: boolean;
  show_prices: boolean;
  show_payment_mode: boolean;
  show_change: boolean;
  exclude_boissons: boolean;
  group_by_category: boolean;
  font_size_px: number;
  paper_width_mm: number;
  extra_css: string;
};

const SAMPLE_LINES = [
  { nom: 'BURGER FORMULE + SOFT', qte: 1, pu: 4500 },
  { nom: 'CHEESE BURGER', qte: 1, pu: 4000 },
  { nom: 'FRITES', qte: 1, pu: 1500 },
  { nom: 'WORLD COLA', qte: 1, pu: 500 },
  { nom: 'EAU PLATE', qte: 1, pu: 500 },
];

export default function TicketTemplates() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const isCeo = profile?.role === 'ceo';

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['ticket_templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_templates' as any).select('*').order('type');
      if (error) throw error;
      return data as unknown as Template[];
    },
  });

  const [active, setActive] = useState<'cuisine' | 'caisse'>('cuisine');
  const [form, setForm] = useState<Template | null>(null);

  useEffect(() => {
    const t = templates.find(t => t.type === active);
    if (t) setForm(t);
  }, [templates, active]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { id, ...rest } = form;
      const { error } = await supabase.from('ticket_templates' as any)
        .update(rest as any).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Modèle enregistré');
      qc.invalidateQueries({ queryKey: ['ticket_templates'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = <K extends keyof Template>(key: K, value: Template[K]) => {
    setForm(p => p ? { ...p, [key]: value } : p);
  };

  if (isLoading || !form) return <p className="text-sm text-muted-foreground p-4">Chargement…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <ReceiptText className="h-6 w-6 text-primary" /> Modèles de tickets
        </h1>
        {isCeo && (
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        )}
      </div>

      {!isCeo && (
        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          Lecture seule · seul le CEO peut modifier les modèles.
        </p>
      )}

      <Tabs value={active} onValueChange={(v) => setActive(v as any)}>
        <TabsList>
          <TabsTrigger value="cuisine"><ChefHat className="h-4 w-4 mr-1" />Bon Cuisine</TabsTrigger>
          <TabsTrigger value="caisse"><ReceiptText className="h-4 w-4 mr-1" />Ticket Caisse</TabsTrigger>
        </TabsList>

        <TabsContent value={active} className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* ── Configuration ── */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">En-tête</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div><Label>Titre principal</Label><Input value={form.header_title} disabled={!isCeo} onChange={e => set('header_title', e.target.value)} /></div>
                  <div><Label>Sous-titre</Label><Input value={form.header_subtitle ?? ''} disabled={!isCeo} onChange={e => set('header_subtitle', e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Adresse</Label><Input value={form.header_address ?? ''} disabled={!isCeo} onChange={e => set('header_address', e.target.value)} /></div>
                    <div><Label>Téléphone</Label><Input value={form.header_phone ?? ''} disabled={!isCeo} onChange={e => set('header_phone', e.target.value)} /></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Pied de page</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div><Label>Message</Label><Textarea rows={2} value={form.footer_message ?? ''} disabled={!isCeo} onChange={e => set('footer_message', e.target.value)} /></div>
                  <div><Label>Mention légale</Label><Input value={form.footer_legal ?? ''} disabled={!isCeo} onChange={e => set('footer_legal', e.target.value)} /></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Affichage</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {([
                    ['show_ticket_number', 'Numéro de ticket'],
                    ['show_datetime', 'Date / heure'],
                    ['show_serveur', 'Serveur'],
                    ['show_table', 'Table'],
                    ['show_caissier', 'Caissier'],
                    ['show_prices', 'Prix unitaire et total'],
                    ['show_payment_mode', 'Mode de paiement'],
                    ['show_change', 'Monnaie rendue'],
                  ] as const).map(([k, label]) => (
                    <div key={k} className="flex items-center justify-between py-1">
                      <Label className="text-sm">{label}</Label>
                      <Switch checked={!!form[k]} disabled={!isCeo} onCheckedChange={(v) => set(k, v as any)} />
                    </div>
                  ))}
                  {active === 'cuisine' && (
                    <>
                      <div className="flex items-center justify-between py-1">
                        <Label className="text-sm">Exclure les boissons</Label>
                        <Switch checked={form.exclude_boissons} disabled={!isCeo} onCheckedChange={(v) => set('exclude_boissons', v)} />
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <Label className="text-sm">Regrouper par catégorie</Label>
                        <Switch checked={form.group_by_category} disabled={!isCeo} onCheckedChange={(v) => set('group_by_category', v)} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Mise en page</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Largeur papier (mm)</Label><Input type="number" value={form.paper_width_mm} disabled={!isCeo} onChange={e => set('paper_width_mm', Number(e.target.value) || 80)} /></div>
                    <div><Label>Taille police (px)</Label><Input type="number" value={form.font_size_px} disabled={!isCeo} onChange={e => set('font_size_px', Number(e.target.value) || 12)} /></div>
                  </div>
                  <div><Label>CSS additionnel (optionnel)</Label><Textarea rows={3} className="font-mono text-xs" value={form.extra_css ?? ''} disabled={!isCeo} onChange={e => set('extra_css', e.target.value)} placeholder=".total { font-size: 16px; }" /></div>
                </CardContent>
              </Card>
            </div>

            {/* ── Aperçu ── */}
            <Card className="lg:sticky lg:top-16 self-start">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Aperçu</CardTitle>
                <Button size="sm" variant="outline" onClick={() => previewPrint(form)}>
                  <Printer className="h-4 w-4 mr-1" />Tester l'impression
                </Button>
              </CardHeader>
              <CardContent>
                <div
                  className="mx-auto bg-white text-black border rounded shadow-sm p-3 font-mono"
                  style={{ width: `${form.paper_width_mm * 3}px`, fontSize: `${form.font_size_px}px`, maxWidth: '100%' }}
                  dangerouslySetInnerHTML={{ __html: renderPreview(form) }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Render helpers (also used by POS via shared util — see src/lib/ticketRender.ts) ──
function renderPreview(t: Template): string {
  const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/,/g, ' ');
  const head = `
    <div style="text-align:center;font-weight:bold;font-size:18px;">${escapeHtml(t.header_title)}</div>
    ${t.header_subtitle ? `<div style="text-align:center;font-size:11px;font-weight:bold;letter-spacing:1px;">${escapeHtml(t.header_subtitle)}</div>` : ''}
    ${t.header_address ? `<div style="text-align:center;font-size:11px;">${escapeHtml(t.header_address)}</div>` : ''}
    ${t.header_phone ? `<div style="text-align:center;font-size:11px;">${escapeHtml(t.header_phone)}</div>` : ''}
  `;
  const meta = [];
  if (t.show_datetime) meta.push(new Date().toLocaleString('fr-FR'));
  if (t.show_ticket_number) meta.push('Ticket N° 3140');
  const lines = SAMPLE_LINES.filter(l => {
    if (t.type !== 'cuisine') return true;
    if (!t.exclude_boissons) return true;
    return !/COLA|EAU|SOFT|JUS|BOISSON/.test(l.nom);
  });
  const total = lines.reduce((s, l) => s + l.pu * l.qte, 0);
  const rows = lines.map(l => {
    if (t.type === 'cuisine') return `<div style="font-size:14px;font-weight:bold;border-bottom:1px dashed #000;padding:3px 0;">${l.qte}× ${l.nom}</div>`;
    return `<div style="display:flex;justify-content:space-between;"><span>${l.qte}× ${l.nom}</span>${t.show_prices ? `<span>${fmt(l.pu * l.qte)} F</span>` : ''}</div>`;
  }).join('');
  return `
    ${head}
    <hr style="border:none;border-top:1px solid #000;margin:6px 0;"/>
    <div style="display:flex;justify-content:space-between;font-size:11px;">${meta.map(m => `<span>${m}</span>`).join('')}</div>
    ${t.show_table || t.show_serveur ? `<div style="font-size:11px;">${t.show_table ? 'table : 12 ' : ''}${t.show_serveur ? '  serveur : SIKA' : ''}</div>` : ''}
    <hr style="border:none;border-top:1px solid #000;margin:6px 0;"/>
    ${rows}
    <hr style="border:none;border-top:1px solid #000;margin:6px 0;"/>
    ${t.show_prices && t.type === 'caisse' ? `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;"><span>Total</span><span>${fmt(total)} F</span></div>` : ''}
    ${t.show_payment_mode && t.type === 'caisse' ? `<div style="display:flex;justify-content:space-between;"><span>Espèces</span><span>${fmt(total)} F</span></div>` : ''}
    ${t.show_change && t.type === 'caisse' ? `<div style="display:flex;justify-content:space-between;"><span>Relicat</span><span>0 F</span></div>` : ''}
    ${t.show_caissier ? `<div style="font-size:11px;">caissier : SIKA</div>` : ''}
    <hr style="border:none;border-top:1px solid #000;margin:6px 0;"/>
    ${t.footer_message ? `<div style="text-align:center;font-size:11px;">${escapeHtml(t.footer_message)}</div>` : ''}
    ${t.footer_legal ? `<div style="text-align:center;font-size:10px;color:#444;">${escapeHtml(t.footer_legal)}</div>` : ''}
    ${t.type === 'cuisine' ? `<div style="text-align:center;font-size:11px;margin-top:6px;">*FIN DE LA COMMANDE*</div>` : ''}
  `;
}

function escapeHtml(s: string) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function previewPrint(t: Template) {
  const html = `<html><head><title>Aperçu</title><style>
    @page { size: ${Number(t.paper_width_mm) || 80}mm auto; margin: 2mm; }
    body { font-family: 'Courier New', monospace; padding: 0; margin: 0; width: ${(Number(t.paper_width_mm) || 80) - 4}mm; font-size: ${Number(t.font_size_px) || 12}px; color: #000; }
    ${sanitizeCssLocal(t.extra_css)}
  </style></head><body>${renderPreview(t)}</body></html>`;
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => setTimeout(() => {
    iframe.contentWindow?.focus(); iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 200);
}
