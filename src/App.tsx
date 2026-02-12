import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ModuleProvider } from "@/contexts/ModuleContext";
import { PreviewProvider } from "@/contexts/PreviewContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy loaded pages - loaded on demand
const ModuleSelectionPage = lazy(() => import("./pages/ModuleSelectionPage"));
const GeneralDashboardPage = lazy(() => import("./pages/GeneralDashboardPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const AgentDetailPage = lazy(() => import("./pages/AgentDetailPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const AdministratorsPage = lazy(() => import("./pages/AdministratorsPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));

const TemplatesPage = lazy(() => import("./pages/admin/TemplatesPage"));
const TemplateDetailPage = lazy(() => import("./pages/admin/TemplateDetailPage"));
const SchedulesPage = lazy(() => import("./pages/admin/SchedulesPage"));
const CVEsCachePage = lazy(() => import("./pages/admin/CVEsCachePage"));
const SuperAgentsPage = lazy(() => import("./pages/admin/SuperAgentsPage"));

// Firewall Module Pages - lazy loaded
const FirewallDashboardPage = lazy(() => import("./pages/firewall/FirewallDashboardPage"));
const FirewallCreatePage = lazy(() => import("./pages/firewall/FirewallCreatePage"));
const FirewallEditPage = lazy(() => import("./pages/firewall/FirewallEditPage"));
const FirewallListPage = lazy(() => import("./pages/firewall/FirewallListPage"));
const FirewallCVEsPage = lazy(() => import("./pages/firewall/FirewallCVEsPage"));
const FirewallReportsPage = lazy(() => import("./pages/firewall/FirewallReportsPage"));
const TaskExecutionsPage = lazy(() => import("./pages/firewall/TaskExecutionsPage"));
const FirewallAnalysis = lazy(() => import("./pages/FirewallAnalysis"));
const AnalyzerDashboardPage = lazy(() => import("./pages/firewall/AnalyzerDashboardPage"));
const AnalyzerInsightsPage = lazy(() => import("./pages/firewall/AnalyzerInsightsPage"));
const AnalyzerCriticalPage = lazy(() => import("./pages/firewall/AnalyzerCriticalPage"));
const AnalyzerConfigChangesPage = lazy(() => import("./pages/firewall/AnalyzerConfigChangesPage"));

// External Domain Module Pages - lazy loaded
const ExternalDomainListPage = lazy(() => import("./pages/external-domain/ExternalDomainListPage"));
const ExternalDomainExecutionsPage = lazy(() => import("./pages/external-domain/ExternalDomainExecutionsPage"));
const ExternalDomainReportsPage = lazy(() => import("./pages/external-domain/ExternalDomainReportsPage"));
const ExternalDomainAnalysisReportPage = lazy(() => import("./pages/external-domain/ExternalDomainAnalysisReportPage"));
const ExternalDomainEditPage = lazy(() => import("./pages/external-domain/ExternalDomainEditPage"));
const AttackSurfaceAnalyzerPage = lazy(() => import("./pages/external-domain/AttackSurfaceAnalyzerPage"));

// Microsoft 365 Module Pages - lazy loaded
const M365ExecutionsPage = lazy(() => import("./pages/m365/M365ExecutionsPage"));
const M365ReportsPage = lazy(() => import("./pages/m365/M365ReportsPage"));
const M365PostureReportPage = lazy(() => import("./pages/m365/M365PostureReportPage"));
const M365PosturePage = lazy(() => import("./pages/m365/M365PosturePage"));
const TenantConnectionPage = lazy(() => import("./pages/m365/TenantConnectionPage"));
const OAuthCallbackPage = lazy(() => import("./pages/m365/OAuthCallbackPage"));
const EntraIdPage = lazy(() => import("./pages/m365/EntraIdPage"));
const EntraIdSecurityInsightsPage = lazy(() => import("./pages/m365/EntraIdSecurityInsightsPage"));
const EntraIdApplicationInsightsPage = lazy(() => import("./pages/m365/EntraIdApplicationInsightsPage"));
const EntraIdAnalysisPage = lazy(() => import("./pages/m365/EntraIdAnalysisPage"));
const ExchangeOnlinePage = lazy(() => import("./pages/m365/ExchangeOnlinePage"));
const M365CVEsPage = lazy(() => import("./pages/m365/M365CVEsPage"));

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
            <PreviewProvider>
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
                  <Route path="/scope-firewall/firewalls/new" element={<FirewallCreatePage />} />
                  <Route path="/scope-firewall/firewalls/:id/analysis" element={<FirewallAnalysis />} />
                  <Route path="/scope-firewall/firewalls/:id/edit" element={<FirewallEditPage />} />
                  <Route path="/scope-firewall/cves" element={<FirewallCVEsPage />} />
                  <Route path="/scope-firewall/executions" element={<TaskExecutionsPage />} />
                  <Route path="/scope-firewall/reports" element={<FirewallReportsPage />} />
                  <Route path="/scope-firewall/analyzer" element={<AnalyzerDashboardPage />} />
                  <Route path="/scope-firewall/analyzer/insights" element={<AnalyzerInsightsPage />} />
                  <Route path="/scope-firewall/analyzer/critical" element={<AnalyzerCriticalPage />} />
                  <Route path="/scope-firewall/analyzer/config-changes" element={<AnalyzerConfigChangesPage />} />

                  {/* External Domain Module */}
                  <Route path="/scope-external-domain/domains" element={<ExternalDomainListPage />} />
                  <Route path="/scope-external-domain/executions" element={<ExternalDomainExecutionsPage />} />
                  <Route path="/scope-external-domain/reports" element={<ExternalDomainReportsPage />} />
                  <Route path="/scope-external-domain/domains/:id/report/:analysisId" element={<ExternalDomainAnalysisReportPage />} />
                  <Route path="/scope-external-domain/domains/:id/edit" element={<ExternalDomainEditPage />} />
                  <Route path="/scope-external-domain/analyzer" element={<AttackSurfaceAnalyzerPage />} />

                   {/* Microsoft 365 Module */}
                  <Route path="/scope-m365" element={<Navigate to="/scope-m365/tenant-connection" replace />} />
                  <Route path="/scope-m365/dashboard" element={<Navigate to="/scope-m365/tenant-connection" replace />} />
                  <Route path="/scope-m365/analysis" element={<Navigate to="/scope-m365/tenant-connection" replace />} />
                  <Route path="/scope-m365/executions" element={<M365ExecutionsPage />} />
                  <Route path="/scope-m365/reports" element={<M365ReportsPage />} />
                  <Route path="/scope-m365/posture/report/:reportId" element={<M365PostureReportPage />} />
                  <Route path="/scope-m365/posture" element={<M365PosturePage />} />
                  <Route path="/scope-m365/tenant-connection" element={<TenantConnectionPage />} />
                  <Route path="/scope-m365/oauth-callback" element={<OAuthCallbackPage />} />
                  <Route path="/scope-m365/entra-id" element={<EntraIdPage />} />
                  <Route path="/scope-m365/entra-id/security-insights" element={<EntraIdSecurityInsightsPage />} />
                  <Route path="/scope-m365/entra-id/applications" element={<EntraIdApplicationInsightsPage />} />
                  <Route path="/scope-m365/entra-id/audit-logs" element={<Navigate to="/scope-m365/entra-id/security-insights" replace />} />
                  <Route path="/scope-m365/entra-id/analysis" element={<EntraIdAnalysisPage />} />
                  <Route path="/scope-m365/exchange-online" element={<ExchangeOnlinePage />} />
                  <Route path="/scope-m365/cves" element={<M365CVEsPage />} />

                  {/* Legacy routes - redirect to new structure */}
                  <Route path="/firewalls" element={<Navigate to="/scope-firewall/firewalls" replace />} />
                  <Route path="/firewalls/:id/analysis" element={<Navigate to="/scope-firewall/firewalls/:id/analysis" replace />} />
                  <Route path="/reports" element={<Navigate to="/scope-firewall/reports" replace />} />

                  {/* Admin */}
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/agents" element={<AgentsPage />} />
                  <Route path="/agents/:id" element={<AgentDetailPage />} />
                  <Route path="/workspaces" element={<ClientsPage />} />
                  <Route path="/clients" element={<Navigate to="/workspaces" replace />} />
                  <Route path="/administrators" element={<AdministratorsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  
                  <Route path="/templates" element={<TemplatesPage />} />
                  <Route path="/templates/:id" element={<TemplateDetailPage />} />
                  <Route path="/schedules" element={<SchedulesPage />} />
                   <Route path="/cves" element={<CVEsCachePage />} />
                   <Route path="/super-agents" element={<SuperAgentsPage />} />

                  {/* Preview routes (temporary) */}
                  <Route path="/preview/domain-report" element={<DomainReportPreview />} />
                  <Route path="/preview/firewall-report" element={<FirewallReportPreview />} />

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </PreviewProvider>
          </ModuleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
