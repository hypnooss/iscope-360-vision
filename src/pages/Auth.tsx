import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, ArrowLeft, Mail, KeyRound, CheckCircle } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import logoPrecisio from '@/assets/logo-precisio-analytics.png';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const emailSchema = z.object({
  email: z.string().email('Email inválido'),
});

const passwordSchema = z.object({
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type AuthView = 'login' | 'forgot-password' | 'verify-code' | 'reset-password' | 'success';

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentView, setCurrentView] = useState<AuthView>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Email não confirmado. Verifique sua caixa de entrada.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    }
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = emailSchema.safeParse({ email: resetEmail });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    
    setIsSubmitting(false);

    if (error) {
      toast.error('Erro ao enviar código. Tente novamente.');
      console.error('Reset password error:', error);
    } else {
      toast.success('Código enviado para seu email!');
      setCurrentView('verify-code');
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpCode.length !== 6) {
      toast.error('Digite o código de 6 dígitos');
      return;
    }

    setIsSubmitting(true);
    
    const { error } = await supabase.auth.verifyOtp({
      email: resetEmail,
      token: otpCode,
      type: 'recovery',
    });
    
    setIsSubmitting(false);

    if (error) {
      toast.error('Código inválido ou expirado. Tente novamente.');
      console.error('OTP verification error:', error);
    } else {
      toast.success('Código verificado!');
      setCurrentView('reset-password');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = passwordSchema.safeParse({ password: newPassword, confirmPassword });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    setIsSubmitting(false);

    if (error) {
      toast.error('Erro ao redefinir senha. Tente novamente.');
      console.error('Update password error:', error);
    } else {
      toast.success('Senha redefinida com sucesso!');
      setCurrentView('success');
    }
  };

  const resetFlow = () => {
    setCurrentView('login');
    setResetEmail('');
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderLoginView = () => (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="text-center">Bem-vindo</CardTitle>
        <CardDescription className="text-center">
          Faça login para acessar a plataforma
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="seu@email.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Senha</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-primary hover:underline"
            onClick={() => setCurrentView('forgot-password')}
          >
            Esqueceu sua senha?
          </button>
        </form>
      </CardContent>
    </Card>
  );

  const renderForgotPasswordView = () => (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <button
          type="button"
          onClick={resetFlow}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </button>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Recuperar Senha
        </CardTitle>
        <CardDescription>
          Digite seu email para receber um código de verificação
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSendResetCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="seu@email.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Código'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderVerifyCodeView = () => (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <button
          type="button"
          onClick={() => setCurrentView('forgot-password')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          Verificar Código
        </CardTitle>
        <CardDescription>
          Digite o código de 6 dígitos enviado para <strong>{resetEmail}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerifyCode} className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otpCode}
              onChange={(value) => setOtpCode(value)}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting || otpCode.length !== 6}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              'Verificar Código'
            )}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={handleSendResetCode}
          >
            Não recebeu? Reenviar código
          </button>
        </form>
      </CardContent>
    </Card>
  );

  const renderResetPasswordView = () => (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          Nova Senha
        </CardTitle>
        <CardDescription>
          Crie uma nova senha segura para sua conta
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Senha</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Redefinindo...
              </>
            ) : (
              'Redefinir Senha'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderSuccessView = () => (
    <Card className="glass-card border-border/50">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <CheckCircle className="w-6 h-6 text-green-500" />
        </div>
        <CardTitle>Senha Redefinida!</CardTitle>
        <CardDescription>
          Sua senha foi alterada com sucesso. Você já pode fazer login.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={resetFlow} className="w-full">
          Voltar ao Login
        </Button>
      </CardContent>
    </Card>
  );

  const renderCurrentView = () => {
    switch (currentView) {
      case 'forgot-password':
        return renderForgotPasswordView();
      case 'verify-code':
        return renderVerifyCodeView();
      case 'reset-password':
        return renderResetPasswordView();
      case 'success':
        return renderSuccessView();
      default:
        return renderLoginView();
    }
  };

  return (
    <div className="min-h-screen bg-background cyber-grid flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-4 mb-4">
            <img src={logoPrecisio} alt="Precisio Analytics" className="h-12 w-auto" />
            <span className="text-2xl font-bold text-foreground">InfraScope 360</span>
          </div>
          <p className="text-muted-foreground">Plataforma de Gestão de Infraestrutura</p>
        </div>

        {renderCurrentView()}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Acesso restrito. Contate o administrador para obter credenciais.
        </p>
      </div>
    </div>
  );
}
