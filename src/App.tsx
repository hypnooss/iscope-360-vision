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
const MfaEnrollPage = lazy(() => import("./pages/MfaEnrollPage"));
const MfaChallengePage = lazy(() => import("./pages/MfaChallengePage"));

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
const CVESourcesPage = lazy(() => import("./pages/admin/CVESourcesPage"));
const SuperAgentsPage = lazy(() => import("./pages/admin/SuperAgentsPage"));
const TechnicalDocsPage = lazy(() => import("./pages/admin/TechnicalDocsPage"));

// Firewall Module Pages - lazy loaded
const FirewallDashboardPage = lazy(() => import("./pages/firewall/FirewallDashboardPage"));
const FirewallCreatePage = lazy(() => import("./pages/firewall/FirewallCreatePage"));
const FirewallEditPage = lazy(() => import("./pages/firewall/FirewallEditPage"));

const FirewallReportsPage = lazy(() => import("./pages/firewall/FirewallReportsPage"));
const FirewallCompliancePage = lazy(() => import("./pages/firewall/FirewallCompliancePage"));
const TaskExecutionsPage = lazy(() => import("./pages/firewall/TaskExecutionsPage"));
const FirewallAnalysis = lazy(() => import("./pages/FirewallAnalysis"));
const AnalyzerDashboardPage = lazy(() => import("./pages/firewall/AnalyzerDashboardPage"));
const AnalyzerInsightsPage = lazy(() => import("./pages/firewall/AnalyzerInsightsPage"));
const AnalyzerCriticalPage = lazy(() => import("./pages/firewall/AnalyzerCriticalPage"));
const AnalyzerConfigChangesPage = lazy(() => import("./pages/firewall/AnalyzerConfigChangesPage"));

// External Domain Module Pages - lazy loaded
const ExternalDomainExecutionsPage = lazy(() => import("./pages/external-domain/ExternalDomainExecutionsPage"));
const ExternalDomainReportsPage = lazy(() => import("./pages/external-domain/ExternalDomainReportsPage"));
const ExternalDomainAnalysisReportPage = lazy(() => import("./pages/external-domain/ExternalDomainAnalysisReportPage"));
const ExternalDomainEditPage = lazy(() => import("./pages/external-domain/ExternalDomainEditPage"));
const SurfaceAnalyzerV3Page = lazy(() => import("./pages/external-domain/SurfaceAnalyzerV3Page"));
const AllFindingsPage = lazy(() => import("./pages/external-domain/AllFindingsPage"));
const ExternalDomainCompliancePage = lazy(() => import("./pages/external-domain/ExternalDomainCompliancePage"));

// Microsoft 365 Module Pages - lazy loaded
const M365ExecutionsPage = lazy(() => import("./pages/m365/M365ExecutionsPage"));
const M365ReportsPage = lazy(() => import("./pages/m365/M365ReportsPage"));
const M365PostureReportPage = lazy(() => import("./pages/m365/M365PostureReportPage"));
const M365PosturePage = lazy(() => import("./pages/m365/M365PosturePage"));

const OAuthCallbackPage = lazy(() => import("./pages/m365/OAuthCallbackPage"));

const M365AnalyzerDashboardPage = lazy(() => import("./pages/m365/M365AnalyzerDashboardPage"));
const M365ServiceHealthPage = lazy(() => import("./pages/m365/M365ServiceHealthPage"));
const ExchangeAnalyzerPage = lazy(() => import("./pages/m365/ExchangeAnalyzerPage"));
const EntraIdAnalyzerPage = lazy(() => import("./pages/m365/EntraIdAnalyzerPage"));
const TeamsAnalyzerPage = lazy(() => import("./pages/m365/TeamsAnalyzerPage"));

