import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryProvider } from "@/providers/QueryProvider";

const OlapComponent = lazy(() => import("@/components/olap/OlapVisualization"));

export default function Olaps() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <Suspense
          fallback={
            <div className="flex justify-center items-center h-screen bg-background">
              <div className="space-y-4 w-full max-w-md px-4">
                <Skeleton className="h-8 w-3/4 mx-auto" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-4 w-1/2 mx-auto" />
              </div>
            </div>
          }
        >
          <OlapComponent />
        </Suspense>
      </ThemeProvider>
    </QueryProvider>
  );
}
