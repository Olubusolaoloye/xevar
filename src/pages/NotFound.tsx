import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24">
      <h1 className="font-display text-6xl font-bold tracking-tight text-line-strong">
        404
      </h1>
      <EmptyState
        icon={<Compass className="h-5 w-5" />}
        title="This page does not exist"
        description="The link may be stale, or the pair may no longer be listed."
        action={
          <Link to="/">
            <Button variant="primary" size="sm">
              Back to the overview
            </Button>
          </Link>
        }
      />
    </div>
  );
}
