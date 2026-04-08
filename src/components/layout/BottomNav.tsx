import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, LineChart, Lightbulb, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Markets', path: '/markets', icon: LineChart },
  { name: 'Home', path: '/', icon: LayoutDashboard },
  { name: 'Wallets', path: '/wallets', icon: Wallet },
  { name: 'Insights', path: '/insights', icon: Lightbulb },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50 px-6 py-3 flex justify-between items-center pb-safe transition-colors duration-300">
      {navItems.map((item) => (
        <NavLink
          key={item.name}
          to={item.path}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 p-2 rounded-xl transition-colors',
              isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            )
          }
        >
          <item.icon className="w-6 h-6" />
          <span className="text-[10px] font-medium">{item.name}</span>
        </NavLink>
      ))}
    </nav>
  );
}
