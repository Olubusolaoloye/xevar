import { Panel } from '@/components/ui/Panel';
import { PageHeader } from '@/components/layout/PageHeader';
import { AddTokenPanel } from '@/components/admin/AddTokenPanel';
import { ReviewQueue } from '@/components/admin/ReviewQueue';
import { ListingList } from '@/components/admin/ListingList';
import { FeedDiagnostics } from '@/components/admin/FeedDiagnostics';
import { AdminGate } from '@/components/admin/AdminGate';
import { SlideManager } from '@/components/admin/SlideManager';
import { AdminSettings } from '@/components/admin/AdminSettings';

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
    <AdminGate>
      <AdminScreen />
    </AdminGate>
  );
}

function AdminScreen() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Manage"
        title="Admin"
        description="Choose which tokens appear listed, and check where their prices are coming from."
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          {/* Leads the column: a submission sitting unreviewed is somebody
              waiting on a payment they have already made. */}
          <Panel className="overflow-hidden" elevation="raised">
            <ReviewQueue />
          </Panel>

          <Panel className="overflow-hidden" elevation="raised">
            <AddTokenPanel />
          </Panel>

          <Panel className="overflow-hidden">
            <ListingList />
          </Panel>

          <Panel className="overflow-hidden">
            <SlideManager />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <FeedDiagnostics />
          </Panel>

          <Panel className="overflow-hidden">
            <AdminSettings />
          </Panel>
        </div>
      </div>
    </div>
  );
}
