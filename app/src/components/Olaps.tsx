import { useState, useEffect, lazy, Suspense } from 'react';

const OlapComponent = lazy(() => import('./Olaps/OlapComponent'));

export default function Olaps() {
  const [showPopup, setShowPopup] = useState(true);
  const [today, setToday] = useState('');

  useEffect(() => {
    const currentDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    setToday(currentDate);
  }, []);

  return (
    <div className="relative">
      {showPopup && (
        <div className="fixed inset-0 z-[40] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-md text-center">
            <h2 className="text-black text-xl font-semibold mb-4">Informasi Data</h2>
            <p className="text-black text-sm mb-4">
              Data yang ditampilkan pada sistem ini merupakan data dari periode <strong>1 Januari 2015</strong> hingga <strong>{today}</strong>.
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

      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
        <OlapComponent />
      </Suspense>
    </div>
  );
}
