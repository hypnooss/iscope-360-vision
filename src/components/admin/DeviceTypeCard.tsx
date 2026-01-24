import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Plus, Pencil, Trash2, Loader2, Copy, Eye, 
  FileCode, CheckCircle, ChevronDown, ChevronRight,
  Package
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';

// Types
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

type RuleSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const SEVERITY_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'critical', label: 'Crítico', color: 'bg-red-500' },
  { value: 'high', label: 'Alto', color: 'bg-orange-500' },
  { value: 'medium', label: 'Médio', color: 'bg-yellow-500' },
  { value: 'low', label: 'Baixo', color: 'bg-blue-500' },
  { value: 'info', label: 'Info', color: 'bg-gray-500' },
];

const CATEGORY_OPTIONS = [
  'Segurança',
  'Autenticação',
  'Rede',
  'Configuração',
  'Logging',
  'Performance',
  'Backup',
  'Criptografia',
  'Segurança de Rede',
  'Proteção Avançada',
  'Inspeção SSL',
  'Auditoria',
];

const ICON_OPTIONS = [
  'Shield', 'Server', 'Cloud', 'Network', 'Lock', 'Cpu', 
  'HardDrive', 'Wifi', 'Globe', 'Database', 'Monitor', 'Activity'
];

interface Props {
  deviceType: DeviceType;
  blueprints: Blueprint[];
  rules: ComplianceRule[];
  onRefresh: () => void;
}

