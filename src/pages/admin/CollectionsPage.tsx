import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Cloud, Globe, Loader2 } from 'lucide-react';
import { DeviceTypesManagement } from '@/components/admin/DeviceTypesManagement';
import { BlueprintsManagement } from '@/components/admin/BlueprintsManagement';
import { ComplianceRulesManagement } from '@/components/admin/ComplianceRulesManagement';

type DeviceCategory = 'firewall' | 'cloud' | 'external';

export default function CollectionsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<DeviceCategory>('firewall');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && role !== 'super_admin') {
      navigate('/dashboard');
    }
  }, [user, role, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== 'super_admin') {
    return null;
  }

  const categoryConfig = {
    firewall: {
      label: 'Firewalls',
      icon: Shield,
      description: 'Gerenciar tipos de firewall, blueprints de coleta e regras de compliance',
    },
    cloud: {
      label: 'Microsoft 365',
      icon: Cloud,
      description: 'Gerenciar coletas e regras para serviços Microsoft 365',
    },
    external: {
      label: 'Domínios Externos',
      icon: Globe,
      description: 'Gerenciar análise de domínios e infraestrutura externa',
    },
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <PageBreadcrumb
          items={[
            { label: 'Administração' },
            { label: 'Coletas' },
          ]}
        />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Coletas</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie tipos de dispositivos, blueprints de coleta e regras de compliance
          </p>
        </div>

        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as DeviceCategory)}>
          <TabsList className="mb-6">
            {Object.entries(categoryConfig).map(([key, config]) => (
              <TabsTrigger key={key} value={key} className="gap-2">
                <config.icon className="w-4 h-4" />
                {config.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(categoryConfig).map(([key, config]) => (
            <TabsContent key={key} value={key} className="space-y-6">
              <p className="text-sm text-muted-foreground mb-4">{config.description}</p>
              
              {/* Device Types Section */}
              <DeviceTypesManagement category={key as DeviceCategory} />
              
              {/* Blueprints Section */}
              <BlueprintsManagement category={key as DeviceCategory} />
              
              {/* Compliance Rules Section */}
              <ComplianceRulesManagement category={key as DeviceCategory} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
