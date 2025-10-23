import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MitigationSection = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground dark:text-white">
            Upaya Mitigasi Kebakaran
          </h2>
          <p className="text-lg text-muted-foreground dark:text-gray-300 max-w-3xl mx-auto">
            Penyelenggaraan pencegahan, pemadaman, dan penanganan pasca karhutla
            berdasarkan Permen LHK Nomor 32 Tahun 2016
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="hover:shadow-lg transition-shadow duration-300 dark:border-gray-700 dark:bg-gray-800">
            <CardHeader className="dark:border-gray-700">
              <div className="text-primary mb-4 dark:text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <CardTitle className="dark:text-white">Pencegahan</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground dark:text-gray-300">
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Pemberdayaan masyarakat</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Penyadartahuan pengurangan resiko karhutla</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Kesiapsiagaan</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Pelaksanaan peringatan dini</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Patroli pencegahan</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 dark:border-gray-700 dark:bg-gray-800">
            <CardHeader className="dark:border-gray-700">
              <div className="text-primary mb-4 dark:text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
                  />
                </svg>
              </div>
              <CardTitle className="dark:text-white">Pemadaman</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground dark:text-gray-300">
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Deteksi dini</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Pemadaman awal</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Koordinasi pemadaman</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Mobilisasi pemadaman</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Pemadaman lanjutan</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Demobilisasi pemadaman</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Evakuasi dan penyelamatan</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 dark:border-gray-700 dark:bg-gray-800">
            <CardHeader className="dark:border-gray-700">
              <div className="text-primary mb-4 dark:text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <CardTitle className="dark:text-white">Penanganan Pasca Karhutla</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground dark:text-gray-300">
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Pengawasan areal bekas terbakar</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Inventarisasi luas karhutla</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Penaksiran kerugian</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-primary mr-2 mt-0.5 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="dark:text-gray-200">Koordinasi penanganan pasca karhutla</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default MitigationSection;
