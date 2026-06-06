import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Settings, Users, Database, Plus, Trash2, Edit, Save, Download, Upload, Shield, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const MODULES: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Tableau de bord' },
  { key: 'insights', label: 'Assistant IA' },
  { key: 'admin', label: 'Administration' },
  { key: 'achats_mp', label: 'Achats MP' },
  { key: 'fiches_techniques', label: 'Fiches Techniques' },
  { key: 'bons_transfert', label: 'Bons Transfert' },
  { key: 'stock_tampon', label: 'Stock Tampon' },
  { key: 'pertes', label: 'Pertes' },
  { key: 'production', label: 'Production' },
  { key: 'inventaire', label: 'Inventaire' },
  { key: 'cloture', label: 'Clôture' },
  { key: 'degustations', label: 'Dégustations' },
  { key: 'catalogue', label: 'Catalogue produits' },
  { key: 'pos', label: 'Caisse / POS' },
  { key: 'ventes', label: 'Ventes & Rapports' },
  { key: 'clients', label: 'Clients & Crédits' },
  { key: 'matieres_premieres', label: 'Matières Premières' },
  { key: 'tables_restaurant', label: 'Tables Restaurant' },
  { key: 'economat', label: 'Économat' },
];
const ACTIONS: { key: 'can_read' | 'can_create' | 'can_update' | 'can_delete'; label: string }[] = [
  { key: 'can_read', label: 'Lire' },
  { key: 'can_create', label: 'Créer' },
  { key: 'can_update', label: 'Modifier' },
  { key: 'can_delete', label: 'Supprimer' },
];

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'ceo', label: 'CEO' },
  { value: 'labo_patisserie', label: 'Labo Pâtisserie' },
  { value: 'labo_viennoiserie', label: 'Labo Viennoiserie' },
  { value: 'cuisine_salee', label: 'Cuisine Salée' },
  { value: 'salle', label: 'Salle' },
  { value: 'economat', label: 'Économat' },
];

