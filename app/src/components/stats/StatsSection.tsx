import { Card, CardContent } from "@/components/ui/card";

interface StatsSectionProps {
  stats: {
    todayHotspots: number;
    todayAffectedProvinces: number;
    todayHighConfidence: number;
  };
  isLoading: boolean;
}

const StatsSection = ({ stats, isLoading }: StatsSectionProps) => {
  return (
    <section className="py-16 bg-secondary text-secondary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="text-4xl font-bold mb-2">
                {isLoading ? "..." : stats.todayHotspots}
              </div>
              <div className="text-lg">Hotspot Hari Ini</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="text-4xl font-bold mb-2">
                {isLoading ? "..." : stats.todayAffectedProvinces}
              </div>
              <div className="text-lg">Provinsi Lokasi Hotspot Hari ini</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="text-4xl font-bold mb-2">
                {isLoading ? "..." : stats.todayHighConfidence}
              </div>
              <div className="text-lg"> Confidence Tinggi Hari Ini</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
