import { Panel } from '@/components/ui/Panel';
import { PageHeader } from '@/components/layout/PageHeader';
import { AddTokenPanel } from '@/components/admin/AddTokenPanel';
import { TrackedTokenList } from '@/components/admin/TrackedTokenList';
import { FeedDiagnostics } from '@/components/admin/FeedDiagnostics';

/**
 * The admin screen.
 *
 * Controls what the board shows. PanScreener tracks a curated list rather than
 * every pair in existence, so this is where that list is built — and where a
 * suspicious price gets diagnosed, since the feed panel reports exactly what
 * resolved and what did not.
 */
export function Admin() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Manage"
        title="Admin"
        description="Choose which tokens appear on the board, and check where their prices are coming from."
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Panel className="overflow-hidden" elevation="raised">
            <AddTokenPanel />
          </Panel>

          <Panel className="overflow-hidden">
            <TrackedTokenList />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <FeedDiagnostics />
          </Panel>
        </div>
      </div>
    </div>
  );
}
