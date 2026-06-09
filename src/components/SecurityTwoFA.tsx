import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Factor { id: string; friendly_name: string | null; factor_type: string; status: string; }

export function SecurityTwoFA({ roleHint }: { roleHint?: string }) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');

  const sensitive = roleHint === 'ceo' || roleHint === 'economat';

  const load = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error) setFactors([...(data?.totp || []), ...(data?.phone || [])] as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp', friendlyName: `SAADÉ ${new Date().toLocaleDateString('fr-FR')}`,
    });
    if (error) { toast.error(error.message); setEnrolling(false); return; }
    setEnrollData({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verifyEnroll = async () => {
    if (!enrollData) return;
    const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
    if (ce) { toast.error(ce.message); return; }
    const { error: ve } = await supabase.auth.mfa.verify({
      factorId: enrollData.factorId, challengeId: ch.id, code,
    });
    if (ve) { toast.error('Code invalide'); return; }
    toast.success('2FA activée');
    setEnrollData(null); setCode(''); setEnrolling(false);
    load();
  };

  const removeFactor = async (id: string) => {
    if (!confirm('Désactiver ce 2FA ?')) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) { toast.error(error.message); return; }
    toast.success('2FA désactivée'); load();
  };

  const verified = factors.filter(f => f.status === 'verified');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {verified.length > 0
            ? <ShieldCheck className="h-5 w-5 text-emerald-600" />
            : <ShieldAlert className={`h-5 w-5 ${sensitive ? 'text-destructive' : 'text-muted-foreground'}`} />}
          Authentification à deux facteurs (2FA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sensitive && verified.length === 0 && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm">
            ⚠️ Votre rôle ({roleHint}) est sensible. Activez le 2FA dès que possible pour protéger les données financières et le stock.
          </div>
        )}

        {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : (
          <>
            {verified.length === 0 && <p className="text-sm text-muted-foreground">Aucun facteur configuré.</p>}
            {verified.map(f => (
              <div key={f.id} className="flex items-center justify-between p-2 rounded border">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{f.factor_type.toUpperCase()}</Badge>
                  <span className="text-sm">{f.friendly_name || 'TOTP'}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeFactor(f.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </>
        )}

        {!enrolling && verified.length === 0 && (
          <Button onClick={startEnroll}>Activer le 2FA (TOTP)</Button>
        )}

        {enrollData && (
          <div className="space-y-3 p-3 rounded-md border bg-muted/30">
            <p className="text-sm">1. Scannez ce QR code avec <strong>Google Authenticator</strong>, <strong>Authy</strong> ou <strong>1Password</strong>.</p>
            <div className="bg-white p-3 rounded inline-block">
              <img src={enrollData.qr} alt="QR 2FA" className="w-40 h-40" />
            </div>
            <p className="text-xs text-muted-foreground break-all">Ou saisissez manuellement : <code>{enrollData.secret}</code></p>
            <div>
              <Label>2. Entrez le code à 6 chiffres affiché</Label>
              <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" maxLength={6} />
            </div>
            <div className="flex gap-2">
              <Button onClick={verifyEnroll} disabled={code.length !== 6}>Valider</Button>
              <Button variant="ghost" onClick={() => { setEnrollData(null); setEnrolling(false); setCode(''); }}>Annuler</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
