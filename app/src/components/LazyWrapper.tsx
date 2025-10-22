import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function LazyWrapper({
  children,
  fallback = (
    <div className="flex items-center justify-center min-h-[200px] bg-muted/10 rounded-lg">
      <Loader2 className="animate-spin h-6 w-6 text-muted-foreground mr-2" />
      <span className="text-muted-foreground">Memuat...</span>
    </div>
  )
}: LazyWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}