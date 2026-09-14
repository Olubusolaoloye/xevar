import { cn } from '@/lib/utils';
import { PRESETS, useScreenerStore } from '@/store/useScreenerStore';
import { Tooltip } from '@/components/ui/Tooltip';

/**
 * One-click filter sets.
 *
 * These encode the questions people actually bring to a screener — "what is
 * new", "what is running", "what is deep and locked" — so the common cases
 * never require assembling thresholds by hand.
 */
export function PresetTabs({ className }: { className?: string }) {
  const activePreset = useScreenerStore((s) => s.activePreset);
  const applyPreset = useScreenerStore((s) => s.applyPreset);

  return (
    <div className={cn('no-scrollbar flex items-center gap-1 overflow-x-auto', className)}>
      {PRESETS.map((preset) => {
        const active = preset.id === activePreset;
        return (
          <Tooltip key={preset.id} content={preset.description} side="bottom">
            <button
              onClick={() => applyPreset(preset)}
              aria-pressed={active}
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
                active
                  ? 'bg-brand-500/12 text-brand-500'
                  : 'text-ink-low hover:bg-raised hover:text-ink',
              )}
            >
              {preset.label}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
