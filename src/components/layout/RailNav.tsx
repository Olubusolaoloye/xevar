import { NavLink } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, SECTION_ITEMS, type NavItem } from './navigation';
import { AccountLink } from './AccountLink';

/**
 * The navigation body, shared by the desktop rail and the mobile drawer.
 *
 * Extracted because the two had drifted into being different menus: the rail
 * carried Sections, Settings and the account row, and the phone got a
 * five-item tab bar with no way to reach any of them. One list means a route
 * added here appears in both without anybody remembering to.
 *
 * `collapsed` is a desktop-only state — the drawer is always full width, since
 * an icon rail inside an overlay saves space nobody is short of.
 */
export function RailLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.path}
      end={item.end}
      onClick={onNavigate}
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
          {/* Active marker — a flush-left bar reads more like an instrument
              than a filled pill. */}
          {isActive && (
            <span className="absolute -left-2.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />
          )}
          <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
          {!collapsed && (
            <>
              <span className="truncate">{item.label}</span>
              {item.soon && (
                <span className="ml-auto shrink-0 rounded-xs bg-warn/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-warn">
                  Soon
                </span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}

/** Primary routes, then the section cuts beneath a divider. */
export function RailLinks({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <RailLink
            key={item.path}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* Sections are cuts of the same board, so they sit under a divider
          rather than mixed in with the primary destinations. */}
      <div className="mt-4 border-t border-line pt-3">
        {!collapsed && (
          <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-dim">
            Sections
          </p>
        )}
        <div className="space-y-0.5">
          {SECTION_ITEMS.map((item) => (
            <RailLink
              key={item.path}
              item={item}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/** Account and settings, pinned to the bottom of both presentations. */
export function RailFooter({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <AccountLink collapsed={collapsed} />

      <NavLink
        to="/settings"
        onClick={onNavigate}
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
    </>
  );
}
