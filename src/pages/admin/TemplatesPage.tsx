import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Shield, Globe, Server, Layers, Loader2 } from 'lucide-react';

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

export default function TemplatesPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

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
      return data;
    },
    enabled: !!user && (role === 'super_admin' || role === 'super_suporte'),
  });

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
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates?.map((template) => {
                  const IconComponent = deviceIconMap[template.code] || Layers;
                  const categoryDisplay = categoryDisplayMap[template.category] || template.category;

                  return (
                    <TableRow key={template.id} className="cursor-pointer hover:bg-muted/50">
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
                      <TableCell className="text-right">
                        <Badge variant={template.is_active ? 'default' : 'secondary'}>
                          {template.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {templates?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum template encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
