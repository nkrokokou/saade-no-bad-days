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
import { Settings, Users, Database, Plus, Trash2, Edit, Save, Download, Upload } from 'lucide-react';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'ceo', label: 'CEO' },
  { value: 'labo_patisserie', label: 'Labo Pâtisserie' },
  { value: 'labo_viennoiserie', label: 'Labo Viennoiserie' },
  { value: 'cuisine_salee', label: 'Cuisine Salée' },
  { value: 'salle', label: 'Salle' },
];

function invokeManageUsers(body: any) {
  return supabase.functions.invoke('manage-users', { body });
}

export default function Admin() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  // ── Profile tab ──
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => { if (profile) setFullName(profile.full_name); }, [profile]);

  const updateProfile = async () => {
    if (fullName !== profile?.full_name) {
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', user!.id);
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
    toast.success('Profil mis à jour');
    setNewEmail('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // ── Users tab ──
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await invokeManageUsers({ action: 'list' });
      if (error) throw error;
      return data as any[];
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'salle' as UserRole });
  const [editingUser, setEditingUser] = useState<any>(null);

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeManageUsers({ action: 'create', ...newUser });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreate(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'salle' });
      toast.success('Utilisateur créé');
    },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const updateUser = useMutation({
    mutationFn: async (data: any) => {
      const { data: res, error } = await invokeManageUsers({ action: 'update', ...data });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
      toast.success('Utilisateur modifié');
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await invokeManageUsers({ action: 'delete', user_id: userId });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Utilisateur supprimé');
    },
  });

  // ── Backup tab ──
  const exportBackup = async () => {
    toast.info('Export en cours...');
    const { data, error } = await invokeManageUsers({ action: 'export_all' });
    if (error) { toast.error('Erreur export'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saade_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Sauvegarde téléchargée');
  };

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const tables = Object.keys(backup);
      let count = 0;
      for (const table of tables) {
        if (!Array.isArray(backup[table]) || backup[table].length === 0) continue;
        // Insert rows (skip conflicts)
        for (const row of backup[table]) {
          await supabase.from(table as any).upsert(row as any, { onConflict: 'id' });
          count++;
        }
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
        <TabsList>
          <TabsTrigger value="profile"><Settings className="h-3.5 w-3.5 mr-1" /> Mon Profil</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1" /> Utilisateurs</TabsTrigger>
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
              <Button onClick={updateProfile}><Save className="h-4 w-4 mr-1" /> Enregistrer</Button>
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
                    <Button className="w-full" onClick={() => createUser.mutate()} disabled={createUser.isPending}>Créer</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
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
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BACKUP ── */}
        <TabsContent value="backup">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Sauvegarde</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Exporter toutes les données de l'application en fichier JSON.</p>
                <Button onClick={exportBackup}><Download className="h-4 w-4 mr-1" /> Télécharger la sauvegarde</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Restauration</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Restaurer les données à partir d'un fichier de sauvegarde JSON.</p>
                <input type="file" accept=".json" className="text-sm" onChange={e => { const f = e.target.files?.[0]; if (f) importBackup(f); }} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
