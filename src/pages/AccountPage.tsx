import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Badge } from '@/components/ui/badge';
import { passwordRequirements, validatePassword } from '@/lib/passwordValidation';
import { User, Shield, Lock, Check, X, Loader2, KeyRound, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MfaFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AccountPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'profile';
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Profile state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // MFA state
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [loadingMfa, setLoadingMfa] = useState(true);
  const [removingMfa, setRemovingMfa] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
  }, [profile]);

  useEffect(() => {
    loadMfaFactors();
  }, []);

  const loadMfaFactors = async () => {
    setLoadingMfa(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setMfaFactors(data.totp || []);
    } catch {
      // silent
    } finally {
      setLoadingMfa(false);
    }
  };

  const verifiedFactors = mfaFactors.filter(f => f.status === 'verified');
  const hasActiveMfa = verifiedFactors.length > 0;

  // Profile handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', user.id);
    setSavingProfile(false);
    if (error) {
      toast({ title: 'Erro ao salvar perfil', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Perfil atualizado com sucesso' });
    }
  };

  // Password handlers
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast({ title: validation.errors[0], variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
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

  // MFA handlers
  const handleResetMfa = async (factorId: string) => {
    setRemovingMfa(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast({ title: 'MFA removido. Redirecionando para novo cadastro...' });
      setTimeout(() => navigate('/mfa/enroll'), 1000);
    } catch (err: any) {
      toast({ title: 'Erro ao remover MFA', description: err.message, variant: 'destructive' });
    } finally {
      setRemovingMfa(false);
    }
  };

  const handleEnrollMfa = () => {
    navigate('/mfa/enroll');
  };

  return (
    <AppLayout>
      <PageBreadcrumb items={[{ label: 'Minha Conta' }]} />

      <div className="py-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Minha Conta</h1>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Lock className="w-4 h-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="mfa" className="gap-2">
              <Shield className="w-4 h-4" />
              MFA
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Perfil</CardTitle>
                <CardDescription>Gerencie suas informações pessoais.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome Completo</Label>
                    <Input
                      id="full_name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>Defina uma nova senha forte para sua conta.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova Senha</Label>
                    <PasswordInput
                      id="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                    <PasswordInput
                      id="confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      required
                    />
                  </div>

                  {/* Password requirements checklist */}
                  {newPassword.length > 0 && (
                    <div className="rounded-lg border border-border p-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Requisitos da senha:</p>
                      {passwordRequirements.map((req, i) => {
                        const passes = req.test(newPassword);
                        return (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            {passes ? (
                              <Check className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-destructive" />
                            )}
                            <span className={passes ? 'text-green-500' : 'text-muted-foreground'}>
                              {req.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Button type="submit" disabled={savingPassword}>
                    {savingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Alterar Senha'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MFA Tab */}
          <TabsContent value="mfa">
            <Card>
              <CardHeader>
                <CardTitle>Autenticação em Dois Fatores (MFA)</CardTitle>
                <CardDescription>
                  Gerencie a autenticação TOTP da sua conta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMfa ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Carregando fatores MFA...</span>
                  </div>
                ) : hasActiveMfa ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                        <Shield className="w-3 h-3 mr-1" />
                        Ativo
                      </Badge>
                    </div>

                    {verifiedFactors.map((factor) => (
                      <div
                        key={factor.id}
                        className="flex items-center justify-between rounded-lg border border-border p-4"
                      >
                        <div className="flex items-center gap-3">
                          <KeyRound className="w-5 h-5 text-primary" />
                          <div>
                            <p className="text-sm font-medium">
                              {factor.friendly_name || 'Autenticador TOTP'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Cadastrado em{' '}
                              {format(new Date(factor.created_at), "dd 'de' MMMM 'de' yyyy", {
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleResetMfa(factor.id)}
                          disabled={removingMfa}
                        >
                          {removingMfa ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-1" />
                              Resetar
                            </>
                          )}
                        </Button>
                      </div>
                    ))}

                    <p className="text-xs text-muted-foreground">
                      Resetar o MFA irá desconectar o autenticador atual e redirecionar você para cadastrar um novo.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-muted-foreground">
                        <Shield className="w-3 h-3 mr-1" />
                        Inativo
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      A autenticação em dois fatores não está configurada. Configure agora para aumentar a segurança da sua conta.
                    </p>
                    <Button onClick={handleEnrollMfa}>
                      <Shield className="w-4 h-4 mr-2" />
                      Configurar MFA
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
