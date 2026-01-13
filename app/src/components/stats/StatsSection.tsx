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
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div className="text-center py-6 sm:py-0 sm:px-8">
            <div className="text-4xl font-bold text-primary mb-2">
              {isLoading ? "..." : stats.todayHotspots}
            </div>
            <div className="text-lg text-muted-foreground">Hotspot Hari Ini</div>
          </div>
          <div className="text-center py-6 sm:py-0 sm:px-8">
            <div className="text-4xl font-bold text-primary mb-2">
              {isLoading ? "..." : stats.todayAffectedProvinces}
            </div>
            <div className="text-lg text-muted-foreground">Provinsi Terdampak</div>
          </div>
          <div className="text-center py-6 sm:py-0 sm:px-8">
            <div className="text-4xl font-bold text-primary mb-2">
              {isLoading ? "..." : stats.todayHighConfidence}
            </div>
            <div className="text-lg text-muted-foreground">Confidence Tinggi</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
