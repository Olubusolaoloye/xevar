import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Wordmark } from '@/components/brand/Logo';
import { usePrefsStore } from '@/store/usePrefsStore';
import { NAV_ITEMS } from './navigation';

/**
 * Desktop navigation.
 *
 * Collapses to a 60px icon rail — on a screener, horizontal space is the
 * scarcest resource on the page and every pixel reclaimed is another column of
 * market data the user can see at once.
 */
export function SideRail() {
  const collapsed = usePrefsStore((s) => s.railCollapsed);
  const toggleRail = usePrefsStore((s) => s.toggleRail);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface lg:flex',
        'transition-[width] duration-300 ease-[var(--ease-out-quint)]',
        collapsed ? 'w-[60px]' : 'w-[212px]',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-line',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <NavLink to="/" aria-label="PanScreener home">
          <Wordmark markOnly={collapsed} />
        </NavLink>
      </div>

      <nav className={cn('flex-1 space-y-0.5 py-3', collapsed ? 'px-2' : 'px-2.5')}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center rounded-md text-sm font-medium',
                'transition-colors duration-150',
                collapsed ? 'h-9 w-9 justify-center' : 'h-9 gap-2.5 px-2.5',
                isActive
                  ? 'bg-brand-500/10 text-brand-500'
                  : 'text-ink-low hover:bg-raised hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active marker — a flush-left bar reads more like an
                    instrument than a filled pill. */}
                {isActive && (
                  <span className="absolute -left-2.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />
                )}
                <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={cn('space-y-0.5 border-t border-line py-3', collapsed ? 'px-2' : 'px-2.5')}>
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-md text-sm font-medium transition-colors duration-150',
              collapsed ? 'h-9 w-9 justify-center' : 'h-9 gap-2.5 px-2.5',
              isActive ? 'bg-raised text-ink' : 'text-ink-low hover:bg-raised hover:text-ink',
            )
          }
        >
          <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <button
          onClick={toggleRail}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className={cn(
            'flex items-center rounded-md text-sm font-medium text-ink-dim',
            'transition-colors duration-150 hover:bg-raised hover:text-ink-mid',
            collapsed ? 'h-9 w-9 justify-center' : 'h-9 w-full gap-2.5 px-2.5',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={2} />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={2} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
