'use client';

import { useState, useEffect } from 'react';
import Navbar from "../components/Navbar";
import OlapComponent from "../components/Olaps/OlapComponent";
import MapComponent from "../components/Maps/MapComponent";

export default function Olaps() {
  const [selectedData, setSelectedData] = useState<any>(null);
  const [showPopup, setShowPopup] = useState(true);

  const handleSelect = (data: any) => {
    setSelectedData(data); 
    console.log('Selected Data:', data); 
  };

  // tanggal sekarang
  const today = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="relative">
      {/* Popup */}
      {showPopup && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-md text-center">
            <h2 className="text-black text-xl font-semibold mb-4">Informasi Data</h2>
            <p className="text-black text-sm mb-4">
              Data yang ditampilkan pada sistem ini merupakan data dari periode <strong>17 Februari 2025</strong> hingga <strong>{today}</strong>.
            </p>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={() => setShowPopup(false)}
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      <Navbar />
      <main>
        <OlapComponent
          query={{}} 
          value="someValue"
          index={0}
          tipe="pulau" 
          onSelect={handleSelect} 
        />
        {selectedData && (
          <div>
            <h4>Selected Data:</h4>
            <pre>{JSON.stringify(selectedData, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}
