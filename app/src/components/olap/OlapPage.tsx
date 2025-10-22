import { useState, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeProvider } from "@/providers/ThemeProvider";

const OlapComponent = lazy(() => import("@/components/olap/OlapVisualization"));

export default function Olaps() {
  const [showPopup, setShowPopup] = useState(false);
  const [today, setToday] = useState("");

  useEffect(() => {
    const currentDate = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    setToday(currentDate);

    // Check localStorage if popup has been shown before
    const hasSeenPopup = localStorage.getItem("hasSeenDataInfoPopup");
    if (!hasSeenPopup) {
      setShowPopup(true);
    }
  }, []);

  const handleClosePopup = () => {
    localStorage.setItem("hasSeenDataInfoPopup", "true");
    setShowPopup(false);
  };

  return (
    <ThemeProvider>
      <div className="relative">
        {showPopup && (
          <div className="fixed inset-0 z-[40] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="max-w-md text-center shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl">Informasi Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-6">
                  Data yang ditampilkan pada sistem ini merupakan data dari
                  periode <strong>1 Januari 2015</strong> hingga{" "}
                  <strong>{today}</strong>.
                </p>
                <Button onClick={handleClosePopup}>Mengerti</Button>
              </CardContent>
            </Card>
          </div>
        )}

        <Suspense
          fallback={
            <div className="flex justify-center items-center h-screen">
              <div className="space-y-4 w-full max-w-md">
                <Skeleton className="h-8 w-3/4 mx-auto" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-4 w-1/2 mx-auto" />
              </div>
            </div>
          }
        >
          <OlapComponent />
        </Suspense>
      </div>
    </ThemeProvider>
  );
}
