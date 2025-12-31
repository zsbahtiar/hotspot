import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const Navbar = () => {
  const [pathname, setPathname] = useState("/");
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Suppress hydration warnings
    const suppressHydration = () => {
      const originalError = console.error;
      console.error = (...args) => {
        if (
          typeof args[0] === "string" &&
          args[0].includes("Hydration failed")
        ) {
          return;
        }
        originalError(...args);
      };
      return () => {
        console.error = originalError;
      };
    };

    const cleanup = suppressHydration();

    setMounted(true);
    setPathname(window.location.pathname);

    return cleanup;
  }, []);

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  if (!mounted) {
    return (
      <nav className="bg-background/80 backdrop-blur-xl border-b border-border/60 fixed w-full top-0 z-[99999] shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-8 h-8 bg-muted rounded-lg animate-pulse"></div>
              <div>
                <div className="h-4 w-32 bg-muted rounded animate-pulse mb-1"></div>
                <div className="h-3 w-24 bg-muted/50 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-muted rounded-xl animate-pulse"></div>
              <div className="w-10 h-10 bg-muted rounded-xl animate-pulse md:hidden"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-background/80 backdrop-blur-xl border-b border-border/60 fixed w-full top-0 z-[99999] shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <a href="/" className="flex items-center space-x-3 min-w-0 group" title="OLAP Hotspot - Beranda">
            <div className="relative">
              <img
                src="/assets/ipb.webp"
                alt="Logo"
                width={32}
                height={32}
                className="flex-shrink-0 rounded-lg transition-transform duration-200 group-hover:scale-105"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground truncate">
                Hotspot Karhutla
              </h1>
              <p className="text-xs text-muted-foreground">
                Monitoring System
              </p>
            </div>
          </a>

          <div className="hidden md:flex items-center space-x-2">
            <a
              href="/"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname === "/" || pathname === ""
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title="Halaman Beranda"
            >
              Beranda
            </a>

            <a
              href="/map"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname === "/map" || pathname === "/map/"
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title="Lihat Peta Hotspot"
            >
              Peta
            </a>
            <a
              href="/data"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname === "/data"
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title="Lihat Data Tabel Hotspot"
            >
              Data
            </a>
            <a
              href="/about"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname === "/about"
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title="Tentang Sistem"
            >
              Tentang
            </a>
          </div>

          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMenu}
              className="md:hidden rounded-xl hover:bg-secondary transition-colors duration-200"
              aria-label="Toggle menu"
              aria-expanded={isOpen}
            >
              {isOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-[1099]"
          onClick={closeMenu}
        />
      )}

      {isOpen && (
        <div
          className="md:hidden absolute top-16 left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border/60 z-[100000] rounded-b-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-6 space-y-2">
            <a
              href="/"
              onClick={closeMenu}
              className={`block w-full px-4 py-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname === "/"
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Halaman Beranda"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                <span className="ml-1">Beranda</span>
              </div>
            </a>
            <a
              href="/map"
              onClick={closeMenu}
              className={`block w-full px-4 py-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname === "/map"
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Lihat Peta Hotspot"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                <span className="ml-1">Peta</span>
              </div>
            </a>
            <a
              href="/data"
              onClick={closeMenu}
              className={`block w-full px-4 py-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname === "/data"
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Lihat Data Tabel Hotspot"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v6m10 0v1a1 1 0 01-1 1H9a1 1 0 01-1-1v-1m4-4V4a1 1 0 00-1-1h-2a1 1 0 00-1 1v4"
                  />
                </svg>
                <span className="ml-1">Data</span>
              </div>
            </a>
            <a
              href="/about"
              onClick={closeMenu}
              className={`block w-full px-4 py-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                pathname === "/about"
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Tentang Sistem"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="ml-1">Tentang</span>
              </div>
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
