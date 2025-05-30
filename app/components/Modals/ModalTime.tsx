import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { OlapService } from '../../core/services/OlapService';

export type Time = "tahun" | "semester" | "kuartal" | "bulan" | "hari";
export type Type = "pulau" | "provinsi" | "kota" | "kecamatan" | "desa";

export interface QueryData {
  tahun?: string;
  semester?: string;
  kuartal?: string;
  bulan?: string;
  hari?: string;
  point?: string;
  [key: string]: any;
}

interface FormattedDataItem {
  value: string;
  label: string;
}

interface ModalTimeProps {
  query: QueryData;
  value: string;
  index: number[];
  tipe: Type;
  onSelect: (data: { data: QueryData; index: number[]; tipe: Type }) => void;
  onClose: () => void;
}

export default function ModalTime({
  query,
  value,
  index,
  tipe,
  onSelect,
  onClose,
}: ModalTimeProps) {
  const { handleSubmit, setValue, watch } = useForm<QueryData>();
  const [dataTahun, setDataTahun] = useState<FormattedDataItem[]>([]);
  const [dataSemester, setDataSemester] = useState<FormattedDataItem[]>([]);
  const [datakuartal, setDatakuartal] = useState<FormattedDataItem[]>([]);
  const [dataBulan, setDataBulan] = useState<FormattedDataItem[]>([]);
  const [dataHari, setDataHari] = useState<FormattedDataItem[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState<Record<Time, boolean>>({
    tahun: false,
    semester: false,
    kuartal: false,
    bulan: false,
    hari: false
  });
  const [loading, setLoading] = useState<Record<Time, boolean>>({
    tahun: false,
    semester: false,
    kuartal: false,
    bulan: false,
    hari: false
  });

  const tahunValue = watch("tahun");
  const semesterValue = watch("semester");
  const kuartalValue = watch("kuartal");
  const bulanValue = watch("bulan");
  const hariValue = watch("hari");

  useEffect(() => {
    fetchTimeData("tahun");
    
    if (query.tahun) setValue("tahun", query.tahun);
    if (query.semester) setValue("semester", query.semester);
    if (query.kuartal) setValue("kuartal", query.kuartal);
    if (query.bulan) setValue("bulan", query.bulan);
    if (query.hari) setValue("hari", query.hari);
  }, []);

  useEffect(() => {
    if (tahunValue) {
      fetchTimeData("semester");
    } else {
      setDataSemester([]);
      setValue("semester", "");
    }
  }, [tahunValue]);

  useEffect(() => {
    if (semesterValue) {
      fetchTimeData("kuartal");
    } else {
      setDatakuartal([]);
      setValue("kuartal", "");
    }
  }, [semesterValue]);

  useEffect(() => {
    if (kuartalValue) {
      fetchTimeData("bulan");
    } else {
      setDataBulan([]);
      setValue("bulan", "");
    }
  }, [kuartalValue]);

  useEffect(() => {
    if (bulanValue) {
      fetchTimeData("hari");
    } else {
      setDataHari([]);
      setValue("hari", "");
    }
  }, [bulanValue]);

  const fetchTimeData = async (type: Time) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    
    try {
      const params = buildQueryParams(type);
      console.log("Fetching time data with params:", params);
      
      const response = await OlapService.query("time", params);
      console.log("RAW RESPONSE:", JSON.stringify(response, null, 2));
      if (response && Array.isArray(response)) {
        const formattedData: FormattedDataItem[] = response
          .map(item => {
            if (Array.isArray(item) && item.length > 0) {
              const value = item[0]?.toString().trim();
              return value ? { value, label: value } : null;
            }
            else if (typeof item === 'object' && item !== null) {
              const value = item.value?.toString().trim() || item.id?.toString().trim();
              const label = item.label?.toString().trim() || item.name?.toString().trim();
              return value && label ? { value, label } : null;
            }
            else if (item !== undefined && item !== null) {
              const value = item.toString().trim();
              return value ? { value, label: value } : null;
            }
            return null;
          })
          .filter((item: FormattedDataItem | null): item is FormattedDataItem => 
             item !== null && item.value !== "" && item.label !== "");
  
        console.log("Formatted Data:", formattedData);
  
        if (formattedData.length === 0) {
          console.warn(`No valid data received for ${type}`);
          throw new Error(`Data ${type} tidak valid`);
        }
  
        switch (type) {
          case "tahun":
            setDataTahun(formattedData);
            break;
          case "semester":
            const validSemester = formattedData.filter(item => 
              ["1", "2"].includes(item.value)
            );
            if (validSemester.length === 0) {
              throw new Error("Data semester harus 1 atau 2");
            }
            setDataSemester(validSemester);
            break;
          case "kuartal":
            const validkuartal = formattedData.filter(item =>
              ["Q1", "Q2", "Q3", "Q4"].includes(item.value)
            );
            setDatakuartal(validkuartal);
            break;
          case "bulan":
            setDataBulan(formattedData);
            break;
          case "hari":
            setDataHari(formattedData);
            break;
        }
      }
    } catch (error: unknown) {
      console.error(`Error fetching ${type} data:`, error);
      let errorMessage = "Terjadi kesalahan tidak dikenal.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      switch (type) {
        case "semester":
          setDataSemester([]);
          setValue("semester", "");
          break;
        case "kuartal":
          setDatakuartal([]);
          setValue("kuartal", "");
          break;
        case "bulan":
          setDataBulan([]);
          setValue("bulan", "");
          break;
        case "hari":
          setDataHari([]);
          setValue("hari", "");
          break;
      }
      alert(`Gagal memuat data ${type}: ${errorMessage}`);
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const buildQueryParams = (type: Time): QueryData => {
    const params: QueryData = { 
      dimension: 'time',
      ...(tipe === 'pulau' && value && { pulau: value }),
      ...(tipe === 'provinsi' && value && { provinsi: value }),
      ...(tipe === 'kota' && value && { kota: value }),
      ...(tipe === 'kecamatan' && value && { kecamatan: value }),
      ...(tipe === 'desa' && value && { desa: value })
    };
  
    switch (type) {
      case "semester":
        if (tahunValue) params.tahun = tahunValue;
        break;
      case "kuartal":
        if (tahunValue) params.tahun = tahunValue;
        if (semesterValue) params.semester = semesterValue;
        break;
      case "bulan":
        if (tahunValue) params.tahun = tahunValue;
        if (semesterValue) params.semester = semesterValue;
        if (kuartalValue) params.kuartal = kuartalValue;
        break;
      case "hari":
        if (tahunValue) params.tahun = tahunValue;
        if (semesterValue) params.semester = semesterValue;
        if (kuartalValue) params.kuartal = kuartalValue;
        if (bulanValue) params.bulan = bulanValue;
        break;
    }
  
    console.log("Built params:", params);
    return params;
  };

  const toggleDropdown = (type: Time) => {
    setIsDropdownOpen(prev => ({ ...prev, [type]: !prev[type] }));
    if (!isDropdownOpen[type]) {
      switch (type) {
        case "tahun":
          if (dataTahun.length === 0) fetchTimeData("tahun");
          break;
        case "semester":
          if (dataSemester.length === 0 && tahunValue) fetchTimeData("semester");
          break;
        case "kuartal":
          if (datakuartal.length === 0 && semesterValue) fetchTimeData("kuartal");
          break;
        case "bulan":
          if (dataBulan.length === 0 && kuartalValue) fetchTimeData("bulan");
          break;
        case "hari":
          if (dataHari.length === 0 && bulanValue) fetchTimeData("hari");
          break;
      }
    }
  };

  const selectTimeValue = (type: Time, value: string) => {
    setValue(type, value);
    setIsDropdownOpen(prev => ({ ...prev, [type]: false }));
  };

  const onSubmit = (formData: QueryData) => {
    if (!formData.tahun) {
      alert("Tahun harus dipilih");
      return;
    }
  
    const updatedQuery = {
      ...query,
      tahun: formData.tahun,
      semester: formData.semester,
      kuartal: formData.kuartal,
      bulan: formData.bulan,
      hari: formData.hari,
      point: value
    };
  
    console.log("Submitting time filter:", updatedQuery);
    onSelect({ 
      data: updatedQuery, 
      index, 
      tipe 
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]">
      <div 
        className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-gray-800 mb-4">Filter Waktu</h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tahun */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
            <div 
              className="w-full p-2 border border-gray-300 rounded-md cursor-pointer bg-gray-100"
              onClick={() => toggleDropdown("tahun")}
            >
              {tahunValue || "Pilih Tahun"}
            </div>
            {isDropdownOpen.tahun && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {loading.tahun ? (
                  <li className="p-2 text-center text-gray-500">Loading...</li>
                ) : dataTahun.length > 0 ? (
                  dataTahun.map((item, index) => (
                    <li 
                      key={index}
                      className="p-2 hover:bg-blue-100 cursor-pointer"
                      onClick={() => selectTimeValue("tahun", item.value)}
                    >
                      {item.label}
                    </li>
                  ))
                ) : (
                  <li className="p-2 text-center text-gray-500">Tidak ada data</li>
                )}
              </ul>
            )}
          </div>

          {/* Semester */}
          {tahunValue && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <div 
                className="w-full p-2 border border-gray-300 rounded-md cursor-pointer bg-gray-100"
                onClick={() => toggleDropdown("semester")}
              >
                {semesterValue || "Pilih Semester"}
              </div>
              {isDropdownOpen.semester && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {loading.semester ? (
                    <li className="p-2 text-center text-gray-500">Loading...</li>
                  ) : dataSemester.length > 0 ? (
                    dataSemester.map((item, index) => (
                      <li 
                        key={index}
                        className="p-2 hover:bg-blue-100 cursor-pointer"
                        onClick={() => selectTimeValue("semester", item.value)}
                      >
                        {item.label}
                      </li>
                    ))
                  ) : (
                    <li className="p-2 text-center text-gray-500">Tidak ada data</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* Kuartal */}
          {semesterValue && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Kuartal</label>
              <div 
                className="w-full p-2 border border-gray-300 rounded-md cursor-pointer bg-gray-100"
                onClick={() => toggleDropdown("kuartal")}
              >
                {kuartalValue || "Pilih Kuartal"}
              </div>
              {isDropdownOpen.kuartal && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {loading.kuartal ? (
                    <li className="p-2 text-center text-gray-500">Loading...</li>
                  ) : datakuartal.length > 0 ? (
                    datakuartal.map((item, index) => (
                      <li 
                        key={index}
                        className="p-2 hover:bg-blue-100 cursor-pointer"
                        onClick={() => selectTimeValue("kuartal", item.value)}
                      >
                        {item.label}
                      </li>
                    ))
                  ) : (
                    <li className="p-2 text-center text-gray-500">Tidak ada data</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* Bulan */}
          {kuartalValue && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bulan</label>
              <div 
                className="w-full p-2 border border-gray-300 rounded-md cursor-pointer bg-gray-100"
                onClick={() => toggleDropdown("bulan")}
              >
                {bulanValue || "Pilih Bulan"}
              </div>
              {isDropdownOpen.bulan && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {loading.bulan ? (
                    <li className="p-2 text-center text-gray-500">Loading...</li>
                  ) : dataBulan.length > 0 ? (
                    dataBulan.map((item, index) => (
                      <li 
                        key={index}
                        className="p-2 hover:bg-blue-100 cursor-pointer"
                        onClick={() => selectTimeValue("bulan", item.value)}
                      >
                        {item.label}
                      </li>
                    ))
                  ) : (
                    <li className="p-2 text-center text-gray-500">Tidak ada data</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* Hari */}
          {bulanValue && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Hari</label>
              <div 
                className="w-full p-2 border border-gray-300 rounded-md cursor-pointer bg-gray-100"
                onClick={() => toggleDropdown("hari")}
              >
                {hariValue || "Pilih Hari"}
              </div>
              {isDropdownOpen.hari && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {loading.hari ? (
                    <li className="p-2 text-center text-gray-500">Loading...</li>
                  ) : dataHari.length > 0 ? (
                    dataHari.map((item, index) => (
                      <li 
                        key={index}
                        className="p-2 hover:bg-blue-100 cursor-pointer"
                        onClick={() => selectTimeValue("hari", item.value)}
                      >
                        {item.label}
                      </li>
                    ))
                  ) : (
                    <li className="p-2 text-center text-gray-500">Tidak ada data</li>
                  )}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}