import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// ScopeModule is now a string type since modules can be created dynamically
// The code must start with "scope_" (enforced by database constraint)
export type ScopeModule = string;
export type ModulePermissionLevel = 'none' | 'view' | 'edit';

export interface Module {
  id: string;
  code: ScopeModule;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
}

export interface UserModuleAccess {
  module: Module;
  permission: ModulePermissionLevel;
}

interface ModuleContextType {
  modules: Module[];
  userModules: UserModuleAccess[];
  activeModule: ScopeModule | null;
  setActiveModule: (module: ScopeModule | null) => void;
  hasModuleAccess: (moduleCode: ScopeModule) => boolean;
  getModulePermission: (moduleCode: ScopeModule) => ModulePermissionLevel;
  canEditModule: (moduleCode: ScopeModule) => boolean;
  loading: boolean;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const { user, role, loading: authLoading } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [userModules, setUserModules] = useState<UserModuleAccess[]>([]);
  const [activeModule, setActiveModule] = useState<ScopeModule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      fetchModules();
    } else if (!authLoading && !user) {
      setModules([]);
      setUserModules([]);
      setActiveModule(null);
      setLoading(false);
    }
  }, [user, authLoading, role]);

  const fetchModules = async () => {
    try {
      // Fetch all active modules
      const { data: allModules } = await supabase
        .from('modules')
        .select('*')
        .eq('is_active', true)
        .order('name');

      setModules(allModules || []);

      // Super admin has access to all modules with edit permission
      if (role === 'super_admin') {
        const fullAccess: UserModuleAccess[] = (allModules || []).map(m => ({
          module: m as Module,
          permission: 'edit' as ModulePermissionLevel,
        }));
        setUserModules(fullAccess);
      } else {
        // Fetch user's module access with permissions
        const { data: userModuleData } = await supabase
          .from('user_modules')
          .select('module_id, permission, modules(*)')
          .eq('user_id', user!.id);

        const accessibleModules: UserModuleAccess[] = (userModuleData || [])
          .filter(um => um.modules)
          .map(um => ({
            module: um.modules as unknown as Module,
            permission: (um.permission as ModulePermissionLevel) || 'view',
          }));

        setUserModules(accessibleModules);
      }

      // Set default active module if not set
      const savedModule = localStorage.getItem('activeModule') as ScopeModule | null;
      if (savedModule) {
        const hasAccess = role === 'super_admin' || 
          userModules.some(m => m.module.code === savedModule && m.permission !== 'none');
        if (hasAccess) {
          setActiveModule(savedModule);
        }
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasModuleAccess = (moduleCode: ScopeModule): boolean => {
    if (role === 'super_admin') return true;
    return userModules.some(m => m.module.code === moduleCode && m.permission !== 'none');
  };

  const getModulePermission = (moduleCode: ScopeModule): ModulePermissionLevel => {
    if (role === 'super_admin') return 'edit';
    const userModule = userModules.find(m => m.module.code === moduleCode);
    return userModule?.permission || 'none';
  };

  const canEditModule = (moduleCode: ScopeModule): boolean => {
    if (role === 'super_admin') return true;
    return getModulePermission(moduleCode) === 'edit';
  };

  const handleSetActiveModule = (module: ScopeModule | null) => {
    setActiveModule(module);
    if (module) {
      localStorage.setItem('activeModule', module);
    } else {
      localStorage.removeItem('activeModule');
    }
  };

  return (
    <ModuleContext.Provider
      value={{
        modules,
        userModules,
        activeModule,
        setActiveModule: handleSetActiveModule,
        hasModuleAccess,
        getModulePermission,
        canEditModule,
        loading,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
}

export function useModules() {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error('useModules must be used within a ModuleProvider');
  }
  return context;
}