async function invokeManageUsers(body: any) {
  const { data, error } = await supabase.functions.invoke('manage-users', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function Admin() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();

  // ── Profile tab ──
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => { if (profile) setFullName(profile.full_name); }, [profile]);

  const updateProfile = async () => {
    setSavingProfile(true);
    try {
      if (fullName !== profile?.full_name) {
        const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', user!.id);
        if (error) { toast.error(error.message); return; }
      }
      if (newEmail) {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) { toast.error(error.message); return; }
      }
      if (newPassword) {
        if (newPassword !== confirmPassword) { toast.error('Les mots de passe ne correspondent pas'); return; }
        if (newPassword.length < 6) { toast.error('Minimum 6 caractères'); return; }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) { toast.error(error.message); return; }
      }
      await refreshProfile();
      toast.success('Profil mis à jour');
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Users tab ──
  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => invokeManageUsers({ action: 'list' }),
    retry: 1,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'salle' as UserRole });
  const [editingUser, setEditingUser] = useState<any>(null);

  const createUser = useMutation({
    mutationFn: () => invokeManageUsers({ action: 'create', ...newUser }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreate(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'salle' });
      toast.success('Utilisateur créé');
    },
    onError: (e: any) => toast.error(e.message || 'Erreur lors de la création'),
  });

  const updateUser = useMutation({
    mutationFn: (data: any) => invokeManageUsers({ action: 'update', ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
      toast.success('Utilisateur modifié');
    },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => invokeManageUsers({ action: 'delete', user_id: userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Utilisateur supprimé');
    },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  // ── Backup tab ──
  const [exporting, setExporting] = useState(false);
  const exportBackup = async () => {
    setExporting(true);
    try {
      const data = await invokeManageUsers({ action: 'export_all' });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saade_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Sauvegarde téléchargée');
    } catch {
      toast.error('Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  // ── Wipe all data ──
  const [wiping, setWiping] = useState(false);
  const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState('');

  const WIPE_TABLES = [
    'bon_transfert_lignes', 'bons_transfert', 'cloture_journaliere',
    'degustations', 'pertes', 'production_labo', 'stock_tampon',
    'mouvements_stock', 'inventaire', 'fiches_techniques', 'achats_mp',
  ] as const;

  const wipeAllData = async () => {
    setWiping(true);
    try {
      for (const t of WIPE_TABLES) {
        const { error } = await supabase.from(t as any).delete().not('id', 'is', null);
        if (error) throw error;
      }
      toast.success('Toutes les données opérationnelles ont été effacées');
      qc.invalidateQueries();
      setConfirmWipeOpen(false);
      setWipeText('');
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'effacement');
    } finally {
      setWiping(false);
    }
  };

  // Allow-list of restorable tables. user_roles, profiles, module_permissions, audit_logs
  // sont volontairement exclues pour empêcher l'escalade de privilèges via un fichier piégé.
  const RESTORABLE_TABLES = new Set<string>([
    'achats_mp', 'fiches_techniques', 'bons_transfert', 'bon_transfert_lignes',
    'stock_tampon', 'mouvements_stock', 'pertes', 'production_labo',
    'inventaire', 'cloture_journaliere', 'degustations',
    'produits', 'categories_produits', 'matieres_premieres',
    'clients', 'credits_clients', 'paiements_credits',
    'ventes', 'vente_lignes', 'sessions_caisse', 'tables_restaurant',
    'ticket_templates', 'audits_ceo',
  ]);

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const tables = Object.keys(backup);
      const skipped: string[] = [];
      let count = 0;
      for (const table of tables) {
        if (!RESTORABLE_TABLES.has(table)) { skipped.push(table); continue; }
        if (!Array.isArray(backup[table]) || backup[table].length === 0) continue;
        for (const row of backup[table]) {
          await supabase.from(table as any).upsert(row as any, { onConflict: 'id' });
          count++;
        }
      }
      if (skipped.length) {
        toast.warning(`${skipped.length} table(s) ignorée(s) (non autorisées) : ${skipped.join(', ')}`);
      }
      toast.success(`${count} enregistrements restaurés`);
      qc.invalidateQueries();
    } catch {
      toast.error('Fichier de sauvegarde invalide');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" /> Administration
      </h1>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile"><Settings className="h-3.5 w-3.5 mr-1" /> Mon Profil</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1" /> Utilisateurs</TabsTrigger>
          <TabsTrigger value="permissions"><Shield className="h-3.5 w-3.5 mr-1" /> Permissions</TabsTrigger>
          <TabsTrigger value="backup"><Database className="h-3.5 w-3.5 mr-1" /> Sauvegarde</TabsTrigger>
        </TabsList>

        {/* ── PROFILE ── */}
        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle>Informations personnelles</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div><Label>Nom complet</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
              <div><Label>Nouvel email (optionnel)</Label><Input type="email" placeholder={user?.email} value={newEmail} onChange={e => setNewEmail(e.target.value)} /></div>
              <div><Label>Nouveau mot de passe (optionnel)</Label><Input type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
              {newPassword && <div><Label>Confirmer le mot de passe</Label><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>}
              <Button onClick={updateProfile} disabled={savingProfile}>
                <Save className="h-4 w-4 mr-1" /> {savingProfile ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── USERS ── */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Gestion des utilisateurs & rôles</CardTitle>
              <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouvel utilisateur</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Créer un utilisateur</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Nom complet</Label><Input value={newUser.full_name} onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} /></div>
                    <div><Label>Email</Label><Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} /></div>
                    <div><Label>Mot de passe</Label><Input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} /></div>
                    <div><Label>Rôle</Label>
                      <Select value={newUser.role} onValueChange={v => setNewUser(p => ({ ...p, role: v as UserRole }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" onClick={() => createUser.mutate()} disabled={createUser.isPending}>
                      {createUser.isPending ? 'Création...' : 'Créer'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {usersError && (
                <p className="text-sm text-destructive mb-4">Erreur de chargement des utilisateurs. Vérifiez votre connexion.</p>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell>{editingUser?.id === u.id ? (
                          <Input value={editingUser.full_name} onChange={e => setEditingUser((p: any) => ({ ...p, full_name: e.target.value }))} />
                        ) : u.full_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>{editingUser?.id === u.id ? (
                          <Select value={editingUser.role} onValueChange={v => setEditingUser((p: any) => ({ ...p, role: v }))}>
                            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : ROLES.find(r => r.value === u.role)?.label || u.role}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {editingUser?.id === u.id ? (
                              <Button size="icon" variant="ghost" onClick={() => updateUser.mutate({ user_id: u.id, full_name: editingUser.full_name, role: editingUser.role })}>
                                <Save className="h-4 w-4 text-primary" />
                              </Button>
                            ) : (
                              <Button size="icon" variant="ghost" onClick={() => setEditingUser({ ...u })}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {u.id !== user?.id && (
                              <Button size="icon" variant="ghost" onClick={() => { if (confirm('Supprimer cet utilisateur ?')) deleteUser.mutate(u.id); }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {usersLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Chargement...</TableCell></TableRow>}
                    {!usersLoading && users.length === 0 && !usersError && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Aucun utilisateur</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PERMISSIONS MATRIX ── */}
        <TabsContent value="permissions">
          <PermissionsMatrix />
        </TabsContent>

        {/* ── BACKUP ── */}
        <TabsContent value="backup">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Sauvegarde</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Exporter toutes les données de l'application en fichier JSON.</p>
                <Button onClick={exportBackup} disabled={exporting}>
                  <Download className="h-4 w-4 mr-1" /> {exporting ? 'Export...' : 'Télécharger la sauvegarde'}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Restauration</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Restaurer les données à partir d'un fichier de sauvegarde JSON.</p>
                <Input type="file" accept=".json" className="text-sm" onChange={e => { const f = e.target.files?.[0]; if (f) importBackup(f); }} />
              </CardContent>
            </Card>
          </div>

          {profile?.role === 'ceo' && (
            <Card className="mt-4 border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" /> Zone de danger
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Effacer <strong>toutes les données opérationnelles</strong> (achats, fiches techniques, transferts, production, pertes, stock, inventaire, dégustations, clôtures). Les utilisateurs, rôles et permissions sont conservés. Cette action est <strong>irréversible</strong>.
                </p>
                <Dialog open={confirmWipeOpen} onOpenChange={setConfirmWipeOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-1" /> Effacer toutes les données
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" /> Confirmation requise
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <p className="text-sm">
                        Cette action supprimera définitivement toutes les données opérationnelles. Pour confirmer, tapez <strong>EFFACER</strong> ci-dessous.
                      </p>
                      <Input value={wipeText} onChange={e => setWipeText(e.target.value)} placeholder="EFFACER" />
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={wipeText !== 'EFFACER' || wiping}
                        onClick={wipeAllData}
                      >
                        {wiping ? 'Effacement...' : 'Confirmer l\'effacement'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PermissionsMatrix() {
  const qc = useQueryClient();
  const { data: perms = [], isLoading } = useQuery({
    queryKey: ['module-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('module_permissions').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ role, module, action, value }: { role: string; module: string; action: string; value: boolean }) => {
      const existing = perms.find((p: any) => p.role === role && p.module === module);
      if (existing) {
        const { error } = await supabase.from('module_permissions').update({ [action]: value } as any).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('module_permissions').insert({ role, module, [action]: value } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['module-permissions'] }),
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const getPerm = (role: string, module: string, action: string): boolean => {
    const p = perms.find((x: any) => x.role === role && x.module === module);
    return p ? !!(p as any)[action] : false;
  };

  const ROLES_NO_CEO = ROLES.filter(r => r.value !== 'ceo');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Matrice des permissions</CardTitle>
        <p className="text-sm text-muted-foreground">Le CEO a tous les droits par défaut. Cochez/décochez pour autoriser une action à un rôle.</p>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground text-sm">Chargement...</p> : (
          <div className="space-y-6">
            {ROLES_NO_CEO.map(role => (
              <div key={role.value} className="border rounded-lg p-3">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="secondary">{role.label}</Badge>
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Module</th>
                        {ACTIONS.map(a => <th key={a.key} className="py-2 px-2 text-center font-medium">{a.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map(mod => (
                        <tr key={mod.key} className="border-t">
                          <td className="py-2 pr-4">{mod.label}</td>
                          {ACTIONS.map(a => (
                            <td key={a.key} className="py-2 px-2 text-center">
                              <Checkbox
                                checked={getPerm(role.value, mod.key, a.key)}
                                onCheckedChange={v => toggle.mutate({ role: role.value, module: mod.key, action: a.key, value: !!v })}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
