import { ThemeProvider } from "@/providers/ThemeProvider";
import Dashboard from "@/components/stats/Dashboard";

interface DashboardWithThemeProps {
  showMitigation?: boolean;
}

export default function DashboardWithTheme({ showMitigation = true }: DashboardWithThemeProps) {
  return (
    <ThemeProvider>
      <Dashboard showHero={false} showMitigation={showMitigation} />
    </ThemeProvider>
  );
}
