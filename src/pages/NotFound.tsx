import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Cake } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 · route inconnue :', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background via-secondary/30 to-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center h-24 w-24 rounded-full gradient-primary text-primary-foreground mb-6 shadow-lg"
        >
          <Cake className="h-12 w-12" />
        </motion.div>
        <h1 className="text-7xl font-heading font-bold text-primary mb-2">404</h1>
        <p className="text-xl font-heading text-foreground mb-2">Page introuvable</p>
        <p className="text-sm text-muted-foreground mb-8">
          La pâtisserie que vous cherchez s'est égarée. Retournons en cuisine.
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
          <Button asChild>
            <Link to="/dashboard">
              <Home className="h-4 w-4 mr-2" /> Tableau de bord
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
