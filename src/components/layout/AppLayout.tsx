import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SystemAlertBanner } from '@/components/alerts/SystemAlertBanner';
import { PreviewBanner } from '@/components/preview/PreviewBanner';
import { useAuth } from '@/contexts/AuthContext';
import { useModules, ScopeModule } from '@/contexts/ModuleContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useEffectiveModules } from '@/hooks/useEffectiveModules';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  LayoutDashboard,
  Server,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Clock,
  ChevronDown,
  Settings,
  Shield,
  Network,
  Cloud,
  Bot,
  Building,
  ShieldCheck,
  Mail,
  Layers,
  Globe,
  Database,
  Lock,
  Key,
  Zap,
  Activity,
  Monitor,
  Cpu,
  HardDrive,
  Wifi,
  ClipboardList,
  Bug,
  Radar,
  BookOpen,
  HeartPulse,
  LucideIcon,
} from 'lucide-react';
import logoIscope from '@/assets/logo-iscope.png';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';

// Map icon names to components
const iconMap: Record<string, LucideIcon> = {
  Shield,
  Cloud,
  Network,
  Server,
  Layers,
  LayoutDashboard,
  Globe,
  Database,
  Lock,
  Zap,
  Activity,
  Monitor,
  Cpu,
  HardDrive,
  Wifi,
};

const getIconFromName = (iconName: string | null): LucideIcon => {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  return LayoutDashboard;
};

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ModuleNavConfig {
  code: ScopeModule;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: NavItem[];
}

// Static navigation config for known modules
const knownModuleNavConfigs: Record<string, { items: NavItem[]; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  'scope_firewall': {
    icon: Shield,
    color: 'text-orange-500',
    items: [
      { label: 'Compliance', href: '/scope-firewall/compliance', icon: FileText },
      { label: 'Analyzer', href: '/scope-firewall/analyzer', icon: Radar },
      { label: 'Execuções', href: '/scope-firewall/executions', icon: Activity },
    ],
  },
  'scope_external_domain': {
    icon: Globe,
    color: 'text-teal-500',
    items: [
      { label: 'Compliance', href: '/scope-external-domain/compliance', icon: FileText },
      { label: 'Analyzer', href: '/scope-external-domain/analyzer', icon: Radar },
      { label: 'Execuções', href: '/scope-external-domain/executions', icon: Activity },
    ],
  },
  'scope_m365': {
    icon: Cloud,
    color: 'text-blue-500',
    items: [
      { label: 'Compliance', href: '/scope-m365/compliance', icon: FileText },
      { label: 'Exchange Analyzer', href: '/scope-m365/exchange-analyzer', icon: Mail },
      { label: 'Entra ID Analyzer', href: '/scope-m365/entra-id-analyzer', icon: Shield },
      { label: 'Colaboração Analyzer', href: '/scope-m365/teams-analyzer', icon: Users },
      { label: 'Analyzer', href: '/scope-m365/analyzer', icon: Radar },
      { label: 'Entra ID', href: '/scope-m365/entra-id', icon: Shield },
      
      { label: 'Colaboração', href: '/scope-m365/collaboration', icon: Users },
      { label: 'Saúde do 365', href: '/scope-m365/service-health', icon: HeartPulse },
      { label: 'Execuções', href: '/scope-m365/executions', icon: Activity },
    ],
  },
  'scope_network': {
    icon: Network,
    color: 'text-cyan-500',
    items: [
      { label: 'Dashboard', href: '/scope-network/dashboard', icon: LayoutDashboard },
    ],
  },
  'scope_cloud': {
    icon: Cloud,
    color: 'text-purple-500',
    items: [
      { label: 'Dashboard', href: '/scope-cloud/dashboard', icon: LayoutDashboard },
    ],
  },
};

