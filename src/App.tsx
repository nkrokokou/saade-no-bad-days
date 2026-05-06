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
import AchatsMP from "./pages/AchatsMP";
import InsightsBot from "./pages/InsightsBot";
import FichesTechniques from "./pages/FichesTechniques";
import Admin from "./pages/Admin";
import Catalogue from "./pages/Catalogue";
import POS from "./pages/POS";
import Ventes from "./pages/Ventes";
import Clients from "./pages/Clients";
import AuditLog from "./pages/AuditLog";
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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/index" element={<Navigate to="/dashboard" replace />} />
            <Route path="/home" element={<Navigate to="/dashboard" replace />} />

            <Route element={<AppLayout module="dashboard" />}>
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>
            <Route element={<AppLayout module="insights" />}>
              <Route path="/insights" element={<InsightsBot />} />
            </Route>
            <Route element={<AppLayout module="admin" />}>
              <Route path="/admin" element={<Admin />} />
              <Route path="/audit" element={<AuditLog />} />
            </Route>
            <Route element={<AppLayout module="catalogue" />}>
              <Route path="/catalogue" element={<Catalogue />} />
            </Route>
            <Route element={<AppLayout module="pos" />}>
              <Route path="/pos" element={<POS />} />
            </Route>
            <Route element={<AppLayout module="ventes" />}>
              <Route path="/ventes" element={<Ventes />} />
            </Route>
            <Route element={<AppLayout module="achats_mp" />}>
              <Route path="/achats-mp" element={<AchatsMP />} />
            </Route>
            <Route element={<AppLayout module="fiches_techniques" />}>
              <Route path="/fiches-techniques" element={<FichesTechniques />} />
            </Route>
            <Route element={<AppLayout module="bons_transfert" />}>
              <Route path="/bons-transfert" element={<BonsTransfert />} />
            </Route>
            <Route element={<AppLayout module="stock_tampon" />}>
              <Route path="/stock-tampon" element={<StockTampon />} />
            </Route>
            <Route element={<AppLayout module="pertes" />}>
              <Route path="/pertes" element={<Pertes />} />
            </Route>
            <Route element={<AppLayout module="production" />}>
              <Route path="/production" element={<ProductionLabo />} />
            </Route>
            <Route element={<AppLayout module="inventaire" />}>
              <Route path="/inventaire" element={<Inventaire />} />
            </Route>
            <Route element={<AppLayout module="cloture" />}>
              <Route path="/cloture" element={<ClotureJournaliere />} />
            </Route>
            <Route element={<AppLayout module="degustations" />}>
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
