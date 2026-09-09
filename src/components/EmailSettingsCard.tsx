import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, Save, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function EmailSettingsCard() {
  const qc = useQueryClient();
  const [destinataire, setDestinataire] = useState("");
  const [copies, setCopies] = useState("");
  const [expediteurNom, setExpediteurNom] = useState("");
  const [expediteurEmail, setExpediteurEmail] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["parametres_email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parametres_email" as any)
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!data) return;
    setDestinataire(data.destinataire || "");
    setCopies((data.copies || []).join(", "));
    setExpediteurNom(data.expediteur_nom || "");
    setExpediteurEmail(data.expediteur_email || "");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("parametres_email" as any)
        .update({
          destinataire: destinataire.trim(),
          copies: copies
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
          expediteur_nom: expediteurNom.trim() || "SAADÉ Rapports",
          expediteur_email: expediteurEmail.trim() || "onboarding@resend.dev",
        })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Réglages d'envoi enregistrés");
      qc.invalidateQueries({ queryKey: ["parametres_email"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const testEnvoi = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("rapport-journalier-ceo", {
        body: { force: true },
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (d: any) => {
      if (d?.ok) toast.success("Envoi réussi");
      else toast.error("Échec : " + (d?.error || "inconnu"));
      qc.invalidateQueries({ queryKey: ["parametres_email"] });
      qc.invalidateQueries({ queryKey: ["rapports_journaliers"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const domaineTest = expediteurEmail.endsWith("@resend.dev");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Réglages d'envoi des emails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dest">Destinataire principal</Label>
            <Input id="dest" value={destinataire} onChange={(e) => setDestinataire(e.target.value)} placeholder="ceo@exemple.com" />
          </div>
          <div>
            <Label htmlFor="cc">Personnes en copie (séparées par des virgules)</Label>
            <Input id="cc" value={copies} onChange={(e) => setCopies(e.target.value)} placeholder="moi@exemple.com" />
          </div>
          <div>
            <Label htmlFor="expn">Nom affiché de l'expéditeur</Label>
            <Input id="expn" value={expediteurNom} onChange={(e) => setExpediteurNom(e.target.value)} placeholder="SAADÉ Rapports" />
          </div>
          <div>
            <Label htmlFor="expe">Adresse d'expédition</Label>
            <Input id="expe" value={expediteurEmail} onChange={(e) => setExpediteurEmail(e.target.value)} placeholder="rapports@saadenobaddays.store" />
          </div>
        </div>

        {domaineTest && (
          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
            <div>
              L'adresse d'expédition actuelle est une adresse de test : les emails ne peuvent
              partir que vers ta propre adresse. Pour écrire à la CEO, fais valider
              <strong> saadenobaddays.store</strong> chez Resend, puis remplace l'adresse ici par
              <strong> rapports@saadenobaddays.store</strong>.
            </div>
          </div>
        )}

        {data?.derniere_erreur && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
            <div className="font-medium mb-1 flex items-center gap-2">
              <Badge variant="destructive">Dernier échec</Badge>
            </div>
            <code className="break-all">{data.derniere_erreur}</code>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-2" /> Enregistrer
          </Button>
          <Button variant="outline" onClick={() => testEnvoi.mutate()} disabled={testEnvoi.isPending}>
            {testEnvoi.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Tester l'envoi maintenant
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