// Default config for dynamically created modules
const getDefaultModuleConfig = (code: string) => {
  const routePrefix = code.replace(/_/g, '-');
  return {
    items: [
      { label: 'Dashboard', href: `/${routePrefix}/dashboard`, icon: LayoutDashboard },
    ],
  };
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, role, signOut, mfaRequired, mfaEnrolled } = useAuth();
  const { activeModule, setActiveModule, hasModuleAccess } = useModules();
  const { effectiveProfile, effectiveRole, isPreviewMode } = useEffectiveAuth();
  const { effectiveUserModules, allActiveModules } = useEffectiveModules();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar-open');
    return saved !== null ? saved === 'true' : true;
  });
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar-open', String(sidebarOpen));
  }, [sidebarOpen]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  // Detect active module from URL
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/scope-firewall')) {
      setActiveModule('scope_firewall');
      setExpandedModules({ scope_firewall: true });
      setAdminMenuOpen(false);
    } else if (path.startsWith('/scope-external-domain')) {
      setActiveModule('scope_external_domain');
      setExpandedModules({ scope_external_domain: true });
      setAdminMenuOpen(false);
    } else if (path.startsWith('/scope-m365')) {
      setActiveModule('scope_m365');
      setExpandedModules({ scope_m365: true });
      setAdminMenuOpen(false);
    } else if (path.startsWith('/scope-network')) {
      setActiveModule('scope_network');
      setExpandedModules({ scope_network: true });
      setAdminMenuOpen(false);
    } else if (path.startsWith('/scope-cloud')) {
      setActiveModule('scope_cloud');
      setExpandedModules({ scope_cloud: true });
      setAdminMenuOpen(false);
    } else if (path === '/environment' || path === '/licensing-hub') {
      // Environment/Licensing page: close all modules and admin
      setExpandedModules({});
      setAdminMenuOpen(false);
    } else if (path === '/workspaces' || path === '/administrators' || path === '/settings' || path === '/collections' || path === '/templates' || path === '/schedules' || path === '/cves' || path === '/super-agents' || path === '/docs') {
      // Admin routes: expand admin menu, close all modules
      setAdminMenuOpen(true);
      setExpandedModules({});
    }
  }, [location.pathname, setActiveModule]);

  // MFA Guard: redirect to MFA pages if MFA is required
  useEffect(() => {
    if (mfaRequired) {
      if (mfaEnrolled) {
        navigate('/mfa/challenge', { replace: true });
      } else {
        navigate('/mfa/enroll', { replace: true });
      }
    }
  }, [mfaRequired, mfaEnrolled, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = () => {
    // Use effective role when in preview mode
    const displayRole = effectiveRole || role;
    switch (displayRole) {
      case 'super_admin':
        return 'Super Admin';
      case 'super_suporte':
        return 'Super Suporte';
      case 'workspace_admin':
        return 'Workspace Admin';
      default:
        return 'Usuário';
    }
  };

  const toggleModule = (moduleCode: string) => {
    setExpandedModules(prev => {
      const isCurrentlyOpen = prev[moduleCode];
      // Close all and open only the clicked one (if it was closed)
      return {
        [moduleCode]: !isCurrentlyOpen,
      };
    });
    // Close admin menu when a module is opened
    if (!expandedModules[moduleCode]) {
      setAdminMenuOpen(false);
    }
  };

  const isActiveRoute = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/');
  const isSuperAdminRole = effectiveRole === 'super_admin';
  const isModuleActive = (moduleCode: string) => location.pathname.includes(moduleCode.replace('_', '-'));

  // Build module configs dynamically from effectiveUserModules (respects preview mode)
  const accessibleModuleConfigs: ModuleNavConfig[] = effectiveUserModules.map(um => {
    const code = um.module.code;
    const name = um.module.name;
    const moduleIcon = um.module.icon;
    const moduleColor = um.module.color; // Color from database
    
    // Check if we have a known config for navigation items
    const knownConfig = knownModuleNavConfigs[code];
    const navItems = knownConfig?.items || getDefaultModuleConfig(code).items;
    
    // Use icon and color from database, fallback to known config or defaults
    const icon = getIconFromName(moduleIcon) || knownConfig?.icon || LayoutDashboard;
    const color = moduleColor || knownConfig?.color || 'text-primary';
    
    return {
      code,
      name,
      icon,
      color,
      items: navItems,
    };
  });
  
  // Use effective role for menu visibility (respects preview mode)
  const canAccessUsers = effectiveRole === 'super_admin' || effectiveRole === 'workspace_admin';

  // Helper component for sidebar items with tooltip when collapsed
  const SidebarLink = ({ to, icon: Icon, label, isActive, color }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; isActive: boolean; color?: string }) => {
    const linkContent = (
      <Link
        to={to}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
          !sidebarOpen && 'justify-center'
        )}
      >
        <Icon className={cn('w-5 h-5 flex-shrink-0', color)} />
        {sidebarOpen && label}
      </Link>
    );

    if (!sidebarOpen) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  // Helper for module buttons in collapsed mode
  const ModuleButton = ({ moduleConfig }: { moduleConfig: ModuleNavConfig }) => {
    const firstRoute = moduleConfig.items[0]?.href || `/${moduleConfig.code.replace(/_/g, '-')}/dashboard`;
    
    if (!sidebarOpen) {
      return (
        <HoverCard openDelay={100} closeDelay={150}>
          <HoverCardTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isModuleActive(moduleConfig.code)
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <moduleConfig.icon className={cn('w-5 h-5 flex-shrink-0', moduleConfig.color)} />
            </button>
          </HoverCardTrigger>
          <HoverCardContent side="right" sideOffset={10} align="start" className="z-50 w-auto min-w-[200px] p-2 bg-sidebar border-sidebar-border shadow-lg">
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-sidebar-border">
              <moduleConfig.icon className={cn('w-4 h-4', moduleConfig.color)} />
              <span className="text-sm font-semibold text-sidebar-foreground">{moduleConfig.name}</span>
            </div>
            <div className="space-y-0.5">
              {moduleConfig.items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
                    isActiveRoute(item.href)
                      ? 'bg-sidebar-accent/70 text-sidebar-primary font-medium'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/30'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    }

    // In expanded mode, use collapsible
    return (
      <Collapsible
        open={expandedModules[moduleConfig.code]}
        onOpenChange={() => toggleModule(moduleConfig.code)}
      >
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isModuleActive(moduleConfig.code)
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <moduleConfig.icon className={cn('w-5 h-5 flex-shrink-0', moduleConfig.color)} />
            <span className="flex-1 text-left">{moduleConfig.name}</span>
            {expandedModules[moduleConfig.code] ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-4 space-y-1 mt-1">
          {moduleConfig.items.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActiveRoute(item.href)
                  ? 'bg-sidebar-accent/70 text-sidebar-primary font-medium'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/30'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Disabled module button for modules without access
  const DisabledModuleButton = ({ module }: { module: import('@/contexts/ModuleContext').Module }) => {
    const Icon = getIconFromName(module.icon);
    
    const content = (
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium opacity-40 cursor-default select-none',
          !sidebarOpen && 'justify-center'
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
        {sidebarOpen && <span className="text-muted-foreground">{module.name}</span>}
      </div>
    );

    if (!sidebarOpen) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {module.name}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  // Helper for admin section
  const AdminButton = () => {
    const isAdminRoute = location.pathname === '/workspaces' || location.pathname === '/administrators' || location.pathname === '/settings' || location.pathname === '/collections' || location.pathname === '/templates' || location.pathname === '/schedules' || location.pathname === '/cves' || location.pathname === '/super-agents' || location.pathname === '/docs';
    
    if (!sidebarOpen) {
      return (
        <HoverCard openDelay={100} closeDelay={150}>
          <HoverCardTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isAdminRoute
                  ? 'bg-warning/20 text-warning border border-warning/30'
                  : 'text-warning hover:bg-warning/10'
              )}
            >
              <ShieldCheck className="w-5 h-5 flex-shrink-0 text-warning" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent side="right" sideOffset={10} align="start" className="z-50 w-auto min-w-[200px] p-2 bg-sidebar border-sidebar-border shadow-lg">
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-sidebar-border">
              <ShieldCheck className="w-4 h-4 text-warning" />
              <span className="text-sm font-semibold text-warning">Administração</span>
            </div>
            <div className="space-y-0.5">
              {[
                { href: '/administrators', icon: ShieldCheck, label: 'Administradores' },
                { href: '/schedules', icon: Clock, label: 'Agendamentos' },
                { href: '/settings', icon: Settings, label: 'Configurações' },
                { href: '/cves', icon: Bug, label: 'CVEs' },
                { href: '/docs', icon: BookOpen, label: 'Documentação' },
                { href: '/super-agents', icon: Cpu, label: 'Super Agents' },
                { href: '/templates', icon: ClipboardList, label: 'Templates' },
                { href: '/workspaces', icon: Building, label: 'Workspaces' },
              ].map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
                    location.pathname === item.href
                      ? 'bg-warning/20 text-warning font-medium'
                      : 'text-warning/80 hover:bg-warning/10'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    }

    return (
      <Collapsible
        open={adminMenuOpen}
        onOpenChange={(open) => {
          setAdminMenuOpen(open);
          // Close all modules when opening admin
          if (open) {
            setExpandedModules({});
          }
        }}
      >
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isAdminRoute
                ? 'bg-warning/20 text-warning border border-warning/30'
                : 'text-warning hover:bg-warning/10'
            )}
          >
            <ShieldCheck className="w-5 h-5 flex-shrink-0 text-warning" />
            <span className="flex-1 text-left">Administração</span>
            {adminMenuOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-4 space-y-1 mt-1">
          <Link
            to="/administrators"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === '/administrators'
                ? 'bg-warning/20 text-warning font-medium'
                : 'text-warning/80 hover:bg-warning/10'
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            Administradores
          </Link>
          <Link
            to="/schedules"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === '/schedules'
                ? 'bg-warning/20 text-warning font-medium'
                : 'text-warning/80 hover:bg-warning/10'
            )}
          >
            <Clock className="w-4 h-4" />
            Agendamentos
          </Link>
          <Link
            to="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === '/settings'
                ? 'bg-warning/20 text-warning font-medium'
                : 'text-warning/80 hover:bg-warning/10'
            )}
          >
            <Settings className="w-4 h-4" />
            Configurações
          </Link>
          <Link
            to="/cves"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === '/cves'
                ? 'bg-warning/20 text-warning font-medium'
                : 'text-warning/80 hover:bg-warning/10'
            )}
          >
            <Bug className="w-4 h-4" />
            CVEs
          </Link>
          <Link
            to="/docs"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === '/docs'
                ? 'bg-warning/20 text-warning font-medium'
                : 'text-warning/80 hover:bg-warning/10'
            )}
          >
            <BookOpen className="w-4 h-4" />
            Documentação
          </Link>
          <Link
            to="/super-agents"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === '/super-agents'
                ? 'bg-warning/20 text-warning font-medium'
                : 'text-warning/80 hover:bg-warning/10'
            )}
          >
            <Cpu className="w-4 h-4" />
            Super Agents
          </Link>
          <Link
            to="/templates"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === '/templates'
                ? 'bg-warning/20 text-warning font-medium'
                : 'text-warning/80 hover:bg-warning/10'
            )}
          >
            <ClipboardList className="w-4 h-4" />
            Templates
          </Link>
          <Link
            to="/workspaces"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              location.pathname === '/workspaces'
                ? 'bg-warning/20 text-warning font-medium'
                : 'text-warning/80 hover:bg-warning/10'
            )}
          >
            <Building className="w-4 h-4" />
            Workspaces
          </Link>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const NavContent = () => (
    <TooltipProvider delayDuration={0}>
      {/* Dashboard Geral */}
      <SidebarLink 
        to="/dashboard" 
        icon={LayoutDashboard} 
        label="Dashboard" 
        isActive={location.pathname === '/dashboard'} 
      />

      {/* All active modules sorted alphabetically */}
      {allActiveModules
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(module => {
          const hasAccess = effectiveUserModules.some(em => em.module.code === module.code);
          if (hasAccess) {
            const config = accessibleModuleConfigs.find(c => c.code === module.code);
            return config ? <ModuleButton key={module.id} moduleConfig={config} /> : null;
          }
          return <DisabledModuleButton key={module.id} module={module} />;
        })}

      {/* Divider */}
      {sidebarOpen && <div className="border-t border-sidebar-border my-2" />}

      {/* Gestão de Ativos */}
      {canAccessUsers && (
        <SidebarLink 
          to="/licensing-hub" 
          icon={Key} 
          label="Gestão de Ativos" 
          isActive={location.pathname === '/licensing-hub'} 
        />
      )}

      {/* Ambiente */}
      {canAccessUsers && (
        <SidebarLink 
          to="/environment" 
          icon={Monitor} 
          label="Ambiente" 
          isActive={location.pathname === '/environment'} 
        />
      )}

      {/* Users */}
      {canAccessUsers && (
        <SidebarLink 
          to="/users" 
          icon={Users} 
          label="Usuários" 
          isActive={location.pathname === '/users'} 
        />
      )}

      {/* Agents */}
      {canAccessUsers && (
        <SidebarLink 
          to="/agents" 
          icon={Bot} 
          label="Agents" 
          isActive={location.pathname === '/agents'} 
        />
      )}

      {/* Divider before Workspaces */}
      {effectiveRole === 'super_admin' && sidebarOpen && <div className="border-t border-sidebar-border my-2" />}

      {/* Administração - Super Admin and Super Suporte (hidden in preview mode unless target has access) */}
      {(effectiveRole === 'super_admin' || effectiveRole === 'super_suporte') && <AdminButton />}
    </TooltipProvider>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Preview Banner - appears at very top when in preview mode */}
      <PreviewBanner />
      
      {/* System Alerts Banner */}
      <SystemAlertBanner />
      
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <img src={logoIscope} alt="iScope 360" className="h-6 w-auto" />
          <span className="font-bold text-foreground">iScope 360</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-50 transform transition-transform duration-200',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <img src={logoIscope} alt="iScope 360" className="h-6 w-auto" />
            <span className="font-bold text-sidebar-foreground">iScope 360</span>
          </div>
        </div>
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
          <NavContent />
        </nav>
      </aside>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'hidden lg:flex flex-col h-screen sticky top-0 border-r border-sidebar-border bg-sidebar transition-all duration-300',
            sidebarOpen ? 'w-64' : 'w-16'
          )}
        >
          {/* Logo */}
          <div className="p-4 border-b border-sidebar-border flex items-center justify-center relative">
            <span className={cn('font-bold text-sidebar-foreground tracking-wide', sidebarOpen ? 'text-lg' : 'text-xs')}>
              {sidebarOpen ? 'iScope 360' : 'iS'}
            </span>
            {sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
            <NavContent />
          </nav>

          {/* Collapse Button */}
          {!sidebarOpen && (
            <div className="p-3 border-t border-sidebar-border">
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-9"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* User Menu */}
          {sidebarOpen && (
            <div className="p-3 border-t border-sidebar-border">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={effectiveProfile?.avatar_url || undefined} alt={effectiveProfile?.full_name || ''} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(effectiveProfile?.full_name ?? effectiveProfile?.email ?? null)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {effectiveProfile?.full_name || effectiveProfile?.email}
                      </p>
                      <p className="text-xs text-muted-foreground">{getRoleBadge()}</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate('/account')} className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/account?tab=security')} className="cursor-pointer">
                    <Lock className="w-4 h-4 mr-2" />
                    Trocar Senha
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      handleSignOut();
                    }} 
                    className="text-destructive cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-screen cyber-grid px-4 lg:px-12">{children}</main>
      </div>
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  );
}
