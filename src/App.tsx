/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useStore } from './store/useStore';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Wallets } from './pages/Wallets';
import { Markets } from './pages/Markets';
import { Insights } from './pages/Insights';
import { Alerts } from './pages/Alerts';
import { Settings } from './pages/Settings';
import { CryptoDetails } from './pages/CryptoDetails';

export default function App() {
  const { theme, updatePrices } = useStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Fetch real-time prices via WebSocket (which TradingView uses for its default crypto feeds)
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connectWebSocket = () => {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const priceMap: Record<string, { price: number, change24h: number, volume24h: number }> = {};
          
          data.forEach((ticker: any) => {
            priceMap[ticker.s] = {
              price: parseFloat(ticker.c),
              change24h: parseFloat(ticker.P),
              volume24h: parseFloat(ticker.q)
            };
          });
          
          updatePrices(priceMap);
        } catch (error) {
          console.error('Error parsing WebSocket data:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed. Reconnecting in 5s...');
        reconnectTimer = setTimeout(connectWebSocket, 5000);
      };
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.close();
      }
    };
  }, [updatePrices]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="wallets" element={<Wallets />} />
          <Route path="markets" element={<Markets />} />
          <Route path="markets/:id" element={<CryptoDetails />} />
          <Route path="insights" element={<Insights />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
