import { useMemo } from 'react';

export function useDateRangeFilter(period: string | undefined) {
  return useMemo(() => {
    if (!period || period === 'all') {
      return { where: undefined };
    }

    // Round to start of current day to keep the timestamp stable
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let daysAgo = 0;
    switch (period) {
      case 'daily':
        daysAgo = 1;
        break;
      case 'weekly':
        daysAgo = 7;
        break;
      case 'monthly':
        daysAgo = 30;
        break;
      default:
        return { where: undefined };
    }

    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return { where: { playedTime: { gte: startDate.toISOString() } } };
  }, [period]);
}
