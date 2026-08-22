package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/zsbahtiar/hotspot/api/domain"
	"golang.org/x/sync/errgroup"
)

type HotspotRepository interface {
	GetTopProvinces(ctx context.Context, req domain.GetTopProvincesRequest) ([]domain.LocationCount, error)
	GetTopCities(ctx context.Context, req domain.GetTopCityRequest) ([]domain.LocationCount, error)
	GetMonthlyStats(ctx context.Context, req domain.GetMonthlyStatsRequest) ([]domain.MonthlyStats, error)
	GetHotspots(ctx context.Context, req domain.GetHotspotsRequest) (*domain.GetHotspotsResponse, error)
	GetConfidenceDistribution(ctx context.Context, req domain.GetDistributionRequest) ([]domain.DistributionCount, error)
	GetSatelliteDistribution(ctx context.Context, req domain.GetDistributionRequest) ([]domain.DistributionCount, error)
	GetStats(ctx context.Context, req domain.GetStatsRequest) (*domain.GetStatsResponse, error)
	GetTodayStats(ctx context.Context, timezone string) (*domain.GetTodayStatsResponse, error)
	GetConfidenceList(ctx context.Context) ([]domain.FilterOption, error)
	GetSatelliteList(ctx context.Context) ([]domain.FilterOption, error)
	GetProductList(ctx context.Context) ([]domain.FilterOption, error)
	GetPeriods(ctx context.Context, req domain.GetPeriodsRequest) (*domain.GetPeriodsResponse, error)
	GetLocations(ctx context.Context, req domain.GetLocationsRequest) (*domain.GetLocationsResponse, error)
}

type HotspotService struct {
	repo  HotspotRepository
	redis *redis.Client
}

func NewHotspotService(repo HotspotRepository, redis *redis.Client) *HotspotService {
	return &HotspotService{
		repo:  repo,
		redis: redis,
	}
}

func buildHotspotCacheKey(prefix string, req domain.GetHotspotsRequest) string {
	return fmt.Sprintf("%s:%s:%s:%d:%d:%d:%d:%d:%s:%s:%s:%s:%s:%s:%s:%d:%s",
		prefix,
		req.StartDate.Format("2006-01-02"),
		req.EndDate.Format("2006-01-02"),
		req.Year, req.Semester, req.Quarter, req.Month, req.Week,
		req.ProvinceCode, req.CityCode, req.DistrictCode, req.SubdistrictCode,
		req.SatelliteID, req.ProductID, req.ConfidenceID,
		req.Limit, req.Cursor)
}

func (h *HotspotService) GetHotspots(ctx context.Context, req domain.GetHotspotsRequest) (*domain.GetHotspotsResponse, error) {
	if req.StartDate.IsZero() {
		req.StartDate = time.Date(2000, time.January, 1, 0, 0, 0, 0, time.UTC)
	}
	if req.EndDate.IsZero() {
		now := time.Now()
		req.EndDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999, time.UTC)
	}

	cacheKey := buildHotspotCacheKey("hotspots", req)
	cachedData, err := h.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var result domain.GetHotspotsResponse
		if err := json.Unmarshal([]byte(cachedData), &result); err == nil {
			return &result, nil
		}
	}

	result, err := h.repo.GetHotspots(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest hotspots: %w", err)
	}

	go func() {
		jsonData, err := json.Marshal(result)
		if err == nil {
			_, _ = h.redis.Set(context.Background(), cacheKey, jsonData, 1*time.Hour).Result()
			h.redis.SAdd(context.Background(), "api_cache_keys", cacheKey)
		}
	}()

	return result, nil
}

