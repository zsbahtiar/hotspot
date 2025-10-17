import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

interface StatsSkeletonProps {
  count?: number;
}

export const StatsSkeleton = ({ count = 3 }: StatsSkeletonProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 text-center">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="p-6 animate-pulse">
          <div className="text-4xl font-bold mb-2 h-12 bg-gray-200 rounded w-24 mx-auto"></div>
          <div className="text-lg h-6 bg-gray-200 rounded w-32 mx-auto mt-3"></div>
        </div>
      ))}
    </div>
  );
};

interface CardSkeletonProps {
  count?: number;
}

export const CardSkeleton = ({ count = 1 }: CardSkeletonProps) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="p-3 rounded-full bg-gray-200 animate-pulse w-12 h-12"></div>
              <div className="h-6 bg-gray-200 rounded w-48 ml-3 animate-pulse"></div>
            </div>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

interface ChartSkeletonProps {}

export const ChartSkeleton = () => {
  return (
    <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
      <div className="flex flex-col items-center justify-center py-16">
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          size="3x"
          className="text-green-600 mb-4"
        />
        <p className="text-gray-700">Memuat grafik...</p>
      </div>
    </div>
  );
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton = ({ rows = 10, columns = 8 }: TableSkeletonProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

export const LoadingSpinner = ({ size = "md", text = "Memuat data..." }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-3xl",
    lg: "text-5xl"
  };

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <FontAwesomeIcon
        icon={faSpinner}
        spin
        size={size === "sm" ? "2x" : size === "md" ? "3x" : "5x"}
        className="text-green-600 mb-4"
      />
      <p className="text-gray-700">{text}</p>
    </div>
  );
};

interface HeroSkeletonProps {}

export const HeroSkeleton = () => {
  return (
    <section className="relative w-full h-screen min-h-[600px] pt-24">
      <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>
      <div className="relative z-10 w-full max-w-6xl mx-auto h-full flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-3xl space-y-6">
          <div className="h-16 bg-gray-300 rounded w-3/4 mx-auto animate-pulse"></div>
          <div className="h-8 bg-gray-300 rounded w-full animate-pulse"></div>
          <div className="h-8 bg-gray-300 rounded w-5/6 mx-auto animate-pulse"></div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <div className="h-16 bg-gray-300 rounded w-48 animate-pulse"></div>
            <div className="h-16 bg-gray-300 rounded w-48 animate-pulse"></div>
          </div>
        </div>
      </div>
    </section>
  );
};