import { useState } from 'react';
import { Header } from '@/components/Header';
import { ConnectionForm } from '@/components/ConnectionForm';
import { Dashboard } from '@/components/Dashboard';
import { ComplianceReport } from '@/types/compliance';
import { generateMockReport } from '@/data/mockCompliance';
import { Shield, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Index = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionConfig, setConnectionConfig] = useState<{ url: string; apiKey: string } | null>(null);

  const handleConnect = async (url: string, apiKey: string) => {
    setIsConnecting(true);
    setConnectionConfig({ url, apiKey });
    
    try {
      const { data, error } = await supabase.functions.invoke('fortigate-compliance', {
        body: { url, apiKey },
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Erro ao conectar', {
          description: error.message || 'Não foi possível conectar ao FortiGate',
        });
        // Fallback para mock se a API real falhar
        toast.info('Usando dados de demonstração');
        setReport(generateMockReport());
      } else if (data.error) {
        console.error('FortiGate API error:', data.error);
        toast.error('Erro na API FortiGate', {
          description: data.details || data.error,
        });
        // Fallback para mock
        toast.info('Usando dados de demonstração');
        setReport(generateMockReport());
      } else {
        // Converter a data para objeto Date
        const reportData: ComplianceReport = {
          ...data,
          generatedAt: new Date(data.generatedAt),
        };
        setReport(reportData);
        toast.success('Análise concluída!', {
          description: `${data.passed} de ${data.totalChecks} verificações aprovadas`,
        });
      }
      
      setIsConnected(true);
    } catch (err) {
      console.error('Connection error:', err);
      toast.error('Erro de conexão', {
        description: 'Usando dados de demonstração',
      });
      setReport(generateMockReport());
      setIsConnected(true);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefresh = async () => {
    if (!connectionConfig) {
      setReport(generateMockReport());
      return;
    }

    setIsRefreshing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('fortigate-compliance', {
        body: connectionConfig,
      });

      if (error || data.error) {
        toast.error('Erro ao atualizar', {
          description: 'Usando dados anteriores',
        });
      } else {
        const reportData: ComplianceReport = {
          ...data,
          generatedAt: new Date(data.generatedAt),
        };
        setReport(reportData);
        toast.success('Análise atualizada!');
      }
    } catch (err) {
      console.error('Refresh error:', err);
      toast.error('Erro ao atualizar');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {!report ? (
        <main className="px-6 py-12">
          {/* Hero Section */}
          <div className="max-w-4xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
              <Shield className="w-4 h-4" />
              Ferramenta de Auditoria FortiGate
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Valide seu Firewall em
              <span className="text-primary"> Minutos</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Conecte-se ao seu FortiGate e receba uma análise completa de compliance, 
              segurança e boas práticas com recomendações acionáveis.
            </p>
          </div>

          {/* Features Grid */}
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: CheckCircle2,
                title: 'Verificações Automáticas',
                description: 'Mais de 50 pontos de verificação baseados em boas práticas',
              },
              {
                icon: AlertTriangle,
                title: 'Detecção de Riscos',
                description: 'Identifica vulnerabilidades e configurações inseguras',
              },
              {
                icon: TrendingUp,
                title: 'Recomendações',
                description: 'Sugestões práticas para melhorar sua postura de segurança',
              },
            ].map((feature, index) => (
              <div 
                key={feature.title}
                className="glass-card rounded-xl p-6 text-center animate-fade-in"
                style={{ animationDelay: `${0.3 + index * 0.1}s` }}
              >
                <div className="inline-flex p-3 rounded-lg bg-primary/10 mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Connection Form */}
          <ConnectionForm 
            onConnect={handleConnect}
            isConnecting={isConnecting}
            isConnected={isConnected}
          />
        </main>
      ) : (
        <Dashboard 
          report={report} 
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      )}
    </div>
  );
};

export default Index;
