import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import Dashboard from "@/components/stats/Dashboard";

interface DashboardWithThemeProps {
  showMitigation?: boolean;
  currentYear?: number;
}

export default function DashboardWithTheme({ showMitigation = true, currentYear }: DashboardWithThemeProps) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <Dashboard showHero={false} showMitigation={showMitigation} currentYear={currentYear} />
      </ThemeProvider>
    </QueryProvider>
  );
}
