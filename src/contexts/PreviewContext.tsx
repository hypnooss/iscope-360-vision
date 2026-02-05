import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types for preview mode - prepared for future impersonate expansion
export type PreviewMode = 'preview' | 'impersonate'; // 'impersonate' for future use

export interface PreviewUserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface PreviewModuleAccess {
  module: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
  };
  permission: 'none' | 'view' | 'edit';
}

export interface PreviewWorkspace {
  id: string;
  name: string;
}

export interface PreviewTarget {
  userId: string;
  workspaceId: string | null;
  profile: PreviewUserProfile;
  role: 'super_admin' | 'super_suporte' | 'workspace_admin' | 'user';
  permissions: Record<string, string>;
  modules: PreviewModuleAccess[];
  workspaces: PreviewWorkspace[];
}

interface PreviewContextType {
  // State
  isPreviewMode: boolean;
  mode: PreviewMode;
  previewTarget: PreviewTarget | null;
  previewSessionId: string | null;
  previewStartedAt: Date | null;
  loading: boolean;
  
  // Actions
  startPreview: (userId: string, workspaceId?: string, reason?: string) => Promise<boolean>;
  stopPreview: () => Promise<void>;
  canStartPreview: () => boolean;
}

const PREVIEW_SESSION_KEY = 'preview_session';

const PreviewContext = createContext<PreviewContextType | undefined>(undefined);

export function PreviewProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [mode] = useState<PreviewMode>('preview'); // For future: could be 'impersonate'
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [previewStartedAt, setPreviewStartedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  // Restore preview session from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(PREVIEW_SESSION_KEY);
    if (stored && user) {
      try {
        const session = JSON.parse(stored);
        // Validate that the stored session belongs to current user
        if (session.adminId === user.id) {
          setIsPreviewMode(true);
          setPreviewTarget(session.target);
          setPreviewSessionId(session.sessionId);
          setPreviewStartedAt(new Date(session.startedAt));
        } else {
          // Clear invalid session
          sessionStorage.removeItem(PREVIEW_SESSION_KEY);
        }
      } catch (e) {
        console.error('Error restoring preview session:', e);
        sessionStorage.removeItem(PREVIEW_SESSION_KEY);
      }
    }
  }, [user]);

  // Clear preview on logout
  useEffect(() => {
    if (!user && isPreviewMode) {
      stopPreview();
    }
  }, [user]);

  const canStartPreview = useCallback((): boolean => {
    return role === 'super_admin' || role === 'super_suporte';
  }, [role]);

  const startPreview = useCallback(async (
    userId: string, 
    workspaceId?: string, 
    reason?: string
  ): Promise<boolean> => {
    if (!canStartPreview()) {
      toast.error('Você não tem permissão para usar o modo de visualização');
      return false;
    }

    if (!user) {
      toast.error('Você precisa estar logado');
      return false;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('get-user-preview-data', {
        body: {
          targetUserId: userId,
          targetWorkspaceId: workspaceId || null,
          reason: reason || null,
        },
      });

      if (error) {
        console.error('Preview function error:', error);
        toast.error('Erro ao iniciar visualização: ' + error.message);
        return false;
      }

      if (!data.success) {
        toast.error(data.error || 'Erro ao carregar dados do usuário');
        return false;
      }

      const target: PreviewTarget = {
        userId,
        workspaceId: workspaceId || null,
        profile: data.profile,
        role: data.role,
        permissions: data.permissions,
        modules: data.modules,
        workspaces: data.workspaces,
      };

      const startedAt = new Date();

      // Store in session storage for persistence across navigation
      sessionStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify({
        adminId: user.id,
        target,
        sessionId: data.sessionId,
        startedAt: startedAt.toISOString(),
      }));

      setPreviewTarget(target);
      setPreviewSessionId(data.sessionId);
      setPreviewStartedAt(startedAt);
      setIsPreviewMode(true);

      toast.success(`Visualizando como ${target.profile.full_name || target.profile.email}`);
      return true;
    } catch (error: any) {
      console.error('Start preview error:', error);
      toast.error('Erro ao iniciar modo de visualização');
      return false;
    } finally {
      setLoading(false);
    }
  }, [canStartPreview, user]);

  const stopPreview = useCallback(async (): Promise<void> => {
    // Update session end time in database
    if (previewSessionId) {
      try {
        await supabase
          .from('preview_sessions')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', previewSessionId);
      } catch (error) {
        console.error('Error updating preview session:', error);
      }
    }

    // Clear state
    sessionStorage.removeItem(PREVIEW_SESSION_KEY);
    setIsPreviewMode(false);
    setPreviewTarget(null);
    setPreviewSessionId(null);
    setPreviewStartedAt(null);

    toast.success('Visualização encerrada');
  }, [previewSessionId]);

  return (
    <PreviewContext.Provider
      value={{
        isPreviewMode,
        mode,
        previewTarget,
        previewSessionId,
        previewStartedAt,
        loading,
        startPreview,
        stopPreview,
        canStartPreview,
      }}
    >
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreview() {
  const context = useContext(PreviewContext);
  if (context === undefined) {
    throw new Error('usePreview must be used within a PreviewProvider');
  }
  return context;
}
