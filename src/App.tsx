import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BonsTransfert from "./pages/BonsTransfert";
import StockTampon from "./pages/StockTampon";
import Pertes from "./pages/Pertes";
import ProductionLabo from "./pages/ProductionLabo";
import Inventaire from "./pages/Inventaire";
import ClotureJournaliere from "./pages/ClotureJournaliere";
import Degustations from "./pages/Degustations";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* CEO only */}
            <Route element={<AppLayout allowedRoles={['ceo']} />}>
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>

            {/* Bons de Transfert */}
            <Route element={<AppLayout allowedRoles={['ceo', 'labo_patisserie', 'labo_viennoiserie', 'salle']} />}>
              <Route path="/bons-transfert" element={<BonsTransfert />} />
            </Route>

            {/* Stock Tampon */}
            <Route element={<AppLayout allowedRoles={['ceo', 'labo_patisserie', 'labo_viennoiserie', 'cuisine_salee']} />}>
              <Route path="/stock-tampon" element={<StockTampon />} />
            </Route>

            {/* Pertes */}
            <Route element={<AppLayout allowedRoles={['ceo', 'labo_patisserie', 'labo_viennoiserie', 'cuisine_salee']} />}>
              <Route path="/pertes" element={<Pertes />} />
            </Route>

            {/* Production */}
            <Route element={<AppLayout allowedRoles={['ceo', 'labo_patisserie', 'labo_viennoiserie']} />}>
              <Route path="/production" element={<ProductionLabo />} />
            </Route>

            {/* Inventaire */}
            <Route element={<AppLayout allowedRoles={['ceo', 'cuisine_salee']} />}>
              <Route path="/inventaire" element={<Inventaire />} />
            </Route>

            {/* Clôture Journalière & Invendus -50% */}
            <Route element={<AppLayout allowedRoles={['ceo', 'salle']} />}>
              <Route path="/cloture" element={<ClotureJournaliere />} />
            </Route>

            {/* Dégustations */}
            <Route element={<AppLayout allowedRoles={['ceo', 'salle']} />}>
              <Route path="/degustations" element={<Degustations />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