// Preview pages (temporary)
const EnvironmentPage = lazy(() => import("./pages/EnvironmentPage"));
const AddAssetPage = lazy(() => import("./pages/AddAssetPage"));
const AddExternalDomainPage = lazy(() => import("./pages/AddExternalDomainPage"));
const AddFirewallPage = lazy(() => import("./pages/environment/AddFirewallPage"));
const AddM365TenantPage = lazy(() => import("./pages/environment/AddM365TenantPage"));
const M365TenantEditPage = lazy(() => import("./pages/environment/M365TenantEditPage"));
const DomainReportPreview = lazy(() => import("./pages/preview/DomainReportPreview"));
const FirewallReportPreview = lazy(() => import("./pages/preview/FirewallReportPreview"));
const LicensingHubPage = lazy(() => import("./pages/LicensingHubPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const TerminalPopoutPage = lazy(() => import("./pages/TerminalPopoutPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    },
  },
});

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
                  <Route path="/mfa/enroll" element={<MfaEnrollPage />} />
                  <Route path="/mfa/challenge" element={<MfaChallengePage />} />

                  {/* Module Selection */}
                  <Route path="/modules" element={<ModuleSelectionPage />} />

                  {/* General Dashboard */}
                  <Route path="/dashboard" element={<GeneralDashboardPage />} />

                  {/* Scope Firewall Module */}
                  <Route path="/scope-firewall/dashboard" element={<FirewallDashboardPage />} />
                  <Route path="/scope-firewall/compliance" element={<FirewallCompliancePage />} />
                  <Route path="/scope-firewall/firewalls/:id/analysis" element={<FirewallAnalysis />} />
                  
                  <Route path="/scope-firewall/executions" element={<TaskExecutionsPage />} />
                  <Route path="/scope-firewall/reports" element={<FirewallReportsPage />} />
                  <Route path="/scope-firewall/analyzer" element={<AnalyzerDashboardPage />} />
                  <Route path="/scope-firewall/analyzer/insights" element={<AnalyzerInsightsPage />} />
                  <Route path="/scope-firewall/analyzer/critical" element={<AnalyzerCriticalPage />} />
                  <Route path="/scope-firewall/analyzer/config-changes" element={<AnalyzerConfigChangesPage />} />

                  {/* External Domain Module */}
                  <Route path="/scope-external-domain/compliance" element={<ExternalDomainCompliancePage />} />
                  <Route path="/scope-external-domain/executions" element={<ExternalDomainExecutionsPage />} />
                  <Route path="/scope-external-domain/reports" element={<ExternalDomainReportsPage />} />
                  <Route path="/scope-external-domain/domains/:id/report/:analysisId" element={<ExternalDomainAnalysisReportPage />} />
                  <Route path="/environment/external-domain/:id/edit" element={<ExternalDomainEditPage />} />
                  <Route path="/scope-external-domain/analyzer" element={<SurfaceAnalyzerV3Page />} />
                  <Route path="/scope-external-domain/analyzer/findings" element={<AllFindingsPage />} />

                   {/* Microsoft 365 Module */}
                  <Route path="/scope-m365" element={<Navigate to="/scope-m365/compliance" replace />} />
                  <Route path="/scope-m365/dashboard" element={<Navigate to="/scope-m365/compliance" replace />} />
                  <Route path="/scope-m365/analysis" element={<Navigate to="/scope-m365/compliance" replace />} />
                  <Route path="/scope-m365/tenant-connection" element={<Navigate to="/scope-m365/compliance" replace />} />
                  <Route path="/scope-m365/posture" element={<Navigate to="/scope-m365/compliance" replace />} />
                  <Route path="/scope-m365/executions" element={<M365ExecutionsPage />} />
                  <Route path="/scope-m365/reports" element={<M365ReportsPage />} />
                  <Route path="/scope-m365/compliance/report/:reportId" element={<M365PostureReportPage />} />
                  <Route path="/scope-m365/compliance" element={<M365PosturePage />} />
                  <Route path="/scope-m365/oauth-callback" element={<OAuthCallbackPage />} />
                  
                  <Route path="/scope-m365/exchange-analyzer" element={<ExchangeAnalyzerPage />} />
                  <Route path="/scope-m365/entra-id-analyzer" element={<EntraIdAnalyzerPage />} />
                  <Route path="/scope-m365/teams-analyzer" element={<TeamsAnalyzerPage />} />
                  
                  
                  <Route path="/scope-m365/analyzer" element={<M365AnalyzerDashboardPage />} />
                  <Route path="/scope-m365/service-health" element={<M365ServiceHealthPage />} />

                  {/* Legacy routes - redirect to new structure */}
                  <Route path="/firewalls" element={<Navigate to="/scope-firewall/firewalls" replace />} />
                  <Route path="/firewalls/:id/analysis" element={<Navigate to="/scope-firewall/firewalls/:id/analysis" replace />} />
                  <Route path="/reports" element={<Navigate to="/scope-firewall/reports" replace />} />

                  {/* Account */}
                  <Route path="/account" element={<AccountPage />} />

                  {/* Licensing Hub */}
                  <Route path="/licensing-hub" element={<LicensingHubPage />} />

                  {/* Environment */}
                  <Route path="/environment" element={<EnvironmentPage />} />
                  <Route path="/environment/firewall/:id/edit" element={<FirewallEditPage />} />
                  <Route path="/environment/new" element={<AddAssetPage />} />
                  <Route path="/environment/new/external-domain" element={<AddExternalDomainPage />} />
                  <Route path="/environment/new/firewall" element={<AddFirewallPage />} />
                  <Route path="/environment/new/m365" element={<AddM365TenantPage />} />
                  <Route path="/environment/m365/:id/edit" element={<M365TenantEditPage />} />

                  {/* Admin */}
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/agents" element={<AgentsPage />} />
                  <Route path="/agents/:id" element={<AgentDetailPage />} />
                  <Route path="/terminal/:id" element={<TerminalPopoutPage />} />
                  <Route path="/workspaces" element={<ClientsPage />} />
                  <Route path="/clients" element={<Navigate to="/workspaces" replace />} />
                  <Route path="/administrators" element={<AdministratorsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  
                  <Route path="/templates" element={<TemplatesPage />} />
                  <Route path="/templates/:id" element={<TemplateDetailPage />} />
                  <Route path="/schedules" element={<SchedulesPage />} />
                   <Route path="/cves" element={<CVEsCachePage />} />
                   <Route path="/cves/sources" element={<CVESourcesPage />} />
                   <Route path="/super-agents" element={<SuperAgentsPage />} />
                   <Route path="/docs" element={<TechnicalDocsPage />} />

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
