import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save, X, Plus, Clock, Flame, AlertTriangle, ChefHat } from 'lucide-react';

const ALLERGENES_COMMUNS = [
  'Gluten', 'Œufs', 'Lait', 'Fruits à coque', 'Arachides',
  'Soja', 'Sésame', 'Sulfites', 'Moutarde', 'Crustacés', 'Poisson',
];

interface MetaData {
  id?: string;
  rendement: number | null;
  rendement_unite: string;
  temps_preparation_min: number | null;
  temps_cuisson_min: number | null;
  temperature_cuisson: number | null;
  allergenes: string[];
  etapes: string;
  conservation: string;
}

const EMPTY: MetaData = {
  rendement: null, rendement_unite: 'pièces',
  temps_preparation_min: null, temps_cuisson_min: null, temperature_cuisson: null,
  allergenes: [], etapes: '', conservation: '',
};

export function FicheMetaPanel({ produitId, coutTotal }: { produitId: string; coutTotal: number }) {
  const [meta, setMeta] = useState<MetaData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customAllergene, setCustomAllergene] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('fiches_techniques_meta')
        .select('*').eq('produit_id', produitId).maybeSingle();
      if (data) setMeta({ ...EMPTY, ...data, allergenes: data.allergenes || [] });
      else setMeta(EMPTY);
      setLoading(false);
    })();
  }, [produitId]);

  const save = async () => {
    setSaving(true);
    const payload = { ...meta, produit_id: produitId };
    delete (payload as any).id;
    const { error } = meta.id
      ? await supabase.from('fiches_techniques_meta').update(payload).eq('id', meta.id)
      : await supabase.from('fiches_techniques_meta').upsert(payload, { onConflict: 'produit_id' });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Fiche enregistrée');
    const { data } = await supabase.from('fiches_techniques_meta')
      .select('*').eq('produit_id', produitId).maybeSingle();
    if (data) setMeta({ ...EMPTY, ...data, allergenes: data.allergenes || [] });
  };

  const toggleAllergene = (a: string) => {
    setMeta(m => ({
      ...m,
      allergenes: m.allergenes.includes(a) ? m.allergenes.filter(x => x !== a) : [...m.allergenes, a],
    }));
  };

  const coutUnitaire = meta.rendement && meta.rendement > 0 ? coutTotal / meta.rendement : null;

  if (loading) return <Card><CardContent className="pt-4 text-sm text-muted-foreground">Chargement…</CardContent></Card>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ChefHat className="h-4 w-4" /> Fiche détaillée
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Rendement</Label>
            <div className="flex gap-1">
              <Input type="number" step="0.1" value={meta.rendement ?? ''}
                onChange={e => setMeta(m => ({ ...m, rendement: e.target.value === '' ? null : Number(e.target.value) }))} />
              <Input className="w-24" value={meta.rendement_unite}
                onChange={e => setMeta(m => ({ ...m, rendement_unite: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" />Prép. (min)</Label>
            <Input type="number" value={meta.temps_preparation_min ?? ''}
              onChange={e => setMeta(m => ({ ...m, temps_preparation_min: e.target.value === '' ? null : Number(e.target.value) }))} />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Flame className="h-3 w-3" />Cuisson (min)</Label>
            <Input type="number" value={meta.temps_cuisson_min ?? ''}
              onChange={e => setMeta(m => ({ ...m, temps_cuisson_min: e.target.value === '' ? null : Number(e.target.value) }))} />
          </div>
          <div>
            <Label className="text-xs">Four (°C)</Label>
            <Input type="number" value={meta.temperature_cuisson ?? ''}
              onChange={e => setMeta(m => ({ ...m, temperature_cuisson: e.target.value === '' ? null : Number(e.target.value) }))} />
          </div>
        </div>

        {coutUnitaire !== null && (
          <div className="text-sm bg-muted/40 rounded p-2">
            Coût par {meta.rendement_unite.replace(/s$/, '')} : <strong className="text-primary">{coutUnitaire.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} F CFA</strong>
          </div>
        )}

        <div>
          <Label className="text-xs flex items-center gap-1 mb-2"><AlertTriangle className="h-3 w-3" />Allergènes</Label>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGENES_COMMUNS.map(a => (
              <Badge key={a}
                variant={meta.allergenes.includes(a) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleAllergene(a)}>
                {a}
              </Badge>
            ))}
            {meta.allergenes.filter(a => !ALLERGENES_COMMUNS.includes(a)).map(a => (
              <Badge key={a} variant="secondary" className="cursor-pointer" onClick={() => toggleAllergene(a)}>
                {a} <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
          <div className="flex gap-1 mt-2">
            <Input className="h-8 text-xs" placeholder="Autre allergène…" value={customAllergene}
              onChange={e => setCustomAllergene(e.target.value)} />
            <Button size="sm" variant="ghost" className="h-8"
              onClick={() => { if (customAllergene.trim()) { toggleAllergene(customAllergene.trim()); setCustomAllergene(''); } }}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-xs">Étapes de fabrication</Label>
          <Textarea rows={6} value={meta.etapes}
            placeholder={`1. Peser les ingrédients…\n2. Mélanger au robot pendant 3 min\n3. Laisser pousser 1h…`}
            onChange={e => setMeta(m => ({ ...m, etapes: e.target.value }))} />
        </div>

        <div>
          <Label className="text-xs">Conservation</Label>
          <Input value={meta.conservation}
            placeholder="Ex : 48h au frais à 4°C, ou 7 jours sous vide"
            onChange={e => setMeta(m => ({ ...m, conservation: e.target.value }))} />
        </div>

        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Enregistrement…' : 'Enregistrer la fiche'}
        </Button>
      </CardContent>
    </Card>
  );
}
