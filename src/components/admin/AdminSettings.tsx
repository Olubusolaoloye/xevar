import { useState } from 'react';
import { Gauge, Link2 } from 'lucide-react';
import { buildVerdictUrl, useAdminStore } from '@/store/useAdminStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { PanelHeader } from '@/components/ui/Panel';

const POLL_OPTIONS = [10, 15, 30, 60];

/**
 * Feed and verdict-provider settings.
 *
 * The URL template gets a live preview because its exact shape cannot be
 * verified from here — seeing the resulting link for a real token turns a
 * guess into something correctable at a glance.
 */
export function AdminSettings() {
  const provider = useAdminStore((s) => s.provider);
  const setProvider = useAdminStore((s) => s.setProvider);
  const pollSeconds = useAdminStore((s) => s.pollSeconds);
  const setPollSeconds = useAdminStore((s) => s.setPollSeconds);
  const setPassHash = useAdminStore((s) => s.setPassHash);

  const [resetAsked, setResetAsked] = useState(false);

  const preview = buildVerdictUrl(provider, {
    address: '0x6ec90334d89dbdc89e08a133271be3d104128edb',
    chain: 'bsc',
    symbol: 'WKC',
    pairAddress: '0x0000000000000000000000000000000000000000',
  });

  return (
    <div>
      <PanelHeader
        title="Settings"
        subtitle="Feed rate and verdict provider"
        icon={<Gauge className="h-4 w-4" />}
      />

      <div className="divide-y divide-line-soft">
        {/* Refresh rate */}
        <div className="px-4 py-3.5">
          <p className="text-sm font-medium text-ink">Refresh every</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-low">
            Prices update on this interval without a reload. Faster costs more
            requests against a rate-limited public API.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {POLL_OPTIONS.map((seconds) => (
              <button
                key={seconds}
                onClick={() => setPollSeconds(seconds)}
                aria-pressed={pollSeconds === seconds}
                className={
                  pollSeconds === seconds
                    ? 'rounded-sm border border-brand-500/40 bg-brand-500/12 px-2.5 py-1 text-[11px] font-medium text-brand-500'
                    : 'rounded-sm border border-line bg-sunken px-2.5 py-1 text-[11px] font-medium text-ink-low hover:border-line-strong hover:text-ink-mid'
                }
              >
                {seconds}s
              </button>
            ))}
          </div>
        </div>

        {/* Verdict provider */}
        <div className="space-y-2.5 px-4 py-3.5">
          <Toggle
            checked={provider.enabled}
            onChange={(enabled) => setProvider({ enabled })}
            label="Contract verdicts"
            description="Link each token page to an external contract report."
          />

          <div>
            <label htmlFor="prov-name" className="mb-1 block text-[11px] text-ink-mid">
              Provider name
            </label>
            <Input
              id="prov-name"
              value={provider.name}
              onChange={(e) => setProvider({ name: e.target.value })}
              placeholder="FatDev"
            />
          </div>

          <div>
            <label htmlFor="prov-url" className="mb-1 block text-[11px] text-ink-mid">
              URL template
            </label>
            <Input
              id="prov-url"
              value={provider.urlTemplate}
              onChange={(e) => setProvider({ urlTemplate: e.target.value })}
              placeholder="https://fatdev.org/token/{address}"
              className="font-mono text-xs"
              icon={<Link2 className="h-3.5 w-3.5" />}
            />
            <p className="mt-1 text-[11px] text-ink-dim">
              Placeholders:{' '}
              <code className="font-mono text-ink-low">
                {'{address} {chain} {symbol} {pairAddress}'}
              </code>
            </p>
          </div>

          <div className="rounded-sm border border-line bg-sunken px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-ink-low">
              Preview for WKC
            </p>
            <p className="mt-0.5 break-all font-mono text-[11px] text-ink-mid">
              {preview}
            </p>
          </div>
        </div>

        {/* Passphrase */}
        <div className="px-4 py-3.5">
          <p className="text-sm font-medium text-ink">Admin passphrase</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-low">
            Clearing it means the next visit to this screen sets a new one.
          </p>
          <div className="mt-2.5">
            {resetAsked ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setPassHash(null);
                    sessionStorage.removeItem('panscreener.admin.unlocked');
                    window.location.reload();
                  }}
                >
                  Confirm clear
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setResetAsked(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setResetAsked(true)}>
                Clear passphrase
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
