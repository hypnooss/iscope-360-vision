import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Globe, Shield, Cloud } from 'lucide-react';

const assetTypes = [
  {
    type: 'external_domain',
    title: 'Domínio Externo',
    description: 'Monitore domínios, subdomínios e superfície de ataque externa',
    icon: Globe,
    iconColor: 'text-teal-400',
    bgColor: 'bg-teal-400/10',
    route: '/scope-external-domain/domains',
  },
  {
    type: 'firewall',
    title: 'Firewall',
    description: 'Adicione firewalls para análise de conformidade e segurança',
    icon: Shield,
    iconColor: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    route: '/scope-firewall/firewalls/new',
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

export function AddAssetWizardDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleSelect = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Item</DialogTitle>
          <DialogDescription>Selecione o tipo de ativo que deseja adicionar ao ambiente.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 mt-2">
          {assetTypes.map((asset) => (
            <Card
              key={asset.type}
              className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
              onClick={() => handleSelect(asset.route)}
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
      </DialogContent>
    </Dialog>
  );
}
