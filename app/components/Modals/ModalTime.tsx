import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { OlapService } from "../../core/services/OlapService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp, faSpinner, faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { QueryData } from "@/app/core/model/query";
import { Time } from "@/app/core/model/time";
import { DrillDownLevel } from "@/app/core/model/location";
import { monthNames } from "@/app/core/model/time";

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
  tipe: DrillDownLevel;
  onSelect: (data: { data: QueryData; index: number[]; tipe: DrillDownLevel }) => void;
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
  const [dataMinggu, setDataMinggu] = useState<FormattedDataItem[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState<Record<Time, boolean>>({
    tahun: false,
    semester: false,
    kuartal: false,
    bulan: false,
    minggu: false,
  });
  const [loading, setLoading] = useState<Record<Time, boolean>>({
    tahun: false,
    semester: false,
    kuartal: false,
    bulan: false,
    minggu: false,
  });

  const [tahunError, setTahunError] = useState<string | null>(null);
  const tahunValue = watch("tahun");
  const semesterValue = watch("semester");
  const kuartalValue = watch("kuartal");
  const bulanValue = watch("bulan");
  const mingguValue = watch("minggu");

  const tahunRef = useRef<HTMLDivElement>(null);
  const semesterRef = useRef<HTMLDivElement>(null);
  const kuartalRef = useRef<HTMLDivElement>(null);
  const bulanRef = useRef<HTMLDivElement>(null);
  const mingguRef = useRef<HTMLDivElement>(null);

  const dropdownRefs = useMemo(
    () => ({
      tahun: tahunRef,
      semester: semesterRef,
      kuartal: kuartalRef,
      bulan: bulanRef,
      minggu: mingguRef,
    }),
    [tahunRef, semesterRef, kuartalRef, bulanRef, mingguRef]
  );

  const buildQueryParams = useCallback(
    (type: Time): QueryData => {
      const params: QueryData = {
        dimension: "time",
        ...(tipe === "pulau" && value && { pulau: value }),
        ...(tipe === "provinsi" && value && { provinsi: value }),
        ...(tipe === "kota" && value && { kota: value }),
        ...(tipe === "kecamatan" && value && { kecamatan: value }),
        ...(tipe === "desa" && value && { desa: value }),
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
        case "minggu":
          if (tahunValue) params.tahun = tahunValue;
          if (semesterValue) params.semester = semesterValue;
          if (kuartalValue) params.kuartal = kuartalValue;
          if (bulanValue) params.bulan = bulanValue;
          break;
      }
      return params;
    },
    [
      tipe,
      value,
      tahunValue,
      semesterValue,
      kuartalValue,
      bulanValue,
    ]
  );

  // Mengambil data waktu
  const getTimeData = useCallback(
    async (type: Time) => {
      setLoading((prev) => ({ ...prev, [type]: true }));
      try {
        const params = buildQueryParams(type);
        const response = await OlapService.query("time", params);

        if (response && Array.isArray(response)) {
          let formattedData: FormattedDataItem[] = response
            .map((item) => {
              if (Array.isArray(item) && item.length > 0) {
                const val = String(item[0]).trim();
                return val ? { value: val, label: val } : null;
              } else if (typeof item === "object" && item !== null) {
                const typedItem = item as FormattedDataItem;
                const val = String(
                  typedItem.value ?? typedItem.id ?? ""
                ).trim();
                const lbl = String(
                  typedItem.label ?? typedItem.name ?? ""
                ).trim();
                return val && lbl ? { value: val, label: lbl } : null;
              } else if (item !== undefined && item !== null) {
                const val = String(item).trim();
                return val ? { value: val, label: val } : null;
              }
              return null;
            })
            .filter(
              (item: FormattedDataItem | null): item is FormattedDataItem =>
                item !== null && item.value !== "" && item.label !== ""
            );

          if (formattedData.length === 0) {
            console.warn(`No valid data received for ${type}`);
          }

          switch (type) {
            case "tahun":
              formattedData = formattedData.sort(
                (a, b) => Number(a.value) - Number(b.value)
              );
              break;
            case "semester":
              formattedData = formattedData.sort(
                (a, b) => Number(a.value) - Number(b.value)
              );
              break;
            case "kuartal":
              const orderKuartal = ["Q1", "Q2", "Q3", "Q4"];
              formattedData = formattedData.sort(
                (a, b) =>
                  orderKuartal.indexOf(a.value.toUpperCase()) -
                  orderKuartal.indexOf(b.value.toUpperCase())
              );
              break;
            case "bulan":
              formattedData = formattedData.sort(
                (a, b) =>
                  monthNames.indexOf(a.value) - monthNames.indexOf(b.value)
              );
              break;
            case "minggu":
              formattedData = formattedData.sort(
                (a, b) => Number(a.value) - Number(b.value)
              );
              break;
          }

          // Sorting data
          switch (type) {
            case "tahun":
              setDataTahun(formattedData);
              break;
            case "semester":
              const validSemester = formattedData.filter((item) =>
                ["1", "2"].includes(item.value)
              );
              setDataSemester(validSemester);
              if (
                semesterValue &&
                !validSemester.some((s) => s.value === semesterValue)
              ) {
                setValue("semester", "");
              }
              break;
            case "kuartal":
              const validKuartal = formattedData.filter((item) =>
                ["Q1", "Q2", "Q3", "Q4"].includes(item.value.toUpperCase())
              );
              setDatakuartal(validKuartal);
              if (
                kuartalValue &&
                !validKuartal.some((q) => q.value === kuartalValue)
              ) {
                setValue("kuartal", "");
              }
              break;
            case "bulan":
              setDataBulan(formattedData);
              if (
                bulanValue &&
                !formattedData.some((b) => b.value === bulanValue)
              ) {
                setValue("bulan", "");
              }
              break;
            case "minggu":
              setDataMinggu(formattedData);
              if (
                mingguValue &&
                !formattedData.some((b) => b.value === mingguValue)
              ) {
                setValue("minggu", "");
              }
              break;
          }
        } else {
          console.warn(`Response for ${type} is not an array:`, response);
          switch (type) {
            case "tahun":
              setDataTahun([]);
              setValue("tahun", "");
              break;
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
            case "minggu":
              setDataMinggu([]);
              setValue("minggu", "");
              break;
          }
        }
      } catch (error: unknown) {
        console.error(`Error fetching ${type} data:`, error);

        switch (type) {
          case "tahun":
            setDataTahun([]);
            setValue("tahun", "");
            break;
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
          case "minggu":
            setDataMinggu([]);
            setValue("minggu", "");
            break;
        }
      } finally {
        setLoading((prev) => ({ ...prev, [type]: false }));
      }
    },
    [
      buildQueryParams,
      setValue,
      semesterValue,
      kuartalValue,
      bulanValue,
      mingguValue,
    ]
  );

  useEffect(() => {
    getTimeData("tahun");

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
    if (query.minggu) {
      setValue("minggu", query.minggu);
    }
  }, [
    getTimeData,
    query.tahun,
    query.semester,
    query.kuartal,
    query.bulan,
    query.minggu,
    setValue,
  ]);

  useEffect(() => {
    if (tahunValue) {
      getTimeData("semester");
      setTahunError(null);
    } else {
      setDataSemester([]);
      setValue("semester", "");
      setDatakuartal([]);
      setValue("kuartal", "");
      setDataBulan([]);
      setValue("bulan", "");
      setDataMinggu([]);
      setValue("minggu", "");
    }
  }, [tahunValue, getTimeData, setValue]);

  useEffect(() => {
    if (semesterValue) {
      getTimeData("kuartal");
    } else {
      setDatakuartal([]);
      setValue("kuartal", "");
      setDataBulan([]);
      setValue("bulan", "");
      setDataMinggu([]);
      setValue("minggu", "");
    }
  }, [semesterValue, getTimeData, setValue]);

  useEffect(() => {
    if (kuartalValue) {
      getTimeData("bulan");
    } else {
      setDataBulan([]);
      setValue("bulan", "");
      setDataMinggu([]);
      setValue("minggu", "");
    }
  }, [kuartalValue, getTimeData, setValue]);

  useEffect(() => {
    if (bulanValue) {
      getTimeData("minggu");
    } else {
      setDataMinggu([]);
      setValue("minggu", "");
    }
  }, [bulanValue, getTimeData, setValue]);

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
          minggu: false,
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRefs]);

  const toggleDropdown = (type: Time) => {
    setIsDropdownOpen((prev) => {
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
          if (dataTahun.length === 0) getTimeData("tahun");
          break;
        case "semester":
          if (dataSemester.length === 0 && tahunValue)
            getTimeData("semester");
          break;
        case "kuartal":
          if (datakuartal.length === 0 && semesterValue)
            getTimeData("kuartal");
          break;
        case "bulan":
          if (dataBulan.length === 0 && kuartalValue) getTimeData("bulan");
          break;
        case "minggu":
          if (dataMinggu.length === 0 && bulanValue) getTimeData("minggu");
          break;
      }
    }
  };

  const selectTimeValue = (type: Time, valueToSet: string) => {
    setValue(type, valueToSet);
    setIsDropdownOpen((prev) => ({ ...prev, [type]: false }));
    if (type === "tahun") {
      setTahunError(null);
    }
  };

  const resetTimeFilters = () => {
    setValue("tahun", "");
    setValue("semester", "");
    setValue("kuartal", "");
    setValue("bulan", "");
    setValue("minggu", "");
    setTahunError(null);

    setDataTahun([]);
    setDataSemester([]);
    setDatakuartal([]);
    setDataBulan([]);
    setDataMinggu([]);

    getTimeData("tahun");
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
      minggu: formData.minggu || undefined,
      point: value,
    };

    onSelect({
      data: updatedQuery,
      index,
      tipe,
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
          {placeholder.replace("Pilih ", "")}
        </label>
        <div
          className={`w-full p-2 border rounded-md cursor-pointer flex items-center justify-between transition-all duration-200
            ${
              showDropdown
                ? "border-blue-500 ring-1 ring-blue-300"
                : "border-gray-300 bg-gray-100"
            }
            ${loading[type] ? "opacity-70 cursor-not-allowed" : ""}`}
          onClick={() => !loading[type] && toggleDropdown(type)}
        >
          <span>{currentValue || placeholder}</span>
          {loading[type] ? (
            <FontAwesomeIcon icon={faSpinner} spin className="text-green-600" />
          ) : (
            <FontAwesomeIcon
              icon={showDropdown ? faChevronUp : faChevronDown}
              className="text-gray-500"
            />
          )}
        </div>
        {showDropdown && (
          <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
            {dataList.length > 0 && (
              <li
                className="p-2 hover:bg-blue-100 cursor-pointer text-gray-600 font-semibold sticky top-0 bg-white border-b border-gray-200"
                onClick={() => selectTimeValue(type, "")}
              >
                Semua {placeholder.replace("Pilih ", "")}
              </li>
            )}
            {loading[type] ? (
              <li className="p-2 text-center text-gray-500 flex items-center justify-center">
                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />{" "}
                Memuat data...
              </li>
            ) : dataList.length > 0 ? (
              dataList.map((item, idx) => (
                <li
                  key={idx}
                  className={`p-2 hover:bg-blue-100 cursor-pointer ${
                    currentValue === item.value
                      ? "bg-blue-50 text-blue-800 font-medium"
                      : ""
                  }`}
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
            <FontAwesomeIcon icon={faTimesCircle} className="mr-1" />{" "}
            {tahunError}
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
        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
          Filter Waktu Hotspot
        </h2>

        {/* FORM WAKTU */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {renderDropdown(
            "tahun",
            tahunValue,
            dataTahun,
            "Pilih Tahun",
            isDropdownOpen.tahun
          )}
          {renderDropdown(
            "semester",
            semesterValue,
            dataSemester,
            "Pilih Semester",
            isDropdownOpen.semester,
            !!tahunValue
          )}
          {renderDropdown(
            "kuartal",
            kuartalValue,
            datakuartal,
            "Pilih Kuartal",
            isDropdownOpen.kuartal,
            !!semesterValue
          )}
          {renderDropdown(
            "bulan",
            bulanValue,
            dataBulan,
            "Pilih Bulan",
            isDropdownOpen.bulan,
            !!kuartalValue
          )}
          {renderDropdown(
            "minggu",
            mingguValue,
            dataMinggu,
            "Pilih Minggu",
            isDropdownOpen.minggu,
            !!bulanValue
          )}

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