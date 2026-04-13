type TrendMetric = "gmv" | "orders" | "producers";

type TrendPoint = {
  day: string;
  gmv: number;
  label: string;
  orders: number;
  producers: number;
};

type AdminTrendChartProps = {
  metric: TrendMetric;
  points: TrendPoint[];
};

const metricLabelMap: Record<TrendMetric, string> = {
  gmv: "Vendas",
  orders: "Pedidos",
  producers: "Produtores",
};

function formatMetricValue(metric: TrendMetric, value: number) {
  if (metric === "gmv") {
    return new Intl.NumberFormat("pt-BR", {
      currency: "BRL",
      maximumFractionDigits: 0,
      style: "currency",
    }).format(value);
  }

  return new Intl.NumberFormat("pt-BR").format(value);
}

export function AdminTrendChart({ metric, points }: AdminTrendChartProps) {
  const chartHeight = 240;
  const chartWidth = 640;
  const padding = 20;
  const values = points.map((point) => point[metric]);
  const maxValue = Math.max(...values, 1);
  const stepX =
    points.length > 1
      ? (chartWidth - padding * 2) / (points.length - 1)
      : chartWidth / 2;
  const coordinates = points.map((point, index) => {
    const ratio = point[metric] / maxValue;
    const x = padding + stepX * index;
    const y = chartHeight - padding - ratio * (chartHeight - padding * 2);

    return {
      label: point.label,
      value: point[metric],
      x,
      y,
    };
  });
  const linePath = coordinates
    .map(
      (coordinate, index) =>
        `${index === 0 ? "M" : "L"} ${coordinate.x.toFixed(2)} ${coordinate.y.toFixed(2)}`,
    )
    .join(" ");
  const firstPoint = coordinates[0];
  const lastPoint = coordinates[coordinates.length - 1];
  const areaPath = `${linePath} L ${lastPoint?.x ?? 0} ${chartHeight - padding} L ${firstPoint?.x ?? 0} ${chartHeight - padding} Z`;
  const guideValues = [1, 0.66, 0.33, 0].map((ratio) => ({
    label: formatMetricValue(metric, maxValue * ratio),
    y: chartHeight - padding - ratio * (chartHeight - padding * 2),
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-forest/10 bg-cream/55 px-4 py-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
            Pico
          </p>
          <p className="mt-2 font-display text-2xl font-black tracking-[-0.04em] text-soil">
            {formatMetricValue(metric, maxValue)}
          </p>
        </div>
        <div className="rounded-[22px] border border-forest/10 bg-cream/55 px-4 py-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
            Ultimo ponto
          </p>
          <p className="mt-2 font-display text-2xl font-black tracking-[-0.04em] text-soil">
            {formatMetricValue(metric, lastPoint?.value ?? 0)}
          </p>
        </div>
        <div className="rounded-[22px] border border-forest/10 bg-cream/55 px-4 py-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
            Serie
          </p>
          <p className="mt-2 font-display text-2xl font-black tracking-[-0.04em] text-soil">
            {metricLabelMap[metric]}
          </p>
        </div>
      </div>

      <div className="rounded-[26px] border border-forest/10 bg-white p-4">
        <div className="relative">
          <svg
            aria-label={`Tendencia de ${metricLabelMap[metric].toLowerCase()}`}
            className="h-auto w-full"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          >
            <defs>
              <linearGradient id="admin-trend-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(75, 132, 92, 0.28)" />
                <stop offset="100%" stopColor="rgba(75, 132, 92, 0.02)" />
              </linearGradient>
            </defs>

            {guideValues.map((guide) => (
              <g key={guide.y}>
                <line
                  stroke="rgba(13, 51, 33, 0.08)"
                  strokeDasharray="4 8"
                  strokeWidth="1"
                  x1={padding}
                  x2={chartWidth - padding}
                  y1={guide.y}
                  y2={guide.y}
                />
                <text
                  fill="rgba(59, 72, 63, 0.72)"
                  fontFamily="var(--font-sans, sans-serif)"
                  fontSize="11"
                  textAnchor="end"
                  x={chartWidth - padding}
                  y={guide.y - 6}
                >
                  {guide.label}
                </text>
              </g>
            ))}

            <path d={areaPath} fill="url(#admin-trend-fill)" />
            <path
              d={linePath}
              fill="none"
              stroke="rgb(31, 84, 51)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />

            {coordinates.map((coordinate) => (
              <g key={`${coordinate.label}-${coordinate.x}`}>
                <circle
                  cx={coordinate.x}
                  cy={coordinate.y}
                  fill="white"
                  r="5"
                  stroke="rgb(31, 84, 51)"
                  strokeWidth="2"
                />
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center sm:grid-cols-7">
          {points
            .filter((_, index) => {
              if (points.length <= 7) {
                return true;
              }

              return (
                index % Math.ceil(points.length / 7) === 0 ||
                index === points.length - 1
              );
            })
            .map((point) => (
              <div
                key={point.day}
                className="rounded-[16px] bg-cream/45 px-2 py-2"
              >
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-bark/58">
                  {point.label}
                </p>
                <p className="mt-1 font-sans text-xs font-semibold text-soil">
                  {formatMetricValue(metric, point[metric])}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
