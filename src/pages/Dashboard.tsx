import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownRight, Wallet, Activity } from 'lucide-react';

const COLORS = ['#1E3A8A', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];

export function Dashboard() {
  const { tokens, history, currency } = useStore();

  const totalValue = tokens.reduce((acc, token) => acc + token.value, 0);
  const totalChange = tokens.reduce((acc, token) => acc + (token.value * token.change) / 100, 0);
  const changePercentage = (totalChange / (totalValue - totalChange)) * 100;

  const chainData = tokens.reduce((acc, token) => {
    const existing = acc.find(c => c.name === token.chain);
    if (existing) {
      existing.value += token.value;
    } else {
      acc.push({ name: token.chain, value: token.value });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-1"
        >
          <Card className="h-full bg-gradient-to-br from-blue-900 to-blue-800 text-white border-none">
            <CardContent className="p-8 flex flex-col justify-between h-full">
              <div>
                <p className="text-blue-200 font-medium mb-2 flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Total Balance
                </p>
                <h2 className="text-4xl font-bold tracking-tight mb-4">
                  {currency === 'USD' ? '$' : '₦'}
                  {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${changePercentage >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                  {changePercentage >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {Math.abs(changePercentage).toFixed(2)}% (24h)
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-blue-700/50">
                <select className="w-full bg-blue-800/50 border border-blue-700 text-white rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option>All Wallets</option>
                  <option>Main Wallet</option>
                  <option>DeFi Wallet</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Portfolio Performance
              </CardTitle>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {['24H', '7D', '30D', 'ALL'].map((filter) => (
                  <button
                    key={filter}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === '30D' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50'}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[240px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={['dataMin - 1000', 'dataMax + 1000']} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-lg">
                              <p className="text-slate-400 text-xs mb-1">{label}</p>
                              <p className="text-white font-semibold">
                                ${Number(payload[0].value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle>Your Assets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token) => (
                    <TableRow key={token.id} className="group cursor-pointer">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img src={token.icon} alt={token.name} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 p-1" />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-50">{token.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{token.symbol} • {token.chain}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium dark:text-slate-300">${token.price.toLocaleString()}</div>
                        <div className={`text-xs ${token.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {token.change >= 0 ? '+' : ''}{token.change}%
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium dark:text-slate-300">
                        {token.balance.toLocaleString()} {token.symbol}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900 dark:text-slate-50">
                        ${token.value.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="lg:col-span-1"
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Chain Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center">
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chainData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chainData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--tw-colors-slate-900)', 
                        borderColor: 'var(--tw-colors-slate-800)',
                        borderRadius: '0.75rem',
                        color: '#fff'
                      }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => `$${value.toLocaleString()}`} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full mt-6 space-y-3">
                {chainData.map((chain, index) => (
                  <div key={chain.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{chain.name}</span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      {((chain.value / totalValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
