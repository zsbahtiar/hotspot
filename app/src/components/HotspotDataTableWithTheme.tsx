import { ThemeProvider } from "@/providers/ThemeProvider";
import HotspotDataTable from "@/components/data/HotspotDataTable";

export default function HotspotDataTableWithTheme() {
  return (
    <ThemeProvider>
      <HotspotDataTable />
    </ThemeProvider>
  );
}
