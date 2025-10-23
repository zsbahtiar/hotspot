// DashboardContent.tsx - Dashboard without hero section for better performance
import Dashboard from "@/components/stats/Dashboard";

// Wrapper component that only loads the dashboard content (no hero section)
export default function DashboardContent() {
  return <Dashboard showHero={false} />;
}
