import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import logoIscope from '@/assets/logo-iscope.png';

type CallbackStatus = 'loading' | 'success' | 'partial' | 'error';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState<string | null>(null);

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const missingPermissions = searchParams.get('missing');
    const tenantId = searchParams.get('tenant_id');

    // Prepare message for parent window
    const messageData = {
      type: 'm365-oauth-callback',
      success: success === 'true' || success === 'partial',
      partial: success === 'partial',
      tenantId,
      missingPermissions: missingPermissions?.split(',').filter(Boolean) || [],
      error: error || null,
      errorDescription: errorDescription || null,
    };

    // Try to send message to parent window (opener)
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, '*');
      } catch (e) {
        console.warn('Could not send message to parent window:', e);
      }
    }

    // Update UI based on result
    if (success === 'true') {
      setStatus('success');
      setMessage('Conexão estabelecida com sucesso!');
      setDetails('Todas as permissões foram validadas. Você pode fechar esta janela.');
    } else if (success === 'partial') {
      setStatus('partial');
      setMessage('Conexão estabelecida parcialmente');
      const missing = missingPermissions?.replace(/,/g, ', ') || 'Algumas permissões';
      setDetails(`As seguintes permissões não puderam ser validadas: ${missing}. Isso pode ser por falta de licença Premium ou permissões não concedidas.`);
    } else if (error) {
      setStatus('error');
      setMessage('Falha na conexão');
      setDetails(errorDescription || error || 'Ocorreu um erro durante o processo de autorização.');
    } else {
      // No parameters - might be a direct access
      setStatus('error');
      setMessage('Página de callback');
      setDetails('Esta página é usada para processar o retorno da autenticação Microsoft. Acesse através do fluxo de conexão de tenant.');
    }

    // Auto-close window after delay if opened as popup
    if (window.opener) {
      if (success === 'true') {
        setTimeout(() => {
          window.close();
        }, 3000);
      } else if (success === 'partial') {
        setTimeout(() => {
          window.close();
        }, 10000);
      }
    }
  }, [searchParams]);

  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else {
      window.location.href = '/environment';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-16 h-16 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="w-16 h-16 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-16 h-16 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-500';
      case 'partial':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img src={logoIscope} alt="iScope 360" className="h-12" />
          </div>

          {/* Status Icon */}
          <div className="flex justify-center">
            {getIcon()}
          </div>

          {/* Status Message */}
          <div className="space-y-2">
            <h1 className={`text-xl font-bold ${getStatusColor()}`}>
              {message}
            </h1>
            {details && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {details}
              </p>
            )}
          </div>

          <div className="pt-4 space-y-3">
            {status === 'success' && (
              <p className="text-xs text-muted-foreground">
                Esta janela será fechada automaticamente em 3 segundos...
              </p>
            )}
            {status === 'partial' && (
              <p className="text-xs text-muted-foreground">
                Esta janela será fechada automaticamente em 10 segundos...
              </p>
            )}
            
            <Button onClick={handleClose} className="w-full">
              {window.opener ? 'Fechar Janela' : 'Voltar para Conexões'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
