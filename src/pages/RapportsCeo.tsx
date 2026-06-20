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
import { exportToExcel, exportToPDF, exportToExcelMulti, exportToPDFSections, fmtMoneyPdf } from "@/hooks/useExcelImportExport";

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

      <DailyExportCard />


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

// =====================================================
// Export rapport journalier DÉTAILLÉ (PDF / Excel multi-feuilles)
// =====================================================
async function buildDailyReportDetailed(date: string) {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const [ventesRes, sessionsRes, cloturesRes, nouveauxCreditsRes, paiementsCreditsRes, encoursRes, pertesRes] = await Promise.all([
    supabase.from("ventes").select("id, total, mode_paiement, numero_ticket, client_nom, date_vente, statut, caissier_nom").gte("date_vente", dayStart).lte("date_vente", dayEnd).neq("statut", "annulee"),
    supabase.from("sessions_caisse").select("id, statut, ecart, ferme_at, ouvert_at, fond_initial, fond_final_attendu, fond_final_compte, caissier_nom, notes").gte("ouvert_at", dayStart).lte("ouvert_at", dayEnd),
    supabase.from("cloture_journaliere").select("produit, categorie, ouverture, recu, vendu, degustation, invendu, invendu_50, compte, qte_perte, prix_invendu_50, valeur_perte").eq("date_cloture", date),
    supabase.from("credits_clients").select("client_nom, montant_initial, montant_restant").eq("date_credit", date),
    supabase.from("paiements_credits").select("montant, credit_id, date_paiement").gte("date_paiement", dayStart).lte("date_paiement", dayEnd),
    supabase.from("credits_clients").select("montant_restant").eq("statut", "ouvert"),
    supabase.from("pertes").select("produit, quantite, valeur, motif").eq("jour", date),
  ]);

  const ventes = ventesRes.data || [];
  const ca = ventes.reduce((s, v: any) => s + Number(v.total || 0), 0);
  const nbTickets = ventes.length;
  const panierMoyen = nbTickets ? ca / nbTickets : 0;

  const parMode: Record<string, number> = {};
  ventes.forEach((v: any) => { const m = v.mode_paiement || "autre"; parMode[m] = (parMode[m] || 0) + Number(v.total || 0); });

  // Lignes de ventes détaillées
  let lignes: any[] = [];
  let parProduit: { nom: string; categorie: string; qte: number; ca: number }[] = [];
  if (ventes.length) {
    const ids = ventes.map((v: any) => v.id);
    const ticketByVente = new Map(ventes.map((v: any) => [v.id, v]));
    const { data: rawLignes } = await supabase
      .from("vente_lignes")
      .select("vente_id, produit_id, produit_nom, quantite, prix_unitaire, total_ligne, produits(nom, categorie_id, categories_produits(nom))")
      .in("vente_id", ids);
    lignes = (rawLignes || []).map((l: any) => {
      const v = ticketByVente.get(l.vente_id) as any;
      const cat = l.produits?.categories_produits?.nom || '';
      return {
        ticket: v?.numero_ticket || '',
        date: v?.date_vente || '',
        client: v?.client_nom || '',
        caissier: v?.caissier_nom || '',
        produit: l.produit_nom,
        categorie: cat,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        total: l.total_ligne,
        mode: v?.mode_paiement || '',
      };
    });
    const map = new Map<string, { nom: string; categorie: string; qte: number; ca: number }>();
    lignes.forEach(l => {
      const key = l.produit;
      if (!map.has(key)) map.set(key, { nom: l.produit, categorie: l.categorie, qte: 0, ca: 0 });
      const cur = map.get(key)!;
      cur.qte += Number(l.quantite || 0);
      cur.ca += Number(l.total || 0);
    });
    parProduit = Array.from(map.values()).sort((a, b) => b.ca - a.ca);
  }

  const sessions = sessionsRes.data || [];
  const sessionsFermees = sessions.filter((s: any) => s.statut === "fermee" || s.statut === "fermee_auto");
  const sessionsOuvertes = sessions.filter((s: any) => s.statut === "ouverte");
  const ecartTotal = sessionsFermees.reduce((s: number, x: any) => s + Number(x.ecart || 0), 0);

  const clotures = cloturesRes.data || [];
  const valeurInvendus = clotures.reduce((s: number, c: any) => s + Number(c.invendu || 0) * Number(c.prix_invendu_50 || 0), 0);

  const nouveauxCreditsList = nouveauxCreditsRes.data || [];
  const nouveauxCredits = nouveauxCreditsList.reduce((s: number, c: any) => s + Number(c.montant_initial || 0), 0);
  const paiementsCredits = (paiementsCreditsRes.data || []).reduce((s: number, p: any) => s + Number(p.montant || 0), 0);
  const encours = (encoursRes.data || []).reduce((s: number, c: any) => s + Number(c.montant_restant || 0), 0);
  const pertes = pertesRes.data || [];
  const pertesValeur = pertes.reduce((s: number, p: any) => s + Number(p.valeur || 0), 0);

  return {
    date, ca, nbTickets, panierMoyen, parMode, ventes, lignes, parProduit,
    sessions: { total: sessions.length, fermees: sessionsFermees.length, ouvertes: sessionsOuvertes.length, ecartTotal, all: sessions },
    cloture: { lignes: clotures, nbProduits: clotures.length, valeurInvendus },
    credits: { nouveaux: nouveauxCredits, nouveauxList: nouveauxCreditsList, paiements: paiementsCredits, encours },
    pertes, pertesValeur,
  };
}

