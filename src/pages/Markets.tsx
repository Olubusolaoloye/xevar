import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Search, TrendingUp, TrendingDown, Star } from 'lucide-react';
import { motion } from 'motion/react';

export function Markets() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { markets } = useStore();

  const filteredMarkets = markets.filter((coin) =>
    coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Market Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track top cryptocurrencies and market trends.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search coins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900 border-blue-100 dark:border-blue-900/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">Top Gainer</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Last 24 hours</p>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">SOL</p>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">+8.5%</p>
                </div>
                <img src="https://cryptologos.cc/logos/solana-sol-logo.svg?v=032" alt="Solana" className="w-12 h-12 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-slate-900 border-red-100 dark:border-red-900/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">Top Loser</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Last 24 hours</p>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">DOGE</p>
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">-4.2%</p>
                </div>
                <img src="https://cryptologos.cc/logos/dogecoin-doge-logo.svg?v=032" alt="Dogecoin" className="w-12 h-12 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
          <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900 border-amber-100 dark:border-amber-900/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">Trending</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Most searched</p>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">ETH</p>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">+5.1%</p>
                </div>
                <img src="https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032" alt="Ethereum" className="w-12 h-12 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Cryptocurrencies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">24h Change</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Market Cap</TableHead>
                <TableHead className="text-right hidden md:table-cell">Volume (24h)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMarkets.map((coin, index) => (
                <motion.tr
                  key={coin.id}
                  onClick={() => navigate(`/markets/${coin.id}`)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="border-b border-slate-50 dark:border-slate-800/50 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer group"
                >
                  <TableCell className="text-center text-slate-400 dark:text-slate-500 font-medium">{coin.rank}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img src={coin.icon} alt={coin.name} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 p-1" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-50">{coin.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{coin.symbol}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium dark:text-slate-300">
                    ${coin.price.toLocaleString(undefined, { minimumFractionDigits: coin.price < 1 ? 4 : 2, maximumFractionDigits: coin.price < 1 ? 4 : 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${coin.change24h >= 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                      {coin.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(coin.change24h).toFixed(2)}%
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                    ${coin.marketCap}B
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-600 dark:text-slate-400 hidden md:table-cell">
                    ${coin.volume24h}B
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
