import { Moon, Sun, Palette as PaletteIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme, PALETTES, Palette } from '@/hooks/useTheme';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function ThemeToggle() {
  const { theme, toggle, palette, setPalette } = useTheme();
  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Palette de couleurs">
            <PaletteIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="end">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Palette de couleurs</p>
          <div className="space-y-1">
            {PALETTES.map(p => (
              <button
                key={p.id}
                onClick={() => setPalette(p.id as Palette)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-accent text-left text-sm"
              >
                <div className="flex gap-0.5">
                  {p.colors.map((c, i) => (
                    <div key={i} className="h-5 w-2 rounded-sm border border-border/40" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span className="flex-1">{p.label}</span>
                {palette === p.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8" title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
}
