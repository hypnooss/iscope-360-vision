import { useState, useEffect } from 'react';
import { formatDateLongBR } from '@/lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Badge } from '@/components/ui/badge';
import { passwordRequirements, validatePassword } from '@/lib/passwordValidation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Shield, Lock, Check, X, Loader2, KeyRound, Trash2, Calendar, Mail, IdCard, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AvatarSelector } from '@/components/account/AvatarSelector';
import { NotificationPreferences } from '@/components/account/NotificationPreferences';

interface MfaFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AccountPage() {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [timezone, setTimezone] = useState(profile?.timezone || 'America/Sao_Paulo');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [loadingMfa, setLoadingMfa] = useState(true);
  const [removingMfa, setRemovingMfa] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setAvatarUrl(profile?.avatar_url || '');
  }, [profile]);

  useEffect(() => { loadMfaFactors(); }, []);

  const loadMfaFactors = async () => {
    setLoadingMfa(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setMfaFactors(data.totp || []);
    } catch { /* silent */ } finally { setLoadingMfa(false); }
  };

  const verifiedFactors = mfaFactors.filter(f => f.status === 'verified');
  const hasActiveMfa = verifiedFactors.length > 0;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), avatar_url: avatarUrl || null })
      .eq('id', user.id);
    setSavingProfile(false);
    if (error) {
      toast({ title: 'Erro ao salvar perfil', description: error.message, variant: 'destructive' });
    } else {
      await refreshProfile();
      toast({ title: 'Perfil atualizado com sucesso' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePassword(newPassword);
    if (!validation.valid) { toast({ title: validation.errors[0], variant: 'destructive' }); return; }
    if (newPassword !== confirmPassword) { toast({ title: 'As senhas não coincidem', variant: 'destructive' }); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast({ title: 'Erro ao trocar senha', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Senha alterada com sucesso' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleResetMfa = async (factorId: string) => {
    setRemovingMfa(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast({ title: 'MFA removido. Redirecionando para novo cadastro...' });
      setTimeout(() => navigate('/mfa/enroll'), 1000);
    } catch (err: any) {
      toast({ title: 'Erro ao remover MFA', description: err.message, variant: 'destructive' });
    } finally { setRemovingMfa(false); }
  };

  const memberSince = user?.created_at
    ? formatDateLongBR(user.created_at)
    : '—';

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Minha Conta' }]} />

        <div>
          <h1 className="text-2xl font-bold text-foreground">Minha Conta</h1>
          <p className="text-muted-foreground">Gerencie suas informações pessoais, segurança e autenticação</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left column — Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Informações do Perfil
              </CardTitle>
              <CardDescription>Gerencie suas informações pessoais.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-6">
                {/* Avatar */}
                <AvatarSelector
                  currentUrl={avatarUrl}
                  userName={fullName || user?.email || ''}
                  onSelect={setAvatarUrl}
                />

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                {/* Read-only info */}
                <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium text-foreground truncate">{user?.email || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <IdCard className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">ID do Usuário</p>
                      <p className="text-sm font-mono text-foreground truncate">{user?.id || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Membro desde</p>
                      <p className="text-sm font-medium text-foreground">{memberSince}</p>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={savingProfile} className="w-full">
                  {savingProfile ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar Perfil'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Right column — Security + MFA stacked */}
          <div className="space-y-6">
            {/* Password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>Defina uma nova senha forte para sua conta.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova Senha</Label>
                    <PasswordInput id="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Digite a nova senha" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                    <PasswordInput id="confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" required />
                  </div>
                  {newPassword.length > 0 && (
                    <div className="rounded-lg border border-border p-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Requisitos da senha:</p>
                      {passwordRequirements.map((req, i) => {
                        const passes = req.test(newPassword);
                        return (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            {passes ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-destructive" />}
                            <span className={passes ? 'text-green-500' : 'text-muted-foreground'}>{req.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button type="submit" disabled={savingPassword} className="w-full">
                    {savingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Alterar Senha'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* MFA */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Autenticação em Dois Fatores (MFA)
                </CardTitle>
                <CardDescription>Gerencie a autenticação TOTP da sua conta.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMfa ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Carregando fatores MFA...</span>
                  </div>
                ) : hasActiveMfa ? (
                  <div className="space-y-4">
                    <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                      <Shield className="w-3 h-3 mr-1" />Ativo
                    </Badge>
                    {verifiedFactors.map((factor) => (
                      <div key={factor.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                        <div className="flex items-center gap-3">
                          <KeyRound className="w-5 h-5 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{factor.friendly_name || 'Autenticador TOTP'}</p>
                            <p className="text-xs text-muted-foreground">
                              Cadastrado em {formatDateLongBR(factor.created_at)}
                            </p>
                          </div>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => handleResetMfa(factor.id)} disabled={removingMfa}>
                          {removingMfa ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4 mr-1" />Resetar</>}
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">Resetar o MFA irá desconectar o autenticador atual e redirecionar você para cadastrar um novo.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Badge variant="secondary" className="text-muted-foreground">
                      <Shield className="w-3 h-3 mr-1" />Inativo
                    </Badge>
                    <p className="text-sm text-muted-foreground">A autenticação em dois fatores não está configurada. Configure agora para aumentar a segurança da sua conta.</p>
                    <Button onClick={() => navigate('/mfa/enroll')} className="w-full">
                      <Shield className="w-4 h-4 mr-2" />Configurar MFA
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <NotificationPreferences />
      </div>
    </AppLayout>
  );
}