func (h *HotspotService) GetHotspotsGeoJSON(ctx context.Context, req domain.GetHotspotsRequest) (*domain.GeoJSON, error) {
	if req.StartDate.IsZero() {
		req.StartDate = time.Date(2000, time.January, 1, 0, 0, 0, 0, time.UTC)
	}
	if req.EndDate.IsZero() {
		now := time.Now()
		req.EndDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999, time.UTC)
	}

	cacheKey := buildHotspotCacheKey("geojson", req)
	cachedData, err := h.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var result domain.GeoJSON
		if err := json.Unmarshal([]byte(cachedData), &result); err == nil {
			return &result, nil
		}
	}

	result, err := h.repo.GetHotspots(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get hotspots: %w", err)
	}

	geoJSON := transformToGeoJSON(result.Hotspots)
	geoJSON.Pagination = result.Pagination

	go func() {
		jsonData, err := json.Marshal(geoJSON)
		if err == nil {
			_, _ = h.redis.Set(context.Background(), cacheKey, jsonData, 2*time.Hour).Result()
			h.redis.SAdd(context.Background(), "api_cache_keys", cacheKey)
		}
	}()

	return geoJSON, nil
}

func (h *HotspotService) GetSummary(ctx context.Context, provinceLimit, cityLimit int, startDate, endDate time.Time, timezone string) (*domain.GetSummaryResponse, error) {

	now := time.Now()
	if startDate.IsZero() {
		startDate = time.Date(2000, time.January, 1, 0, 0, 0, 0, time.UTC)
	}
	if endDate.IsZero() {
		endDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999, time.UTC)
	}
	if timezone == "" {
		timezone = "UTC"
	}

	cacheKey := fmt.Sprintf("summary:province_limit:%d:city_limit:%d:start:%s:end:%s:tz:%s",
		provinceLimit, cityLimit, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"), timezone)
	cachedData, err := h.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var result domain.GetSummaryResponse
		if err := json.Unmarshal([]byte(cachedData), &result); err == nil {
			return &result, nil
		}
	}

	var (
		topProvinces           []domain.LocationCount
		topCities              []domain.LocationCount
		satelliteDistribution  []domain.DistributionCount
		stats                  *domain.GetStatsResponse
		monthlyStats           []domain.MonthlyStats
		todayStats             *domain.GetTodayStatsResponse
		confidenceDistribution []domain.DistributionCount
	)

	g, ctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		result, err := h.repo.GetTopProvinces(ctx, domain.GetTopProvincesRequest{
			StartDate: startDate,
			EndDate:   endDate,
			Limit:     provinceLimit,
		})
		if err != nil {
			return fmt.Errorf("failed to get top provinces: %w", err)
		}
		topProvinces = result
		return nil
	})

	g.Go(func() error {
		result, err := h.repo.GetTopCities(ctx, domain.GetTopCityRequest{
			StartDate: startDate,
			EndDate:   endDate,
			Limit:     cityLimit,
		})
		if err != nil {
			return fmt.Errorf("failed to get top cities: %w", err)
		}
		topCities = result
		return nil
	})

	g.Go(func() error {
		result, err := h.repo.GetSatelliteDistribution(ctx, domain.GetDistributionRequest{
			StartDate: startDate,
			EndDate:   endDate,
		})
		if err != nil {
			return fmt.Errorf("failed to get satellite distribution: %w", err)
		}
		satelliteDistribution = result
		return nil
	})

	g.Go(func() error {
		result, err := h.repo.GetStats(ctx, domain.GetStatsRequest{
			StartDate: startDate,
			EndDate:   endDate,
		})
		if err != nil {
			return fmt.Errorf("failed to get stats: %w", err)
		}
		stats = result
		return nil
	})

	g.Go(func() error {
		result, err := h.repo.GetMonthlyStats(ctx, domain.GetMonthlyStatsRequest{
			StartDate: startDate,
			EndDate:   endDate,
			Timezone:  timezone,
		})
		if err != nil {
			return fmt.Errorf("failed to get monthly stats: %w", err)
		}
		monthlyStats = result
		return nil
	})

	g.Go(func() error {
		result, err := h.repo.GetTodayStats(ctx, timezone)
		if err != nil {
			return fmt.Errorf("failed to get today stats: %w", err)
		}
		todayStats = result
		return nil
	})

	g.Go(func() error {
		result, err := h.repo.GetConfidenceDistribution(ctx, domain.GetDistributionRequest{
			StartDate: startDate,
			EndDate:   endDate,
		})
		if err != nil {
			return fmt.Errorf("failed to get confidence distribution: %w", err)
		}
		confidenceDistribution = result
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	result := &domain.GetSummaryResponse{
		TopProvinces:           topProvinces,
		TopCities:              topCities,
		SatelliteDistribution:  satelliteDistribution,
		Stats:                  stats,
		MonthlyStats:           monthlyStats,
		TodayStats:             todayStats,
		ConfidenceDistribution: confidenceDistribution,
	}

	go func() {
		jsonData, err := json.Marshal(result)
		if err == nil {
			_, _ = h.redis.Set(context.Background(), cacheKey, jsonData, 2*time.Hour).Result()
			h.redis.SAdd(context.Background(), "api_cache_keys", cacheKey)
		}
	}()

	return result, nil
}

func transformToGeoJSON(hotspots []domain.HotspotDetail) *domain.GeoJSON {
	features := make([]domain.GeoJSONFeature, 0, len(hotspots))

	for _, hotspot := range hotspots {

		lat, err := strconv.ParseFloat(hotspot.Latitude, 64)
		if err != nil {
			continue
		}
		lon, err := strconv.ParseFloat(hotspot.Longitude, 64)
		if err != nil {
			continue
		}

		location := domain.Location{
			ProvinceName:    hotspot.ProvinceName,
			CityName:        hotspot.CityName,
			DistrictName:    hotspot.DistrictName,
			SubdistrictName: hotspot.SubdistrictName,

			Provinsi:  hotspot.ProvinceName,
			KabKota:   hotspot.CityName,
			Kecamatan: hotspot.DistrictName,
			Desa:      hotspot.SubdistrictName,
			Pulau:     extractIslandFromProvinceCode(hotspot.ProvinceCode),
		}

		timestamp := hotspot.AcquiredAt.Format(time.RFC3339)
		props := domain.GeoJSONFeatureProps{
			ID:              hotspot.ID,
			AcquiredAt:      timestamp,
			Time:            timestamp,
			HotspotTime:     timestamp,
			HotspotCount:    1,
			Confidence:      hotspot.ConfidenceClass,
			ConfidenceClass: hotspot.ConfidenceClass,
			Satellite:       hotspot.SatelliteName,
			SatelliteName:   hotspot.SatelliteName,
			Instrument:      "",
			Product:         hotspot.Product,
			FRP:             hotspot.FRP,
			Brightness:      hotspot.Brightness,
			BrightT31:       hotspot.BrightT31,
			BrightTI4:       hotspot.BrightTI4,
			BrightTI5:       hotspot.BrightTI5,
			Location:        location,

			Temperature:       hotspot.Temperature,
			Humidity:          hotspot.Humidity,
			WindSpeed:         hotspot.WindSpeed,
			WindDegree:        hotspot.WindDegree,
			Visibility:        hotspot.Visibility,
			CloudCoverage:     hotspot.CloudCoverage,
			Pressure:          hotspot.Pressure,
			UVIndex:           hotspot.UVIndex,
			Precipitation:     hotspot.Precipitation,
			SolarRadiation:    hotspot.SolarRadiation,
			WeatherConditions: hotspot.WeatherConditions,
			WeatherIcon:       hotspot.WeatherIcon,
		}

		feature := domain.GeoJSONFeature{
			Type: "Feature",
			Geometry: domain.GeoJSONGeometry{
				Type:        "Point",
				Coordinates: []float64{lon, lat},
			},
			Properties: props,
		}

		features = append(features, feature)
	}

	return &domain.GeoJSON{
		Type:     "FeatureCollection",
		Features: features,
	}
}

func extractIslandFromProvinceCode(provinceCode string) string {
	if len(provinceCode) < 2 {
		return "LAINNYA"
	}

	prefix := provinceCode[:2]

	switch prefix {

	case "11", "12", "13", "14", "15", "16", "17", "18", "19", "21":
		return "SUMATERA"

	case "31", "32", "33", "34", "35", "36":
		return "JAWA"

	case "51":
		return "BALI"

	case "52", "53":
		return "NUSA TENGGARA"

	case "61", "62", "63", "64", "65":
		return "KALIMANTAN"

	case "71", "72", "73", "74", "75", "76":
		return "SULAWESI"

	case "81", "82":
		return "MALUKU"

	case "91", "92", "93", "94", "95", "96":
		return "PAPUA"
	default:
		return "LAINNYA"
	}
}

func extractIslandFromProvince(provinceName string) string {

	if containsAny(provinceName, []string{"Aceh", "Sumatera", "Sumatra", "Riau", "Jambi", "Bengkulu", "Lampung", "Bangka", "Kepulauan Riau"}) {
		return "SUMATERA"
	}

	if containsAny(provinceName, []string{"Jakarta", "Jawa", "Banten", "Yogyakarta", "Jogja"}) {
		return "JAWA"
	}

	if containsAny(provinceName, []string{"Kalimantan"}) {
		return "KALIMANTAN"
	}

	if containsAny(provinceName, []string{"Sulawesi", "Gorontalo"}) {
		return "SULAWESI"
	}

	if containsAny(provinceName, []string{"Papua"}) {
		return "PAPUA"
	}

	if containsAny(provinceName, []string{"Bali", "Nusa Tenggara"}) {
		return "BALI & NUSA TENGGARA"
	}

	if containsAny(provinceName, []string{"Maluku"}) {
		return "MALUKU"
	}

	return "LAINNYA"
}

func containsAny(s string, substrs []string) bool {
	for _, substr := range substrs {
		if len(s) >= len(substr) {
			for i := 0; i <= len(s)-len(substr); i++ {
				match := true
				for j := 0; j < len(substr); j++ {
					c1 := s[i+j]
					c2 := substr[j]
					if c1 >= 'A' && c1 <= 'Z' {
						c1 = c1 + 32
					}
					if c2 >= 'A' && c2 <= 'Z' {
						c2 = c2 + 32
					}
					if c1 != c2 {
						match = false
						break
					}
				}
				if match {
					return true
				}
			}
		}
	}
	return false
}

func (h *HotspotService) GetFilterOptions(ctx context.Context) (*domain.GetFilterOptionsResponse, error) {

	cacheKey := "filter_options"
	cachedData, err := h.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var result domain.GetFilterOptionsResponse
		if err := json.Unmarshal([]byte(cachedData), &result); err == nil {
			return &result, nil
		}
	}

	g, ctx := errgroup.WithContext(ctx)

	var confidenceList []domain.FilterOption
	var satelliteList []domain.FilterOption
	var productList []domain.FilterOption

	g.Go(func() error {
		list, err := h.repo.GetConfidenceList(ctx)
		if err != nil {
			return fmt.Errorf("failed to get confidence list: %w", err)
		}
		confidenceList = list
		return nil
	})

	g.Go(func() error {
		list, err := h.repo.GetSatelliteList(ctx)
		if err != nil {
			return fmt.Errorf("failed to get satellite list: %w", err)
		}
		satelliteList = list
		return nil
	})

	g.Go(func() error {
		list, err := h.repo.GetProductList(ctx)
		if err != nil {
			return fmt.Errorf("failed to get product list: %w", err)
		}
		productList = list
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	result := &domain.GetFilterOptionsResponse{
		Confidence: confidenceList,
		Satellites: satelliteList,
		Products:   productList,
	}

	go func() {
		jsonData, err := json.Marshal(result)
		if err == nil {
			_, _ = h.redis.Set(context.Background(), cacheKey, jsonData, 24*time.Hour).Result()
			h.redis.SAdd(context.Background(), "api_cache_keys", cacheKey)
		}
	}()

	return result, nil
}

func (h *HotspotService) GetPeriods(ctx context.Context, req domain.GetPeriodsRequest) (*domain.GetPeriodsResponse, error) {

	cacheKey := fmt.Sprintf("periods:%d:%d:%d:%d", req.Year, req.Semester, req.Quarter, req.Month)
	cachedData, err := h.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var result domain.GetPeriodsResponse
		if err := json.Unmarshal([]byte(cachedData), &result); err == nil {
			return &result, nil
		}
	}

	result, err := h.repo.GetPeriods(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get periods: %w", err)
	}

	go func() {
		jsonData, err := json.Marshal(result)
		if err == nil {
			_, _ = h.redis.Set(context.Background(), cacheKey, jsonData, 24*time.Hour).Result()
			h.redis.SAdd(context.Background(), "api_cache_keys", cacheKey)
		}
	}()

	return result, nil
}

func (h *HotspotService) GetLocations(ctx context.Context, req domain.GetLocationsRequest) (*domain.GetLocationsResponse, error) {

	cacheKey := fmt.Sprintf("locations:v4:%s:%s:%s:%d:%d:%d:%d:%d:%s:%s:%s:%s:%s",
		req.ProvinceCode, req.CityCode, req.DistrictCode,
		req.Year, req.Semester, req.Quarter, req.Month, req.Week,
		req.SatelliteID, req.ProductID, req.ConfidenceID,
		req.StartDate.Format("2006-01-02"), req.EndDate.Format("2006-01-02"))
	cachedData, err := h.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var result domain.GetLocationsResponse
		if err := json.Unmarshal([]byte(cachedData), &result); err == nil {
			return &result, nil
		}
	}

	result, err := h.repo.GetLocations(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get locations: %w", err)
	}

	if req.ProvinceCode == "" && req.CityCode == "" && req.DistrictCode == "" && len(result.Provinces) > 0 {

		islandMap := make(map[string]*domain.IslandGroup)
		islandOrder := []string{}

		for i := range result.Provinces {
			pulau := extractIslandFromProvinceCode(result.Provinces[i].Code)
			result.Provinces[i].Pulau = pulau

			if _, exists := islandMap[pulau]; !exists {
				islandMap[pulau] = &domain.IslandGroup{
					Name:      pulau,
					Count:     0,
					Provinces: []domain.LocationHierarchyItem{},
				}
				islandOrder = append(islandOrder, pulau)
			}

			islandMap[pulau].Provinces = append(islandMap[pulau].Provinces, result.Provinces[i])
			islandMap[pulau].Count += result.Provinces[i].Count
		}

		result.Islands = make([]domain.IslandGroup, 0, len(islandOrder))
		for _, pulau := range islandOrder {
			island := islandMap[pulau]
			if len(island.Provinces) > 0 {
				var totalLat, totalLng float64
				for _, prov := range island.Provinces {
					totalLat += prov.Lat
					totalLng += prov.Lng
				}
				island.Lat = totalLat / float64(len(island.Provinces))
				island.Lng = totalLng / float64(len(island.Provinces))
			}
			result.Islands = append(result.Islands, *island)
		}

		for i := 0; i < len(result.Islands)-1; i++ {
			for j := i + 1; j < len(result.Islands); j++ {
				if result.Islands[j].Count > result.Islands[i].Count {
					result.Islands[i], result.Islands[j] = result.Islands[j], result.Islands[i]
				}
			}
		}

		result.Provinces = nil
	}

	go func() {
		jsonData, err := json.Marshal(result)
		if err == nil {
			_, _ = h.redis.Set(context.Background(), cacheKey, jsonData, 24*time.Hour).Result()
			h.redis.SAdd(context.Background(), "api_cache_keys", cacheKey)
		}
	}()

	return result, nil
}
