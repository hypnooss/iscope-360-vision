import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, Cloud, Globe, Loader2, Plus, Package } from 'lucide-react';
import { DeviceTypeCard } from '@/components/admin/DeviceTypeCard';
import { toast } from 'sonner';
import * as LucideIcons from 'lucide-react';

type DeviceCategory = 'firewall' | 'cloud' | 'external';
type DbDeviceCategory = 'firewall' | 'router' | 'switch' | 'server' | 'wlc' | 'other';

interface DeviceType {
  id: string;
  vendor: string;
  name: string;
  code: string;
  category: string;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

interface CollectionSteps {
  steps: Array<{
    id: string;
    executor: string;
    config: Record<string, any>;
  }>;
}

interface Blueprint {
  id: string;
  name: string;
  description: string | null;
  device_type_id: string;
  version: string;
  collection_steps: CollectionSteps;
  is_active: boolean;
  created_at: string;
}

interface ComplianceRule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  severity: string;
  weight: number;
  recommendation: string | null;
  pass_description: string | null;
  fail_description: string | null;
  evaluation_logic: Record<string, any>;
  device_type_id: string;
  is_active: boolean;
  created_at: string;
}

const categoryToDbCategory: Record<DeviceCategory, DbDeviceCategory> = {
  firewall: 'firewall',
  cloud: 'server',
  external: 'other',
};

const ICON_OPTIONS = [
  'Shield', 'Server', 'Cloud', 'Network', 'Lock', 'Cpu', 
  'HardDrive', 'Wifi', 'Globe', 'Database', 'Monitor', 'Activity'
];

export default function CollectionsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<DeviceCategory>('firewall');
  const [loading, setLoading] = useState(true);
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  
  // New device type dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    vendor: '',
    name: '',
    code: '',
    icon: 'Shield',
    is_active: true,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && role !== 'super_admin') {
      navigate('/dashboard');
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (user && role === 'super_admin') {
      fetchData();
    }
  }, [activeCategory, user, role]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const dbCategory = categoryToDbCategory[activeCategory];
      
      // Fetch device types for this category
      const { data: types, error: typesError } = await supabase
        .from('device_types')
        .select('*')
        .eq('category', dbCategory)
        .order('vendor', { ascending: true });

      if (typesError) throw typesError;
      setDeviceTypes(types || []);

      if (types && types.length > 0) {
        const typeIds = types.map(t => t.id);

        // Fetch blueprints for these device types
        const { data: bps, error: bpsError } = await supabase
          .from('device_blueprints')
          .select('*')
          .in('device_type_id', typeIds)
          .order('name', { ascending: true });

        if (bpsError) throw bpsError;
        setBlueprints((bps || []).map(bp => ({
          ...bp,
          collection_steps: bp.collection_steps as unknown as CollectionSteps,
        })));

        // Fetch compliance rules for these device types
        const { data: rulesData, error: rulesError } = await supabase
          .from('compliance_rules')
          .select('*')
          .in('device_type_id', typeIds)
          .order('category', { ascending: true });

        if (rulesError) throw rulesError;
        setRules((rulesData || []).map(r => ({
          ...r,
          evaluation_logic: r.evaluation_logic as Record<string, any>,
        })));
      } else {
        setBlueprints([]);
        setRules([]);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vendor: '',
      name: '',
      code: '',
      icon: 'Shield',
      is_active: true,
    });
  };

  const handleCreateDeviceType = async () => {
    if (!formData.vendor || !formData.name || !formData.code) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const dbCategory = categoryToDbCategory[activeCategory];
      const { error } = await supabase
        .from('device_types')
        .insert({
          vendor: formData.vendor,
          name: formData.name,
          code: formData.code,
          category: dbCategory,
          icon: formData.icon,
          is_active: formData.is_active,
        });

      if (error) throw error;
      toast.success('Tipo de dispositivo criado');
      setCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao criar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getIconComponent = (iconName: string | null) => {
    if (!iconName) return <Package className="w-5 h-5" />;
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="w-5 h-5" /> : <Package className="w-5 h-5" />;
  };

  const getBlueprintsForDevice = (deviceTypeId: string) => {
    return blueprints.filter(bp => bp.device_type_id === deviceTypeId);
  };

  const getRulesForDevice = (deviceTypeId: string) => {
    return rules.filter(r => r.device_type_id === deviceTypeId);
  };

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
      <div className="space-y-6">
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
            <TabsContent key={key} value={key} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{config.description}</p>
                <Button onClick={() => setCreateDialogOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Tipo de Dispositivo
                </Button>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : deviceTypes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-lg">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum tipo de dispositivo cadastrado para esta categoria.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar primeiro tipo
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {deviceTypes.map((deviceType) => (
                    <DeviceTypeCard
                      key={deviceType.id}
                      deviceType={deviceType}
                      blueprints={getBlueprintsForDevice(deviceType.id)}
                      rules={getRulesForDevice(deviceType.id)}
                      onRefresh={fetchData}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Create Device Type Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="border-border">
            <DialogHeader>
              <DialogTitle>Novo Tipo de Dispositivo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 px-6">
              <div className="space-y-2">
                <Label htmlFor="vendor">Fabricante *</Label>
                <Input
                  id="vendor"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  placeholder="Ex: Fortinet, Palo Alto, Microsoft"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Dispositivo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: FortiGate, Azure AD"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Código Único *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="Ex: fortigate, entra_id"
                />
                <p className="text-xs text-muted-foreground">
                  Identificador único usado internamente
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Ícone</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData({ ...formData, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        <div className="flex items-center gap-2">
                          {getIconComponent(icon)}
                          <span>{icon}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Ativo</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateDeviceType} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
