import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  Shield,
  LayoutDashboard,
  Server,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Settings,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module: 'dashboard' | 'firewall' | 'reports' | 'users';
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Firewalls', href: '/firewalls', icon: Server, module: 'firewall' },
  { label: 'Relatórios', href: '/reports', icon: FileText, module: 'reports' },
  { label: 'Usuários', href: '/users', icon: Users, module: 'users' },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, role, permissions, signOut, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const visibleNavItems = navItems.filter((item) => {
    // Users page visible to admins and super_admins
    if (item.module === 'users') {
      return role === 'super_admin' || role === 'admin';
    }
    return hasPermission(item.module, 'view');
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <span className="font-bold text-foreground">FortiAudit</span>
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
            <Shield className="w-6 h-6 text-primary" />
            <span className="font-bold text-sidebar-foreground">FortiAudit</span>
          </div>
        </div>
        <nav className="p-4 space-y-1">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname === item.href
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
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
              <Shield className="w-6 h-6 text-primary flex-shrink-0" />
              {sidebarOpen && <span className="font-bold text-sidebar-foreground">FortiAudit</span>}
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
          <nav className="flex-1 p-3 space-y-1">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === item.href
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
                  !sidebarOpen && 'justify-center'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && item.label}
              </Link>
            ))}
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
