'use client';

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function About() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 pt-24 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-blue-800 mb-6">Sistem OLAP (Online Analytical Processing)</h1>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-blue-700 mb-4">Apa itu OLAP?</h2>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <p className="mb-4">
                OLAP adalah teknologi yang digunakan untuk mengorganisir data bisnis besar dan mendukung analisis kompleks. Sistem OLAP dirancang untuk membantu menganalisis data dari berbagai perspektif.
              </p>
              <p>
                Berbeda dengan sistem OLTP (Online Transaction Processing) yang berfokus pada pemrosesan transaksi harian, OLAP berfokus pada pengambilan keputusan dengan menyediakan kemampuan analisis multidimensi.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-blue-700 mb-4">Operasi OLAP</h2>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  {
                    title: "Drill-down",
                    use: "Navigasi dari data umum ke lebih detail.",
                    example: "Digunakan untuk menelusuri titik panas dari pulau → provinsi → kabupaten/kota → kecamatan → desa."
                  },
                  {
                    title: "Roll-up",
                    use: "Mengagregasi data dari detail ke ringkasan.",
                    example: "Digunakan untuk agregasi data dari desa → kecamatan → kabupaten/kota → provinsi → pulau."
                  },
                  {
                    title: "Slice",
                    use: "Memilih satu dimensi dari kubus untuk membuat subset data.",
                    example: "Digunakan untuk filtering satu dimensi yaitu confidence"
                  },
                  {
                    title: "Dice",
                    use: "Memilih subset data dengan beberapa nilai pada berbagai dimensi.",
                    example: "Digunakan untuk filtering dua dimensi (confidence dan satellite) dan tiga dimensi (confidence, satellite, dan waktu) "
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="relative group border border-gray-200 p-4 rounded hover:bg-blue-50 transition cursor-pointer"
                  >
                    <h3 className="font-medium text-blue-600 mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-700">{item.use}</p>
                    <div className="absolute z-10 left-0 top-full mt-2 w-64 p-3 bg-white text-sm text-gray-700 border border-gray-200 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                      <span className="block font-semibold text-blue-600 mb-1">Penerapan:</span>
                      {item.example}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}