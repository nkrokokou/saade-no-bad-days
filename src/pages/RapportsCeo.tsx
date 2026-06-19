import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Calendar, CheckCircle2, XCircle, Clock, Loader2, FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { exportToExcel, exportToPDF } from "@/hooks/useExcelImportExport";

const CEO_EMAIL = "nkro006@gmail.com";

const fmtXOF = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " F";

export default function RapportsCeo() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: rapports, isLoading } = useQuery({
    queryKey: ["rapports_journaliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rapports_journaliers")
        .select("*")
        .order("date_rapport", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data || [];
    },
  });

  const sendNow = useMutation({
    mutationFn: async (date?: string) => {
      const { data, error } = await supabase.functions.invoke("rapport-journalier-ceo", {
        body: { date, force: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.ok) {
        toast.success("Rapport envoyé à la CEO");
      } else {
        toast.error("Échec d'envoi : " + (data?.error || "inconnu"));
      }
      qc.invalidateQueries({ queryKey: ["rapports_journaliers"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const selectedRapport = rapports?.find((r: any) => r.id === selected);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading">Rapports CEO</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <Mail className="h-4 w-4" />
            Envoi automatique à <strong>{CEO_EMAIL}</strong> tous les jours à 23h00
          </p>
        </div>
        <Button onClick={() => sendNow.mutate(undefined)} disabled={sendNow.isPending}>
          {sendNow.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Envoyer le rapport d'aujourd'hui
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
            {!isLoading && (!rapports || rapports.length === 0) && (
              <p className="text-sm text-muted-foreground">
                Aucun rapport encore. Le premier sera envoyé automatiquement à 23h00.
              </p>
            )}
            {rapports?.map((r: any) => {
              const isActive = r.id === selected;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className={`w-full text-left p-3 rounded-md border transition ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(r.date_rapport + "T12:00:00"), "EEE d MMM yyyy", { locale: fr })}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.payload?.report?.ca !== undefined && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      CA : <strong>{fmtXOF(r.payload.report.ca)}</strong> · {r.payload.report.nbTickets} tickets
                    </div>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aperçu du rapport</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRapport ? (
              <p className="text-sm text-muted-foreground">
                Sélectionnez un rapport dans l'historique pour voir son contenu.
              </p>
            ) : (
              <RapportPreview rapport={selectedRapport} onResend={() => sendNow.mutate(selectedRapport.date_rapport)} resending={sendNow.isPending} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent")
    return (
      <Badge variant="secondary" className="text-green-700 bg-green-100 dark:bg-green-900/30">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Envoyé
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" /> Échec
      </Badge>
    );
  return (
    <Badge variant="outline">
      <Clock className="h-3 w-3 mr-1" /> En attente
    </Badge>
  );
}

function RapportPreview({ rapport, onResend, resending }: any) {
  const r = rapport.payload?.report;
  if (!r) return <p className="text-sm text-muted-foreground">Pas de contenu.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b">
        <div>
          <div className="font-medium">{r.dayLabel}</div>
          <div className="text-xs text-muted-foreground">
            {rapport.status === "sent" && rapport.sent_at && (
              <>Envoyé le {format(new Date(rapport.sent_at), "d MMM HH:mm", { locale: fr })}</>
            )}
            {rapport.status === "failed" && (
              <span className="text-destructive">Échec : {rapport.error_message}</span>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onResend} disabled={resending}>
          <Send className="h-3 w-3 mr-2" /> Renvoyer
        </Button>
      </div>

      <Section title="Chiffre d'affaires">
        <Row label="CA total" value={fmtXOF(r.ca)} highlight />
        <Row label="Tickets" value={String(r.nbTickets)} />
        <Row label="Panier moyen" value={fmtXOF(r.panierMoyen)} />
      </Section>

      <Section title="Par mode de paiement">
        {Object.keys(r.parMode || {}).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun paiement</p>
        ) : (
          Object.entries(r.parMode).map(([m, v]: any) => (
            <Row key={m} label={m} value={fmtXOF(v)} />
          ))
        )}
      </Section>

      <Section title="Caisse">
        <Row label="Sessions" value={`${r.sessions.fermees} fermées / ${r.sessions.total}`} />
        {r.sessions.ouvertes > 0 && (
          <Row label="⚠ Ouvertes" value={String(r.sessions.ouvertes)} warn />
        )}
        <Row label="Écart total" value={fmtXOF(r.sessions.ecartTotal)} />
      </Section>

      <Section title="Top 5 produits">
        {(r.topProduits || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune vente</p>
        ) : (
          r.topProduits.map((p: any, i: number) => (
            <Row key={i} label={`${i + 1}. ${p.nom}`} value={`${p.qte} · ${fmtXOF(p.ca)}`} />
          ))
        )}
      </Section>

      <Section title="Clôture journalière">
        <Row label="Produits clôturés" value={String(r.cloture.nbProduits)} />
        <Row label="Produits avec perte" value={String(r.cloture.nbProduitsAvecPerte)} />
        <Row label="Valeur invendus -50%" value={fmtXOF(r.cloture.valeurInvendus)} />
      </Section>

      <Section title="Crédits clients">
        <Row label="Nouveaux crédits" value={fmtXOF(r.credits.nouveaux)} />
        <Row label="Paiements reçus" value={fmtXOF(r.credits.paiements)} />
        <Row label="Total encours" value={fmtXOF(r.credits.encours)} highlight />
      </Section>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, highlight, warn }: any) {
  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-medium ${
          highlight ? "text-primary text-base" : ""
        } ${warn ? "text-orange-600" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
