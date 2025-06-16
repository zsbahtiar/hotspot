"use client";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function About() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 pt-24 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-blue-800 mb-6">OLAP <em>Hotspot</em> (<em>Online Analytical Processing</em>)</h1>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-blue-700 mb-4">Apa itu OLAP <em>Hotspot</em>?</h2>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <p className="mb-4">
                OLAP (<em>Online Analytical Processing</em>) adalah teknologi yang digunakan untuk mengelola data secara multidimensi dan mendukung analisis data yang kompleks. Sistem OLAP dirancang untuk membantu menganalisis data dari berbagai perspektif.
              </p>
              <p className="mb-4">
                OLAP <em>Hotspot</em> adalah sistem untuk analisis data historikal <em>hotspot</em> kebakaran hutan dan lahan (karhutla) berdasarkan dimensi lokasi, waktu, <em>confidence</em>, dan satelit.
                Data <em>hotspot</em> yang dianalisis dalam sistem ini berasal dari <em>website</em>{" "}
                <a
                  href="https://sipongi.menlhk.go.id/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-800 hover:underline"
                >
                  SiPongi+
                </a>
                , yang dikelola dalam data <em>warehouse</em> dengan skema bintang.
                Pengguna dapat memperoleh data historikal <em>hotspot</em> melalui operasi <em>drill-down</em> dan <em>roll-up</em>.
              </p>
              <p>
                Hasil operasi tersebut ditampilkan dalam bentuk <em>cross table</em>, grafik, dan peta.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-blue-700 mb-4">Operasi OLAP</h2>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="grid md:grid-cols-3 gap-4">
                {[
                    {
                    title: <em>Drill-down</em>,
                    use: (
                      <>
                        Navigasi dari data umum ke lebih data yang detail.
                      </>
                    ),
                    example: (
                      <>
                        Digunakan untuk menelusuri titik panas dari pulau &rarr; provinsi &rarr; kabupaten/kota &rarr; kecamatan &rarr; desa.
                      </>
                    ),
                  },
                  {
                    title: <em>Roll-up</em>,
                    use: (
                      <>
                        Mengagregasi data dari detail ke ringkasan.
                      </>
                    ),
                    example: (
                      <>
                        Digunakan untuk agregasi data dari desa &rarr; kecamatan &rarr; kabupaten/kota &rarr; provinsi &rarr; pulau.
                      </>
                    ),
                  },
                  {
                    title: <em>Slice</em>,
                    use: (
                      <>
                        Memilih satu dimensi dari <em>cube</em> untuk membuat subset data.
                      </>
                    ),
                    example: (
                      <>
                        Digunakan untuk <em>filtering</em> satu dimensi yaitu <em>confidence</em>.
                      </>
                    ),
                  },
                  {
                    title: <em>Dice</em>,
                    use: (
                      <>
                        Memilih subset data dengan beberapa nilai pada berbagai dimensi.
                      </>
                    ),
                    example: (
                      <>
                        Digunakan untuk <em>filtering</em> dua dimensi (<em>confidence</em> dan satelit) dan tiga dimensi (<em>confidence</em>, satelit, dan <em>waktu</em>).
                      </>
                    ),
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

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-blue-700 mb-4">Model Data Warehouse</h2>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <p className="mb-4">
                Model data <em>warehouse</em> ini menggunakan pendekatan skema bintang dengan tabel fakta utama dan beberapa tabel dimensi:
              </p>
              
              <div className="space-y-4">
                <div className="border-l-4 border-blue-600 pl-4">
                  <h3 className="font-semibold text-blue-700">Tabel Fakta Hotspot</h3>
                  <p className="text-gray-700">
                    Menyimpan catatan kejadian <em>hotspot</em> dengan atribut utama seperti jumlah titik, tingkat <em>confidence</em>, serta referensi ke dimensi terkait.
                  </p>
                </div>
                
                <div className="border-l-4 border-green-600 pl-4">
                  <h3 className="font-semibold text-green-700">Dimensi Lokasi</h3>
                  <p className="text-gray-700">
                    Meliputi pulau, provinsi, kabupaten/kota, kecamatan, dan desa.
                  </p>
                </div>
                
                <div className="border-l-4 border-amber-600 pl-4">
                  <h3 className="font-semibold text-amber-700">Dimensi Waktu</h3>
                  <p className="text-gray-700">
                    Meliputi tahun, semester, kuartal, bulan, minggu, dan hari.
                  </p>
                </div>
                
                <div className="border-l-4 border-red-600 pl-4">
                  <h3 className="font-semibold text-red-700">Dimensi Confidence</h3>
                  <p className="text-gray-700">
                    Mendefinisikan tingkat kepercayaan (<em>confidence level</em>) dari masing-masing data <em>hotspot</em>.
                  </p>
                  <p className="text-gray-700 mt-2">
                    Rentang nilai <em>confidence</em> ini mengacu pada Peraturan Menteri Lingkungan Hidup dan Kehutanan Nomor 8 Tahun 2018 tentang Prosedur Tetap Pengecekan Lapangan Informasi Titik Panas dan/atau Informasi Kebakaran Hutan dan Lahan:
                  </p>
                  <ul className="list-disc list-inside ml-4 mt-2">
                    <li className="text-gray-700"><em>Low</em> (Rendah): 0 – 29</li>
                    <li className="text-gray-700"><em>Medium</em> (Sedang): 30 – 79</li>
                    <li className="text-gray-700"><em>High</em> (Tinggi): 80 – 100</li>
                  </ul>
                </div>
                
                <div className="border-l-4 border-purple-600 pl-4">
                  <h3 className="font-semibold text-purple-700">Dimensi Satelit</h3>
                  <p className="text-gray-700">
                    Mendefinisikan sumber data satelit (NASA-SNPP, NASA-MODIS, NASA-NOAA20).
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-blue-700 mb-4">Tim Pengembang</h2>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-lg font-semibold text-blue-600">Tio Ramadhan</div>
                  <div className="text-gray-600 mt-2">Modul <em>database hotspot</em></div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-lg font-semibold text-blue-600">Lee Roy Akbar</div>
                  <div className="text-gray-600 mt-2"><em>Back-end</em></div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-lg font-semibold text-blue-600">Nechita Samantha</div>
                  <div className="text-gray-600 mt-2"><em>Front-end</em></div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}