import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, LineChart, Lightbulb, Bell, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Markets', path: '/markets', icon: LineChart },
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Wallets', path: '/wallets', icon: Wallet },
  { name: 'Insights', path: '/insights', icon: Lightbulb },
  { name: 'Alerts', path: '/alerts', icon: Bell },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0 transition-colors duration-300">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-900 dark:text-blue-400 tracking-tight">Xevar</h1>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-50'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Need help?</p>
          <a href="#" className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">Contact Support</a>
        </div>
      </div>
    </aside>
  );
}
