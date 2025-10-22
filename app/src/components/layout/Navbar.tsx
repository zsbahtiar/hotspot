import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
        if (typeof args[0] === 'string' && args[0].includes('Hydration failed')) {
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

  const linkClass = (path: string, currentPath: string) =>
    cn(
      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
      currentPath === path
        ? "text-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-muted",
    );

  if (!mounted) {
    return (
      <nav className="bg-background/80 backdrop-blur-sm border-b border-border fixed w-full top-0 z-[99999]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-6 h-6 bg-muted rounded animate-pulse"></div>
              <div className="h-4 w-32 bg-muted rounded animate-pulse"></div>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-8 h-8 bg-muted rounded animate-pulse"></div>
              <div className="w-8 h-8 bg-muted rounded animate-pulse md:hidden"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-background/80 backdrop-blur-sm border-b border-border fixed w-full top-0 z-[99999]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          <a href="/" className="flex items-center space-x-2 min-w-0">
            <img
              src="/assets/ipb.webp"
              alt="Logo"
              width={24}
              height={24}
              className="flex-shrink-0"
            />
            <h1 className="text-sm font-semibold truncate">Hotspot Karhutla</h1>
          </a>

          <div className="hidden md:flex items-center space-x-1">
            <a href="/" className={linkClass("/", pathname)}>
              Beranda
            </a>
            <a href="/map" className={linkClass("/map", pathname)}>
              Map
            </a>
            <a href="/data" className={linkClass("/data", pathname)}>
              Data
            </a>
            <a href="/about" className={linkClass("/about", pathname)}>
              Tentang
            </a>
          </div>

          <div className="flex items-center space-x-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMenu}
              className="md:hidden"
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
          className="md:hidden fixed inset-0 bg-black/50 z-[1099]"
          onClick={closeMenu}
        />
      )}

      {isOpen && (
        <div
          className="md:hidden absolute top-14 left-0 right-0 bg-background border-b border-border shadow-lg z-[100000]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 space-y-0.5">
            <a
              href="/"
              onClick={closeMenu}
              className={linkClass("/", pathname) + " block w-full"}
            >
              Beranda
            </a>
            <a
              href="/map"
              onClick={closeMenu}
              className={linkClass("/map", pathname) + " block w-full"}
            >
              Map
            </a>
            <a
              href="/data"
              onClick={closeMenu}
              className={linkClass("/data", pathname) + " block w-full"}
            >
              Data
            </a>
            <a
              href="/about"
              onClick={closeMenu}
              className={linkClass("/about", pathname) + " block w-full"}
            >
              Tentang
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
