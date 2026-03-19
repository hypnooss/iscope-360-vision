import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, AlertTriangle, Upload, Bot, Layers, Info, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateManagementCardProps {
  userId?: string;
}

interface OutdatedAgent {
  name: string;
  version: string;
  client: string;
}

interface OutdatedSupervisor {
  name: string;
  supervisorVersion: string;
  client: string;
}

interface OutdatedMonitor {
  name: string;
  monitorVersion: string;
  client: string;
}

export function UpdateManagementCard({ userId }: UpdateManagementCardProps) {
  // Agent update
  const [agentLatestVersion, setAgentLatestVersion] = useState('');
  const [agentForceUpdate, setAgentForceUpdate] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [calculatedChecksum, setCalculatedChecksum] = useState('');
  const [calculatingChecksum, setCalculatingChecksum] = useState(false);
  const [publishingUpdate, setPublishingUpdate] = useState(false);
  const [newVersion, setNewVersion] = useState('');

  // Supervisor update
  const [supervisorLatestVersion, setSupervisorLatestVersion] = useState('');
  const [supervisorForceUpdate, setSupervisorForceUpdate] = useState(false);
  const [selectedSupervisorFile, setSelectedSupervisorFile] = useState<File | null>(null);
  const [supervisorChecksum, setSupervisorChecksum] = useState('');
  const [calculatingSupervisorChecksum, setCalculatingSupervisorChecksum] = useState(false);
  const [publishingSupervisorUpdate, setPublishingSupervisorUpdate] = useState(false);
  const [newSupervisorVersion, setNewSupervisorVersion] = useState('');

  // Monitor update
  const [monitorLatestVersion, setMonitorLatestVersion] = useState('');
  const [monitorForceUpdate, setMonitorForceUpdate] = useState(false);
  const [selectedMonitorFile, setSelectedMonitorFile] = useState<File | null>(null);
  const [monitorChecksum, setMonitorChecksum] = useState('');
  const [calculatingMonitorChecksum, setCalculatingMonitorChecksum] = useState(false);
  const [publishingMonitorUpdate, setPublishingMonitorUpdate] = useState(false);
  const [newMonitorVersion, setNewMonitorVersion] = useState('');

  // Stats
  const [agentStats, setAgentStats] = useState<{ total: number; upToDate: number; outdated: OutdatedAgent[] }>({ total: 0, upToDate: 0, outdated: [] });
  const [supervisorStats, setSupervisorStats] = useState<{ total: number; upToDate: number; outdated: OutdatedSupervisor[]; withoutSupervisor: number }>({ total: 0, upToDate: 0, outdated: [], withoutSupervisor: 0 });
  const [monitorStats, setMonitorStats] = useState<{ total: number; upToDate: number; outdated: OutdatedMonitor[]; withoutMonitor: number }>({ total: 0, upToDate: 0, outdated: [], withoutMonitor: 0 });

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadUpdateSettings();
      loadStats();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadUpdateSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'agent_latest_version', 'agent_force_update',
          'supervisor_latest_version', 'supervisor_force_update',
          'monitor_latest_version', 'monitor_force_update',
        ]);

      if (data) {
        data.forEach((s) => {
          const strVal = typeof s.value === 'string' ? s.value.replace(/"/g, '') : String(s.value || '');
          const boolVal = s.value === true || s.value === 'true';
          switch (s.key) {
            case 'agent_latest_version': setAgentLatestVersion(strVal); break;
            case 'agent_force_update': setAgentForceUpdate(boolVal); break;
            case 'supervisor_latest_version': setSupervisorLatestVersion(strVal); break;
            case 'supervisor_force_update': setSupervisorForceUpdate(boolVal); break;
            case 'monitor_latest_version': setMonitorLatestVersion(strVal); break;
            case 'monitor_force_update': setMonitorForceUpdate(boolVal); break;
          }
        });
      }
    } catch (error) {
      console.error('Error loading update settings:', error);
    }
  };

  const loadStats = async () => {
    try {
      const { data: agents, error } = await supabase
        .from('agents')
        .select(`id, name, agent_version, supervisor_version, revoked, clients!agents_client_id_fkey (name)`)
        .eq('revoked', false);

      if (error) throw error;

      const { data: versionSettings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['agent_latest_version', 'supervisor_latest_version', 'monitor_latest_version']);

      let latestAgentVer = '';
      let latestSupVer = '';
      let latestMonVer = '';
      versionSettings?.forEach((s) => {
        const v = typeof s.value === 'string' ? s.value.replace(/"/g, '') : String(s.value || '');
        if (s.key === 'agent_latest_version') latestAgentVer = v;
        if (s.key === 'supervisor_latest_version') latestSupVer = v;
        if (s.key === 'monitor_latest_version') latestMonVer = v;
      });

      if (agents) {
        // Agent stats
        const agentUpToDate = agents.filter((a) => a.agent_version === latestAgentVer).length;
        const agentOutdated = agents
          .filter((a) => a.agent_version && a.agent_version !== latestAgentVer)
          .map((a) => ({ name: a.name, version: a.agent_version || 'N/A', client: (a.clients as any)?.name || 'Sem cliente' }));
        setAgentStats({ total: agents.length, upToDate: agentUpToDate, outdated: agentOutdated });

        // Supervisor stats
        const agentsWithSupervisor = agents.filter((a) => a.supervisor_version);
        const supUpToDate = latestSupVer ? agentsWithSupervisor.filter((a) => a.supervisor_version === latestSupVer).length : agentsWithSupervisor.length;
        const supOutdated = latestSupVer
          ? agentsWithSupervisor.filter((a) => a.supervisor_version !== latestSupVer).map((a) => ({ name: a.name, supervisorVersion: a.supervisor_version || 'N/A', client: (a.clients as any)?.name || 'Sem cliente' }))
          : [];
        setSupervisorStats({ total: agentsWithSupervisor.length, upToDate: supUpToDate, outdated: supOutdated, withoutSupervisor: agents.length - agentsWithSupervisor.length });

        // Monitor stats — get latest monitor_version per agent from agent_metrics
        const agentIds = agents.map((a) => a.id);
        if (agentIds.length > 0 && latestMonVer) {
          const { data: metrics } = await supabase
            .from('agent_metrics')
            .select('agent_id, monitor_version')
            .in('agent_id', agentIds)
            .order('collected_at', { ascending: false });

          // Deduplicate: pick first (latest) per agent_id
          const latestByAgent = new Map<string, string>();
          metrics?.forEach((m) => {
            if (!latestByAgent.has(m.agent_id) && m.monitor_version) {
              latestByAgent.set(m.agent_id, m.monitor_version);
            }
          });

          const monUpToDate = Array.from(latestByAgent.values()).filter((v) => v === latestMonVer).length;
          const monOutdated: OutdatedMonitor[] = [];
          latestByAgent.forEach((ver, agentId) => {
            if (ver !== latestMonVer) {
              const agent = agents.find((a) => a.id === agentId);
              monOutdated.push({ name: agent?.name || agentId, monitorVersion: ver, client: (agent?.clients as any)?.name || 'Sem cliente' });
            }
          });

          setMonitorStats({
            total: latestByAgent.size,
            upToDate: monUpToDate,
            outdated: monOutdated,
            withoutMonitor: agents.length - latestByAgent.size,
          });
        } else {
          setMonitorStats({ total: 0, upToDate: 0, outdated: [], withoutMonitor: agents?.length || 0 });
        }
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const calculateSHA256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  // Generic file select handler
  const handleGenericFileSelect = async (
    file: File,
    setFile: (f: File) => void,
    setChecksum: (c: string) => void,
    setCalculating: (b: boolean) => void,
  ) => {
    if (!file.name.endsWith('.tar.gz')) {
      toast.error('Selecione um arquivo .tar.gz');
      return;
    }
    setFile(file);
    setCalculating(true);
    try {
      const checksum = await calculateSHA256(file);
      setChecksum(checksum);
    } catch {
      toast.error('Erro ao calcular checksum');
    } finally {
      setCalculating(false);
    }
  };

  // Generic publish handler
  const handleGenericPublish = async (
    prefix: string,
    version: string,
    file: File | null,
    checksum: string,
    forceUpdate: boolean,
    setPublishing: (b: boolean) => void,
    setLatestVersion: (v: string) => void,
    setNewVersion: (v: string) => void,
    setFile: (f: File | null) => void,
    setChecksum: (c: string) => void,
    fileInputId: string,
  ) => {
    if (!file || !version) {
      toast.error('Selecione um arquivo e informe a versão');
      return;
    }
    if (!checksum) {
      toast.error('Aguarde o cálculo do checksum');
      return;
    }

    setPublishing(true);
    try {
      const versionedFilename = `iscope-${prefix}-${version}.tar.gz`;
      const { error: uploadError } = await supabase.storage.from('agent-releases').upload(versionedFilename, file, { upsert: true, contentType: 'application/gzip' });
      if (uploadError) throw uploadError;

      const { error: latestError } = await supabase.storage.from('agent-releases').upload(`iscope-${prefix}-latest.tar.gz`, file, { upsert: true, contentType: 'application/gzip' });
      if (latestError) toast.warning('Versão publicada, mas erro ao atualizar arquivo latest');

      const settings = [
        { key: `${prefix}_latest_version`, value: version, description: `Versão mais recente do ${prefix}` },
        { key: `${prefix}_update_checksum`, value: checksum, description: `Checksum SHA256 do pacote do ${prefix}` },
        { key: `${prefix}_force_update`, value: forceUpdate, description: `Forçar atualização do ${prefix}` },
      ];

      for (const setting of settings) {
        const { data: updateData, error: updateError } = await supabase
          .from('system_settings')
          .update({ value: setting.value, updated_by: userId, updated_at: new Date().toISOString() })
          .eq('key', setting.key)
          .select();

        if (!updateError && (!updateData || updateData.length === 0)) {
          await supabase.from('system_settings').insert({ key: setting.key, value: setting.value, updated_by: userId, description: setting.description });
        }
      }

      toast.success(`${prefix.charAt(0).toUpperCase() + prefix.slice(1)} v${version} publicado com sucesso!`);
      setLatestVersion(version);
      setNewVersion('');
      setFile(null);
      setChecksum('');

      const fileInput = document.getElementById(fileInputId) as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      await loadStats();
    } catch (error) {
      console.error(`Error publishing ${prefix} update:`, error);
      toast.error(`Erro ao publicar atualização do ${prefix}`);
    } finally {
      setPublishing(false);
    }
  };

  const renderPublishSection = (
    icon: React.ReactNode,
    label: string,
    prefix: string,
    version: string,
    setVersion: (v: string) => void,
    file: File | null,
    checksum: string,
    calculatingCs: boolean,
    forceUpdate: boolean,
    setForceUpdate: (b: boolean) => void,
    publishing: boolean,
    fileInputId: string,
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onPublish: () => void,
  ) => (
    <div className="space-y-4 p-4 border rounded-lg">
      <h4 className="font-medium flex items-center gap-2">
        {icon}
        Publicar {label}
      </h4>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}Version`}>Versão</Label>
          <Input id={`${prefix}Version`} placeholder="1.0.0" value={version} onChange={(e) => setVersion(e.target.value)} />
          <p className="text-xs text-muted-foreground">Formato semântico: major.minor.patch</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={fileInputId}>Pacote do {label} (.tar.gz)</Label>
          <Input id={fileInputId} type="file" accept=".tar.gz,.gz" onChange={onFileSelect} />
          {file && <p className="text-xs text-muted-foreground">Arquivo: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>}
        </div>
      </div>

      {calculatingCs && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Calculando checksum...</span>
        </div>
      )}

      {checksum && !calculatingCs && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-muted-foreground">SHA256:</span>
          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{checksum.substring(0, 32)}...</code>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Switch id={`${prefix}ForceUpdate`} checked={forceUpdate} onCheckedChange={setForceUpdate} />
        <Label htmlFor={`${prefix}ForceUpdate`} className="cursor-pointer">Forçar atualização</Label>
      </div>

      <Button onClick={onPublish} disabled={!file || !version || publishing || calculatingCs} className="w-full sm:w-auto">
        {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
        Publicar {label}
      </Button>
    </div>
  );

  const renderStatusSection = (
    label: string,
    latestVersion: string,
    versionPrefix: string,
    total: number,
    upToDate: number,
    outdated: Record<string, string>[],
    versionKey: string,
    extra?: React.ReactNode,
  ) => (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Status dos {label}</h4>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Auto refresh
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <div>
            <p className="font-medium">{upToDate} atualizados</p>
            <p className="text-xs text-muted-foreground">{latestVersion ? `${versionPrefix} v${latestVersion}` : 'Versão não definida'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <p className="font-medium">{outdated.length} desatualizados</p>
            <p className="text-xs text-muted-foreground">Aguardando update</p>
          </div>
        </div>
      </div>

      {extra}

      {outdated.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{label} desatualizados:</p>
          <ScrollArea className="h-[200px]">
            <ul className="space-y-1 pr-4">
              {outdated.map((agent, i) => (
                <li key={i} className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>{agent.name}</span>
                  <Badge variant="outline" className="text-xs">{versionPrefix} v{agent[versionKey]}</Badge>
                  <span className="text-muted-foreground">- {agent.client}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}

      {total === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum registrado</p>}
    </div>
  );

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">Gerenciamento de Atualizações</CardTitle>
            <CardDescription>Publique novas versões do Agent, Supervisor e Monitor para atualização automática</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {agentLatestVersion && <Badge variant="outline" className="text-sm">Agent: v{agentLatestVersion}</Badge>}
            {supervisorLatestVersion && <Badge variant="outline" className="text-sm">Supervisor: v{supervisorLatestVersion}</Badge>}
            {monitorLatestVersion && <Badge variant="outline" className="text-sm">Monitor: v{monitorLatestVersion}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Agent Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {renderPublishSection(
            <Bot className="w-4 h-4" />, 'Agent', 'agent',
            newVersion, setNewVersion,
            selectedFile, calculatedChecksum, calculatingChecksum,
            agentForceUpdate, setAgentForceUpdate,
            publishingUpdate, 'agentPackageFile',
            (e) => { const f = e.target.files?.[0]; if (f) handleGenericFileSelect(f, setSelectedFile, setCalculatedChecksum, setCalculatingChecksum); },
            () => handleGenericPublish('agent', newVersion, selectedFile, calculatedChecksum, agentForceUpdate, setPublishingUpdate, setAgentLatestVersion, setNewVersion, setSelectedFile, setCalculatedChecksum, 'agentPackageFile'),
          )}
          {renderStatusSection('Agents', agentLatestVersion, 'Agent', agentStats.total, agentStats.upToDate, agentStats.outdated, 'version')}
        </div>

        {/* Supervisor Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {renderPublishSection(
            <Layers className="w-4 h-4" />, 'Supervisor', 'supervisor',
            newSupervisorVersion, setNewSupervisorVersion,
            selectedSupervisorFile, supervisorChecksum, calculatingSupervisorChecksum,
            supervisorForceUpdate, setSupervisorForceUpdate,
            publishingSupervisorUpdate, 'supervisorPackageFile',
            (e) => { const f = e.target.files?.[0]; if (f) handleGenericFileSelect(f, setSelectedSupervisorFile, setSupervisorChecksum, setCalculatingSupervisorChecksum); },
            () => handleGenericPublish('supervisor', newSupervisorVersion, selectedSupervisorFile, supervisorChecksum, supervisorForceUpdate, setPublishingSupervisorUpdate, setSupervisorLatestVersion, setNewSupervisorVersion, setSelectedSupervisorFile, setSupervisorChecksum, 'supervisorPackageFile'),
          )}
          {renderStatusSection('Supervisors', supervisorLatestVersion, 'Sup', supervisorStats.total, supervisorStats.upToDate, supervisorStats.outdated, 'supervisorVersion',
            supervisorStats.withoutSupervisor > 0 ? (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                <Info className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-muted-foreground">{supervisorStats.withoutSupervisor} sem Supervisor</p>
                  <p className="text-xs text-muted-foreground">Agentes legados (modelo antigo)</p>
                </div>
              </div>
            ) : undefined,
          )}
        </div>

        {/* Monitor Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {renderPublishSection(
            <Activity className="w-4 h-4" />, 'Monitor', 'monitor',
            newMonitorVersion, setNewMonitorVersion,
            selectedMonitorFile, monitorChecksum, calculatingMonitorChecksum,
            monitorForceUpdate, setMonitorForceUpdate,
            publishingMonitorUpdate, 'monitorPackageFile',
            (e) => { const f = e.target.files?.[0]; if (f) handleGenericFileSelect(f, setSelectedMonitorFile, setMonitorChecksum, setCalculatingMonitorChecksum); },
            () => handleGenericPublish('monitor', newMonitorVersion, selectedMonitorFile, monitorChecksum, monitorForceUpdate, setPublishingMonitorUpdate, setMonitorLatestVersion, setNewMonitorVersion, setSelectedMonitorFile, setMonitorChecksum, 'monitorPackageFile'),
          )}
          {renderStatusSection('Monitors', monitorLatestVersion, 'Mon', monitorStats.total, monitorStats.upToDate, monitorStats.outdated, 'monitorVersion',
            monitorStats.withoutMonitor > 0 ? (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                <Info className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-muted-foreground">{monitorStats.withoutMonitor} sem Monitor</p>
                  <p className="text-xs text-muted-foreground">Sem dados de monitoramento</p>
                </div>
              </div>
            ) : undefined,
          )}
        </div>
      </CardContent>
    </Card>
  );
}
