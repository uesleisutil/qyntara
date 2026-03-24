const BACKTEST_CACHE_KEY = 'b3tr_backtest_result';

export const saveBacktestResult = (result: any, config: any) => {
  try {
    localStorage.setItem(BACKTEST_CACHE_KEY, JSON.stringify({
      result, config, savedAt: new Date().toISOString(),
    }));
  } catch { /* quota exceeded — ignore */ }
};

export const loadBacktestResult = (): { result: any; config: any; savedAt: string } | null => {
  try {
    const saved = localStorage.getItem(BACKTEST_CACHE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
};

export const clearBacktestResult = () => {
  localStorage.removeItem(BACKTEST_CACHE_KEY);
};
