import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type ScopeModule = 'scope_firewall' | 'scope_network' | 'scope_cloud' | 'scope_m365';

export interface Module {
  id: string;
  code: ScopeModule;
  name: string;
  description: string | null;
  icon: string | null;
}

interface ModuleContextType {
  modules: Module[];
  userModules: Module[];
  activeModule: ScopeModule | null;
  setActiveModule: (module: ScopeModule | null) => void;
  hasModuleAccess: (moduleCode: ScopeModule) => boolean;
  loading: boolean;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const { user, role, loading: authLoading } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [userModules, setUserModules] = useState<Module[]>([]);
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

      // Super admin has access to all modules
      if (role === 'super_admin') {
        setUserModules(allModules || []);
      } else {
        // Fetch user's module access
        const { data: userModuleData } = await supabase
          .from('user_modules')
          .select('module_id, modules(*)')
          .eq('user_id', user!.id);

        const accessibleModules = (userModuleData || [])
          .map(um => um.modules)
          .filter(Boolean) as unknown as Module[];

        setUserModules(accessibleModules);
      }

      // Set default active module if not set
      const savedModule = localStorage.getItem('activeModule') as ScopeModule | null;
      if (savedModule && (role === 'super_admin' || userModules.some(m => m.code === savedModule))) {
        setActiveModule(savedModule);
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasModuleAccess = (moduleCode: ScopeModule): boolean => {
    if (role === 'super_admin') return true;
    return userModules.some(m => m.code === moduleCode);
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
