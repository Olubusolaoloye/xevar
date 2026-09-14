import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrefsStore, type ThemeChoice } from '@/store/usePrefsStore';

const OPTIONS: Array<{ value: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/** Three-way theme control: light, follow the system, or dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = usePrefsStore((s) => s.theme);
  const setTheme = usePrefsStore((s) => s.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-line bg-sunken p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            title={label}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-sm transition-colors duration-150',
              active ? 'bg-raised text-ink shadow-panel' : 'text-ink-low hover:text-ink-mid',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
