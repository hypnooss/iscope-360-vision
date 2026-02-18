import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Globe, Shield, Cloud } from 'lucide-react';

const assetTypes = [
  {
    type: 'external_domain',
    title: 'Domínio Externo',
    description: 'Monitore domínios, subdomínios e superfície de ataque externa',
    icon: Globe,
    iconColor: 'text-teal-400',
    bgColor: 'bg-teal-400/10',
    route: '/environment/new/external-domain',
  },
  {
    type: 'firewall',
    title: 'Firewall',
    description: 'Adicione firewalls para análise de conformidade e segurança',
    icon: Shield,
    iconColor: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    route: '/environment/new/firewall',
  },
  {
    type: 'm365',
    title: 'Microsoft 365',
    description: 'Conecte um tenant M365 para análise de postura de segurança',
    icon: Cloud,
    iconColor: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    route: '/scope-m365/tenant-connection',
  },
];

export default function AddAssetPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 flex flex-col flex-1 min-h-0">
        <PageBreadcrumb items={[{ label: 'Ambiente', href: '/environment' }, { label: 'Novo Item' }]} />


        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg grid gap-3">
            {assetTypes.map((asset) => (
              <Card
                key={asset.type}
                className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                onClick={() => navigate(asset.route)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`rounded-lg p-3 ${asset.bgColor}`}>
                    <asset.icon className={`w-6 h-6 ${asset.iconColor}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{asset.title}</p>
                    <p className="text-sm text-muted-foreground">{asset.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
