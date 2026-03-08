import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

const STYLES = [
  'adventurer',
  'avataaars',
  'fun-emoji',
  'lorelei',
  'notionists',
  'big-ears',
  'micah',
  'open-peeps',
  'personas',
  'bottts',
] as const;

const SEED_VARIANTS = ['alpha', 'beta', 'gamma', 'delta'];

function generateAvatarUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
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

  const avatarOptions = useMemo(() => {
    const options: { key: string; url: string; label: string }[] = [];
    for (const style of STYLES) {
      for (const variant of SEED_VARIANTS) {
        const seed = round === 0
          ? `${baseName}-${variant}`
          : `${baseName}-${variant}-${round}`;
        options.push({
          key: `${style}-${variant}-${round}`,
          url: generateAvatarUrl(style, seed),
          label: style,
        });
      }
    }
    return options;
  }, [baseName, round]);

  const displayUrl = currentUrl || generateAvatarUrl('adventurer', baseName);

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
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[320px] overflow-y-auto pr-1">
            {avatarOptions.map(({ key, url, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(url)}
                className={cn(
                  'rounded-lg border-2 p-1 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring',
                  currentUrl === url
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-transparent hover:border-border'
                )}
                title={label}
              >
                <img
                  src={url}
                  alt={label}
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