export function DeviceTypeCard({ deviceType, blueprints, rules, onRefresh }: Props) {
  const [saving, setSaving] = useState(false);
  
  // Device Type dialogs
  const [editDeviceDialogOpen, setEditDeviceDialogOpen] = useState(false);
  const [deleteDeviceDialogOpen, setDeleteDeviceDialogOpen] = useState(false);
  const [deviceFormData, setDeviceFormData] = useState({
    vendor: deviceType.vendor,
    name: deviceType.name,
    code: deviceType.code,
    icon: deviceType.icon || 'Shield',
    is_active: deviceType.is_active,
  });

  // Blueprint dialogs
  const [blueprintDialogOpen, setBlueprintDialogOpen] = useState(false);
  const [blueprintDeleteDialogOpen, setBlueprintDeleteDialogOpen] = useState(false);
  const [blueprintViewDialogOpen, setBlueprintViewDialogOpen] = useState(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
  const [blueprintFormData, setBlueprintFormData] = useState({
    name: '',
    description: '',
    version: 'any',
    collection_steps: '{"steps": []}',
    is_active: true,
  });

  // Rule dialogs
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleDeleteDialogOpen, setRuleDeleteDialogOpen] = useState(false);
  const [ruleViewDialogOpen, setRuleViewDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<ComplianceRule | null>(null);
  const [ruleFormData, setRuleFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: 'Segurança',
    severity: 'medium',
    weight: 1,
    recommendation: '',
    pass_description: '',
    fail_description: '',
    evaluation_logic: '{}',
    is_active: true,
  });

  // Expanded blueprints state
  const [expandedBlueprints, setExpandedBlueprints] = useState<Record<string, boolean>>({});

  const getIconComponent = (iconName: string | null) => {
    if (!iconName) return <Package className="w-5 h-5" />;
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="w-5 h-5" /> : <Package className="w-5 h-5" />;
  };

  const getSeverityBadge = (severity: string) => {
    const config = SEVERITY_OPTIONS.find(s => s.value === severity);
    return (
      <Badge className={`${config?.color || 'bg-gray-500'} text-white`}>
        {config?.label || severity}
      </Badge>
    );
  };

  const getStepsCount = (blueprint: Blueprint) => {
    return blueprint.collection_steps?.steps?.length || 0;
  };

  // Device Type handlers
  const handleEditDevice = () => {
    setDeviceFormData({
      vendor: deviceType.vendor,
      name: deviceType.name,
      code: deviceType.code,
      icon: deviceType.icon || 'Shield',
      is_active: deviceType.is_active,
    });
    setEditDeviceDialogOpen(true);
  };

  const handleSaveDevice = async () => {
    if (!deviceFormData.vendor || !deviceFormData.name || !deviceFormData.code) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('device_types')
        .update({
          vendor: deviceFormData.vendor,
          name: deviceFormData.name,
          code: deviceFormData.code,
          icon: deviceFormData.icon,
          is_active: deviceFormData.is_active,
        })
        .eq('id', deviceType.id);

      if (error) throw error;
      toast.success('Tipo de dispositivo atualizado');
      setEditDeviceDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('device_types')
        .delete()
        .eq('id', deviceType.id);

      if (error) throw error;
      toast.success('Tipo de dispositivo excluído');
      setDeleteDeviceDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Blueprint handlers
  const resetBlueprintForm = () => {
    setBlueprintFormData({
      name: '',
      description: '',
      version: 'any',
      collection_steps: '{"steps": []}',
      is_active: true,
    });
    setSelectedBlueprint(null);
  };

  const openCreateBlueprintDialog = () => {
    resetBlueprintForm();
    setBlueprintDialogOpen(true);
  };

  const openEditBlueprintDialog = (blueprint: Blueprint) => {
    setSelectedBlueprint(blueprint);
    setBlueprintFormData({
      name: blueprint.name,
      description: blueprint.description || '',
      version: blueprint.version,
      collection_steps: JSON.stringify(blueprint.collection_steps, null, 2),
      is_active: blueprint.is_active,
    });
    setBlueprintDialogOpen(true);
  };

  const openViewBlueprintDialog = (blueprint: Blueprint) => {
    setSelectedBlueprint(blueprint);
    setBlueprintViewDialogOpen(true);
  };

  const openDeleteBlueprintDialog = (blueprint: Blueprint) => {
    setSelectedBlueprint(blueprint);
    setBlueprintDeleteDialogOpen(true);
  };

  const handleSaveBlueprint = async () => {
    if (!blueprintFormData.name) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    let parsedSteps;
    try {
      parsedSteps = JSON.parse(blueprintFormData.collection_steps);
    } catch (e) {
      toast.error('JSON de collection_steps inválido');
      return;
    }

    setSaving(true);
    try {
      if (selectedBlueprint) {
        const { error } = await supabase
          .from('device_blueprints')
          .update({
            name: blueprintFormData.name,
            description: blueprintFormData.description || null,
            version: blueprintFormData.version,
            collection_steps: parsedSteps,
            is_active: blueprintFormData.is_active,
          })
          .eq('id', selectedBlueprint.id);

        if (error) throw error;
        toast.success('Blueprint atualizado');
      } else {
        const { error } = await supabase
          .from('device_blueprints')
          .insert({
            name: blueprintFormData.name,
            description: blueprintFormData.description || null,
            device_type_id: deviceType.id,
            version: blueprintFormData.version,
            collection_steps: parsedSteps,
            is_active: blueprintFormData.is_active,
          });

        if (error) throw error;
        toast.success('Blueprint criado');
      }

      setBlueprintDialogOpen(false);
      resetBlueprintForm();
      onRefresh();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlueprint = async () => {
    if (!selectedBlueprint) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('device_blueprints')
        .delete()
        .eq('id', selectedBlueprint.id);

      if (error) throw error;
      toast.success('Blueprint excluído');
      setBlueprintDeleteDialogOpen(false);
      setSelectedBlueprint(null);
      onRefresh();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateBlueprint = async (blueprint: Blueprint) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('device_blueprints')
        .insert({
          name: `${blueprint.name} (Cópia)`,
          description: blueprint.description,
          device_type_id: blueprint.device_type_id,
          version: blueprint.version,
          collection_steps: blueprint.collection_steps as unknown as Record<string, any>,
          is_active: false,
        });

      if (error) throw error;
      toast.success('Blueprint duplicado');
      onRefresh();
    } catch (error: any) {
      toast.error('Erro ao duplicar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Rule handlers
  const resetRuleForm = () => {
    setRuleFormData({
      code: '',
      name: '',
      description: '',
      category: 'Segurança',
      severity: 'medium',
      weight: 1,
      recommendation: '',
      pass_description: '',
      fail_description: '',
      evaluation_logic: '{}',
      is_active: true,
    });
    setSelectedRule(null);
  };

  const openCreateRuleDialog = () => {
    resetRuleForm();
    setRuleDialogOpen(true);
  };

  const openEditRuleDialog = (rule: ComplianceRule) => {
    setSelectedRule(rule);
    setRuleFormData({
      code: rule.code,
      name: rule.name,
      description: rule.description || '',
      category: rule.category,
      severity: rule.severity,
      weight: rule.weight,
      recommendation: rule.recommendation || '',
      pass_description: rule.pass_description || '',
      fail_description: rule.fail_description || '',
      evaluation_logic: JSON.stringify(rule.evaluation_logic, null, 2),
      is_active: rule.is_active,
    });
    setRuleDialogOpen(true);
  };

  const openViewRuleDialog = (rule: ComplianceRule) => {
    setSelectedRule(rule);
    setRuleViewDialogOpen(true);
  };

  const openDeleteRuleDialog = (rule: ComplianceRule) => {
    setSelectedRule(rule);
    setRuleDeleteDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!ruleFormData.code || !ruleFormData.name) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    let parsedLogic;
    try {
      parsedLogic = JSON.parse(ruleFormData.evaluation_logic);
    } catch (e) {
      toast.error('JSON de evaluation_logic inválido');
      return;
    }

    setSaving(true);
    try {
      const severityValue = ruleFormData.severity as RuleSeverity;
      
      if (selectedRule) {
        const { error } = await supabase
          .from('compliance_rules')
          .update({
            code: ruleFormData.code,
            name: ruleFormData.name,
            description: ruleFormData.description || null,
            category: ruleFormData.category,
            severity: severityValue,
            weight: ruleFormData.weight,
            recommendation: ruleFormData.recommendation || null,
            pass_description: ruleFormData.pass_description || null,
            fail_description: ruleFormData.fail_description || null,
            evaluation_logic: parsedLogic,
            is_active: ruleFormData.is_active,
          })
          .eq('id', selectedRule.id);

        if (error) throw error;
        toast.success('Regra atualizada');
      } else {
        const { error } = await supabase
          .from('compliance_rules')
          .insert({
            code: ruleFormData.code,
            name: ruleFormData.name,
            description: ruleFormData.description || null,
            category: ruleFormData.category,
            severity: severityValue,
            weight: ruleFormData.weight,
            recommendation: ruleFormData.recommendation || null,
            pass_description: ruleFormData.pass_description || null,
            fail_description: ruleFormData.fail_description || null,
            evaluation_logic: parsedLogic,
            device_type_id: deviceType.id,
            is_active: ruleFormData.is_active,
          });

        if (error) throw error;
        toast.success('Regra criada');
      }

      setRuleDialogOpen(false);
      resetRuleForm();
      onRefresh();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!selectedRule) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('compliance_rules')
        .delete()
        .eq('id', selectedRule.id);

      if (error) throw error;
      toast.success('Regra excluída');
      setRuleDeleteDialogOpen(false);
      setSelectedRule(null);
      onRefresh();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateRule = async (rule: ComplianceRule) => {
    setSaving(true);
    try {
      const severityValue = rule.severity as RuleSeverity;
      const { error } = await supabase
        .from('compliance_rules')
        .insert({
          code: `${rule.code}_copy`,
          name: `${rule.name} (Cópia)`,
          description: rule.description,
          category: rule.category,
          severity: severityValue,
          weight: rule.weight,
          recommendation: rule.recommendation,
          pass_description: rule.pass_description,
          fail_description: rule.fail_description,
          evaluation_logic: rule.evaluation_logic,
          device_type_id: rule.device_type_id,
          is_active: false,
        });

      if (error) throw error;
      toast.success('Regra duplicada');
      onRefresh();
    } catch (error: any) {
      toast.error('Erro ao duplicar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {getIconComponent(deviceType.icon)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    {deviceType.vendor} - {deviceType.name}
                  </h3>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                    {deviceType.code}
                  </code>
                  <Badge variant={deviceType.is_active ? 'default' : 'secondary'}>
                    {deviceType.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleEditDevice} title="Editar">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setDeleteDeviceDialogOpen(true)}
                className="text-destructive hover:text-destructive"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Accordion type="multiple" className="w-full">
            {/* Blueprints Section */}
            <AccordionItem value="blueprints" className="border-border/50">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-primary" />
                  <span className="font-medium">Blueprints</span>
                  <Badge variant="outline" className="ml-2">{blueprints.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button onClick={openCreateBlueprintDialog} size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Blueprint
                    </Button>
                  </div>
                  {blueprints.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum blueprint cadastrado.
                    </p>
                  ) : (
                    <div className="border rounded-lg border-border/50 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/50">
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Versão</TableHead>
                            <TableHead>Steps</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {blueprints.map((blueprint) => (
                            <>
                              <TableRow key={blueprint.id} className="border-border/50">
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-6 h-6"
                                    onClick={() => setExpandedBlueprints(prev => ({
                                      ...prev,
                                      [blueprint.id]: !prev[blueprint.id],
                                    }))}
                                  >
                                    {expandedBlueprints[blueprint.id] ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TableCell>
                                <TableCell className="font-medium">{blueprint.name}</TableCell>
                                <TableCell>
                                  <code className="text-xs bg-muted px-2 py-1 rounded">{blueprint.version}</code>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{getStepsCount(blueprint)} steps</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={blueprint.is_active ? 'default' : 'secondary'}>
                                    {blueprint.is_active ? 'Ativo' : 'Inativo'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openViewBlueprintDialog(blueprint)} title="Visualizar">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDuplicateBlueprint(blueprint)} title="Duplicar">
                                      <Copy className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => openEditBlueprintDialog(blueprint)} title="Editar">
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => openDeleteBlueprintDialog(blueprint)} className="text-destructive hover:text-destructive" title="Excluir">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {expandedBlueprints[blueprint.id] && (
                                <TableRow className="border-border/50">
                                  <TableCell colSpan={6} className="bg-muted/30">
                                    <div className="p-3">
                                      <p className="text-sm text-muted-foreground mb-2">
                                        {blueprint.description || 'Sem descrição'}
                                      </p>
                                      <div className="text-xs font-mono bg-background p-2 rounded border border-border/50 max-h-40 overflow-auto">
                                        <pre>{JSON.stringify(blueprint.collection_steps, null, 2)}</pre>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Compliance Rules Section */}
            <AccordionItem value="rules" className="border-border/50 border-b-0">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="font-medium">Regras de Compliance</span>
                  <Badge variant="outline" className="ml-2">{rules.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button onClick={openCreateRuleDialog} size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Regra
                    </Button>
                  </div>
                  {rules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma regra cadastrada.
                    </p>
                  ) : (
                    <div className="border rounded-lg border-border/50 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/50">
                            <TableHead>Código</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Severidade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rules.map((rule) => (
                            <TableRow key={rule.id} className="border-border/50">
                              <TableCell>
                                <code className="text-xs bg-muted px-2 py-1 rounded">{rule.code}</code>
                              </TableCell>
                              <TableCell className="font-medium max-w-[200px] truncate" title={rule.name}>
                                {rule.name}
                              </TableCell>
                              <TableCell>{rule.category}</TableCell>
                              <TableCell>{getSeverityBadge(rule.severity)}</TableCell>
                              <TableCell>
                                <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                                  {rule.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openViewRuleDialog(rule)} title="Visualizar">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDuplicateRule(rule)} title="Duplicar">
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => openEditRuleDialog(rule)} title="Editar">
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => openDeleteRuleDialog(rule)} className="text-destructive hover:text-destructive" title="Excluir">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Edit Device Type Dialog */}
      <Dialog open={editDeviceDialogOpen} onOpenChange={setEditDeviceDialogOpen}>
        <DialogContent className="border-border">
          <DialogHeader>
            <DialogTitle>Editar Tipo de Dispositivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 px-6">
            <div className="space-y-2">
              <Label htmlFor="vendor">Fabricante *</Label>
              <Input
                id="vendor"
                value={deviceFormData.vendor}
                onChange={(e) => setDeviceFormData({ ...deviceFormData, vendor: e.target.value })}
                placeholder="Ex: Fortinet, Palo Alto, Microsoft"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Dispositivo *</Label>
              <Input
                id="name"
                value={deviceFormData.name}
                onChange={(e) => setDeviceFormData({ ...deviceFormData, name: e.target.value })}
                placeholder="Ex: FortiGate, Azure AD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código Único *</Label>
              <Input
                id="code"
                value={deviceFormData.code}
                onChange={(e) => setDeviceFormData({ ...deviceFormData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="Ex: fortigate, entra_id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Ícone</Label>
              <Select
                value={deviceFormData.icon}
                onValueChange={(value) => setDeviceFormData({ ...deviceFormData, icon: value })}
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
                checked={deviceFormData.is_active}
                onCheckedChange={(checked) => setDeviceFormData({ ...deviceFormData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDeviceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDevice} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Device Type Dialog */}
      <Dialog open={deleteDeviceDialogOpen} onOpenChange={setDeleteDeviceDialogOpen}>
        <DialogContent className="border-border">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir o tipo de dispositivo{' '}
            <strong>{deviceType.name}</strong>?
          </p>
          <p className="text-sm text-destructive">
            Esta ação não pode ser desfeita. Blueprints e regras associados também serão afetados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDeviceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteDevice} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blueprint Create/Edit Dialog */}
      <Dialog open={blueprintDialogOpen} onOpenChange={setBlueprintDialogOpen}>
        <DialogContent className="max-w-2xl border-border">
          <DialogHeader>
            <DialogTitle>
              {selectedBlueprint ? 'Editar Blueprint' : 'Novo Blueprint'}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 py-4 px-6">
              <div className="space-y-2">
                <Label htmlFor="bp-name">Nome *</Label>
                <Input
                  id="bp-name"
                  value={blueprintFormData.name}
                  onChange={(e) => setBlueprintFormData({ ...blueprintFormData, name: e.target.value })}
                  placeholder="Ex: FortiGate Standard Compliance"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-description">Descrição</Label>
                <Textarea
                  id="bp-description"
                  value={blueprintFormData.description}
                  onChange={(e) => setBlueprintFormData({ ...blueprintFormData, description: e.target.value })}
                  placeholder="Descrição do blueprint..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bp-version">Versão Compatível</Label>
                  <Input
                    id="bp-version"
                    value={blueprintFormData.version}
                    onChange={(e) => setBlueprintFormData({ ...blueprintFormData, version: e.target.value })}
                    placeholder="Ex: any, 7.x, 6.4"
                  />
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label htmlFor="bp-is_active">Ativo</Label>
                  <Switch
                    id="bp-is_active"
                    checked={blueprintFormData.is_active}
                    onCheckedChange={(checked) => setBlueprintFormData({ ...blueprintFormData, is_active: checked })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-collection_steps">Collection Steps (JSON)</Label>
                <Textarea
                  id="bp-collection_steps"
                  value={blueprintFormData.collection_steps}
                  onChange={(e) => setBlueprintFormData({ ...blueprintFormData, collection_steps: e.target.value })}
                  className="font-mono text-sm"
                  rows={10}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlueprintDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBlueprint} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedBlueprint ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blueprint View Dialog */}
      <Dialog open={blueprintViewDialogOpen} onOpenChange={setBlueprintViewDialogOpen}>
        <DialogContent className="max-w-2xl border-border">
          <DialogHeader>
            <DialogTitle>Visualizar Blueprint</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 py-4 px-6">
              <div>
                <Label className="text-muted-foreground">Nome</Label>
                <p className="font-medium">{selectedBlueprint?.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Descrição</Label>
                <p>{selectedBlueprint?.description || 'Sem descrição'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Versão</Label>
                  <p><code className="text-xs bg-muted px-2 py-1 rounded">{selectedBlueprint?.version}</code></p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>
                    <Badge variant={selectedBlueprint?.is_active ? 'default' : 'secondary'}>
                      {selectedBlueprint?.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Collection Steps</Label>
                <div className="mt-2 text-xs font-mono bg-muted/50 p-3 rounded border border-border/50 max-h-60 overflow-auto">
                  <pre>{JSON.stringify(selectedBlueprint?.collection_steps, null, 2)}</pre>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlueprintViewDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blueprint Delete Dialog */}
      <Dialog open={blueprintDeleteDialogOpen} onOpenChange={setBlueprintDeleteDialogOpen}>
        <DialogContent className="border-border">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir o blueprint{' '}
            <strong>{selectedBlueprint?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlueprintDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteBlueprint} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Create/Edit Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-2xl border-border">
          <DialogHeader>
            <DialogTitle>
              {selectedRule ? 'Editar Regra de Compliance' : 'Nova Regra de Compliance'}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 py-4 px-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-code">Código *</Label>
                  <Input
                    id="rule-code"
                    value={ruleFormData.code}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    placeholder="Ex: FW_ADMIN_HTTPS"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-name">Nome *</Label>
                  <Input
                    id="rule-name"
                    value={ruleFormData.name}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                    placeholder="Ex: Admin HTTPS Obrigatório"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-description">Descrição</Label>
                <Textarea
                  id="rule-description"
                  value={ruleFormData.description}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
                  placeholder="Descrição da regra..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-category">Categoria</Label>
                  <Select
                    value={ruleFormData.category}
                    onValueChange={(value) => setRuleFormData({ ...ruleFormData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-severity">Severidade</Label>
                  <Select
                    value={ruleFormData.severity}
                    onValueChange={(value) => setRuleFormData({ ...ruleFormData, severity: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-weight">Peso</Label>
                  <Input
                    id="rule-weight"
                    type="number"
                    min="1"
                    max="10"
                    value={ruleFormData.weight}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, weight: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-recommendation">Recomendação</Label>
                <Textarea
                  id="rule-recommendation"
                  value={ruleFormData.recommendation}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, recommendation: e.target.value })}
                  placeholder="O que deve ser feito para resolver..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-pass">Descrição (Pass)</Label>
                  <Input
                    id="rule-pass"
                    value={ruleFormData.pass_description}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, pass_description: e.target.value })}
                    placeholder="Mensagem quando está em conformidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-fail">Descrição (Fail)</Label>
                  <Input
                    id="rule-fail"
                    value={ruleFormData.fail_description}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, fail_description: e.target.value })}
                    placeholder="Mensagem quando não está em conformidade"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-logic">Evaluation Logic (JSON)</Label>
                <Textarea
                  id="rule-logic"
                  value={ruleFormData.evaluation_logic}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, evaluation_logic: e.target.value })}
                  className="font-mono text-sm"
                  rows={6}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="rule-is_active">Ativo</Label>
                <Switch
                  id="rule-is_active"
                  checked={ruleFormData.is_active}
                  onCheckedChange={(checked) => setRuleFormData({ ...ruleFormData, is_active: checked })}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRule} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedRule ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule View Dialog */}
      <Dialog open={ruleViewDialogOpen} onOpenChange={setRuleViewDialogOpen}>
        <DialogContent className="max-w-2xl border-border">
          <DialogHeader>
            <DialogTitle>Visualizar Regra</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 py-4 px-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Código</Label>
                  <p><code className="text-xs bg-muted px-2 py-1 rounded">{selectedRule?.code}</code></p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Nome</Label>
                  <p className="font-medium">{selectedRule?.name}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Descrição</Label>
                <p>{selectedRule?.description || 'Sem descrição'}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Categoria</Label>
                  <p>{selectedRule?.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Severidade</Label>
                  <p>{selectedRule && getSeverityBadge(selectedRule.severity)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Peso</Label>
                  <p>{selectedRule?.weight}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Recomendação</Label>
                <p>{selectedRule?.recommendation || 'Não definida'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Evaluation Logic</Label>
                <div className="mt-2 text-xs font-mono bg-muted/50 p-3 rounded border border-border/50 max-h-60 overflow-auto">
                  <pre>{JSON.stringify(selectedRule?.evaluation_logic, null, 2)}</pre>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleViewDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Delete Dialog */}
      <Dialog open={ruleDeleteDialogOpen} onOpenChange={setRuleDeleteDialogOpen}>
        <DialogContent className="border-border">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir a regra{' '}
            <strong>{selectedRule?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteRule} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
