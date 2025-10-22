import { ThemeProvider } from "@/providers/ThemeProvider";
import Navbar from "@/components/layout/Navbar";

export default function NavbarWithTheme() {
  return (
    <ThemeProvider>
      <Navbar />
    </ThemeProvider>
  );
}
