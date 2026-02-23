import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Trash2, Eye, Upload, FileText, Search, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ApiDoc {
  id: string;
  device_type_id: string;
  title: string;
  version: string;
  doc_type: string;
  content: any;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  deviceTypeId: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  log_api: 'Log API',
  rest_api: 'REST API',
  monitor_api: 'Monitor API',
  reference: 'Referência',
};

export function ApiDocsManagement({ deviceTypeId }: Props) {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [showViewer, setShowViewer] = useState<ApiDoc | null>(null);
  const [searchEndpoint, setSearchEndpoint] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [docType, setDocType] = useState('log_api');
  const [notes, setNotes] = useState('');
  const [jsonContent, setJsonContent] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['api-docs', deviceTypeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_type_api_docs' as any)
        .select('*')
        .eq('device_type_id', deviceTypeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ApiDoc[];
    },
  });

  const insertMutation = useMutation({
    mutationFn: async (doc: { title: string; version: string; doc_type: string; content: any; notes: string | null }) => {
      const { error } = await supabase
        .from('device_type_api_docs' as any)
        .insert({
          device_type_id: deviceTypeId,
          title: doc.title,
          version: doc.version,
          doc_type: doc.doc_type,
          content: doc.content,
          notes: doc.notes || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-docs', deviceTypeId] });
      queryClient.invalidateQueries({ queryKey: ['api-docs-count', deviceTypeId] });
      toast.success('Documento adicionado com sucesso');
      resetForm();
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('device_type_api_docs' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-docs', deviceTypeId] });
      queryClient.invalidateQueries({ queryKey: ['api-docs-count', deviceTypeId] });
      toast.success('Documento removido');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const resetForm = () => {
    setShowUpload(false);
    setTitle('');
    setVersion('');
    setDocType('log_api');
    setNotes('');
    setJsonContent(null);
    setFileName('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        setJsonContent(parsed);
        // Auto-fill title/version from swagger info
        if (parsed.info) {
          if (!title && parsed.info.title) setTitle(parsed.info.title);
          if (!version && parsed.info.version) setVersion(parsed.info.version);
        }
      } catch {
        toast.error('Arquivo JSON inválido');
        setJsonContent(null);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    if (!title || !version || !jsonContent) {
      toast.error('Preencha título, versão e selecione um arquivo JSON');
      return;
    }
    setUploading(true);
    insertMutation.mutate(
      { title, version, doc_type: docType, content: jsonContent, notes },
      { onSettled: () => setUploading(false) }
    );
  };

  // Extract endpoints from swagger/openapi content
  const extractEndpoints = (content: any) => {
    if (!content?.paths) return [];
    return Object.entries(content.paths).flatMap(([path, methods]: [string, any]) =>
      Object.entries(methods).map(([method, details]: [string, any]) => ({
        path,
        method: method.toUpperCase(),
        summary: details.summary || details.description || '',
        parameters: details.parameters || [],
      }))
    );
  };

  const filteredEndpoints = showViewer
    ? extractEndpoints(showViewer.content).filter(
        (ep) =>
          !searchEndpoint ||
          ep.path.toLowerCase().includes(searchEndpoint.toLowerCase()) ||
          ep.summary.toLowerCase().includes(searchEndpoint.toLowerCase())
      )
    : [];

  const methodColor = (m: string) => {
    switch (m) {
      case 'GET': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'POST': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'PUT': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'DELETE': return 'bg-red-500/15 text-red-400 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Documentação API</h3>
          <p className="text-sm text-muted-foreground">
            Schemas e referências de API associados a este template
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Documento
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/50 rounded-lg">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Nenhuma documentação API cadastrada</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowUpload(true)}>
            <Upload className="w-4 h-4" />
            Enviar primeiro documento
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Versão</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Endpoints</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => {
              const endpointCount = doc.content?.paths
                ? Object.keys(doc.content.paths).length
                : 0;
              return (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{doc.version}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{endpointCount} paths</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(doc.created_at), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setShowViewer(doc); setSearchEndpoint(''); }}
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Remover este documento?')) deleteMutation.mutate(doc.id);
                        }}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={(o) => !o && resetForm()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Documentação API</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Log API - Memory" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Versão</Label>
                <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Ex: 7.4.11" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Arquivo JSON (Swagger/OpenAPI)</Label>
              <Input type="file" accept=".json" onChange={handleFileChange} />
              {fileName && (
                <p className="text-xs text-muted-foreground">
                  {fileName} {jsonContent && `• ${Object.keys(jsonContent.paths || {}).length} endpoints detectados`}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas sobre esta versão..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Viewer Dialog */}
      <Dialog open={!!showViewer} onOpenChange={(o) => !o && setShowViewer(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <FileText className="w-5 h-5" />
              {showViewer?.title}
              <Badge variant="outline">{showViewer?.version}</Badge>
            </DialogTitle>
          </DialogHeader>
          {showViewer?.notes && (
            <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">{showViewer.notes}</p>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchEndpoint}
              onChange={(e) => setSearchEndpoint(e.target.value)}
              placeholder="Buscar endpoint..."
              className="pl-9"
            />
          </div>
          <ScrollArea className="flex-1 min-h-0 max-h-[55vh]">
            <div className="space-y-1 pr-4">
              {filteredEndpoints.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum endpoint encontrado</p>
              ) : (
                filteredEndpoints.map((ep, i) => (
                  <div
                    key={`${ep.path}-${ep.method}-${i}`}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <Badge variant="outline" className={`font-mono text-xs min-w-[60px] justify-center ${methodColor(ep.method)}`}>
                      {ep.method}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <code className="text-sm font-mono text-foreground break-all">{ep.path}</code>
                      {ep.summary && (
                        <p className="text-xs text-muted-foreground mt-0.5">{ep.summary}</p>
                      )}
                      {ep.parameters.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {ep.parameters.length} parâmetro(s): {ep.parameters.map((p: any) => p.name).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="text-xs text-muted-foreground text-right pt-2 border-t border-border/50">
            {filteredEndpoints.length} endpoint(s) {searchEndpoint && 'filtrado(s)'}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
