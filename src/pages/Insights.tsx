import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Info, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Insights() {
  const { insights } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'info': return <Info className="w-6 h-6 text-blue-500" />;
      case 'idea': return <Lightbulb className="w-6 h-6 text-purple-500" />;
      default: return <Info className="w-6 h-6 text-slate-500 dark:text-slate-400" />;
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/50';
      case 'info': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/50';
      case 'idea': return 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/50';
      default: return 'bg-slate-50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">AI Insights</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Smart analysis of your portfolio to help you make better decisions.</p>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {insights.map((insight, index) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className={cn('overflow-hidden transition-all duration-300', getColorClass(insight.type))}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm">
                      {getIcon(insight.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{insight.title}</h3>
                          <p className="text-slate-600 dark:text-slate-300 mt-1">{insight.description}</p>
                        </div>
                        <button
                          onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
                          className="flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full shadow-sm transition-colors"
                        >
                          {expandedId === insight.id ? (
                            <>Close <ChevronUp className="w-4 h-4" /></>
                          ) : (
                            <>Explain <ChevronDown className="w-4 h-4" /></>
                          )}
                        </button>
                      </div>
                      
                      <AnimatePresence>
                        {expandedId === insight.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                {insight.explanation}
                              </p>
                              <div className="mt-4 flex gap-3">
                                <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                  Take Action
                                </button>
                                <button className="px-4 py-2 bg-transparent text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
