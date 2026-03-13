import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ShieldCheck, ShieldOff } from 'lucide-react';

interface MfaUserDetail {
  displayName: string;
  upn: string;
  methods: string[];
  hasMfa: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  microsoftAuthenticatorPush: 'Authenticator',
  softwareOneTimePasscode: 'Software OTP',
  mobilePhone: 'Mobile Phone',
  email: 'Email',
  windowsHelloForBusiness: 'Windows Hello',
  passKeyDeviceBound: 'Passkey',
  hardwareOneTimePasscode: 'Hardware OTP',
  microsoftAuthenticatorPasswordless: 'Passwordless',
  fido2: 'FIDO2',
};

interface MfaUserListProps {
  users: MfaUserDetail[];
  showMethods?: boolean;
}

export function MfaUserList({ users, showMethods = false }: MfaUserListProps) {
  const [search, setSearch] = useState('');
  const LIMIT = 10;

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.upn.toLowerCase().includes(q)
    );
  }, [users, search]);

  const visible = filtered.slice(0, search.trim() ? filtered.length : LIMIT);
  const hiddenCount = search.trim() ? 0 : Math.max(0, filtered.length - LIMIT);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou UPN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      <div className="text-xs text-muted-foreground">
        {filtered.length} usuário{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          Nenhum usuário encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((user) => (
            <div
              key={user.upn}
              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-secondary/30 border border-border/40"
            >
              <div className="mt-0.5 shrink-0">
                {user.hasMfa ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                ) : (
                  <ShieldOff className="w-4 h-4 text-destructive" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-medium text-sm truncate">{user.displayName}</div>
                <div className="text-xs text-muted-foreground truncate">{user.upn}</div>
                {showMethods && user.methods.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {user.methods.map((m) => (
                      <Badge key={m} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {METHOD_LABELS[m] || m}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hiddenCount > 0 && (
        <div className="text-xs text-center text-muted-foreground">
          + {hiddenCount} usuário{hiddenCount !== 1 ? 's' : ''}. Use a busca para ver todos.
        </div>
      )}
    </div>
  );
}
