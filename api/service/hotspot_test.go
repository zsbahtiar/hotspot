package service_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/zsbahtiar/hotspot/api/domain"
	"github.com/zsbahtiar/hotspot/api/service"
	"github.com/zsbahtiar/hotspot/api/service/mocks"
)

func newTestService(t *testing.T) (*service.HotspotService, *mocks.HotspotRepository) {
	t.Helper()

	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	mockRepo := new(mocks.HotspotRepository)
	svc := service.NewHotspotService(mockRepo, rdb)
	return svc, mockRepo
}

func TestHotspotService_GetHotspots(t *testing.T) {
	ctx := context.Background()

	t.Run("Applies default date range when none provided", func(t *testing.T) {
		svc, mockRepo := newTestService(t)

		expected := &domain.GetHotspotsResponse{
			Hotspots:   []domain.HotspotDetail{{ID: "01ABC"}},
			Pagination: &domain.Pagination{TotalCount: 1, Limit: 100},
		}

		mockRepo.On("GetHotspots", mock.Anything,
			mock.MatchedBy(func(r domain.GetHotspotsRequest) bool {
				return !r.StartDate.IsZero() && !r.EndDate.IsZero()
			}),
		).Return(expected, nil).Once()

		got, err := svc.GetHotspots(ctx, domain.GetHotspotsRequest{})

		assert.NoError(t, err)
		require.NotNil(t, got)
		assert.Len(t, got.Hotspots, 1)
		assert.Equal(t, "01ABC", got.Hotspots[0].ID)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Propagates repository error", func(t *testing.T) {
		svc, mockRepo := newTestService(t)

		mockRepo.On("GetHotspots", mock.Anything, mock.Anything).
			Return(nil, errors.New("clickhouse down")).Once()

		got, err := svc.GetHotspots(ctx, domain.GetHotspotsRequest{})

		assert.Error(t, err)
		assert.Nil(t, got)
		mockRepo.AssertExpectations(t)
	})
}

func TestHotspotService_GetHotspotsGeoJSON(t *testing.T) {
	ctx := context.Background()

	t.Run("Transforms hotspots to a GeoJSON FeatureCollection and skips invalid coordinates", func(t *testing.T) {
		svc, mockRepo := newTestService(t)

		repoResp := &domain.GetHotspotsResponse{
			Hotspots: []domain.HotspotDetail{
				{ID: "valid", Latitude: "-6.2", Longitude: "106.8", ProvinceCode: "31", ProvinceName: "DKI Jakarta", ConfidenceClass: "HIGH", SatelliteName: "TERRA"},
				{ID: "bad-lat", Latitude: "not-a-number", Longitude: "106.8"},
			},
			Pagination: &domain.Pagination{TotalCount: 2, HasNext: false, Limit: 500},
		}

		mockRepo.On("GetHotspots", mock.Anything, mock.Anything).Return(repoResp, nil).Once()

		req := domain.GetHotspotsRequest{
			StartDate: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
			EndDate:   time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC),
		}
		got, err := svc.GetHotspotsGeoJSON(ctx, req)

		assert.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, "FeatureCollection", got.Type)
		require.Len(t, got.Features, 1, "invalid-coordinate hotspot must be dropped")

		f := got.Features[0]
		assert.Equal(t, "Feature", f.Type)
		assert.Equal(t, "Point", f.Geometry.Type)

		assert.Equal(t, []float64{106.8, -6.2}, f.Geometry.Coordinates)
		assert.Equal(t, "valid", f.Properties.ID)
		assert.Equal(t, "JAWA", f.Properties.Location.Pulau, "province code 31 maps to island JAWA")
		require.NotNil(t, got.Pagination)
		assert.Equal(t, uint64(2), got.Pagination.TotalCount)
		mockRepo.AssertExpectations(t)
	})
}

func TestHotspotService_GetSummary(t *testing.T) {
	ctx := context.Background()

	t.Run("Fans out to every repository call and assembles the summary", func(t *testing.T) {
		svc, mockRepo := newTestService(t)

		provinces := []domain.LocationCount{{Name: "Riau", Count: 10}}
		cities := []domain.LocationCount{{Name: "Pekanbaru", Count: 5}}
		satDist := []domain.DistributionCount{{Name: "TERRA", Count: 8}}
		confDist := []domain.DistributionCount{{Name: "HIGH", Count: 3}}
		stats := &domain.GetStatsResponse{TotalHotspots: 10, HighConfidence: 3, AffectedProvinces: 1}
		monthly := []domain.MonthlyStats{{Total: 10, HighConfidence: 3}}
		today := &domain.GetTodayStatsResponse{TodayHotspots: 2}

		mockRepo.On("GetTopProvinces", mock.Anything, mock.Anything).Return(provinces, nil).Once()
		mockRepo.On("GetTopCities", mock.Anything, mock.Anything).Return(cities, nil).Once()
		mockRepo.On("GetSatelliteDistribution", mock.Anything, mock.Anything).Return(satDist, nil).Once()
		mockRepo.On("GetConfidenceDistribution", mock.Anything, mock.Anything).Return(confDist, nil).Once()
		mockRepo.On("GetStats", mock.Anything, mock.Anything).Return(stats, nil).Once()
		mockRepo.On("GetMonthlyStats", mock.Anything, mock.Anything).Return(monthly, nil).Once()
		mockRepo.On("GetTodayStats", mock.Anything, mock.Anything).Return(today, nil).Once()

		got, err := svc.GetSummary(ctx, 10, 10, time.Time{}, time.Time{}, "Asia/Jakarta")

		assert.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, provinces, got.TopProvinces)
		assert.Equal(t, cities, got.TopCities)
		assert.Equal(t, satDist, got.SatelliteDistribution)
		assert.Equal(t, confDist, got.ConfidenceDistribution)
		assert.Equal(t, stats, got.Stats)
		assert.Equal(t, monthly, got.MonthlyStats)
		assert.Equal(t, today, got.TodayStats)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Returns error when a fan-out call fails", func(t *testing.T) {
		svc, mockRepo := newTestService(t)

		mockRepo.On("GetTopProvinces", mock.Anything, mock.Anything).Return(nil, errors.New("boom")).Maybe()
		mockRepo.On("GetTopCities", mock.Anything, mock.Anything).Return([]domain.LocationCount{}, nil).Maybe()
		mockRepo.On("GetSatelliteDistribution", mock.Anything, mock.Anything).Return([]domain.DistributionCount{}, nil).Maybe()
		mockRepo.On("GetConfidenceDistribution", mock.Anything, mock.Anything).Return([]domain.DistributionCount{}, nil).Maybe()
		mockRepo.On("GetStats", mock.Anything, mock.Anything).Return(&domain.GetStatsResponse{}, nil).Maybe()
		mockRepo.On("GetMonthlyStats", mock.Anything, mock.Anything).Return([]domain.MonthlyStats{}, nil).Maybe()
		mockRepo.On("GetTodayStats", mock.Anything, mock.Anything).Return(&domain.GetTodayStatsResponse{}, nil).Maybe()

		got, err := svc.GetSummary(ctx, 10, 10, time.Time{}, time.Time{}, "UTC")

		assert.Error(t, err)
		assert.Nil(t, got)
	})
}

