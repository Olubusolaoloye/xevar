import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowLeft, TrendingUp, TrendingDown, ExternalLink, Star, Share, Bell, Info, ArrowDownUp, Settings2 } from 'lucide-react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';

export function CryptoDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { markets, theme } = useStore();
  const [showSwap, setShowSwap] = useState(false);
  const [swapAmount, setSwapAmount] = useState('');
  const [timeframe, setTimeframe] = useState('1D');
  const [flash, setFlash] = useState('');
  const [prevPrice, setPrevPrice] = useState(0);

  const coin = markets.find((m) => m.id === id);

  useEffect(() => {
    if (coin && coin.price !== prevPrice) {
      if (prevPrice !== 0) {
        setFlash(coin.price > prevPrice ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400');
        const timer = setTimeout(() => setFlash(''), 1000);
        setPrevPrice(coin.price);
        return () => clearTimeout(timer);
      } else {
        setPrevPrice(coin.price);
      }
    }
  }, [coin?.price, prevPrice]);

  if (!coin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Coin not found</h2>
        <button
          onClick={() => navigate('/markets')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Back to Markets
        </button>
      </div>
    );
  }

  const isPositive = coin.change24h >= 0;
  const tradingViewSymbol = `BINANCE:${coin.symbol}USDT`;

  const getInterval = (tf: string) => {
    switch(tf) {
      case '1D': return '15';
      case '7D': return '60';
      case '1M': return 'D';
      case '1Y': return 'W';
      case 'ALL': return 'M';
      default: return 'D';
    }
  };

  const handleSwap = () => {
    alert(`Simulating swap via Uniswap/PancakeSwap router for ${swapAmount} ${coin.symbol}`);
    setShowSwap(false);
    setSwapAmount('');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Navigation & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/markets')}
          className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Markets
        </button>
        <div className="flex items-center gap-2">
          <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <Star className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <Share className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <img src={coin.icon} alt={coin.name} className="w-16 h-16 rounded-full" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">{coin.name}</h1>
              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg">
                {coin.symbol}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">Rank #{coin.rank}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">Coin</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:items-end">
          <div className={`text-4xl font-bold transition-colors duration-300 ${flash || 'text-slate-900 dark:text-slate-50'}`}>
            ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </div>
          <div className={`flex items-center gap-1 text-lg font-medium mt-1 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {Math.abs(coin.change24h).toFixed(2)}% (1d)
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm">
              Buy
            </button>
            <button 
              onClick={() => setShowSwap(!showSwap)}
              className="px-6 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-50 rounded-xl font-medium transition-colors shadow-sm"
            >
              Swap
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Chart & About */}
        <div className="lg:col-span-2 space-y-6">
          {showSwap && (
            <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-900/10 dark:to-slate-900">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Swap {coin.symbol}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-md">Uniswap V3</span>
                  <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">You pay</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Balance: 0.00</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <input 
                      type="number" 
                      placeholder="0.0" 
                      className="bg-transparent text-2xl font-semibold outline-none w-1/2 dark:text-white"
                    />
                    <button className="flex items-center gap-2 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 font-medium">
                      <img src="https://cryptologos.cc/logos/tether-usdt-logo.svg?v=032" alt="USDT" className="w-5 h-5" />
                      USDT
                    </button>
                  </div>
                </div>

                <div className="flex justify-center -my-2 relative z-10">
                  <button className="bg-white dark:bg-slate-800 p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <ArrowDownUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>

                <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">You receive</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Balance: 0.00</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <input 
                      type="number" 
                      value={swapAmount}
                      onChange={(e) => setSwapAmount(e.target.value)}
                      placeholder="0.0" 
                      className="bg-transparent text-2xl font-semibold outline-none w-1/2 dark:text-white"
                    />
                    <button className="flex items-center gap-2 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 font-medium">
                      <img src={coin.icon} alt={coin.symbol} className="w-5 h-5 rounded-full" />
                      {coin.symbol}
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleSwap}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-colors shadow-sm"
                >
                  Swap
                </button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>{coin.name} Price Chart</CardTitle>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {['1D', '7D', '1M', '1Y', 'ALL'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${timeframe === tf ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] w-full mt-4 rounded-xl overflow-hidden">
                <AdvancedRealTimeChart
                  symbol={tradingViewSymbol}
                  theme={theme === 'dark' ? 'dark' : 'light'}
                  interval={getInterval(timeframe) as any}
                  autosize
                  hide_side_toolbar={false}
                  allow_symbol_change={false}
                  save_image={false}
                  backgroundColor={theme === 'dark' ? '#0f172a' : '#ffffff'}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About {coin.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
                <p>{coin.about}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Stats & Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{coin.symbol} Price Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  {coin.name} Price <Info className="w-4 h-4" />
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-50">${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">24h Low / 24h High</span>
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  ${(coin.price * 0.98).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} / ${(coin.price * 1.02).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Trading Volume (24h)</span>
                <span className="font-medium text-slate-900 dark:text-slate-50">${coin.volume24h}B</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Market Cap</span>
                <span className="font-medium text-slate-900 dark:text-slate-50">${coin.marketCap}B</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Circulating Supply</span>
                <span className="font-medium text-slate-900 dark:text-slate-50">{coin.circulatingSupply.toLocaleString()} {coin.symbol}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-slate-500 dark:text-slate-400">Max Supply</span>
                <span className="font-medium text-slate-900 dark:text-slate-50">{coin.maxSupply ? `${coin.maxSupply.toLocaleString()} ${coin.symbol}` : '∞'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Website</span>
                <a href="#" className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-50 rounded-lg text-sm font-medium transition-colors">
                  {coin.name.toLowerCase().replace(/\s+/g, '')}.org <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div>
                <span className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Explorers</span>
                <div className="flex flex-wrap gap-2">
                  <a href="#" className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-50 rounded-lg text-sm font-medium transition-colors">
                    Blockchain.com <ExternalLink className="w-3 h-3" />
                  </a>
                  <a href="#" className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-50 rounded-lg text-sm font-medium transition-colors">
                    Blockchair <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div>
                <span className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Community</span>
                <div className="flex flex-wrap gap-2">
                  <a href="#" className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-50 rounded-lg text-sm font-medium transition-colors">
                    Reddit <ExternalLink className="w-3 h-3" />
                  </a>
                  <a href="#" className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-50 rounded-lg text-sm font-medium transition-colors">
                    Twitter <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
