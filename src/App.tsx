import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ModuleProvider } from "@/contexts/ModuleContext";

// Critical pages - loaded immediately
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy loaded pages - loaded on demand
const ModuleSelectionPage = lazy(() => import("./pages/ModuleSelectionPage"));
const GeneralDashboardPage = lazy(() => import("./pages/GeneralDashboardPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const AdministratorsPage = lazy(() => import("./pages/AdministratorsPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const CollectionsPage = lazy(() => import("./pages/admin/CollectionsPage"));

// Firewall Module Pages - lazy loaded
const FirewallDashboardPage = lazy(() => import("./pages/firewall/FirewallDashboardPage"));
const FirewallListPage = lazy(() => import("./pages/firewall/FirewallListPage"));
const FirewallReportsPage = lazy(() => import("./pages/firewall/FirewallReportsPage"));
const TaskExecutionsPage = lazy(() => import("./pages/firewall/TaskExecutionsPage"));
const FirewallAnalysis = lazy(() => import("./pages/FirewallAnalysis"));

// External Domain Module Pages - lazy loaded
const ExternalDomainListPage = lazy(() => import("./pages/external-domain/ExternalDomainListPage"));
const ExternalDomainExecutionsPage = lazy(() => import("./pages/external-domain/ExternalDomainExecutionsPage"));
const ExternalDomainReportsPage = lazy(() => import("./pages/external-domain/ExternalDomainReportsPage"));
const ExternalDomainAnalysisReportPage = lazy(() => import("./pages/external-domain/ExternalDomainAnalysisReportPage"));

// Microsoft 365 Module Pages - lazy loaded
const M365DashboardPage = lazy(() => import("./pages/m365/M365DashboardPage"));
const TenantConnectionPage = lazy(() => import("./pages/m365/TenantConnectionPage"));
const OAuthCallbackPage = lazy(() => import("./pages/m365/OAuthCallbackPage"));
const EntraIdPage = lazy(() => import("./pages/m365/EntraIdPage"));
const EntraIdSecurityInsightsPage = lazy(() => import("./pages/m365/EntraIdSecurityInsightsPage"));
const EntraIdApplicationInsightsPage = lazy(() => import("./pages/m365/EntraIdApplicationInsightsPage"));
const EntraIdAnalysisPage = lazy(() => import("./pages/m365/EntraIdAnalysisPage"));

// Preview pages (temporary)
const DomainReportPreview = lazy(() => import("./pages/preview/DomainReportPreview"));
const FirewallReportPreview = lazy(() => import("./pages/preview/FirewallReportPreview"));

const queryClient = new QueryClient();

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ModuleProvider>
            <Suspense fallback={<PageLoader />}>
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
                <Route path="/scope-firewall/executions" element={<TaskExecutionsPage />} />
                <Route path="/scope-firewall/reports" element={<FirewallReportsPage />} />

                {/* External Domain Module */}
                <Route path="/scope-external-domain/domains" element={<ExternalDomainListPage />} />
                <Route path="/scope-external-domain/executions" element={<ExternalDomainExecutionsPage />} />
                <Route path="/scope-external-domain/reports" element={<ExternalDomainReportsPage />} />
                <Route path="/scope-external-domain/domains/:id/report/:analysisId" element={<ExternalDomainAnalysisReportPage />} />

                {/* Microsoft 365 Module */}
                <Route path="/scope-m365/dashboard" element={<M365DashboardPage />} />
                <Route path="/scope-m365/tenant-connection" element={<TenantConnectionPage />} />
                <Route path="/scope-m365/oauth-callback" element={<OAuthCallbackPage />} />
                <Route path="/scope-m365/entra-id" element={<EntraIdPage />} />
                <Route path="/scope-m365/entra-id/security-insights" element={<EntraIdSecurityInsightsPage />} />
                <Route path="/scope-m365/entra-id/applications" element={<EntraIdApplicationInsightsPage />} />
                <Route path="/scope-m365/entra-id/audit-logs" element={<Navigate to="/scope-m365/entra-id/security-insights" replace />} />
                <Route path="/scope-m365/entra-id/analysis" element={<EntraIdAnalysisPage />} />

                {/* Legacy routes - redirect to new structure */}
                <Route path="/firewalls" element={<Navigate to="/scope-firewall/firewalls" replace />} />
                <Route path="/firewalls/:id/analysis" element={<Navigate to="/scope-firewall/firewalls/:id/analysis" replace />} />
                <Route path="/reports" element={<Navigate to="/scope-firewall/reports" replace />} />

                {/* Admin */}
                <Route path="/users" element={<UsersPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/workspaces" element={<ClientsPage />} />
                <Route path="/clients" element={<Navigate to="/workspaces" replace />} />
                <Route path="/administrators" element={<AdministratorsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/collections" element={<CollectionsPage />} />

                {/* Preview routes (temporary) */}
                <Route path="/preview/domain-report" element={<DomainReportPreview />} />
                <Route path="/preview/firewall-report" element={<FirewallReportPreview />} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ModuleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