function DailyExportCard() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [busy, setBusy] = useState<null | "pdf" | "excel">(null);

  const handleExport = async (kind: "pdf" | "excel") => {
    setBusy(kind);
    try {
      const r = await buildDailyReportDetailed(date);
      const dayLbl = format(new Date(date + "T12:00:00"), "EEEE d MMMM yyyy", { locale: fr });
      const fName = `rapport_journalier_${date}`;

      if (kind === "excel") {
        // ── Multi-feuilles ────────────────────────
        const resume: any[] = [
          { Section: "Date", Libellé: dayLbl, Valeur: "" },
          { Section: "CA", Libellé: "Chiffre d'affaires (F)", Valeur: Math.round(r.ca) },
          { Section: "CA", Libellé: "Nombre de tickets", Valeur: r.nbTickets },
          { Section: "CA", Libellé: "Panier moyen (F)", Valeur: Math.round(r.panierMoyen) },
          ...Object.entries(r.parMode).map(([m, v]) => ({ Section: "Paiement", Libellé: m, Valeur: Math.round(v as number) })),
          { Section: "Caisse", Libellé: "Sessions ouvertes", Valeur: r.sessions.ouvertes },
          { Section: "Caisse", Libellé: "Sessions fermées", Valeur: r.sessions.fermees },
          { Section: "Caisse", Libellé: "Écart total (F)", Valeur: Math.round(r.sessions.ecartTotal) },
          { Section: "Crédits", Libellé: "Nouveaux crédits (F)", Valeur: Math.round(r.credits.nouveaux) },
          { Section: "Crédits", Libellé: "Paiements reçus (F)", Valeur: Math.round(r.credits.paiements) },
          { Section: "Crédits", Libellé: "Encours total (F)", Valeur: Math.round(r.credits.encours) },
          { Section: "Pertes", Libellé: "Valeur pertes (F)", Valeur: Math.round(r.pertesValeur) },
          { Section: "Clôture", Libellé: "Valeur invendus -50% (F)", Valeur: Math.round(r.cloture.valeurInvendus) },
        ];

        const tickets = r.ventes.map((v: any) => ({
          Ticket: v.numero_ticket, Date: v.date_vente, Caissier: v.caissier_nom || '',
          Client: v.client_nom || '', Mode: v.mode_paiement, Total: Math.round(Number(v.total || 0)), Statut: v.statut,
        }));

        const lignes = r.lignes.map((l: any) => ({
          Ticket: l.ticket, Date: l.date, Produit: l.produit, Catégorie: l.categorie,
          Quantité: l.quantite, 'Prix unitaire': l.prix_unitaire, Total: l.total, Mode: l.mode, Caissier: l.caissier,
        }));

        const produits = r.parProduit.map(p => ({
          Produit: p.nom, Catégorie: p.categorie, Quantité: p.qte, CA: Math.round(p.ca),
        }));

        const cloture = r.cloture.lignes.map((c: any) => ({
          Produit: c.produit, Catégorie: c.categorie, Ouverture: c.ouverture, Reçu: c.recu,
          Vendu: c.vendu, Dégustation: c.degustation, Invendu: c.invendu, 'Invendu -50%': c.invendu_50,
          Compté: c.compte, 'Qté perte': c.qte_perte, 'Valeur perte': c.valeur_perte,
        }));

        const sessions = r.sessions.all.map((s: any) => ({
          Caissier: s.caissier_nom || '', Ouverture: s.ouvert_at, Fermeture: s.ferme_at || '',
          'Fond initial': s.fond_initial, 'Attendu': s.fond_final_attendu, 'Compté': s.fond_final_compte,
          Écart: s.ecart, Statut: s.statut, Notes: s.notes || '',
        }));

        const credits = r.credits.nouveauxList.map((c: any) => ({
          Client: c.client_nom, 'Montant initial': c.montant_initial, 'Restant': c.montant_restant,
        }));

        const pertes = r.pertes.map((p: any) => ({
          Produit: p.produit, Quantité: p.quantite, Valeur: p.valeur, Motif: p.motif || '',
        }));

        exportToExcelMulti([
          { name: 'Résumé', rows: resume },
          { name: 'Tickets', rows: tickets },
          { name: 'Lignes de vente', rows: lignes },
          { name: 'Produits', rows: produits },
          { name: 'Clôture', rows: cloture },
          { name: 'Sessions caisse', rows: sessions },
          { name: 'Nouveaux crédits', rows: credits },
          { name: 'Pertes', rows: pertes },
        ], fName);
      } else {
        // ── PDF multi-sections ─────────────────────
        const sections = [
          {
            heading: 'Résumé',
            headers: ['Indicateur', 'Valeur'],
            rows: [
              ["Chiffre d'affaires", fmtMoneyPdf(r.ca)],
              ['Nombre de tickets', String(r.nbTickets)],
              ['Panier moyen', fmtMoneyPdf(r.panierMoyen)],
              ...Object.entries(r.parMode).map(([m, v]) => [`Paiement: ${m}`, fmtMoneyPdf(Number(v))] as [string, string]),
              ['Sessions ouvertes', String(r.sessions.ouvertes)],
              ['Sessions fermées', String(r.sessions.fermees)],
              ['Écart caisse total', fmtMoneyPdf(r.sessions.ecartTotal)],
              ['Nouveaux crédits', fmtMoneyPdf(r.credits.nouveaux)],
              ['Paiements reçus', fmtMoneyPdf(r.credits.paiements)],
              ['Encours total', fmtMoneyPdf(r.credits.encours)],
              ['Valeur pertes', fmtMoneyPdf(r.pertesValeur)],
              ['Valeur invendus -50%', fmtMoneyPdf(r.cloture.valeurInvendus)],
            ],
          },
          {
            heading: `Produits vendus (${r.parProduit.length})`,
            headers: ['Produit', 'Catégorie', 'Qté', 'CA'],
            rows: r.parProduit.map(p => [p.nom, p.categorie, String(p.qte), fmtMoneyPdf(p.ca)]),
          },
          {
            heading: `Tickets (${r.ventes.length})`,
            headers: ['#', 'Heure', 'Client', 'Mode', 'Total'],
            rows: r.ventes.map((v: any) => [
              v.numero_ticket || '',
              v.date_vente ? format(new Date(v.date_vente), 'HH:mm') : '',
              v.client_nom || '-',
              v.mode_paiement || '',
              fmtMoneyPdf(v.total),
            ]),
          },
          {
            heading: `Sessions caisse (${r.sessions.total})`,
            headers: ['Caissier', 'Ouvert', 'Fermé', 'Attendu', 'Compté', 'Écart'],
            rows: r.sessions.all.map((s: any) => [
              s.caissier_nom || '-',
              s.ouvert_at ? format(new Date(s.ouvert_at), 'HH:mm') : '',
              s.ferme_at ? format(new Date(s.ferme_at), 'HH:mm') : '-',
              fmtMoneyPdf(s.fond_final_attendu),
              fmtMoneyPdf(s.fond_final_compte),
              fmtMoneyPdf(s.ecart),
            ]),
          },
        ].filter(s => s.rows.length > 0);

        exportToPDFSections(`Rapport journalier - ${dayLbl}`, sections, fName);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur génération rapport");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><FileDown className="h-5 w-5 text-primary" /> Exporter un rapport journalier détaillé</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}>Aujourd'hui</Button>
            <Button size="sm" variant="outline" onClick={() => setDate(format(subDays(new Date(), 1), "yyyy-MM-dd"))}>Hier</Button>
            <Button size="sm" variant="outline" onClick={() => setDate(format(subDays(new Date(), 7), "yyyy-MM-dd"))}>-7 j</Button>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button onClick={() => handleExport("pdf")} disabled={!!busy}>
              {busy === "pdf" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
              Télécharger PDF
            </Button>
            <Button onClick={() => handleExport("excel")} disabled={!!busy} variant="secondary">
              {busy === "excel" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Télécharger Excel
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Excel : <strong>8 feuilles</strong> (Résumé, Tickets, Lignes de vente, Produits, Clôture, Sessions caisse, Crédits, Pertes). PDF : Résumé + Produits vendus + Tickets + Sessions.
        </p>
      </CardContent>
    </Card>
  );
}

