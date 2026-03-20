import { useMemo, useRef, useEffect } from "react";
import {
  Chart as ChartJS,
  Tooltip as ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { formatNumber } from "@/core/utils/formatters";

ChartJS.register(
  ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ChartDataLabels,
  Filler,
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
          top: 10,
          bottom: 0,
          left: 0,
          right: 10,
        },
      },
      interaction: {
        intersect: false,
        mode: "index" as const,
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
          ticks: {
            maxRotation: 0,
            minRotation: 0,
            font: {
              size: 9,
              family: "'Libre Franklin', sans-serif",
            },
            color: "#9ca896",
            padding: 8,
          },
        },
        y: {
          beginAtZero: true,
          position: "left" as const,
          border: {
            display: false,
          },
          grid: {
            color: "rgba(212, 221, 208, 0.4)",
            drawTicks: false,
          },
          ticks: {
            maxTicksLimit: 5,
            font: {
              size: 9,
              family: "'Libre Franklin', sans-serif",
            },
            color: "#9ca896",
            padding: 10,
            callback: function (tickValue: string | number) {
              if (typeof tickValue === "number") {
                if (tickValue >= 1000) {
                  return (tickValue / 1000).toFixed(1) + "K";
                }
                return tickValue.toString();
              }
              return tickValue;
            },
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "white",
          titleColor: "#192d17",
          bodyColor: "#192d17",
          borderColor: "#d4ddd0",
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            title: function (context: any) {
              return context[0].label + ": " + formatNumber(context[0].raw as number);
            },
            label: function () {
              return "";
            },
          },
        },
        datalabels: {
          display: false,
        },
      },
    }),
    [],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <div className="w-5 h-5 border-2 border-[#d4ddd0] border-t-[#3d6b35] rounded-full animate-spin mb-2"></div>
        <p className="text-[0.75rem] text-[#6b7a64]">Memuat grafik...</p>
      </div>
    );
  }

  if (chartData?.datasets?.[0].data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-[0.8rem] text-[#6b7a64]">Tidak ada data untuk grafik</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <Line data={chartData} options={chartOptions} />
    </div>
  );
};

export default ChartComponent;
