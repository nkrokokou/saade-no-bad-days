import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Printer } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type MP = { id: string; nom: string; unite: string; prix_unitaire: number };
type Ing = {
  id?: string;
  section: string;
  matiere_premiere_id: string | null;
  matiere_premiere: string;
  quantite_mp: number;
  unite_mp: string;
  cout_unitaire_mp: number;
  ordre: number;
  _new?: boolean;
  _dirty?: boolean;
};
type Meta = {
  id?: string;
  moule: string;
  taille_longueur: string;
  taille_hauteur: string;
  diametre: string;
  diametre_secondaire: string;
  qte_recette: number | null;
  temps_cuisson_min: number | null;
  temperature_cuisson: number | null;
  rendement: number | null;
  rendement_unite: string;
  etapes: string;
  conservation: string;
};

const EMPTY_META: Meta = {
  moule: '', taille_longueur: '', taille_hauteur: '', diametre: '', diametre_secondaire: '',
  qte_recette: null, temps_cuisson_min: null, temperature_cuisson: null,
  rendement: null, rendement_unite: 'pièces', etapes: '', conservation: '',
};

export function FicheExcelView({
  productId, productName, mps, userId,
}: { productId: string; productName: string; mps: MP[]; userId?: string }) {
  const qc = useQueryClient();
  const [ings, setIngs] = useState<Ing[]>([]);
  const [meta, setMeta] = useState<Meta>(EMPTY_META);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<string[]>([]);

  const { data: loaded, isLoading: loading } = useQuery({
    queryKey: ['fiche_excel_view', productId],
    queryFn: async () => {
      const [{ data: ftRows }, { data: m }] = await Promise.all([
        supabase.from('fiches_techniques').select('*').eq('produit_id', productId).order('ordre', { ascending: true, nullsFirst: false }).order('created_at'),
        supabase.from('fiches_techniques_meta').select('*').eq('produit_id', productId).maybeSingle(),
      ]);
      return { ftRows: ftRows || [], m };
    },
  });

  useEffect(() => {
    if (!loaded) return;
    setIngs(loaded.ftRows.map((r: any, i: number) => ({
      id: r.id,
      section: r.section || '',
      matiere_premiere_id: r.matiere_premiere_id,
      matiere_premiere: r.matiere_premiere,
      quantite_mp: Number(r.quantite_mp) || 0,
      unite_mp: r.unite_mp || 'G',
      cout_unitaire_mp: Number(r.cout_unitaire_mp) || 0,
      ordre: r.ordre ?? i,
    })));
    const m = loaded.m;
    setMeta(m ? {
      id: m.id,
      moule: m.moule || '',
      taille_longueur: m.taille_longueur || '',
      taille_hauteur: m.taille_hauteur || '',
      diametre: m.diametre || '',
      diametre_secondaire: m.diametre_secondaire || '',
      qte_recette: m.qte_recette,
      temps_cuisson_min: m.temps_cuisson_min,
      temperature_cuisson: m.temperature_cuisson,
      rendement: m.rendement,
      rendement_unite: m.rendement_unite || 'pièces',
      etapes: m.etapes || '',
      conservation: m.conservation || '',
    } : EMPTY_META);
    setToDelete([]);
  }, [loaded]);

  const etapesArr = useMemo(
    () => (meta.etapes || '').split('\n').map(s => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean),
    [meta.etapes]
  );

  const total = ings.reduce((s, i) => s + i.quantite_mp * i.cout_unitaire_mp, 0);
  const coutParPiece = meta.qte_recette && meta.qte_recette > 0 ? total / meta.qte_recette : null;

  const updateIng = (idx: number, patch: Partial<Ing>) => {
    setIngs(prev => prev.map((it, i) => i === idx ? { ...it, ...patch, _dirty: true } : it));
  };
  const pickMP = (idx: number, mpId: string) => {
    const mp = mps.find(m => m.id === mpId);
    if (!mp) return;
    updateIng(idx, {
      matiere_premiere_id: mp.id,
      matiere_premiere: mp.nom,
      unite_mp: mp.unite,
      cout_unitaire_mp: Number(mp.prix_unitaire) || 0,
    });
  };
  const addRow = (section = '') => {
    setIngs(prev => [...prev, {
      section, matiere_premiere_id: null, matiere_premiere: '',
      quantite_mp: 0, unite_mp: 'G', cout_unitaire_mp: 0,
      ordre: prev.length, _new: true, _dirty: true,
    }]);
  };
  const removeRow = (idx: number) => {
    setIngs(prev => {
      const it = prev[idx];
      if (it.id) setToDelete(d => [...d, it.id!]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updateEtape = (i: number, val: string) => {
    const arr = [...etapesArr];
    arr[i] = val;
    setMeta(m => ({ ...m, etapes: arr.map((e, k) => `${k + 1}. ${e}`).join('\n') }));
  };
  const addEtape = () => setMeta(m => ({
    ...m,
    etapes: (etapesArr.length ? m.etapes + '\n' : '') + `${etapesArr.length + 1}. `,
  }));
  const removeEtape = (i: number) => {
    const arr = etapesArr.filter((_, k) => k !== i);
    setMeta(m => ({ ...m, etapes: arr.map((e, k) => `${k + 1}. ${e}`).join('\n') }));
  };

  const save = async () => {
    setSaving(true);
    try {
      if (toDelete.length) {
        const { error } = await supabase.from('fiches_techniques').delete().in('id', toDelete);
        if (error) throw error;
      }
      const dirty = ings.filter(i => i._dirty);
      for (let i = 0; i < ings.length; i++) ings[i].ordre = i;
      const toInsert = dirty.filter(i => i._new && i.matiere_premiere.trim()).map(i => ({
        produit_id: productId,
        section: i.section || null,
        matiere_premiere_id: i.matiere_premiere_id,
        matiere_premiere: i.matiere_premiere,
        quantite_mp: i.quantite_mp,
        unite_mp: i.unite_mp,
        cout_unitaire_mp: i.cout_unitaire_mp,
        ordre: i.ordre,
        created_by: userId,
      }));
      const toUpdate = dirty.filter(i => !i._new && i.id);
      if (toInsert.length) {
        const { error } = await supabase.from('fiches_techniques').insert(toInsert);
        if (error) throw error;
      }
      for (const i of toUpdate) {
        const { error } = await supabase.from('fiches_techniques').update({
          section: i.section || null,
          matiere_premiere_id: i.matiere_premiere_id,
          matiere_premiere: i.matiere_premiere,
          quantite_mp: i.quantite_mp,
          unite_mp: i.unite_mp,
          cout_unitaire_mp: i.cout_unitaire_mp,
          ordre: i.ordre,
        }).eq('id', i.id!);
        if (error) throw error;
      }
      const metaPayload: any = {
        produit_id: productId,
        moule: meta.moule || null,
        taille_longueur: meta.taille_longueur || null,
        taille_hauteur: meta.taille_hauteur || null,
        diametre: meta.diametre || null,
        diametre_secondaire: meta.diametre_secondaire || null,
        qte_recette: meta.qte_recette,
        temps_cuisson_min: meta.temps_cuisson_min,
        temperature_cuisson: meta.temperature_cuisson,
        rendement: meta.rendement,
        rendement_unite: meta.rendement_unite || 'pièces',
        etapes: meta.etapes || null,
        conservation: meta.conservation || null,
        created_by: userId,
      };
      const { error: mErr } = await supabase.from('fiches_techniques_meta').upsert(metaPayload, { onConflict: 'produit_id' });
      if (mErr) throw mErr;
      toast.success('Fiche enregistrée');
      qc.invalidateQueries({ queryKey: ['fiches_techniques'] });
      qc.invalidateQueries({ queryKey: ['produits'] });
      qc.invalidateQueries({ queryKey: ['fiche_excel_view', productId] });
      setToDelete([]);
    } catch (e: any) {
      toast.error('Erreur : ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground p-8 text-center">Chargement…</div>;

  // Group ingredients by section for rowspan rendering (Excel-like)
  const groups: { section: string; items: { ing: Ing; idx: number }[] }[] = [];
  ings.forEach((ing, idx) => {
    const sec = ing.section || '';
    const last = groups[groups.length - 1];
    if (last && last.section === sec) last.items.push({ ing, idx });
    else groups.push({ section: sec, items: [{ ing, idx }] });
  });

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Imprimer
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      {/* Excel-style fiche */}
      <div className="bg-white border-2 border-foreground/80 rounded-md overflow-hidden font-sans text-sm shadow-sm">
        {/* HEADER */}
        <table className="w-full border-collapse">
          <tbody>
            <Row label="PRODUIT">
              <Input className="excel-cell font-bold uppercase" value={productName} disabled />
            </Row>
            <Row label="MOULE">
              <Input className="excel-cell" value={meta.moule}
                onChange={e => setMeta(m => ({ ...m, moule: e.target.value }))} />
            </Row>
            <Row label="TAILLE LONGUEUR">
              <Input className="excel-cell" value={meta.taille_longueur}
                onChange={e => setMeta(m => ({ ...m, taille_longueur: e.target.value }))} />
            </Row>
            <Row label="TAILLE HAUTEUR">
              <Input className="excel-cell" value={meta.taille_hauteur}
                onChange={e => setMeta(m => ({ ...m, taille_hauteur: e.target.value }))} />
            </Row>
            <Row label="DIAMETRE">
              <div className="flex gap-1">
                <Input className="excel-cell flex-1" placeholder="Principal" value={meta.diametre}
                  onChange={e => setMeta(m => ({ ...m, diametre: e.target.value }))} />
                <Input className="excel-cell flex-1" placeholder="Mini / secondaire" value={meta.diametre_secondaire}
                  onChange={e => setMeta(m => ({ ...m, diametre_secondaire: e.target.value }))} />
              </div>
            </Row>
            <Row label="QTE POUR UNE RECETTE (PIECES)">
              <Input type="number" className="excel-cell" value={meta.qte_recette ?? ''}
                onChange={e => setMeta(m => ({ ...m, qte_recette: e.target.value === '' ? null : Number(e.target.value) }))} />
            </Row>
            <Row label="TEMPS CUISSON">
              <Input className="excel-cell" placeholder="ex : 2 min friture"
                value={meta.temps_cuisson_min ?? ''}
                onChange={e => setMeta(m => ({ ...m, temps_cuisson_min: e.target.value === '' ? null : Number(e.target.value) }))} />
            </Row>
            <Row label="T° CUISSON">
              <Input className="excel-cell" value={meta.temperature_cuisson ?? ''}
                onChange={e => setMeta(m => ({ ...m, temperature_cuisson: e.target.value === '' ? null : Number(e.target.value) }))} />
            </Row>
          </tbody>
        </table>

        {/* INGREDIENTS */}
        <table className="w-full border-collapse border-t-2 border-foreground/80">
          <thead>
            <tr className="bg-[hsl(var(--primary)/0.15)]">
              <th className="excel-th w-32">SECTION</th>
              <th className="excel-th text-left">INGREDIENTS</th>
              <th className="excel-th w-20">QTE</th>
              <th className="excel-th w-20">UNITE</th>
              <th className="excel-th w-40">PRIX DE REVIENT<br/>POUR UNE RECETTE</th>
              <th className="excel-th w-12 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) => g.items.map((it, ii) => (
              <tr key={`${gi}-${ii}`} className="border-b">
                {ii === 0 && (
                  <td className="excel-td align-top bg-muted/30 font-bold uppercase text-xs" rowSpan={g.items.length}>
                    <Input className="excel-cell font-bold uppercase" value={g.section}
                      placeholder="—"
                      onChange={e => {
                        const newSec = e.target.value;
                        g.items.forEach(({ idx }) => updateIng(idx, { section: newSec }));
                      }} />
                  </td>
                )}
                <td className="excel-td">
                  <div className="flex gap-1">
                    <Select value={it.ing.matiere_premiere_id || ''} onValueChange={v => pickMP(it.idx, v)}>
                      <SelectTrigger className="excel-cell w-8 px-1 print:hidden" />
                      <SelectContent className="max-h-72">
                        {mps.map(m => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="excel-cell flex-1 uppercase" value={it.ing.matiere_premiere}
                      onChange={e => updateIng(it.idx, { matiere_premiere: e.target.value })} />
                  </div>
                </td>
                <td className="excel-td">
                  <Input type="number" step="0.001" className="excel-cell text-right" value={it.ing.quantite_mp || ''}
                    onChange={e => updateIng(it.idx, { quantite_mp: parseFloat(e.target.value) || 0 })} />
                </td>
                <td className="excel-td">
                  <Input className="excel-cell text-center uppercase" value={it.ing.unite_mp}
                    onChange={e => updateIng(it.idx, { unite_mp: e.target.value })} />
                </td>
                <td className="excel-td text-right font-mono">
                  {(it.ing.quantite_mp * it.ing.cout_unitaire_mp).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                </td>
                <td className="excel-td print:hidden">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRow(it.idx)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </td>
              </tr>
            )))}
            {ings.length === 0 && (
              <tr><td colSpan={6} className="excel-td text-center text-muted-foreground py-4">Aucun ingrédient</td></tr>
            )}
            <tr className="bg-[hsl(var(--primary)/0.1)] font-bold">
              <td className="excel-td" colSpan={4}>TOTAL</td>
              <td className="excel-td text-right font-mono">{total.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
              <td className="excel-td print:hidden"></td>
            </tr>
            {coutParPiece !== null && (
              <tr className="bg-[hsl(var(--primary)/0.05)] text-xs">
                <td className="excel-td" colSpan={4}>POUR 1 PIÈCE</td>
                <td className="excel-td text-right font-mono">{coutParPiece.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
                <td className="excel-td print:hidden"></td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex gap-2 p-2 border-t print:hidden">
          <Button size="sm" variant="outline" onClick={() => addRow('')}>
            <Plus className="h-3 w-3 mr-1" /> Ligne
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            const sec = prompt('Nom de la section (ex : GLACAGE, DECO, BASE) :');
            if (sec) addRow(sec.toUpperCase());
          }}>
            <Plus className="h-3 w-3 mr-1" /> Section
          </Button>
        </div>

        {/* REALISATION */}
        <div className="border-t-2 border-foreground/80">
          <div className="bg-[hsl(var(--primary)/0.15)] px-3 py-1.5 font-bold uppercase text-sm">
            RÉALISATION
          </div>
          <table className="w-full border-collapse">
            <tbody>
              {etapesArr.map((e, i) => (
                <tr key={i} className="border-b">
                  <td className="excel-td w-12 text-center font-bold">{i + 1}</td>
                  <td className="excel-td">
                    <Input className="excel-cell uppercase" value={e}
                      onChange={ev => updateEtape(i, ev.target.value)} />
                  </td>
                  <td className="excel-td w-12 print:hidden">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeEtape(i)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {etapesArr.length === 0 && (
                <tr><td colSpan={3} className="excel-td text-center text-muted-foreground py-4">Aucune étape</td></tr>
              )}
            </tbody>
          </table>
          <div className="p-2 print:hidden">
            <Button size="sm" variant="outline" onClick={addEtape}>
              <Plus className="h-3 w-3 mr-1" /> Étape
            </Button>
          </div>
        </div>

        {/* Conservation */}
        <div className="border-t-2 border-foreground/80 p-2 flex items-center gap-2">
          <span className="font-bold uppercase text-xs">Conservation :</span>
          <Input className="excel-cell flex-1" value={meta.conservation}
            onChange={e => setMeta(m => ({ ...m, conservation: e.target.value }))} />
        </div>
      </div>

      <style>{`
        .excel-cell { border: 0 !important; background: transparent !important; height: auto !important; padding: 2px 6px !important; box-shadow: none !important; }
        .excel-cell:focus { outline: 2px solid hsl(var(--primary) / 0.4) !important; background: hsl(var(--primary) / 0.05) !important; }
        .excel-th { border: 1px solid hsl(var(--foreground) / 0.4); padding: 6px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .excel-td { border: 1px solid hsl(var(--foreground) / 0.25); padding: 0; vertical-align: middle; }
        @media print {
          .excel-cell { color: black !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b">
      <td className="excel-td w-64 bg-muted/40 px-2 py-1 font-bold text-xs uppercase">{label}</td>
      <td className="excel-td">{children}</td>
    </tr>
  );
}
