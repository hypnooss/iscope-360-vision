import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ModuleProvider } from "@/contexts/ModuleContext";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ModuleSelectionPage from "./pages/ModuleSelectionPage";
import GeneralDashboardPage from "./pages/GeneralDashboardPage";
import UsersPage from "./pages/UsersPage";
import AgentsPage from "./pages/AgentsPage";
import ClientsPage from "./pages/ClientsPage";
import NotFound from "./pages/NotFound";

// Firewall Module Pages
import FirewallDashboardPage from "./pages/firewall/FirewallDashboardPage";
import FirewallListPage from "./pages/firewall/FirewallListPage";
import FirewallReportsPage from "./pages/firewall/FirewallReportsPage";
import FirewallAnalysis from "./pages/FirewallAnalysis";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ModuleProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />

              {/* Module Selection */}
              <Route path="/modules" element={<ModuleSelectionPage />} />

              {/* General Dashboard */}
              <Route path="/dashboard" element={<GeneralDashboardPage />} />

              {/* Scope Firewall Module */}
              <Route path="/scope-firewall/dashboard" element={<FirewallDashboardPage />} />
              <Route path="/scope-firewall/firewalls" element={<FirewallListPage />} />
              <Route path="/scope-firewall/firewalls/:id/analysis" element={<FirewallAnalysis />} />
              <Route path="/scope-firewall/reports" element={<FirewallReportsPage />} />

              {/* Legacy routes - redirect to new structure */}
              <Route path="/firewalls" element={<Navigate to="/scope-firewall/firewalls" replace />} />
              <Route path="/firewalls/:id/analysis" element={<Navigate to="/scope-firewall/firewalls/:id/analysis" replace />} />
              <Route path="/reports" element={<Navigate to="/scope-firewall/reports" replace />} />

              {/* Admin */}
              <Route path="/users" element={<UsersPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/clients" element={<ClientsPage />} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ModuleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
