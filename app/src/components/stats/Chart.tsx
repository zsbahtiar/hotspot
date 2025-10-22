import { useMemo } from "react";
import {
  Chart as ChartJS,
  Tooltip as ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
} from "chart.js";
import { Line } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { formatNumber } from "@/core/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";

ChartJS.register(
  ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ChartDataLabels,
);

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    borderWidth: number;
    pointBackgroundColor: string;
    pointBorderColor: string;
    pointBorderWidth: number;
    pointRadius: number;
    tension: number;
    fill: boolean;
  }>;
}

interface ChartComponentProps {
  chartData: ChartData;
  isLoading: boolean;
}

const ChartComponent = ({ chartData, isLoading }: ChartComponentProps) => {
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 35,
          bottom: 15,
        },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            font: {
              size: 10,
            },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (tickValue: string | number) {
              return typeof tickValue === "number"
                ? tickValue.toLocaleString("id-ID")
                : tickValue;
            },
          },
        },
      },
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            boxWidth: 12,
            padding: 10,
          },
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              return `${context.label}: ${formatNumber(context.raw as number)} hotspot`;
            },
          },
        },
        datalabels: {
          display: true,
          color: (context: any) => {
            const isDark = document.documentElement.classList.contains("dark");
            return isDark ? "#e5e7eb" : "#1f2937";
          },
          anchor: "end" as const,
          align: "top" as const,
          offset: 5,
          formatter: (value: number) => formatNumber(value),
          font: {
            weight: "bold" as const,
            size: 10,
          },
          clamp: true,
        },
      },
    }),
    [],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 w-full">
        <Skeleton className="h-4 w-3/4 mx-auto" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
      </div>
    );
  }

  if (chartData?.datasets?.[0].data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-muted-foreground">Tidak ada data untuk grafik</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4">
      <Line data={chartData} options={chartOptions} />
    </div>
  );
};

export default ChartComponent;
