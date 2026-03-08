import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

const SEED_SUFFIXES = [
  'hero', 'ninja', 'cyber', 'dragon', 'phoenix',
  'storm', 'blaze', 'frost', 'shadow', 'titan',
  'nova', 'viper', 'spark', 'wolf', 'hawk',
  'sage', 'rune', 'echo', 'flux', 'apex',
];

function generateAvatarUrl(seed: string) {
  return `https://api.multiavatar.com/${encodeURIComponent(seed)}.svg`;
}

interface AvatarSelectorProps {
  currentUrl: string;
  userName: string;
  onSelect: (url: string) => void;
}

export function AvatarSelector({ currentUrl, userName, onSelect }: AvatarSelectorProps) {
  const [round, setRound] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const baseName = userName || 'user';

  const avatarOptions = useMemo(() =>
    SEED_SUFFIXES.map((suffix) => {
      const seed = round === 0 ? `${baseName}-${suffix}` : `${baseName}-${suffix}-${round}`;
      return { seed, url: generateAvatarUrl(seed) };
    }),
    [baseName, round]
  );

  const displayUrl = currentUrl || generateAvatarUrl(baseName);

  return (
    <div className="space-y-3">
      <Label>Avatar</Label>

      <div className="flex items-center gap-4">
        <img
          src={displayUrl}
          alt="Avatar atual"
          className="w-16 h-16 rounded-full border-2 border-primary/30 bg-muted object-cover"
        />
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Fechar galeria' : 'Escolher avatar'}
          </Button>
          {currentUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onSelect('')}
            >
              Remover avatar
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Escolha um avatar</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRound(r => r + 1)} className="gap-1.5 h-7 text-xs">
              <RefreshCw className="w-3 h-3" />
              Randomizar
            </Button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {avatarOptions.map(({ seed, url }) => (
              <button
                key={seed}
                type="button"
                onClick={() => onSelect(url)}
                className={cn(
                  'rounded-lg border-2 p-1.5 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring',
                  currentUrl === url
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-transparent hover:border-border'
                )}
                title={seed}
              >
                <img
                  src={url}
                  alt={seed}
                  className="w-full aspect-square rounded-md bg-background"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
