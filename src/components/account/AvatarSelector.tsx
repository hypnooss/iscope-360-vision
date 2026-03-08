import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

const AVATAR_STYLES = [
  'adventurer',
  'adventurer-neutral',
  'avataaars',
  'big-ears',
  'big-smile',
  'bottts',
  'croodles',
  'fun-emoji',
  'icons',
  'lorelei',
  'micah',
  'miniavs',
  'notionists',
  'open-peeps',
  'personas',
  'pixel-art',
] as const;

function generateAvatarUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

interface AvatarSelectorProps {
  currentUrl: string;
  userName: string;
  onSelect: (url: string) => void;
}

export function AvatarSelector({ currentUrl, userName, onSelect }: AvatarSelectorProps) {
  const [seed, setSeed] = useState(userName || 'user');
  const [expanded, setExpanded] = useState(false);

  const selectedUrl = currentUrl;

  const handleRandomize = () => {
    setSeed(`${userName}-${Date.now()}`);
  };

  const avatarOptions = AVATAR_STYLES.map((style) => ({
    style,
    url: generateAvatarUrl(style, seed),
  }));

  // Show current avatar or a default
  const displayUrl = selectedUrl || generateAvatarUrl('adventurer', seed);

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
          {selectedUrl && (
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
            <p className="text-xs font-medium text-muted-foreground">Escolha um estilo de avatar</p>
            <Button type="button" variant="ghost" size="sm" onClick={handleRandomize} className="gap-1.5 h-7 text-xs">
              <RefreshCw className="w-3 h-3" />
              Randomizar
            </Button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {avatarOptions.map(({ style, url }) => (
              <button
                key={style}
                type="button"
                onClick={() => onSelect(url)}
                className={cn(
                  'rounded-lg border-2 p-1.5 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring',
                  selectedUrl === url
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-transparent hover:border-border'
                )}
                title={style}
              >
                <img
                  src={url}
                  alt={style}
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
