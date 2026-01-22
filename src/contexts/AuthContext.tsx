import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'super_admin' | 'super_suporte' | 'workspace_admin' | 'user';
type ModulePermission = 'view' | 'edit' | 'full';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface UserRole {
  role: AppRole;
}

interface ModulePermissions {
  dashboard: ModulePermission;
  firewall: ModulePermission;
  reports: ModulePermission;
  users: ModulePermission;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole | null;
  permissions: ModulePermissions;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasPermission: (module: keyof ModulePermissions, required: ModulePermission) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
}

const defaultPermissions: ModulePermissions = {
  dashboard: 'view',
  firewall: 'view',
  reports: 'view',
  users: 'view',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<ModulePermissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer Supabase calls with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setPermissions(defaultPermissions);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileData) {
        setProfile(profileData as UserProfile);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleData) {
        setRole(roleData.role as AppRole);
      }

      // Fetch module permissions
      const { data: permissionsData } = await supabase
        .from('user_module_permissions')
        .select('module_name, permission')
        .eq('user_id', userId);

      if (permissionsData) {
        const perms = { ...defaultPermissions };
        permissionsData.forEach((p: { module_name: string; permission: ModulePermission }) => {
          if (p.module_name in perms) {
            perms[p.module_name as keyof ModulePermissions] = p.permission;
          }
        });
        setPermissions(perms);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setPermissions(defaultPermissions);
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
        signIn,
        signUp,
        signOut,
        hasPermission,
        isAdmin,
        isSuperAdmin,
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
