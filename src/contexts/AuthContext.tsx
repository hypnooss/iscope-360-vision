import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isDeviceTrusted, clearTrustedDevice } from '@/lib/trustedDevice';

type AppRole = 'super_admin' | 'super_suporte' | 'workspace_admin' | 'user';
type ModulePermission = 'view' | 'edit' | 'full';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ModulePermissions {
  dashboard: ModulePermission;
  firewall: ModulePermission;
  reports: ModulePermission;
  users: ModulePermission;
  external_domain: ModulePermission;
}

interface CachedUserData {
  profile: UserProfile;
  role: AppRole;
  permissions: ModulePermissions;
  timestamp: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole | null;
  permissions: ModulePermissions;
  loading: boolean;
  mfaRequired: boolean;
  mfaEnrolled: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasPermission: (module: keyof ModulePermissions, required: ModulePermission) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  refreshMfaStatus: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const defaultPermissions: ModulePermissions = {
  dashboard: 'view',
  firewall: 'view',
  reports: 'view',
  users: 'view',
  external_domain: 'view',
};

const CACHE_KEY_PREFIX = 'user_data_';
const CACHE_TTL = 5 * 60 * 1000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<ModulePermissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  
  // Ref to prevent duplicate fetch calls
  const fetchingRef = useRef(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const checkMfaStatus = async () => {
    try {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aalData) return;

      const { currentLevel, nextLevel } = aalData;

      // Check if user has TOTP factors enrolled
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const hasVerifiedTotp = factorsData?.totp?.some(f => f.status === 'verified') ?? false;

      setMfaEnrolled(hasVerifiedTotp);

      // MFA is required if: user has a factor but hasn't completed aal2, OR user doesn't have a factor yet (needs to enroll)
      if (nextLevel === 'aal2' && currentLevel === 'aal1') {
        // Check if device is trusted (MFA verified within 24h)
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const userId = currentSession?.user?.id;
        if (userId && isDeviceTrusted(userId)) {
          setMfaRequired(false);
        } else {
          setMfaRequired(true);
        }
      } else if (!hasVerifiedTotp) {
        // No factor enrolled — needs to enroll
        setMfaRequired(true);
      } else {
        setMfaRequired(false);
      }
    } catch (err) {
      console.error('MFA status check error:', err);
    }
  };

  const refreshMfaStatus = async () => {
    await checkMfaStatus();
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
            checkMfaStatus();
          }, 0);
        } else {
          clearUserData();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
        checkMfaStatus();
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearUserData = () => {
    setProfile(null);
    setRole(null);
    setPermissions(defaultPermissions);
    setMfaRequired(false);
    setMfaEnrolled(false);
    setLoading(false);
    lastFetchedUserIdRef.current = null;
  };

  const getCachedData = (userId: string): CachedUserData | null => {
    try {
      const cached = sessionStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
      if (cached) {
        const parsed: CachedUserData = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          return parsed;
        }
        sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${userId}`);
      }
    } catch {
      // Ignore cache errors
    }
    return null;
  };

  const setCachedData = (userId: string, data: Omit<CachedUserData, 'timestamp'>) => {
    try {
      const cacheData: CachedUserData = {
        ...data,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify(cacheData));
    } catch {
      // Ignore cache errors
    }
  };

  const fetchUserData = async (userId: string) => {
    if (fetchingRef.current && lastFetchedUserIdRef.current === userId) {
      return;
    }
    
    const cached = getCachedData(userId);
    if (cached) {
      setProfile(cached.profile);
      setRole(cached.role);
      setPermissions(cached.permissions);
      setLoading(false);
      lastFetchedUserIdRef.current = userId;
      return;
    }

    fetchingRef.current = true;
    lastFetchedUserIdRef.current = userId;

    try {
      const [profileResult, roleResult, permissionsResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId).single(),
        supabase.from('user_module_permissions').select('module_name, permission').eq('user_id', userId),
      ]);

      const profileData = profileResult.data as UserProfile | null;
      const roleData = roleResult.data;
      const permissionsData = permissionsResult.data;

      if (profileData) {
        setProfile(profileData);
      }

      const userRole = (roleData?.role as AppRole) || 'user';
      setRole(userRole);

      const perms = { ...defaultPermissions };
      if (permissionsData) {
        permissionsData.forEach((p: { module_name: string; permission: ModulePermission }) => {
          if (p.module_name in perms) {
            perms[p.module_name as keyof ModulePermissions] = p.permission;
          }
        });
      }
      setPermissions(perms);

      if (profileData) {
        setCachedData(userId, {
          profile: profileData,
          role: userRole,
          permissions: perms,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (user?.id) {
      sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${user.id}`);
      clearTrustedDevice(user.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    clearUserData();
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data as UserProfile);
        sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${user.id}`);
        lastFetchedUserIdRef.current = null;
      }
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  };

  const hasPermission = (module: keyof ModulePermissions, required: ModulePermission): boolean => {
    if (role === 'super_admin') return true;
    const current = permissions[module];
    const levels: ModulePermission[] = ['view', 'edit', 'full'];
    return levels.indexOf(current) >= levels.indexOf(required);
  };

  const isAdmin = () => role === 'super_admin' || role === 'workspace_admin';
  const isSuperAdmin = () => role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        permissions,
        loading,
        mfaRequired,
        mfaEnrolled,
        signIn,
        signUp,
        signOut,
        hasPermission,
        isAdmin,
        isSuperAdmin,
        refreshMfaStatus,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
