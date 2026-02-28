import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cloud } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleTenantConnectionWizard } from '@/components/m365/SimpleTenantConnectionWizard';

export default function AddM365TenantPage() {
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(true);

  const handleSuccess = () => {
    navigate('/scope-m365/tenant-connection');
  };

  const handleOpenChange = (open: boolean) => {
    setWizardOpen(open);
    if (!open) {
      navigate('/environment/new');
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb
          items={[
            { label: 'Ambiente', href: '/environment' },
            { label: 'Novo Item', href: '/environment/new' },
            { label: 'Microsoft 365' },
          ]}
        />

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/environment/new')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Conectar Microsoft 365</h1>
            <p className="text-sm text-muted-foreground">Configure a conexão com seu tenant Microsoft 365</p>
          </div>
        </div>

        <SimpleTenantConnectionWizard
          open={wizardOpen}
          onOpenChange={handleOpenChange}
          onSuccess={handleSuccess}
        />
      </div>
    </AppLayout>
  );
}
