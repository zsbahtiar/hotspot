import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeProvider } from "@/providers/ThemeProvider";

const OlapComponent = lazy(() => import("@/components/olap/OlapVisualization"));

export default function Olaps() {
  return (
    <ThemeProvider>
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-screen bg-white dark:bg-gray-900">
            <div className="space-y-4 w-full max-w-md px-4">
              <Skeleton className="h-8 w-3/4 mx-auto bg-gray-200 dark:bg-gray-700" />
              <Skeleton className="h-64 w-full bg-gray-200 dark:bg-gray-700" />
              <Skeleton className="h-4 w-1/2 mx-auto bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        }
      >
        <OlapComponent />
      </Suspense>
    </ThemeProvider>
  );
}
