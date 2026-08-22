package domain

import (
	"time"
)

type Location struct {
	ProvinceName    string `json:"province_name"`
	CityName        string `json:"city_name"`
	DistrictName    string `json:"district_name"`
	SubdistrictName string `json:"subdistrict_name"`

	Provinsi  string `json:"provinsi"`
	KabKota   string `json:"kab_kota"`
	Kecamatan string `json:"kecamatan"`
	Desa      string `json:"desa"`
	Pulau     string `json:"pulau,omitempty"`
}

type HotspotDetail struct {
	ID         string    `ch:"id" json:"id"`
	AcquiredAt time.Time `ch:"acquired_at" json:"acquired_at"`
	Latitude   string    `ch:"latitude" json:"latitude"`
	Longitude  string    `ch:"longitude" json:"longitude"`
	FRP        float32   `ch:"frp" json:"frp"`
	Brightness float32   `ch:"brightness" json:"brightness"`
	BrightT31  float32   `ch:"bright_t31" json:"bright_t31"`
	BrightTI4  float32   `ch:"bright_ti4" json:"bright_ti4"`
	BrightTI5  float32   `ch:"bright_ti5" json:"bright_ti5"`

	ConfidenceClass string `ch:"confidence_class" json:"confidence_class"`

	SatelliteName string `ch:"satellite_name" json:"satellite_name"`
	Product       string `ch:"product" json:"product"`

	ProvinceCode string `ch:"province_code" json:"province_code"`
	ProvinceName string `ch:"province_name" json:"province_name"`

	CityCode string `ch:"city_code" json:"city_code"`
	CityName string `ch:"city_name" json:"city_name"`

	DistrictCode string `ch:"district_code" json:"district_code"`
	DistrictName string `ch:"district_name" json:"district_name"`

	SubdistrictCode string `ch:"subdistrict_code" json:"subdistrict_code"`
	SubdistrictName string `ch:"subdistrict_name" json:"subdistrict_name"`

	Temperature       int16   `ch:"temperature" json:"temperature"`
	Humidity          float32 `ch:"humidity" json:"humidity"`
	WindSpeed         float32 `ch:"wind_speed" json:"wind_speed"`
	WindDegree        float32 `ch:"wind_degree" json:"wind_degree"`
	Visibility        uint16  `ch:"visibility" json:"visibility"`
	CloudCoverage     uint8   `ch:"cloud_coverage" json:"cloud_coverage"`
	Pressure          uint16  `ch:"pressure" json:"pressure"`
	UVIndex           uint8   `ch:"uv_index" json:"uv_index"`
	Precipitation     float32 `ch:"precipitation" json:"precipitation"`
	SolarRadiation    float32 `ch:"solar_radiation" json:"solar_radiation"`
	WeatherConditions string  `ch:"weather_conditions" json:"weather_conditions"`
	WeatherIcon       string  `ch:"weather_icon" json:"weather_icon"`
}

type GetTopProvincesRequest struct {
	StartDate time.Time
	EndDate   time.Time
	Limit     int
}

type GetTopCityRequest struct {
	StartDate time.Time
	EndDate   time.Time
	Limit     int
}

type GetMonthlyStatsRequest struct {
	StartDate time.Time
	EndDate   time.Time
	Timezone  string
}

type GetHotspotsRequest struct {
	StartDate time.Time
	EndDate   time.Time

	Year     int
	Semester int
	Quarter  int
	Month    int
	Week     int

	ProvinceCode    string
	CityCode        string
	DistrictCode    string
	SubdistrictCode string

	SatelliteID string

	ProductID string

	ConfidenceID string

	Limit  int
	Cursor string
}

type GetDistributionRequest struct {
	StartDate time.Time
	EndDate   time.Time
}

type GetStatsRequest struct {
	StartDate time.Time
	EndDate   time.Time
}

type GetPeriodsRequest struct {
	Year     int
	Semester int
	Quarter  int
	Month    int
}

type GetLocationsRequest struct {
	ProvinceCode string
	CityCode     string
	DistrictCode string

	StartDate    time.Time
	EndDate      time.Time
	Year         int
	Semester     int
	Quarter      int
	Month        int
	Week         int
	SatelliteID  string
	ProductID    string
	ConfidenceID string
}

type HotspotSummary struct {
	TotalCount   int             `json:"total_count"`
	DateRange    DateRange       `json:"date_range"`
	TopProvinces []LocationCount `json:"top_provinces"`
	TopCities    []LocationCount `json:"top_cities"`
	Confidence   map[string]int  `json:"confidence"`
	Satellites   map[string]int  `json:"satellites"`
	Monthly      []MonthlyCount  `json:"monthly"`
	DailyAvg     float64         `json:"daily_avg"`
}

type GeoJSON struct {
	Type       string           `json:"type"`
	Features   []GeoJSONFeature `json:"features"`
	Pagination *Pagination      `json:"pagination,omitempty"`
}

type Pagination struct {
	TotalCount uint64 `json:"total_count"`
	HasNext    bool   `json:"has_next"`
	NextCursor string `json:"next_cursor,omitempty"`
	Limit      int    `json:"limit"`
}

type GetHotspotsResponse struct {
	Hotspots   []HotspotDetail `json:"hotspots"`
	Pagination *Pagination     `json:"pagination,omitempty"`
}

type GeoJSONFeature struct {
	Type       string              `json:"type"`
	Geometry   GeoJSONGeometry     `json:"geometry"`
	Properties GeoJSONFeatureProps `json:"properties"`
}

