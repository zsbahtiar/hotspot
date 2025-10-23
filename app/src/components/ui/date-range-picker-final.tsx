import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, X } from "lucide-react";
import { format, subDays, subWeeks, subMonths, subYears, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear } from "date-fns";

interface DateRange {
  from: Date;
  to?: Date;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

type PresetOption = {
  label: string;
  getValue: () => DateRange;
};

const presetOptions: PresetOption[] = [
  {
    label: "Today",
    getValue: () => {
      const today = new Date();
      return { from: today, to: today };
    },
  },
  {
    label: "Yesterday",
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return { from: yesterday, to: yesterday };
    },
  },
  {
    label: "This week",
    getValue: () => {
      const today = new Date();
      return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) };
    },
  },
  {
    label: "Last week",
    getValue: () => {
      const lastWeek = subWeeks(new Date(), 1);
      return { from: startOfWeek(lastWeek, { weekStartsOn: 1 }), to: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
    },
  },
  {
    label: "This month",
    getValue: () => {
      const today = new Date();
      return { from: startOfMonth(today), to: endOfMonth(today) };
    },
  },
  {
    label: "Last month",
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    },
  },
  {
    label: "This year",
    getValue: () => {
      const today = new Date();
      return { from: startOfYear(today), to: endOfYear(today) };
    },
  },
  {
    label: "Last year",
    getValue: () => {
      const lastYear = subYears(new Date(), 1);
      return { from: startOfYear(lastYear), to: endOfYear(lastYear) };
    },
  },
];

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  className,
  id,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(value);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    setTempRange(value);
  }, [value]);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handlePresetClick = (preset: PresetOption) => {
    const range = preset.getValue();
    setTempRange(range);
  };

  const handleApply = () => {
    onChange?.(tempRange);
    setOpen(false);
  };

  const handleCancel = () => {
    setTempRange(value);
    setOpen(false);
  };

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return placeholder;
    if (!range.to) return format(range.from, "MMM dd, yyyy");
    return `${format(range.from, "MMM dd, yyyy")} - ${format(range.to, "MMM dd, yyyy")}`;
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              "justify-start text-left font-normal w-full",
              !value && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange(value)}
          </Button>
        </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0", isMobile && "max-w-[calc(100vw-2rem)]")} align="start">
        <div className={cn("flex", isMobile ? "flex-col" : "flex-row")}>
          {/* Presets Sidebar */}
          <div className={cn(
            "flex gap-1 p-3",
            isMobile ? "flex-row flex-wrap border-b" : "flex-col border-r min-w-[140px]"
          )}>
            {presetOptions.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                onClick={() => handlePresetClick(preset)}
                className={cn("text-sm font-normal", isMobile ? "text-xs px-2" : "justify-start")}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={setTempRange as any}
              numberOfMonths={isMobile ? 1 : 2}
              defaultMonth={tempRange?.from}
            />

            {/* Date Inputs and Action Buttons */}
            <div className={cn(
              "flex gap-2 border-t pt-3 mt-3",
              isMobile ? "flex-col" : "items-center justify-between"
            )}>
              <div className={cn("flex items-center gap-2 text-sm", isMobile && "justify-center")}>
                <input
                  type="text"
                  readOnly
                  value={tempRange?.from ? format(tempRange.from, "MMM dd, yyyy") : ""}
                  placeholder="Start date"
                  className={cn("px-2 py-1 border rounded text-center bg-background", isMobile ? "w-28 text-xs" : "w-32")}
                />
                <span className="text-muted-foreground">-</span>
                <input
                  type="text"
                  readOnly
                  value={tempRange?.to ? format(tempRange.to, "MMM dd, yyyy") : ""}
                  placeholder="End date"
                  className={cn("px-2 py-1 border rounded text-center bg-background", isMobile ? "w-28 text-xs" : "w-32")}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleApply}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
    {value && (
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
        onClick={() => {
          onChange?.(undefined);
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    )}
  </div>
  );
}