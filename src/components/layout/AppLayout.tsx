import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules, ScopeModule } from '@/contexts/ModuleContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  LayoutDashboard,
  Server,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Settings,
  Shield,
  Network,
  Cloud,
  Bot,
} from 'lucide-react';
import logoPrecisio from '@/assets/logo-precisio-analytics.png';

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

const moduleNavConfigs: ModuleNavConfig[] = [
  {
    code: 'scope_firewall',
    name: 'Scope Firewall',
    icon: Shield,
    color: 'text-orange-500',
    items: [
      { label: 'Dashboard', href: '/scope-firewall/dashboard', icon: LayoutDashboard },
      { label: 'Firewalls', href: '/scope-firewall/firewalls', icon: Server },
      { label: 'Relatórios', href: '/scope-firewall/reports', icon: FileText },
    ],
  },
  {
    code: 'scope_network',
    name: 'Scope Network',
    icon: Network,
    color: 'text-blue-500',
    items: [
      { label: 'Dashboard', href: '/scope-network/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    code: 'scope_cloud',
    name: 'Scope Cloud',
    icon: Cloud,
    color: 'text-purple-500',
    items: [
      { label: 'Dashboard', href: '/scope-cloud/dashboard', icon: LayoutDashboard },
    ],
  },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const { userModules, activeModule, setActiveModule, hasModuleAccess } = useModules();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Detect active module from URL
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/scope-firewall')) {
      setActiveModule('scope_firewall');
      setExpandedModules(prev => ({ ...prev, scope_firewall: true }));
    } else if (path.startsWith('/scope-network')) {
      setActiveModule('scope_network');
      setExpandedModules(prev => ({ ...prev, scope_network: true }));
    } else if (path.startsWith('/scope-cloud')) {
      setActiveModule('scope_cloud');
      setExpandedModules(prev => ({ ...prev, scope_cloud: true }));
    }
  }, [location.pathname, setActiveModule]);

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
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      default:
        return 'Usuário';
    }
  };

  const toggleModule = (moduleCode: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleCode]: !prev[moduleCode],
    }));
  };

  const isActiveRoute = (href: string) => location.pathname === href;
  const isModuleActive = (moduleCode: string) => location.pathname.includes(moduleCode.replace('_', '-'));

  const accessibleModuleConfigs = moduleNavConfigs.filter(m => hasModuleAccess(m.code));
  const canAccessUsers = role === 'super_admin' || role === 'admin';

  const NavContent = () => (
    <>
      {/* Dashboard Geral */}
      <Link
        to="/dashboard"
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          location.pathname === '/dashboard'
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
          !sidebarOpen && 'justify-center'
        )}
        title={!sidebarOpen ? 'Dashboard' : undefined}
      >
        <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
        {sidebarOpen && 'Dashboard'}
      </Link>

      {/* Modules */}
      {accessibleModuleConfigs.map((moduleConfig) => (
        <Collapsible
          key={moduleConfig.code}
          open={sidebarOpen && expandedModules[moduleConfig.code]}
          onOpenChange={() => sidebarOpen && toggleModule(moduleConfig.code)}
        >
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isModuleActive(moduleConfig.code)
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
                !sidebarOpen && 'justify-center'
              )}
              title={!sidebarOpen ? moduleConfig.name : undefined}
            >
              <moduleConfig.icon className={cn('w-5 h-5 flex-shrink-0', moduleConfig.color)} />
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">{moduleConfig.name}</span>
                  {expandedModules[moduleConfig.code] ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </>
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
      ))}

      {/* Divider */}
      {sidebarOpen && <div className="border-t border-sidebar-border my-2" />}

      {/* Users */}
      {canAccessUsers && (
        <Link
          to="/users"
          onClick={() => setMobileMenuOpen(false)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            location.pathname === '/users'
              ? 'bg-sidebar-accent text-sidebar-primary'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
            !sidebarOpen && 'justify-center'
          )}
          title={!sidebarOpen ? 'Usuários' : undefined}
        >
          <Users className="w-5 h-5 flex-shrink-0" />
          {sidebarOpen && 'Usuários'}
        </Link>
      )}

      {/* Agents */}
      {canAccessUsers && (
        <Link
          to="/agents"
          onClick={() => setMobileMenuOpen(false)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            location.pathname === '/agents'
              ? 'bg-sidebar-accent text-sidebar-primary'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
            !sidebarOpen && 'justify-center'
          )}
          title={!sidebarOpen ? 'Agents' : undefined}
        >
          <Bot className="w-5 h-5 flex-shrink-0" />
          {sidebarOpen && 'Agents'}
        </Link>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <img src={logoPrecisio} alt="Precisio Analytics" className="h-6 w-auto" />
          <span className="font-bold text-foreground">InfraScope 360</span>
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
            <img src={logoPrecisio} alt="Precisio Analytics" className="h-6 w-auto" />
            <span className="font-bold text-sidebar-foreground">InfraScope 360</span>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          <NavContent />
        </nav>
      </aside>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'hidden lg:flex flex-col h-screen sticky top-0 border-r border-sidebar-border bg-sidebar transition-all duration-300',
            sidebarOpen ? 'w-64' : 'w-16'
          )}
        >
          {/* Logo */}
          <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
            <div className={cn('flex items-center gap-2', !sidebarOpen && 'justify-center')}>
              <img src={logoPrecisio} alt="Precisio Analytics" className="h-6 w-auto flex-shrink-0" />
              {sidebarOpen && <span className="font-bold text-sidebar-foreground">InfraScope 360</span>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', !sidebarOpen && 'hidden')}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(profile?.full_name ?? profile?.email ?? null)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {profile?.full_name || profile?.email}
                      </p>
                      <p className="text-xs text-muted-foreground">{getRoleBadge()}</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen">{children}</main>
      </div>
    </div>
  );
}
