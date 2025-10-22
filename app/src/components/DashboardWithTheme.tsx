import { ThemeProvider } from "@/providers/ThemeProvider";
import Dashboard from "@/components/stats/Dashboard";

export default function DashboardWithTheme() {
  return (
    <ThemeProvider>
      <Dashboard />
    </ThemeProvider>
  );
}
