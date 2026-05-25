import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Save, Trash2, Calendar, Star, Plus, FileDown, Send, Loader2 } from "lucide-react";
import { buildAuditPdf } from "@/lib/auditPdf";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const RUBRIQUES = [
  { key: "qualite_produits", label: "Qualité des produits" },
  { key: "presentation_vitrine", label: "Présentation vitrine / mise en scène" },
  { key: "proprete_boutique", label: "Propreté boutique & salle" },
  { key: "proprete_labo", label: "Propreté laboratoires" },
  { key: "hygiene_equipe", label: "Hygiène & tenue de l'équipe" },
  { key: "service_client", label: "Service client & accueil" },
  { key: "rapidite_service", label: "Rapidité du service" },
  { key: "ambiance", label: "Ambiance générale" },
  { key: "gestion_caisse", label: "Gestion de la caisse" },
  { key: "respect_recettes", label: "Respect des recettes & fiches techniques" },
  { key: "gestion_stock", label: "Gestion du stock & pertes" },
  { key: "communication_equipe", label: "Communication interne équipe" },
];

type Rubriques = Record<string, number>;

function emptyRubriques(): Rubriques {
  return RUBRIQUES.reduce((acc, r) => ({ ...acc, [r.key]: 0 }), {});
}

export default function AuditsCeo() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rubriques, setRubriques] = useState<Rubriques>(emptyRubriques());
  const [defauts, setDefauts] = useState("");
  const [ameliorations, setAmeliorations] = useState("");
  const [commentaires, setCommentaires] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: audits, isLoading } = useQuery({
    queryKey: ["audits_ceo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audits_ceo" as any)
        .select("*")
        .order("date_audit", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const reset = () => {
    setEditingId(null);
    setDate(format(new Date(), "yyyy-MM-dd"));
    setRubriques(emptyRubriques());
    setDefauts("");
    setAmeliorations("");
    setCommentaires("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        date_audit: date,
        rubriques,
        defauts: defauts || null,
        ameliorations: ameliorations || null,
        commentaires: commentaires || null,
        created_by: profile?.id,
      };
      if (editingId) {
        const { error } = await supabase
          .from("audits_ceo" as any)
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("audits_ceo" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Audit mis à jour" : "Audit enregistré");
      reset();
      qc.invalidateQueries({ queryKey: ["audits_ceo"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("audits_ceo" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Audit supprimé");
      if (editingId) reset();
      qc.invalidateQueries({ queryKey: ["audits_ceo"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const [sendingId, setSendingId] = useState<string | null>(null);

  const downloadPdf = (a: any) => {
    const doc = buildAuditPdf({
      date_audit: a.date_audit,
      rubriques: a.rubriques || {},
      defauts: a.defauts,
      ameliorations: a.ameliorations,
      commentaires: a.commentaires,
    });
    doc.save(`audit-ceo-${a.date_audit}.pdf`);
  };

  const sendByEmail = async (a: any) => {
    setSendingId(a.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-audit-ceo", {
        body: { audit_id: a.id },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error?.message || "Échec d'envoi");
      toast.success(`Audit envoyé à ${(data as any).to}`);
    } catch (e: any) {
      toast.error(e?.message || "Erreur d'envoi");
    } finally {
      setSendingId(null);
    }
  };


  const loadAudit = (a: any) => {
    setEditingId(a.id);
    setDate(a.date_audit);
    setRubriques({ ...emptyRubriques(), ...(a.rubriques || {}) });
    setDefauts(a.defauts || "");
    setAmeliorations(a.ameliorations || "");
    setCommentaires(a.commentaires || "");
  };

  const moyenne = (() => {
    const notes = Object.values(rubriques).filter((v) => v > 0);
    if (notes.length === 0) return 0;
    return notes.reduce((a, b) => a + b, 0) / notes.length;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Audits CEO
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Évaluation par rubriques + notes libres sur les défauts et améliorations.
          </p>
        </div>
        {editingId && (
          <Button variant="outline" onClick={reset}>
            <Plus className="h-4 w-4 mr-2" /> Nouvel audit
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{editingId ? "Modifier l'audit" : "Nouvel audit"}</span>
              {moyenne > 0 && (
                <Badge variant="secondary" className="text-base">
                  Moyenne : {moyenne.toFixed(1)} / 5
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="max-w-xs">
              <Label htmlFor="date">Date de l'audit</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Tableau de rubriques (0 = non évalué, 1 à 5)
              </Label>
              <div className="mt-2 border rounded-md divide-y">
                {RUBRIQUES.map((r) => (
                  <div
                    key={r.key}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="text-sm flex-1">{r.label}</span>
                    <RatingStars
                      value={rubriques[r.key] || 0}
                      onChange={(v) => setRubriques({ ...rubriques, [r.key]: v })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="defauts">Défauts constatés</Label>
                <Textarea
                  id="defauts"
                  value={defauts}
                  onChange={(e) => setDefauts(e.target.value)}
                  placeholder="Listez les problèmes observés…"
                  rows={6}
                />
              </div>
              <div>
                <Label htmlFor="ameliorations">Améliorations à apporter</Label>
                <Textarea
                  id="ameliorations"
                  value={ameliorations}
                  onChange={(e) => setAmeliorations(e.target.value)}
                  placeholder="Listez les actions à mettre en place…"
                  rows={6}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="commentaires">Commentaires généraux</Label>
              <Textarea
                id="commentaires"
                value={commentaires}
                onChange={(e) => setCommentaires(e.target.value)}
                placeholder="Notes libres, contexte, points positifs…"
                rows={4}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {editingId ? "Mettre à jour" : "Enregistrer l'audit"}
              </Button>
              {editingId && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => downloadPdf(audits?.find((x: any) => x.id === editingId))}
                  >
                    <FileDown className="h-4 w-4 mr-2" /> Télécharger PDF
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => sendByEmail(audits?.find((x: any) => x.id === editingId))}
                    disabled={sendingId === editingId}
                  >
                    {sendingId === editingId
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <Send className="h-4 w-4 mr-2" />}
                    Envoyer par email
                  </Button>
                  <Button variant="ghost" onClick={reset}>Annuler</Button>
                </>
              )}
            </div>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[700px] overflow-y-auto">
            {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
            {!isLoading && (!audits || audits.length === 0) && (
              <p className="text-sm text-muted-foreground">Aucun audit enregistré.</p>
            )}
            {audits?.map((a: any) => {
              const notes = Object.values(a.rubriques || {}).filter((v: any) => v > 0) as number[];
              const moy = notes.length ? notes.reduce((x, y) => x + y, 0) / notes.length : 0;
              const isActive = a.id === editingId;
              return (
                <div
                  key={a.id}
                  className={`p-3 rounded-md border transition ${
                    isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <button onClick={() => loadAudit(a)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(a.date_audit + "T12:00:00"), "EEE d MMM yyyy", { locale: fr })}
                      </div>
                      {moy > 0 && (
                        <Badge variant="secondary">{moy.toFixed(1)}/5</Badge>
                      )}
                    </div>
                    {(a.defauts || a.ameliorations) && (
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {a.defauts || a.ameliorations}
                      </div>
                    )}
                  </button>
                  <div className="flex justify-end gap-1 mt-2 flex-wrap">
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => downloadPdf(a)}>
                      <FileDown className="h-3 w-3 mr-1" /> PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7"
                      onClick={() => sendByEmail(a)}
                      disabled={sendingId === a.id}
                    >
                      {sendingId === a.id
                        ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        : <Send className="h-3 w-3 mr-1" />}
                      Envoyer
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cet audit ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(a.id)}>
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RatingStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          className="p-0.5"
          aria-label={`Note ${n}`}
        >
          <Star
            className={`h-5 w-5 transition ${
              n <= value
                ? "fill-primary text-primary"
                : "text-muted-foreground/40 hover:text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
