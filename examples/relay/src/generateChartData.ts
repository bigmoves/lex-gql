export interface DataPoint {
  date: string;
  count: number;
}

export function generateChartData(
  plays: readonly { readonly playedTime?: string | null; readonly [key: string]: any }[],
  days = 90
): DataPoint[] {
  const counts = new Map<string, number>();
  const now = new Date();

  // Initialize last N days with 0 counts
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split("T")[0];
    counts.set(dateStr, 0);
  }

  // Count plays per day
  plays.forEach((play) => {
    if (play?.playedTime) {
      const date = new Date(play.playedTime);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split("T")[0];
      if (counts.has(dateStr)) {
        counts.set(dateStr, (counts.get(dateStr) || 0) + 1);
      }
    }
  });

  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
