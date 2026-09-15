import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A small anchored menu.
 *
 * Deliberately not a portal: the panel is positioned against its trigger and
 * the header it lives in already establishes a stacking context, so rendering
 * in place keeps the DOM order matching the reading order for a screen reader.
 *
 * Handles the three things a menu that does not do them gets complained about
 * for: clicking away closes it, Escape closes it and returns focus to the
 * trigger, and the trigger reports its own state.
 */
export function Dropdown({
  trigger,
  label,
  align = 'right',
  children,
  className,
}: {
  /** Rendered inside the trigger button. */
  trigger: ReactNode;
  /** Accessible name for the trigger. */
  label: string;
  align?: 'left' | 'right';
  /** Receives a `close` callback so an item can dismiss the menu. */
  children: (close: () => void) => ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // Returning focus matters: without it, dismissing with the keyboard
      // drops the caret at the top of the document.
      triggerRef.current?.focus();
    };

    // `pointerdown` rather than `click` so the menu closes before a click
    // lands on whatever is underneath it.
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-md border px-2 transition-colors',
          open
            ? 'border-line-strong bg-raised text-ink'
            : 'border-line bg-sunken text-ink-mid hover:border-line-strong hover:text-ink',
        )}
      >
        {trigger}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={cn(
            'absolute top-full z-50 mt-1.5 min-w-[13rem] overflow-hidden rounded-lg',
            'border border-line-strong bg-overlay shadow-popover',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** A labelled group of choices inside a dropdown. */
export function DropdownSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-line-soft py-1.5 last:border-b-0">
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-dim">
        {title}
      </p>
      {children}
    </div>
  );
}

/** A single selectable row. */
export function DropdownItem({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
        selected ? 'bg-brand-500/10 text-brand-500' : 'text-ink-mid hover:bg-raised hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
