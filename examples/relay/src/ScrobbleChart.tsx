import { graphql, useFragment } from "react-relay";
import { useMemo } from "react";
import type { ScrobbleChart_data$key } from "./__generated__/ScrobbleChart_data.graphql";

interface ScrobbleChartProps {
  queryRef: ScrobbleChart_data$key;
}

export default function ScrobbleChart({ queryRef }: ScrobbleChartProps) {
  const data = useFragment(
    graphql`
      fragment ScrobbleChart_data on Query {
        chartData: fmTealAlphaFeedPlayAggregate(
          groupBy: [playedTime_day]
          where: $chartWhere
          limit: 90
        ) {
          groups {
            playedTime
            count
          }
        }
      }
    `,
    queryRef,
  );

  const chartData = useMemo(() => {
    if (!data?.chartData?.groups) return [];

    // Convert aggregated data to chart format
    const aggregated = data.chartData.groups.map((item) => {
      // playedTime comes back as '2025-08-03 00:00:00', extract just the date part
      const date = item.playedTime ? item.playedTime.split(" ")[0] : "";
      return {
        date,
        count: item.count,
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    // Fill in missing days with zero counts
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const filledData = [];

    for (let i = 89; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const existing = aggregated.find((d) => d.date === dateStr);
      filledData.push({
        date: dateStr,
        count: existing ? existing.count : 0,
      });
    }

    return filledData;
  }, [data?.chartData?.groups]);

  if (!chartData || chartData.length === 0) return null;

  const width = 1000;
  const height = 100;
  const padding = { top: 0, right: 0, bottom: 0, left: 0 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxCount = Math.max(...chartData.map((d) => d.count));
  const minCount = Math.min(...chartData.map((d) => d.count));
  const range = maxCount - minCount || 1;

  // Generate points for the line
  const points = chartData.map((d, i) => {
    const x = padding.left + (i / (chartData.length - 1)) * chartWidth;
    const y = padding.top + chartHeight -
      ((d.count - minCount) / range) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  // Generate area path
  const areaPoints = [
    `${padding.left},${padding.top + chartHeight}`,
    ...chartData.map((d, i) => {
      const x = padding.left + (i / (chartData.length - 1)) * chartWidth;
      const y = padding.top + chartHeight -
        ((d.count - minCount) / range) * chartHeight;
      return `${x},${y}`;
    }),
    `${padding.left + chartWidth},${padding.top + chartHeight}`,
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      {/* Area fill */}
      <polygon
        points={areaPoints}
        fill="rgb(139 92 246 / 0.1)"
        stroke="none"
      />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="rgb(139 92 246)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
