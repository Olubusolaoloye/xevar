import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Images,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminBackend, useAdminStore, type AdSlide } from '@/store/useAdminStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { EmptyState } from '@/components/ui/EmptyState';
import { PanelHeader } from '@/components/ui/Panel';

function SlideForm({
  slide,
  onSave,
  onCancel,
}: {
  slide?: AdSlide;
  onSave: (draft: Omit<AdSlide, 'id' | 'order'>) => void;
  onCancel: () => void;
}) {
  const [eyebrow, setEyebrow] = useState(slide?.eyebrow ?? '');
  const [title, setTitle] = useState(slide?.title ?? '');
  const [body, setBody] = useState(slide?.body ?? '');
  const [ctaLabel, setCtaLabel] = useState(slide?.ctaLabel ?? '');
  const [ctaHref, setCtaHref] = useState(slide?.ctaHref ?? '');
  const [imageUrl, setImageUrl] = useState(slide?.imageUrl ?? '');
  const [sponsored, setSponsored] = useState(slide?.sponsored ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!title.trim()) {
      setError('A headline is required.');
      return;
    }
    onSave({
      eyebrow: eyebrow.trim() || undefined,
      title: title.trim(),
      body: body.trim() || undefined,
      ctaLabel: ctaLabel.trim() || undefined,
      ctaHref: ctaHref.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      sponsored,
      enabled: slide?.enabled ?? true,
    });
  };

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
    hint?: string,
  ) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] text-ink-mid">
        {label} {hint && <span className="text-ink-dim">— {hint}</span>}
      </label>
      <Input id={id} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="space-y-2.5 border-t border-line bg-sunken/40 px-4 py-3">
      {field('sl-eyebrow', 'Eyebrow', eyebrow, setEyebrow, 'Live across 8 networks', 'small line above')}
      {field('sl-title', 'Headline', title, setTitle, 'Every pair. Every chain.')}
      {field('sl-body', 'Body', body, setBody, 'One or two sentences.')}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {field('sl-cta', 'Button label', ctaLabel, setCtaLabel, 'Learn more')}
        {field('sl-href', 'Button link', ctaHref, setCtaHref, 'https://… or /screener')}
      </div>

      {field('sl-img', 'Background image', imageUrl, setImageUrl, 'https://…', 'optional')}

      <Toggle
        checked={sponsored}
        onChange={setSponsored}
        label="Mark as sponsored"
        description="Paid placements must be labelled. Readers are entitled to know when they are being advertised to."
      />

      {error && <p className="text-xs text-down">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={save}>
          Save slide
        </Button>
      </div>
    </div>
  );
}

/** Manage the hero carousel's slides. */
export function SlideManager() {
  const slides = useAdminStore((s) => s.slides);
  const addSlide = adminBackend.addSlide;
  const updateSlide = adminBackend.updateSlide;
  const removeSlide = adminBackend.removeSlide;
  const moveSlide = adminBackend.moveSlide;

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...slides].sort((a, b) => a.order - b.order),
    [slides],
  );

  return (
    <div>
      <PanelHeader
        title="Hero carousel"
        subtitle={`${ordered.filter((s) => s.enabled).length} of ${ordered.length} showing`}
        icon={<Images className="h-4 w-4" />}
        action={
          <Button
            size="sm"
            variant={creating ? 'ghost' : 'outline'}
            onClick={() => {
              setCreating(!creating);
              setEditing(null);
            }}
          >
            {creating ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {creating ? 'Cancel' : 'New slide'}
          </Button>
        }
      />

      {creating && (
        <SlideForm
          onSave={(draft) => {
            addSlide(draft);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {ordered.length === 0 ? (
        <EmptyState
          title="No slides"
          description="Add one and it becomes the hero at the top of the overview."
        />
      ) : (
        <ul className="divide-y divide-line-soft">
          {ordered.map((slide, index) => (
            <li key={slide.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => moveSlide(slide.id, -1)}
                    disabled={index === 0}
                    aria-label="Move slide up"
                    className="rounded-xs p-0.5 text-ink-dim transition-colors hover:text-ink disabled:opacity-25"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => moveSlide(slide.id, 1)}
                    disabled={index === ordered.length - 1}
                    aria-label="Move slide down"
                    className="rounded-xs p-0.5 text-ink-dim transition-colors hover:text-ink disabled:opacity-25"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-ink">
                      {slide.title}
                    </span>
                    {slide.sponsored && <Badge tone="warn">Sponsored</Badge>}
                    {!slide.enabled && <Badge>Hidden</Badge>}
                  </div>
                  {slide.ctaHref && (
                    <p className="truncate font-mono text-[11px] text-ink-dim">
                      {slide.ctaLabel} → {slide.ctaHref}
                    </p>
                  )}
                </div>

                <Toggle
                  checked={slide.enabled}
                  onChange={(enabled) => updateSlide(slide.id, { enabled })}
                />

                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => {
                      setEditing(editing === slide.id ? null : slide.id);
                      setCreating(false);
                    }}
                    aria-label="Edit slide"
                    className={cn(
                      'rounded-sm p-1.5 transition-colors',
                      editing === slide.id
                        ? 'bg-raised text-ink'
                        : 'text-ink-dim hover:bg-raised hover:text-ink',
                    )}
                  >
                    {editing === slide.id ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      <Pencil className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => removeSlide(slide.id)}
                    aria-label="Delete slide"
                    className="rounded-sm p-1.5 text-ink-dim transition-colors hover:bg-down/10 hover:text-down"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {editing === slide.id && (
                <SlideForm
                  slide={slide}
                  onSave={(draft) => {
                    updateSlide(slide.id, draft);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
