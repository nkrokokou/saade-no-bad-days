import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy loaded pages
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.default })));
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.default })));
const BonsTransfert = lazy(() => import("./pages/BonsTransfert").then(m => ({ default: m.default })));
const StockTampon = lazy(() => import("./pages/StockTampon").then(m => ({ default: m.default })));
const Pertes = lazy(() => import("./pages/Pertes").then(m => ({ default: m.default })));
const ProductionLabo = lazy(() => import("./pages/ProductionLabo").then(m => ({ default: m.default })));
const Inventaire = lazy(() => import("./pages/Inventaire").then(m => ({ default: m.default })));
const ClotureJournaliere = lazy(() => import("./pages/ClotureJournaliere").then(m => ({ default: m.default })));
const Degustations = lazy(() => import("./pages/Degustations").then(m => ({ default: m.default })));
const AchatsMP = lazy(() => import("./pages/AchatsMP").then(m => ({ default: m.default })));
const InsightsBot = lazy(() => import("./pages/InsightsBot").then(m => ({ default: m.default })));
const FichesTechniques = lazy(() => import("./pages/FichesTechniques").then(m => ({ default: m.default })));
const Admin = lazy(() => import("./pages/Admin").then(m => ({ default: m.default })));
const Catalogue = lazy(() => import("./pages/Catalogue").then(m => ({ default: m.default })));
const Categories = lazy(() => import("./pages/Categories").then(m => ({ default: m.default })));
const MatieresPremieres = lazy(() => import("./pages/MatieresPremieres").then(m => ({ default: m.default })));
const TablesRestaurant = lazy(() => import("./pages/TablesRestaurant").then(m => ({ default: m.default })));
const POS = lazy(() => import("./pages/POS").then(m => ({ default: m.default })));
const Ventes = lazy(() => import("./pages/Ventes").then(m => ({ default: m.default })));
const Clients = lazy(() => import("./pages/Clients").then(m => ({ default: m.default })));
const AuditLog = lazy(() => import("./pages/AuditLog").then(m => ({ default: m.default })));
const RapportsCeo = lazy(() => import("./pages/RapportsCeo").then(m => ({ default: m.default })));
const AuditsCeo = lazy(() => import("./pages/AuditsCeo").then(m => ({ default: m.default })));
const TicketTemplates = lazy(() => import("./pages/TicketTemplates").then(m => ({ default: m.default })));
const Unauthorized = lazy(() => import("./pages/Unauthorized").then(m => ({ default: m.default })));
const NotFound = lazy(() => import("./pages/NotFound").then(m => ({ default: m.default })));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="space-y-4 w-64">
      <Skeleton className="h-8 w-48 mx-auto" />
      <Skeleton className="h-4 w-32 mx-auto" />
    </div>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
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
                <Route path="/rapports-ceo" element={<RapportsCeo />} />
                <Route path="/audits-ceo" element={<AuditsCeo />} />
                <Route path="/ticket-templates" element={<TicketTemplates />} />
              </Route>
              <Route element={<AppLayout module="catalogue" />}>
                <Route path="/catalogue" element={<Catalogue />} />
                <Route path="/categories" element={<Categories />} />
              </Route>
              <Route element={<AppLayout module="pos" />}>
                <Route path="/pos" element={<POS />} />
              </Route>
              <Route element={<AppLayout module="ventes" />}>
                <Route path="/ventes" element={<Ventes />} />
              </Route>
              <Route element={<AppLayout module="clients" />}>
                <Route path="/clients" element={<Clients />} />
              </Route>
              <Route element={<AppLayout module="achats_mp" />}>
                <Route path="/achats-mp" element={<AchatsMP />} />
              </Route>
              <Route element={<AppLayout module="matieres_premieres" />}>
                <Route path="/matieres-premieres" element={<MatieresPremieres />} />
              </Route>
              <Route element={<AppLayout module="tables_restaurant" />}>
                <Route path="/tables-restaurant" element={<TablesRestaurant />} />
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
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
