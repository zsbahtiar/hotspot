import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { OlapService } from '../../core/services/OlapService';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp, faSpinner, faTimesCircle } from "@fortawesome/free-solid-svg-icons";

export type Time = "tahun" | "semester" | "kuartal" | "bulan" | "hari";
export type Type = "pulau" | "provinsi" | "kota" | "kecamatan" | "desa";

export interface QueryData {
  tahun?: string;
  semester?: string;
  kuartal?: string;
  bulan?: string;
  hari?: string;
  point?: string;
  dimension?: string;
  pulau?: string;
  provinsi?: string;
  kota?: string;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
}

interface FormattedDataItem {
  value: string;
  label: string;
  id?: string | number;
  name?: string;
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

  const [tahunError, setTahunError] = useState<string | null>(null);
  const tahunValue = watch("tahun");
  const semesterValue = watch("semester");
  const kuartalValue = watch("kuartal");
  const bulanValue = watch("bulan");
  const hariValue = watch("hari");

  const tahunRef = useRef<HTMLDivElement>(null);
  const semesterRef = useRef<HTMLDivElement>(null);
  const kuartalRef = useRef<HTMLDivElement>(null);
  const bulanRef = useRef<HTMLDivElement>(null);
  const hariRef = useRef<HTMLDivElement>(null);

  const dropdownRefs = useMemo(() => ({
    tahun: tahunRef,
    semester: semesterRef,
    kuartal: kuartalRef,
    bulan: bulanRef,
    hari: hariRef,
  }), [tahunRef, semesterRef, kuartalRef, bulanRef, hariRef]);

  const buildQueryParams = useCallback((type: Time): QueryData => {
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
    return params;
  }, [tipe, value, tahunValue, semesterValue, kuartalValue, bulanValue]);

  const fetchTimeData = useCallback(async (type: Time) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    try {
      const params = buildQueryParams(type);
      const response = await OlapService.query("time", params);

      if (response && Array.isArray(response)) {
        const formattedData: FormattedDataItem[] = response
          .map(item => {
            if (Array.isArray(item) && item.length > 0) {
              const val = String(item[0]).trim();
              return val ? { value: val, label: val } : null;
            }
            else if (typeof item === 'object' && item !== null) {
              const typedItem = item as FormattedDataItem;
              const val = String(typedItem.value ?? typedItem.id ?? '').trim();
              const lbl = String(typedItem.label ?? typedItem.name ?? '').trim();
              return val && lbl ? { value: val, label: lbl } : null;
            }
            else if (item !== undefined && item !== null) {
              const val = String(item).trim();
              return val ? { value: val, label: val } : null;
            }
            return null;
          })
          .filter((item: FormattedDataItem | null): item is FormattedDataItem =>
            item !== null && item.value !== "" && item.label !== "");

        if (formattedData.length === 0) {
          console.warn(`No valid data received for ${type}`);
        }

        switch (type) {
          case "tahun":
            setDataTahun(formattedData);
            break;
          case "semester":
            const validSemester = formattedData.filter(item => ["1", "2"].includes(item.value));
            setDataSemester(validSemester);
            if (semesterValue && !validSemester.some(s => s.value === semesterValue)) {
                setValue("semester", "");
            }
            break;
          case "kuartal":
            const validKuartal = formattedData.filter(item =>
              ["Q1", "Q2", "Q3", "Q4"].includes(item.value.toUpperCase())
            );
            setDatakuartal(validKuartal);
               if (kuartalValue && !validKuartal.some(q => q.value === kuartalValue)) {
                setValue("kuartal", "");
            }
            break;
          case "bulan":
            setDataBulan(formattedData);
            if (bulanValue && !formattedData.some(b => b.value === bulanValue)) {
                setValue("bulan", "");
            }
            break;
          case "hari":
            setDataHari(formattedData);
            if (hariValue && !formattedData.some(h => h.value === hariValue)) {
                setValue("hari", "");
            }
            break;
        }
      } else {
        console.warn(`Response for ${type} is not an array:`, response);
        switch (type) {
            case "tahun": setDataTahun([]); setValue("tahun", ""); break;
            case "semester": setDataSemester([]); setValue("semester", ""); break;
            case "kuartal": setDatakuartal([]); setValue("kuartal", ""); break;
            case "bulan": setDataBulan([]); setValue("bulan", ""); break;
            case "hari": setDataHari([]); setValue("hari", ""); break;
        }
      }
    } catch (error: unknown) {
      console.error(`Error fetching ${type} data:`, error);

      switch (type) {
        case "tahun": setDataTahun([]); setValue("tahun", ""); break;
        case "semester": setDataSemester([]); setValue("semester", ""); break;
        case "kuartal": setDatakuartal([]); setValue("kuartal", ""); break;
        case "bulan": setDataBulan([]); setValue("bulan", ""); break;
        case "hari": setDataHari([]); setValue("hari", ""); break;
      }
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  }, [buildQueryParams, setValue, semesterValue, kuartalValue, bulanValue, hariValue]);


