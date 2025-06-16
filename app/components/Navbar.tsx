"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const Navbar = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const linkClass = (path: string) =>
    `block px-3 py-2 rounded-md text-base font-medium ${pathname === path ? 'text-white font-semibold' : 'text-gray-200 hover:text-white hover:font-semibold'}`;

  return (
    <nav className="bg-green-600 text-white fixed w-full top-0 z-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Link href="/" className="flex items-center space-x-2">
              <Image src="/assets/ipb.png" alt="Logo" width={32} height={32} />
              <h1 className="text-sm md:text-lg font-bold">
                OLAP Hotspot | Sistem Pemantauan Hotspot Karhutla
              </h1>
            </Link>
          </div>

          {/* Menu */}
          <div className="hidden md:flex space-x-6">
            <Link href="/" className={linkClass('/')}>Beranda</Link>
            <Link href="/olaps" className={linkClass('/olaps')}>Peta Hotspot</Link>
            <Link href="/data" className={linkClass('/data')}>Data</Link>
            <Link href="/about" className={linkClass('/about')}>Tentang</Link>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="md:hidden">
        <button onClick={toggleMenu} className="text-white focus:outline-none">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden px-4 pb-3 space-y-1 bg-green-700">
          <Link href="/" className={linkClass('/')}>Beranda</Link>
          <Link href="/olaps" className={linkClass('/olaps')}>Peta Hotspot</Link>
          <Link href="/data" className={linkClass('/data')}>Data</Link>
          <Link href="/about" className={linkClass('/about')}>Tentang</Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;