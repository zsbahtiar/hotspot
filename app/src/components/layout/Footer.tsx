import { useState, useEffect } from 'react';

const Footer = () => {
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

    return cleanup;
  }, []);

  if (!mounted) {
    return (
      <footer className="bg-primary/5 border-t border-border text-muted-foreground text-center px-4 py-4">
        <p className="text-xs">Loading...</p>
      </footer>
    );
  }

  return (
    <footer className="bg-primary/5 border-t border-border text-muted-foreground text-center px-4 py-4">
      <p className="text-xs">&copy; 2025 Hotspot Karhutla</p>
    </footer>
  );
};

  export default Footer;
  