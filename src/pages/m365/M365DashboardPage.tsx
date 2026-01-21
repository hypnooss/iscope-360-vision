import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Users, Key, Building, ArrowRight } from 'lucide-react';

export default function M365DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user && !hasModuleAccess('scope_m365')) {
      navigate('/modules');
    }
  }, [user, authLoading, hasModuleAccess, navigate]);

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Microsoft 365</h1>
          <p className="text-muted-foreground">
            Análise e auditoria de ambientes Microsoft 365 via Graph API
          </p>
        </div>

        {/* Submodules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Entra ID - Available */}
          <Card className="glass-card border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => navigate('/scope-m365/entra-id')}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Shield className="w-6 h-6 text-blue-500" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              </div>
              <CardTitle className="text-lg mt-3">Entra ID</CardTitle>
              <CardDescription>
                Gestão de identidades, usuários, grupos e políticas de acesso
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="mt-2">
                Acessar
              </Button>
            </CardContent>
          </Card>

          {/* SharePoint - Coming Soon */}
          <Card className="glass-card border-l-4 border-l-green-500 opacity-60">
            <CardHeader className="pb-2">
              <div className="p-2 rounded-lg bg-green-500/10 w-fit">
                <Building className="w-6 h-6 text-green-500" />
              </div>
              <CardTitle className="text-lg mt-3">SharePoint</CardTitle>
              <CardDescription>
                Análise de sites, permissões e compartilhamentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                Em breve
              </span>
            </CardContent>
          </Card>

          {/* Exchange - Coming Soon */}
          <Card className="glass-card border-l-4 border-l-purple-500 opacity-60">
            <CardHeader className="pb-2">
              <div className="p-2 rounded-lg bg-purple-500/10 w-fit">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <CardTitle className="text-lg mt-3">Exchange Online</CardTitle>
              <CardDescription>
                Auditoria de caixas de correio, regras e delegações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                Em breve
              </span>
            </CardContent>
          </Card>

          {/* Defender - Coming Soon */}
          <Card className="glass-card border-l-4 border-l-red-500 opacity-60">
            <CardHeader className="pb-2">
              <div className="p-2 rounded-lg bg-red-500/10 w-fit">
                <Shield className="w-6 h-6 text-red-500" />
              </div>
              <CardTitle className="text-lg mt-3">Defender</CardTitle>
              <CardDescription>
                Status de proteção, alertas e compliance de dispositivos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                Em breve
              </span>
            </CardContent>
          </Card>

          {/* Intune - Coming Soon */}
          <Card className="glass-card border-l-4 border-l-orange-500 opacity-60">
            <CardHeader className="pb-2">
              <div className="p-2 rounded-lg bg-orange-500/10 w-fit">
                <Key className="w-6 h-6 text-orange-500" />
              </div>
              <CardTitle className="text-lg mt-3">Intune</CardTitle>
              <CardDescription>
                Gestão de dispositivos, políticas e conformidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                Em breve
              </span>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