  useEffect(() => {
    fetchTimeData("tahun");

    if (query.tahun) {
        setValue("tahun", query.tahun);
    }
    if (query.semester) {
        setValue("semester", query.semester);
    }
    if (query.kuartal) {
        setValue("kuartal", query.kuartal);
    }
    if (query.bulan) {
        setValue("bulan", query.bulan);
    }
    if (query.hari) {
        setValue("hari", query.hari);
    }
  }, [fetchTimeData, query.tahun, query.semester, query.kuartal, query.bulan, query.hari, setValue]);

  useEffect(() => {
    if (tahunValue) {
      fetchTimeData("semester");
      setTahunError(null);
    } else {
      setDataSemester([]);
      setValue("semester", "");
      setDatakuartal([]);
      setValue("kuartal", "");
      setDataBulan([]);
      setValue("bulan", "");
      setDataHari([]);
      setValue("hari", "");
    }
  }, [tahunValue, fetchTimeData, setValue]);

  useEffect(() => {
    if (semesterValue) {
      fetchTimeData("kuartal");
    } else {
      setDatakuartal([]);
      setValue("kuartal", "");
      setDataBulan([]);
      setValue("bulan", "");
      setDataHari([]);
      setValue("hari", "");
    }
  }, [semesterValue, fetchTimeData, setValue]);

  useEffect(() => {
    if (kuartalValue) {
      fetchTimeData("bulan");
    } else {
      setDataBulan([]);
      setValue("bulan", "");
      setDataHari([]);
      setValue("hari", "");
    }
  }, [kuartalValue, fetchTimeData, setValue]);

