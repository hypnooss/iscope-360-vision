import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Shield, Globe, Server, Layers, Loader2, Eye, Pencil } from 'lucide-react';

// Map device codes to icons
const deviceIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  fortigate: Shield,
  sonicwall: Server,
  external_domain: Globe,
};

// Map categories to display names
const categoryDisplayMap: Record<string, string> = {
  firewall: 'Firewall',
  switch: 'Switch',
  router: 'Router',
  wlc: 'Wireless Controller',
  server: 'Server',
  other: 'Outros',
};

const categoryOptions = [
  { value: 'firewall', label: 'Firewall' },
  { value: 'switch', label: 'Switch' },
  { value: 'router', label: 'Router' },
  { value: 'wlc', label: 'Wireless Controller' },
  { value: 'server', label: 'Server' },
  { value: 'other', label: 'Outros' },
];

type DeviceCategory = 'firewall' | 'switch' | 'router' | 'wlc' | 'server' | 'other';

interface DeviceType {
  id: string;
  name: string;
  code: string;
  vendor: string;
  category: DeviceCategory;
  is_active: boolean;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export default function TemplatesPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // States for dialogs
  const [viewingTemplate, setViewingTemplate] = useState<DeviceType | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<DeviceType | null>(null);
  const [editForm, setEditForm] = useState<Partial<DeviceType>>({});

  // Access control - only super_admin and super_suporte
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && role !== 'super_admin' && role !== 'super_suporte') {
      navigate('/dashboard');
      toast.error('Acesso restrito a Super Administradores');
    }
  }, [user, role, authLoading, navigate]);

  // Fetch device_types (templates)
  const { data: templates, isLoading } = useQuery({
    queryKey: ['device-types-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_types')
        .select('*')
        .order('vendor', { ascending: true });

      if (error) throw error;
      return data as DeviceType[];
    },
    enabled: !!user && (role === 'super_admin' || role === 'super_suporte'),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<DeviceType> }) => {
      const { error } = await supabase
        .from('device_types')
        .update(data.updates)
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-types-templates'] });
      setEditingTemplate(null);
      setEditForm({});
      toast.success('Template atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating template:', error);
      toast.error('Erro ao atualizar template');
    },
  });

  const handleOpenEdit = (template: DeviceType) => {
    setEditingTemplate(template);
    setEditForm({
      name: template.name,
      vendor: template.vendor,
      category: template.category,
      is_active: template.is_active,
    });
  };

  const handleSaveEdit = () => {
    if (!editingTemplate) return;
    updateMutation.mutate({
      id: editingTemplate.id,
      updates: {
        name: editForm.name,
        vendor: editForm.vendor,
        category: editForm.category as DeviceType['category'],
        is_active: editForm.is_active,
      },
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb
          items={[
            { label: 'Administração' },
            { label: 'Templates' },
          ]}
        />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os templates de dispositivos disponíveis no sistema
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates?.map((template) => {
                  const IconComponent = deviceIconMap[template.code] || Layers;
                  const categoryDisplay = categoryDisplayMap[template.category] || template.category;

                  return (
                    <TableRow key={template.id} className="group">
                      <TableCell>
                        <div className="p-1.5 rounded bg-primary/10 w-fit">
                          <IconComponent className="w-4 h-4 text-primary" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link 
                          to={`/templates/${template.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {template.name}
                        </Link>
                      </TableCell>
                      <TableCell>{template.vendor}</TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                          {template.code}
                        </code>
                      </TableCell>
                      <TableCell>{categoryDisplay}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={template.is_active ? 'default' : 'secondary'}>
                          {template.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewingTemplate(template)}
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenEdit(template)}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {templates?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum template encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewingTemplate} onOpenChange={() => setViewingTemplate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingTemplate && (
                <>
                  {(() => {
                    const Icon = deviceIconMap[viewingTemplate.code] || Layers;
                    return <Icon className="w-5 h-5 text-primary" />;
                  })()}
                  {viewingTemplate.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Detalhes do template de dispositivo
            </DialogDescription>
          </DialogHeader>

          {viewingTemplate && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Código</Label>
                  <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1">
                    {viewingTemplate.code}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Vendor</Label>
                  <p className="text-sm mt-1">{viewingTemplate.vendor}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <p className="text-sm mt-1">
                    {categoryDisplayMap[viewingTemplate.category] || viewingTemplate.category}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge variant={viewingTemplate.is_active ? 'default' : 'secondary'}>
                      {viewingTemplate.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Criado em</Label>
                <p className="text-sm mt-1">
                  {new Date(viewingTemplate.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Atualizado em</Label>
                <p className="text-sm mt-1">
                  {new Date(viewingTemplate.updated_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingTemplate(null)}>
              Fechar
            </Button>
            {viewingTemplate && (
              <Button onClick={() => navigate(`/templates/${viewingTemplate.id}`)}>
                Abrir Configurações
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Template</DialogTitle>
            <DialogDescription>
              Altere as informações do template
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-vendor">Vendor</Label>
                <Input
                  id="edit-vendor"
                  value={editForm.vendor || ''}
                  onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-code">Código</Label>
                <Input
                  id="edit-code"
                  value={editingTemplate.code}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  O código não pode ser alterado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoria</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) => setEditForm({ ...editForm, category: value as DeviceCategory })}
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-active">Ativo</Label>
                <Switch
                  id="edit-active"
                  checked={editForm.is_active}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}