import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ShieldX } from 'lucide-react';

export default function Unauthorized() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <ShieldX className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-2xl font-heading font-bold mb-2">Accès non autorisé</h1>
      <p className="text-muted-foreground mb-6">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
      <Button onClick={() => navigate(-1)}>Retour</Button>
    </div>
  );
}