func TestHotspotService_GetFilterOptions(t *testing.T) {
	ctx := context.Background()

	t.Run("Combines confidence and satellite lists", func(t *testing.T) {
		svc, mockRepo := newTestService(t)

		conf := []domain.FilterOption{{ID: "HIGH", Name: "HIGH"}}
		sat := []domain.FilterOption{{ID: "TERRA", Name: "TERRA"}}
		prod := []domain.FilterOption{{ID: "SP", Name: "SP"}}

		mockRepo.On("GetConfidenceList", mock.Anything).Return(conf, nil).Once()
		mockRepo.On("GetSatelliteList", mock.Anything).Return(sat, nil).Once()
		mockRepo.On("GetProductList", mock.Anything).Return(prod, nil).Once()

		got, err := svc.GetFilterOptions(ctx)

		assert.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, conf, got.Confidence)
		assert.Equal(t, sat, got.Satellites)
		assert.Equal(t, prod, got.Products)
		mockRepo.AssertExpectations(t)
	})
}

func TestHotspotService_GetLocations(t *testing.T) {
	ctx := context.Background()

	t.Run("Groups top-level provinces into islands sorted by count", func(t *testing.T) {
		svc, mockRepo := newTestService(t)

		repoResp := &domain.GetLocationsResponse{
			Provinces: []domain.LocationHierarchyItem{
				{Code: "11", Name: "Aceh", Count: 50, Lat: 4.7, Lng: 96.7},
				{Code: "31", Name: "DKI Jakarta", Count: 100, Lat: -6.2, Lng: 106.8},
				{Code: "32", Name: "Jawa Barat", Count: 200, Lat: -6.9, Lng: 107.6},
			},
		}

		mockRepo.On("GetLocations", mock.Anything,
			mock.MatchedBy(func(r domain.GetLocationsRequest) bool {
				return r.ProvinceCode == "" && r.CityCode == "" && r.DistrictCode == ""
			}),
		).Return(repoResp, nil).Once()

		got, err := svc.GetLocations(ctx, domain.GetLocationsRequest{})

		assert.NoError(t, err)
		require.NotNil(t, got)
		assert.Nil(t, got.Provinces, "flat provinces are cleared once grouped into islands")
		require.Len(t, got.Islands, 2)

		assert.Equal(t, "JAWA", got.Islands[0].Name)
		assert.Equal(t, uint64(300), got.Islands[0].Count)
		assert.Len(t, got.Islands[0].Provinces, 2)
		assert.Equal(t, "SUMATERA", got.Islands[1].Name)
		assert.Equal(t, uint64(50), got.Islands[1].Count)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Passes through drill-down results without island grouping", func(t *testing.T) {
		svc, mockRepo := newTestService(t)

		repoResp := &domain.GetLocationsResponse{
			Cities: []domain.LocationHierarchyItem{{Code: "3171", Name: "Jakarta Selatan", Count: 40}},
		}

		mockRepo.On("GetLocations", mock.Anything,
			mock.MatchedBy(func(r domain.GetLocationsRequest) bool {
				return r.ProvinceCode == "31"
			}),
		).Return(repoResp, nil).Once()

		got, err := svc.GetLocations(ctx, domain.GetLocationsRequest{ProvinceCode: "31"})

		assert.NoError(t, err)
		require.NotNil(t, got)
		assert.Empty(t, got.Islands)
		require.Len(t, got.Cities, 1)
		assert.Equal(t, "Jakarta Selatan", got.Cities[0].Name)
		mockRepo.AssertExpectations(t)
	})
}

func TestHotspotService_GetPeriods(t *testing.T) {
	ctx := context.Background()

	t.Run("Returns periods from the repository", func(t *testing.T) {
		svc, mockRepo := newTestService(t)

		expected := &domain.GetPeriodsResponse{
			Years: []domain.PeriodValue{{Value: "2025", Label: "2025"}},
		}
		mockRepo.On("GetPeriods", mock.Anything, mock.Anything).Return(expected, nil).Once()

		got, err := svc.GetPeriods(ctx, domain.GetPeriodsRequest{})

		assert.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, expected.Years, got.Years)
		mockRepo.AssertExpectations(t)
	})
}
