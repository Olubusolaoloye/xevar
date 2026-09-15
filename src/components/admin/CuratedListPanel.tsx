import { useEffect, useState } from 'react';
import { Check, GripVertical, ListStart, Plus, Trash2 } from 'lucide-react';
import { isValidEntry, type CuratedEntry } from '@/data/curatedList';
import { adminBackend, useAdminStore } from '@/store/useAdminStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PanelHeader } from '@/components/ui/Panel';

/** Room for one screenful; matches the check constraint in migration 003. */
const MAX_ENTRIES = 24;

/**
 * Edit the curated watchlist.
 *
 * Deliberately an address list rather than a picker over the board. The list
 * is a statement about which projects belong to it, and those do not have to
 * be listed here — tying membership to a board listing would mean the only way
 * to put a token on the list is to publish it, which is a different decision.
 *
 * The chain is never asked for and never stored. Every visitor's browser
 * resolves each address through the market provider's cross-chain search, so
 * the network shown is the one the token actually trades on rather than one
 * typed into this form. See data/curatedList.ts.
 */
export function CuratedListPanel() {
  const storedName = useAdminStore((s) => s.curatedName);
  const storedTokens = useAdminStore((s) => s.curatedTokens);

  const [name, setName] = useState(storedName);
  const [rows, setRows] = useState<CuratedEntry[]>(storedTokens);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Another device's edit arrives over realtime. Take it: this form holds a
  // draft, and silently keeping a stale one would overwrite that edit on save.
  useEffect(() => setName(storedName), [storedName]);
  useEffect(() => setRows(storedTokens), [storedTokens]);

  const dirty =
    name !== storedName ||
    JSON.stringify(rows) !== JSON.stringify(storedTokens);

  const bad = rows.findIndex((row) => !isValidEntry(row));

  const patch = (index: number, field: keyof CuratedEntry, value: string) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  const move = (index: number, direction: -1 | 1) =>
    setRows((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = async () => {
    if (bad >= 0) {
      setError(
        `Row ${bad + 1} needs a ticker and a full 0x contract address (40 hex characters).`,
      );
      return;
    }

    setSaving(true);
    setError(null);
    const result = await adminBackend.setCuratedList({
      name: name.trim(),
      tokens: rows.map((row) => ({
        symbol: row.symbol.trim().toUpperCase(),
        address: row.address.trim(),
      })),
    });
    setSaving(false);

    if (result && !result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <PanelHeader
        title="Curated watchlist"
        subtitle="Shown to every visitor until they remove it"
        icon={<ListStart className="h-4 w-4" />}
      />

      <div className="space-y-3 p-4">
        <div>
          <label htmlFor="curated-name" className="mb-1 block text-[11px] text-ink-mid">
            List name
          </label>
          <Input
            id="curated-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="SMC DAO"
          />
        </div>

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="rounded-sm border border-line bg-sunken px-3 py-3 text-xs text-ink-low">
              No tokens on the list. Add a contract address and it appears on
              every visitor's watchlist.
            </p>
          )}

          {rows.map((row, index) => (
            <div key={index} className="flex items-start gap-1.5">
              <div className="flex shrink-0 flex-col pt-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${row.symbol || `row ${index + 1}`} up`}
                  className="px-0.5 text-[9px] leading-none text-ink-dim hover:text-ink disabled:opacity-30"
                >
                  ▲
                </button>
                <GripVertical className="h-3 w-3 text-ink-dim" aria-hidden />
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  aria-label={`Move ${row.symbol || `row ${index + 1}`} down`}
                  className="px-0.5 text-[9px] leading-none text-ink-dim hover:text-ink disabled:opacity-30"
                >
                  ▼
                </button>
              </div>

              <Input
                value={row.symbol}
                onChange={(event) => patch(index, 'symbol', event.target.value)}
                placeholder="WKC"
                aria-label={`Ticker for row ${index + 1}`}
                className="w-24 shrink-0 uppercase"
              />
              <Input
                value={row.address}
                onChange={(event) => patch(index, 'address', event.target.value)}
                placeholder="0x…"
                aria-label={`Contract address for row ${index + 1}`}
                className="min-w-0 flex-1 font-mono text-[11px]"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
                aria-label={`Remove ${row.symbol || `row ${index + 1}`}`}
                className="mt-1 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {rows.length < MAX_ENTRIES && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRows([...rows, { symbol: '', address: '' }])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add token
          </Button>
        )}

        {error && (
          <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 border-t border-line pt-3">
          <Button
            size="sm"
            variant={saved ? 'primary' : 'secondary'}
            onClick={() => void save()}
            disabled={saving || (!dirty && !saved)}
          >
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Saved
              </>
            ) : saving ? (
              'Saving…'
            ) : (
              'Save list'
            )}
          </Button>
          {dirty && !saving && !saved && (
            <span className="text-[11px] text-ink-low">Unsaved changes</span>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-ink-dim">
          The network is not stored. Each visitor's browser looks the contract
          up across every chain the provider indexes, so the list cannot quote a
          lookalike on the wrong network. A visitor who removes the list keeps
          it hidden on that device, even after you edit it.
        </p>
      </div>
    </div>
  );
}
