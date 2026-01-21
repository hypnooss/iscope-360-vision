import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules, ScopeModule } from '@/contexts/ModuleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Network, Cloud, AlertCircle, Loader2 } from 'lucide-react';
import logoPrecisio from '@/assets/logo-precisio-analytics.png';

const moduleIcons: Record<ScopeModule, React.ComponentType<{ className?: string }>> = {
  scope_firewall: Shield,
  scope_network: Network,
  scope_cloud: Cloud,
  scope_m365: Cloud,
};

const moduleColors: Record<ScopeModule, string> = {
  scope_firewall: 'from-orange-500 to-red-500',
  scope_network: 'from-blue-500 to-cyan-500',
  scope_cloud: 'from-purple-500 to-pink-500',
  scope_m365: 'from-blue-500 to-indigo-500',
};

export default function ModuleSelectionPage() {
  const { user, loading: authLoading } = useAuth();
  const { userModules, setActiveModule, loading: modulesLoading } = useModules();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    // If user has only 1 module, go directly to it
    if (!modulesLoading && userModules.length === 1) {
      handleModuleSelect(userModules[0].code);
    }
  }, [userModules, modulesLoading]);

  const handleModuleSelect = (moduleCode: ScopeModule) => {
    setActiveModule(moduleCode);
    
    // Navigate to module dashboard
    switch (moduleCode) {
      case 'scope_firewall':
        navigate('/scope-firewall/dashboard');
        break;
      case 'scope_m365':
        navigate('/scope-m365/dashboard');
        break;
      case 'scope_network':
        navigate('/scope-network/dashboard');
        break;
      case 'scope_cloud':
        navigate('/scope-cloud/dashboard');
        break;
      default:
        navigate('/dashboard');
    }
  };

  if (authLoading || modulesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // No modules assigned
  if (userModules.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <img src={logoPrecisio} alt="Precisio Analytics" className="h-12 w-auto mx-auto mb-6" />
          <AlertCircle className="w-16 h-16 text-warning mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h1>
          <p className="text-muted-foreground max-w-md">
            Você ainda não possui acesso a nenhum módulo do sistema. 
            Entre em contato com o administrador para solicitar as permissões necessárias.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <img src={logoPrecisio} alt="Precisio Analytics" className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">InfraScope 360</h1>
          <p className="text-muted-foreground">Selecione o módulo que deseja acessar</p>
        </div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userModules.map((module) => {
            const Icon = moduleIcons[module.code] || Shield;
            const gradient = moduleColors[module.code] || 'from-primary to-primary/80';

            return (
              <Card
                key={module.id}
                className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl border-2 border-transparent hover:border-primary/30 overflow-hidden group"
                onClick={() => handleModuleSelect(module.code)}
              >
                <div className={`h-2 bg-gradient-to-r ${gradient}`} />
                <CardHeader className="pb-2">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} w-fit mb-2 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{module.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {module.description || 'Módulo de gestão de infraestrutura'}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
