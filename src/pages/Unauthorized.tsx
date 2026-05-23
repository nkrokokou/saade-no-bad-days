import { Button } from '@/components/ui/button';
import { useNavigate, Navigate } from 'react-router-dom';
import { ShieldX, LogIn, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { session, profile, signOut, loading } = useAuth();
  const { roles, isCeo, loading: permLoading } = usePermissions();

  if (loading || permLoading) return null;

  // Pas de session → renvoyer directement à la page de connexion
  if (!session) return <Navigate to="/login" replace />;
  if (isCeo) return <Navigate to="/dashboard" replace />;

  const primaryRole = roles[0] || profile?.role || 'salle';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <ShieldX className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-2xl font-heading font-bold mb-2">Accès non autorisé</h1>
      <p className="text-muted-foreground mb-2 text-center max-w-md">
        Vous n'avez pas les permissions nécessaires pour accéder à cette page.
      </p>
      {profile && (
        <p className="text-xs text-muted-foreground mb-6">
          Connecté en tant que <strong>{profile.full_name}</strong> · rôle : {primaryRole.replace(/_/g, ' ')}
        </p>
      )}
      <div className="flex flex-wrap gap-2 justify-center">
        <Button onClick={() => navigate('/dashboard')} variant="default">
          <Home className="h-4 w-4 mr-2" />Tableau de bord
        </Button>
        <Button onClick={() => navigate(-1)} variant="outline">Retour</Button>
        <Button
          onClick={async () => { await signOut(); navigate('/login', { replace: true }); }}
          variant="ghost"
        >
          <LogIn className="h-4 w-4 mr-2" />Changer de compte
        </Button>
      </div>
    </div>
  );
}