type GeoJSONFeatureProps struct {
	ID              string   `json:"id"`
	AcquiredAt      string   `json:"acquired_at"`
	Time            string   `json:"time"`
	HotspotTime     string   `json:"hotspot_time"`
	HotspotCount    int      `json:"hotspot_count"`
	Confidence      string   `json:"confidence"`
	ConfidenceClass string   `json:"confidence_class"`
	Satellite       string   `json:"satellite"`
	SatelliteName   string   `json:"satellite_name"`
	Instrument      string   `json:"instrument"`
	Product         string   `json:"product"`
	FRP             float32  `json:"frp"`
	Brightness      float32  `json:"brightness"`
	BrightT31       float32  `json:"bright_t31,omitempty"`
	BrightTI4       float32  `json:"bright_ti4,omitempty"`
	BrightTI5       float32  `json:"bright_ti5,omitempty"`
	Location        Location `json:"location"`

	Temperature       int16   `json:"temperature,omitempty"`
	Humidity          float32 `json:"humidity,omitempty"`
	WindSpeed         float32 `json:"wind_speed,omitempty"`
	WindDegree        float32 `json:"wind_degree,omitempty"`
	Visibility        uint16  `json:"visibility,omitempty"`
	CloudCoverage     uint8   `json:"cloud_coverage,omitempty"`
	Pressure          uint16  `json:"pressure,omitempty"`
	UVIndex           uint8   `json:"uv_index,omitempty"`
	Precipitation     float32 `json:"precipitation,omitempty"`
	SolarRadiation    float32 `json:"solar_radiation,omitempty"`
	WeatherConditions string  `json:"weather_conditions,omitempty"`
	WeatherIcon       string  `json:"weather_icon,omitempty"`
}

type GeoJSONGeometry struct {
	Type        string    `json:"type"`
	Coordinates []float64 `json:"coordinates"`
}

type LocationCount struct {
	Name  string `json:"name" ch:"name"`
	Count uint64 `json:"count" ch:"count"`
}

type MonthlyCount struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

type DateRange struct {
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
}

type GetTopProvincesResponse struct {
	Provinces []LocationCount `json:"provinces"`
}

type GetTopCitiesResponse struct {
	Cities []LocationCount `json:"cities"`
}

type GetMonthlyStatsResponse struct {
	Monthlies []MonthlyStats `json:"monthlies"`
}

type MonthlyStats struct {
	Month          time.Time `json:"month" ch:"month"`
	Total          uint64    `json:"total" ch:"total"`
	HighConfidence uint64    `json:"high_confidence" ch:"high_confidence"`
}

type DistributionCount struct {
	Name  string `json:"name" ch:"name"`
	Count uint64 `json:"count" ch:"count"`
}

type GetConfidenceDistributionResponse struct {
	Distributions []DistributionCount `json:"distributions"`
}

type GetSatelliteDistributionResponse struct {
	Distributions []DistributionCount `json:"distributions"`
}

type GetStatsResponse struct {
	TotalHotspots     uint64 `ch:"total_hotspots" json:"total_hotspots"`
	HighConfidence    uint64 `ch:"high_confidence" json:"high_confidence"`
	AffectedProvinces uint64 `ch:"affected_provinces" json:"affected_provinces"`
}

type GetTodayStatsResponse struct {
	TodayHotspots          uint64 `ch:"today_hotspots" json:"today_hotspots"`
	TodayAffectedProvinces uint64 `ch:"today_affected_provinces" json:"today_affected_provinces"`
	TodayHighConfidence    uint64 `ch:"today_high_confidence" json:"today_high_confidence"`
}

type GetSummaryResponse struct {
	TopProvinces           []LocationCount        `json:"top_provinces"`
	TopCities              []LocationCount        `json:"top_cities"`
	SatelliteDistribution  []DistributionCount    `json:"satellite_distribution"`
	Stats                  *GetStatsResponse      `json:"stats"`
	MonthlyStats           []MonthlyStats         `json:"monthly_stats"`
	TodayStats             *GetTodayStatsResponse `json:"today_stats"`
	ConfidenceDistribution []DistributionCount    `json:"confidence_distribution"`
}

type FilterOption struct {
	ID   string `ch:"id" json:"id"`
	Name string `ch:"name" json:"name"`
}

type GetFilterOptionsResponse struct {
	Confidence []FilterOption `json:"confidence"`
	Satellites []FilterOption `json:"satellites"`
	Products   []FilterOption `json:"products"`
}

type PeriodValue struct {
	Value string `json:"value" ch:"value"`
	Label string `json:"label" ch:"label"`
}

type GetPeriodsResponse struct {
	Years     []PeriodValue `json:"years,omitempty"`
	Semesters []PeriodValue `json:"semesters,omitempty"`
	Quarters  []PeriodValue `json:"quarters,omitempty"`
	Months    []PeriodValue `json:"months,omitempty"`
	Weeks     []PeriodValue `json:"weeks,omitempty"`
}

type LocationHierarchyItem struct {
	Code  string  `json:"code" ch:"code"`
	Name  string  `json:"name" ch:"name"`
	Pulau string  `json:"pulau,omitempty"`
	Count uint64  `json:"count" ch:"count"`
	Lat   float64 `json:"lat" ch:"lat"`
	Lng   float64 `json:"lng" ch:"lng"`
}

type IslandGroup struct {
	Name      string                  `json:"name"`
	Count     uint64                  `json:"count"`
	Lat       float64                 `json:"lat"`
	Lng       float64                 `json:"lng"`
	Provinces []LocationHierarchyItem `json:"provinces"`
}

type GetLocationsResponse struct {
	Islands []IslandGroup `json:"islands,omitempty"`

	Provinces    []LocationHierarchyItem `json:"provinces,omitempty"`
	Cities       []LocationHierarchyItem `json:"cities,omitempty"`
	Districts    []LocationHierarchyItem `json:"districts,omitempty"`
	Subdistricts []LocationHierarchyItem `json:"subdistricts,omitempty"`
}