  useEffect(() => {

    if (bulanValue) {
      fetchTimeData("hari");
    } else {
      setDataHari([]);
      setValue("hari", "");
    }
  }, [bulanValue, fetchTimeData, setValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      let clickedInsideAnyDropdown = false;
      for (const key in dropdownRefs) {
        const ref = dropdownRefs[key as Time];
        if (ref.current && ref.current.contains(event.target as Node)) {
          clickedInsideAnyDropdown = true;
          break;
        }
      }

      if (!clickedInsideAnyDropdown) {
        setIsDropdownOpen({
          tahun: false,
          semester: false,
          kuartal: false,
          bulan: false,
          hari: false
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRefs]);


  const toggleDropdown = (type: Time) => {
    setIsDropdownOpen(prev => {
      const newState: Record<Time, boolean> = { ...prev };
      for (const key in newState) {
        if (key !== type) {
          newState[key as Time] = false;
        }
      }
      newState[type] = !prev[type];
      return newState;
    });

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

  const selectTimeValue = (type: Time, valueToSet: string) => {
    setValue(type, valueToSet);
    setIsDropdownOpen(prev => ({ ...prev, [type]: false }));
    if (type === "tahun") {
      setTahunError(null);
    }
  };

  const resetTimeFilters = () => {
    setValue("tahun", "");
    setValue("semester", "");
    setValue("kuartal", "");
    setValue("bulan", "");
    setValue("hari", "");
    setTahunError(null);

    setDataTahun([]);
    setDataSemester([]);
    setDatakuartal([]);
    setDataBulan([]);
    setDataHari([]);

    fetchTimeData("tahun");
  };

  const onSubmit = (formData: QueryData) => {
    if (!formData.tahun) {
      setTahunError("Tahun harus dipilih.");
      return;
    }
    setTahunError(null);
    const updatedQuery = {
      ...query,
      tahun: formData.tahun || undefined,
      semester: formData.semester || undefined,
      kuartal: formData.kuartal || undefined,
      bulan: formData.bulan || undefined,
      hari: formData.hari || undefined,
      point: value
    };

    onSelect({
      data: updatedQuery,
      index,
      tipe
    });
    onClose();
  };

  const renderDropdown = (
    type: Time,
    currentValue: string | undefined,
    dataList: FormattedDataItem[],
    placeholder: string,
    showDropdown: boolean,
    hasParentValue: boolean = true
  ) => {
    if (!hasParentValue && type !== "tahun") return null;

    return (
      <div className="relative" ref={dropdownRefs[type]}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {placeholder.replace('Pilih ', '')}
        </label>
        <div
          className={`w-full p-2 border rounded-md cursor-pointer flex items-center justify-between transition-all duration-200
            ${showDropdown ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-300 bg-gray-100'}
            ${loading[type] ? 'opacity-70 cursor-not-allowed' : ''}`}
          onClick={() => !loading[type] && toggleDropdown(type)}
        >
          <span>{currentValue || placeholder}</span>
          {loading[type] ? (
            <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />
          ) : (
            <FontAwesomeIcon icon={showDropdown ? faChevronUp : faChevronDown} className="text-gray-500" />
          )}
        </div>
        {showDropdown && (
          <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
            {dataList.length > 0 && (
              <li
                className="p-2 hover:bg-blue-100 cursor-pointer text-gray-600 font-semibold sticky top-0 bg-white border-b border-gray-200"
                onClick={() => selectTimeValue(type, "")} // Opsi "Semua"
              >
                Semua {placeholder.replace('Pilih ', '')}
              </li>
            )}
            {loading[type] ? (
              <li className="p-2 text-center text-gray-500 flex items-center justify-center">
                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Memuat...
              </li>
            ) : dataList.length > 0 ? (
              dataList.map((item, idx) => (
                <li
                  key={idx}
                  className={`p-2 hover:bg-blue-100 cursor-pointer ${currentValue === item.value ? 'bg-blue-50 text-blue-800 font-medium' : ''}`}
                  onClick={() => selectTimeValue(type, item.value)}
                >
                  {item.label}
                </li>
              ))
            ) : (
              <li className="p-2 text-center text-gray-500">Tidak ada data</li>
            )}
          </ul>
        )}
        {type === "tahun" && tahunError && (
          <p className="text-red-500 text-xs mt-1 flex items-center">
            <FontAwesomeIcon icon={faTimesCircle} className="mr-1" /> {tahunError}
          </p>
        )}
      </div>
    );
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]">
      <div
        className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto shadow-xl transform transition-all duration-300 scale-100 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Filter Waktu Hotspot</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {renderDropdown("tahun", tahunValue, dataTahun, "Pilih Tahun", isDropdownOpen.tahun)}
          {renderDropdown("semester", semesterValue, dataSemester, "Pilih Semester", isDropdownOpen.semester, !!tahunValue)}
          {renderDropdown("kuartal", kuartalValue, datakuartal, "Pilih Kuartal", isDropdownOpen.kuartal, !!semesterValue)}
          {renderDropdown("bulan", bulanValue, dataBulan, "Pilih Bulan", isDropdownOpen.bulan, !!kuartalValue)}
          {renderDropdown("hari", hariValue, dataHari, "Pilih Hari", isDropdownOpen.hari, !!bulanValue)}

          <div className="flex justify-between items-center pt-4 border-t mt-4">
            <button
              type="button"
              onClick={resetTimeFilters}
              className="px-4 py-2 border border-gray-400 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all duration-200"
            >
              Reset Filter
            </button>
            <div className="flex space-x-3">
                <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200"
                >
                Batal
                </button>
                <button
                type="submit"
                className="px-4 py-2 bg-blue-600 rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                >
                Terapkan Filter
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}