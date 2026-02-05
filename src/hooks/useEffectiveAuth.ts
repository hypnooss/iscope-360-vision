import { useAuth } from '@/contexts/AuthContext';
import { usePreview, PreviewUserProfile, PreviewWorkspace } from '@/contexts/PreviewContext';

type AppRole = 'super_admin' | 'super_suporte' | 'workspace_admin' | 'user';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface EffectiveAuthResult {
  // Real admin data (always from AuthContext)
  realProfile: UserProfile | null;
  realRole: AppRole | null;
  
  // Effective data (preview target when in preview mode, otherwise real data)
  effectiveProfile: UserProfile | null;
  effectiveRole: AppRole | null;
  
  // Workspaces for filtering
  effectiveWorkspaces: PreviewWorkspace[];
  
  // Flags
  isViewingAsOther: boolean;
  isPreviewMode: boolean;
}

/**
 * Hook that combines AuthContext and PreviewContext to provide "effective" user data.
 * When in preview mode, returns the preview target's data.
 * When not in preview mode, returns the real admin's data.
 */
export function useEffectiveAuth(): EffectiveAuthResult {
  const { profile, role } = useAuth();
  const { isPreviewMode, previewTarget } = usePreview();
  
  // Convert PreviewUserProfile to UserProfile format
  const convertProfile = (previewProfile: PreviewUserProfile | undefined): UserProfile | null => {
    if (!previewProfile) return null;
    return {
      id: previewProfile.id,
      email: previewProfile.email,
      full_name: previewProfile.full_name,
      avatar_url: previewProfile.avatar_url,
    };
  };
  
  const effectiveProfile = isPreviewMode && previewTarget 
    ? convertProfile(previewTarget.profile) 
    : profile;
    
  const effectiveRole = isPreviewMode && previewTarget 
    ? previewTarget.role 
    : role;
    
  const effectiveWorkspaces = isPreviewMode && previewTarget?.workspaces
    ? previewTarget.workspaces
    : [];
    
  return {
    // Real data (always admin)
    realProfile: profile,
    realRole: role,
    
    // Effective data (preview or real)
    effectiveProfile,
    effectiveRole,
    
    // Workspaces
    effectiveWorkspaces,
    
    // Flags
    isViewingAsOther: isPreviewMode,
    isPreviewMode,
  };
}
