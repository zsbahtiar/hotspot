import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { hotspotService } from "@/core/services/hotspotService";
import { RefreshCw, X } from "lucide-react";
import type { QueryData } from "@/core/models/query";
import type { Time } from "@/core/models/time";
import type { DrillDownLevel } from "@/core/models/location";
import { monthNames } from "@/core/models/time";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  onSelect: (data: {
    data: QueryData;
    index: number[];
    tipe: DrillDownLevel;
  }) => void;
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
  const { handleSubmit, setValue, watch, reset } = useForm<QueryData>({
    defaultValues: {
      tahun: query.tahun || "",
      semester: query.semester || "",
      kuartal: query.kuartal || "",
      bulan: query.bulan || "",
      minggu: query.minggu || "",
    },
  });
  const [dataTahun, setDataTahun] = useState<FormattedDataItem[]>([]);
  const [dataSemester, setDataSemester] = useState<FormattedDataItem[]>([]);
  const [datakuartal, setDatakuartal] = useState<FormattedDataItem[]>([]);
  const [dataBulan, setDataBulan] = useState<FormattedDataItem[]>([]);
  const [dataMinggu, setDataMinggu] = useState<FormattedDataItem[]>([]);
  const [loading, setLoading] = useState<Record<Time, boolean>>({
    tahun: false,
    semester: false,
    kuartal: false,
    bulan: false,
    minggu: false,
  });
  const [error, setError] = useState<Record<Time, string | null>>({
    tahun: null,
    semester: null,
    kuartal: null,
    bulan: null,
    minggu: null,
  });

  const [tahunError, setTahunError] = useState<string | null>(null);
  const tahunValue = watch("tahun");
  const semesterValue = watch("semester");
  const kuartalValue = watch("kuartal");
  const bulanValue = watch("bulan");
  const mingguValue = watch("minggu");

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
    [tipe, value, tahunValue, semesterValue, kuartalValue, bulanValue],
  );

  const getTimeData = useCallback(
    async (type: Time) => {
      setLoading((prev) => ({ ...prev, [type]: true }));
      setError((prev) => ({ ...prev, [type]: null }));
      try {
        const params: { year?: number; semester?: number; quarter?: number; month?: number } = {};

        if (type === "semester" && tahunValue) {
          params.year = parseInt(tahunValue);
        } else if (type === "kuartal" && tahunValue && semesterValue) {
          params.year = parseInt(tahunValue);
          params.semester = parseInt(semesterValue);
        } else if (type === "bulan" && tahunValue && semesterValue && kuartalValue) {
          params.year = parseInt(tahunValue);
          params.semester = parseInt(semesterValue);
          const quarterMatch = kuartalValue.match(/\d+/);
          if (quarterMatch) {
            params.quarter = parseInt(quarterMatch[0]);
          }
        } else if (type === "minggu" && tahunValue && semesterValue && kuartalValue && bulanValue) {
          params.year = parseInt(tahunValue);
          params.semester = parseInt(semesterValue);
          const quarterMatch = kuartalValue.match(/\d+/);
          if (quarterMatch) {
            params.quarter = parseInt(quarterMatch[0]);
          }
          params.month = monthNames.indexOf(bulanValue) + 1;
        }

        const response = await hotspotService.getPeriods(type === "tahun" ? undefined : params);

        let formattedData: FormattedDataItem[] = [];

        if (response?.data) {
          switch (type) {
            case "tahun":
              formattedData = response.data.years || [];
              break;
            case "semester":
              formattedData = response.data.semesters || [];
              break;
            case "kuartal":
              formattedData = response.data.quarters || [];
              break;
            case "bulan":
              formattedData = response.data.months || [];
              break;
            case "minggu":
              formattedData = response.data.weeks || [];
              break;
          }

          switch (type) {
            case "tahun":
              formattedData = formattedData.sort(
                (a, b) => Number(b.value) - Number(a.value),
              );
              break;
            case "semester":
              formattedData = formattedData.sort(
                (a, b) => Number(a.value) - Number(b.value),
              );
              break;
            case "kuartal":
              const orderKuartal = ["Q1", "Q2", "Q3", "Q4"];
              formattedData = formattedData.sort(
                (a, b) =>
                  orderKuartal.indexOf(a.value.toUpperCase()) -
                  orderKuartal.indexOf(b.value.toUpperCase()),
              );
              break;
            case "bulan":
              formattedData = formattedData.sort(
                (a, b) =>
                  monthNames.indexOf(a.value) - monthNames.indexOf(b.value),
              );
              break;
            case "minggu":
              formattedData = formattedData.sort(
                (a, b) => Number(a.value) - Number(b.value),
              );
              break;
          }

          switch (type) {
            case "tahun":
              setDataTahun(formattedData);
              break;
            case "semester":
              const validSemester = formattedData.filter((item) =>
                ["1", "2"].includes(item.value),
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
                ["Q1", "Q2", "Q3", "Q4"].includes(item.value.toUpperCase()),
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
        }
      } catch (error: unknown) {
        console.error(`Error fetching ${type} data:`, error);
        const errorMessage = error instanceof Error ? error.message : "Gagal memuat data. Periksa koneksi Anda.";
        setError((prev) => ({ ...prev, [type]: errorMessage }));

        switch (type) {
          case "tahun":
            setDataTahun([]);
            break;
          case "semester":
            setDataSemester([]);
            break;
          case "kuartal":
            setDatakuartal([]);
            break;
          case "bulan":
            setDataBulan([]);
            break;
          case "minggu":
            setDataMinggu([]);
            break;
        }
      } finally {
        setLoading((prev) => ({ ...prev, [type]: false }));
      }
    },
    [
      tahunValue,
      semesterValue,
      kuartalValue,
      bulanValue,
      mingguValue,
      setValue,
    ],
  );

  useEffect(() => {
    const loadInitialData = async () => {
      await getTimeData("tahun");

      if (query.tahun) {
        await getTimeData("semester");
      }
      if (query.semester) {
        await getTimeData("kuartal");
      }
      if (query.kuartal) {
        await getTimeData("bulan");
      }
      if (query.bulan) {
        await getTimeData("minggu");
      }
    };

    loadInitialData();
  }, []);

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


  const resetTimeFilters = () => {
    reset({
      tahun: "",
      semester: "",
      kuartal: "",
      bulan: "",
      minggu: "",
    });
    setTahunError(null);

    setDataTahun([]);
    setDataSemester([]);
    setDatakuartal([]);
    setDataBulan([]);
    setDataMinggu([]);

    getTimeData("tahun");
  };

  const onSubmit = (formData: QueryData) => {
    const allEmpty = !formData.tahun && !formData.semester && !formData.kuartal && !formData.bulan && !formData.minggu;

    const hasChildWithoutParent = !formData.tahun && (formData.semester || formData.kuartal || formData.bulan || formData.minggu);

    if (hasChildWithoutParent) {
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

  const renderSelect = (
    type: Time,
    currentValue: string | undefined,
    dataList: FormattedDataItem[],
    placeholder: string,
    hasParentValue: boolean = true,
  ) => {
    if (!hasParentValue && type !== "tahun") return null;

    const hasError = error[type];
    const isDisabled = loading[type] || !!hasError;

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          {placeholder.replace("Pilih ", "")}
        </label>
        <div className="flex items-center gap-2">
          <Select
            value={currentValue || ""}
            onValueChange={(value) => {
              setValue(type, value || "");
              if (type === "tahun") setTahunError(null);
            }}
            disabled={isDisabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={placeholder}>
                {loading[type] ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Memuat...
                  </span>
                ) : hasError ? (
                  <span className="flex items-center gap-2 text-destructive">
                    <X className="h-4 w-4" />
                    Error
                  </span>
                ) : (
                  currentValue || placeholder
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {dataList.length > 0 ? (
                dataList.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__no_data__" disabled>
                  Tidak ada data
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {currentValue && !loading[type] && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                if (type === "tahun") {
                  setTahunError(null);
                  reset({
                    tahun: "",
                    semester: "",
                    kuartal: "",
                    bulan: "",
                    minggu: "",
                  });
                  setDataSemester([]);
                  setDatakuartal([]);
                  setDataBulan([]);
                  setDataMinggu([]);
                } else if (type === "semester") {
                  reset({
                    tahun: tahunValue,
                    semester: "",
                    kuartal: "",
                    bulan: "",
                    minggu: "",
                  });
                  setDatakuartal([]);
                  setDataBulan([]);
                  setDataMinggu([]);
                } else if (type === "kuartal") {
                  reset({
                    tahun: tahunValue,
                    semester: semesterValue,
                    kuartal: "",
                    bulan: "",
                    minggu: "",
                  });
                  setDataBulan([]);
                  setDataMinggu([]);
                } else if (type === "bulan") {
                  reset({
                    tahun: tahunValue,
                    semester: semesterValue,
                    kuartal: kuartalValue,
                    bulan: "",
                    minggu: "",
                  });
                  setDataMinggu([]);
                } else if (type === "minggu") {
                  reset({
                    tahun: tahunValue,
                    semester: semesterValue,
                    kuartal: kuartalValue,
                    bulan: bulanValue,
                    minggu: "",
                  });
                }
              }}
              className="p-2 hover:bg-muted rounded-md transition-colors shrink-0"
              aria-label={`Reset ${placeholder.replace("Pilih ", "")}`}
              title="Reset"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          {hasError && (
            <button
              type="button"
              onClick={() => getTimeData(type)}
              className="p-2 hover:bg-muted rounded-md transition-colors shrink-0"
              aria-label="Coba lagi"
              title="Coba lagi"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        {hasError && (
          <p className="text-destructive text-xs mt-1 flex items-center gap-1">
            <X className="h-3 w-3" /> {hasError}
          </p>
        )}
        {type === "tahun" && tahunError && !hasError && (
          <p className="text-destructive text-xs mt-1 flex items-center gap-1">
            <X className="h-3 w-3" /> {tahunError}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
      <div
        className="bg-card rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto shadow-xl transform transition-all duration-300 scale-100 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-foreground mb-4 border-b border-border pb-2">
          Filter Waktu Hotspot
        </h2>

        {}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {renderSelect(
            "tahun",
            tahunValue,
            dataTahun,
            "Pilih Tahun",
          )}
          {renderSelect(
            "semester",
            semesterValue,
            dataSemester,
            "Pilih Semester",
            !!tahunValue,
          )}
          {renderSelect(
            "kuartal",
            kuartalValue,
            datakuartal,
            "Pilih Kuartal",
            !!semesterValue,
          )}
          {renderSelect(
            "bulan",
            bulanValue,
            dataBulan,
            "Pilih Bulan",
            !!kuartalValue,
          )}
          {renderSelect(
            "minggu",
            mingguValue,
            dataMinggu,
            "Pilih Minggu",
            !!bulanValue,
          )}

          <div className="flex justify-between items-center pt-4 border-t border-border mt-4">
            <button
              type="button"
              onClick={resetTimeFilters}
              className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-muted transition-all duration-200"
            >
              Reset Filter
            </button>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-muted transition-all duration-200"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary rounded-md text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200"
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
