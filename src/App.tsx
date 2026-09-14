import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Overview } from '@/pages/Overview';
import { Screener } from '@/pages/Screener';
import { PairDetail } from '@/pages/PairDetail';
import { Watchlist } from '@/pages/Watchlist';
import { Portfolio } from '@/pages/Portfolio';
import { Alerts } from '@/pages/Alerts';
import { Settings } from '@/pages/Settings';
import { Admin } from '@/pages/Admin';
import { Section } from '@/pages/Section';
import { MultiChart } from '@/pages/MultiChart';
import { NotFound } from '@/pages/NotFound';

export default function App() {
  return (
    /**
     * The router has to know where the app is mounted. On a host that serves
     * from a subpath (GitHub Pages project sites live at /<repo>/), leaving
     * this at "/" means no route ever matches and every page renders the 404.
     * Vite substitutes BASE_URL at build time from the `base` config.
     */
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="screener" element={<Screener />} />
          <Route path="pair/:pairId" element={<PairDetail />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="sections/:sectionId" element={<Section />} />
          <Route path="multichart" element={<MultiChart />} />
          <Route path="admin" element={<Admin />} />
          <Route path="settings" element={<Settings />} />
          <Route path="404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
