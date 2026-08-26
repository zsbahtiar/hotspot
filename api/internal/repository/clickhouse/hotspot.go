package clickhouse

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/zsbahtiar/hotspot/api/domain"
)

type HotspotRepository struct {
	conn clickhouse.Conn
}

func NewHotspotRepository(conn clickhouse.Conn) *HotspotRepository {
	return &HotspotRepository{
		conn: conn,
	}
}

func (r *HotspotRepository) Ping() error {
	return r.conn.Ping(context.Background())
}

func (r *HotspotRepository) GetTopProvinces(ctx context.Context, req domain.GetTopProvincesRequest) ([]domain.LocationCount, error) {
	query := `
		SELECT
			dl.province_name as name,
			count(*) as count
		FROM hotspot.fact_hotspot fh
		INNER JOIN hotspot.dim_location dl ON fh.location_id = dl.id
		WHERE 1=1`

	args := make([]interface{}, 0)

	if !req.StartDate.IsZero() {
		query += " AND fh.acquired_at >= ?"
		args = append(args, req.StartDate)
	}

	if !req.EndDate.IsZero() {
		query += " AND fh.acquired_at <= ?"
		args = append(args, req.EndDate)
	}

	query += `
		GROUP BY name
		HAVING name != ''
		ORDER BY count DESC
		LIMIT ?`

	args = append(args, req.Limit)

	var result []domain.LocationCount
	if err := r.conn.Select(ctx, &result, query, args...); err != nil {
		return nil, fmt.Errorf("failed to get top provinces: %w", err)
	}

	return result, nil
}

func (r *HotspotRepository) GetTopCities(ctx context.Context, req domain.GetTopCityRequest) ([]domain.LocationCount, error) {
	query := `
		SELECT
			dl.city_name as name,
			count(*) as count
		FROM hotspot.fact_hotspot fh
		INNER JOIN hotspot.dim_location dl ON fh.location_id = dl.id
		WHERE 1=1`

	args := make([]interface{}, 0)

	if !req.StartDate.IsZero() {
		query += " AND fh.acquired_at >= ?"
		args = append(args, req.StartDate)
	}

	if !req.EndDate.IsZero() {
		query += " AND fh.acquired_at <= ?"
		args = append(args, req.EndDate)
	}

	query += `
		GROUP BY name
		HAVING name != ''
		ORDER BY count DESC
		LIMIT ?`

	args = append(args, req.Limit)

	var result []domain.LocationCount
	if err := r.conn.Select(ctx, &result, query, args...); err != nil {
		return nil, fmt.Errorf("failed to get top cities: %w", err)
	}

	return result, nil
}

func (r *HotspotRepository) GetMonthlyStats(ctx context.Context, req domain.GetMonthlyStatsRequest) ([]domain.MonthlyStats, error) {

	timezone := req.Timezone
	if timezone == "" {
		timezone = "UTC"
	}

	query := `
		SELECT
			toStartOfMonth(fh.acquired_at, ?) as month,
			count(*) as total,
			countIf(dc.confidence_class = 'HIGH') as high_confidence
		FROM hotspot.fact_hotspot fh
		INNER JOIN hotspot.dim_confidence dc ON fh.confidence_id = dc.id
		WHERE 1=1
	`
	args := []interface{}{timezone}

	if !req.StartDate.IsZero() {
		query += " AND fh.acquired_at >= ?"
		args = append(args, req.StartDate)
	}

	if !req.EndDate.IsZero() {
		query += " AND fh.acquired_at <= ?"
		args = append(args, req.EndDate)
	}

	query += `
		GROUP BY month
		ORDER BY month ASC
	`

	var result []domain.MonthlyStats
	if err := r.conn.Select(ctx, &result, query, args...); err != nil {
		return nil, fmt.Errorf("failed to get monthly stats: %w", err)
	}

	return result, nil
}

func (r *HotspotRepository) GetHotspots(ctx context.Context, req domain.GetHotspotsRequest) (*domain.GetHotspotsResponse, error) {

	var cursorAcquiredAt time.Time
	var cursorID string
	if req.Cursor != "" {
		decoded, err := base64.StdEncoding.DecodeString(req.Cursor)
		if err == nil {
			parts := strings.SplitN(string(decoded), "|", 2)
			if len(parts) == 2 {
				if t, err := time.Parse(time.RFC3339Nano, parts[0]); err == nil {
					cursorAcquiredAt = t
					cursorID = parts[1]
				}
			}
		}
	}

	filterConditions := ""
	filterArgs := []interface{}{}

	if req.ProvinceCode != "" {
		filterConditions += ` AND location_id IN (SELECT id FROM hotspot.dim_location WHERE province_code = ?)`
		filterArgs = append(filterArgs, req.ProvinceCode)
	}
	if req.CityCode != "" {
		filterConditions += ` AND location_id IN (SELECT id FROM hotspot.dim_location WHERE city_code = ?)`
		filterArgs = append(filterArgs, req.CityCode)
	}
	if req.DistrictCode != "" {
		filterConditions += ` AND location_id IN (SELECT id FROM hotspot.dim_location WHERE district_code = ?)`
		filterArgs = append(filterArgs, req.DistrictCode)
	}
	if req.SubdistrictCode != "" {
		filterConditions += ` AND location_id IN (SELECT id FROM hotspot.dim_location WHERE subdistrict_code = ?)`
		filterArgs = append(filterArgs, req.SubdistrictCode)
	}
	if req.SatelliteID != "" {
		filterConditions += ` AND satellite_id IN (SELECT id FROM hotspot.dim_satellite WHERE satellite_name = ?)`
		filterArgs = append(filterArgs, req.SatelliteID)
	}
	if req.ProductID != "" {
		filterConditions += ` AND satellite_id IN (SELECT id FROM hotspot.dim_satellite WHERE product = ?)`
		filterArgs = append(filterArgs, req.ProductID)
	}
	if req.ConfidenceID != "" {
		filterConditions += ` AND confidence_id IN (SELECT id FROM hotspot.dim_confidence WHERE confidence_class = ?)`
		filterArgs = append(filterArgs, req.ConfidenceID)
	}
	if req.Year > 0 {
		filterConditions += ` AND period_id IN (SELECT id FROM hotspot.dim_period WHERE year_value = ?)`
		filterArgs = append(filterArgs, req.Year)
	}
	if req.Semester > 0 {
		filterConditions += ` AND period_id IN (SELECT id FROM hotspot.dim_period WHERE semester_value = ?)`
		filterArgs = append(filterArgs, req.Semester)
	}
	if req.Quarter > 0 {
		filterConditions += ` AND period_id IN (SELECT id FROM hotspot.dim_period WHERE quarter_value = ?)`
		filterArgs = append(filterArgs, req.Quarter)
	}
	if req.Month > 0 {
		filterConditions += ` AND period_id IN (SELECT id FROM hotspot.dim_period WHERE month_value = ?)`
		filterArgs = append(filterArgs, req.Month)
	}
	if req.Week > 0 {
		filterConditions += ` AND period_id IN (SELECT id FROM hotspot.dim_period WHERE week_value = ?)`
		filterArgs = append(filterArgs, req.Week)
	}

	var totalCount uint64
	if req.Cursor == "" {
		countQuery := `SELECT count(*) FROM hotspot.fact_hotspot WHERE acquired_at >= ? AND acquired_at <= ?` + filterConditions
		countArgs := append([]interface{}{req.StartDate, req.EndDate}, filterArgs...)
		if err := r.conn.QueryRow(ctx, countQuery, countArgs...).Scan(&totalCount); err != nil {
			return nil, fmt.Errorf("failed to get hotspots count: %w", err)
		}
	}

	query := `
        SELECT
            fh.id as id,
            fh.acquired_at as acquired_at,
            fh.latitude as latitude,
            fh.longitude as longitude,
            fh.frp as frp,
            fh.brightness as brightness,
            fh.bright_t31 as bright_t31,
            fh.bright_ti4 as bright_ti4,
            fh.bright_ti5 as bright_ti5,

            dc.confidence_class as confidence_class,
            ds.satellite_name as satellite_name,
            ds.product as product,

            dl.province_code as province_code,
            dl.province_name as province_name,
            dl.city_code as city_code,
            dl.city_name as city_name,
            dl.district_code as district_code,
            dl.district_name as district_name,
            dl.subdistrict_code as subdistrict_code,
            dl.subdistrict_name as subdistrict_name,

            fw.temperature as temperature,
            fw.humidity as humidity,
            fw.wind_speed as wind_speed,
            fw.wind_degree as wind_degree,
            fw.visibility as visibility,
            fw.cloud_coverage as cloud_coverage,
            fw.pressure as pressure,
            fw.uv_index as uv_index,
            fw.precipitation as precipitation,
            fw.solar_radiation as solar_radiation,
            dwc.conditions as weather_conditions,
            dwc.icon as weather_icon

        FROM (
            SELECT *
            FROM hotspot.fact_hotspot
            WHERE acquired_at >= ?
              AND acquired_at <= ?`

	args := []interface{}{req.StartDate, req.EndDate}
	args = append(args, filterArgs...)
	query += filterConditions

	if !cursorAcquiredAt.IsZero() && cursorID != "" {
		query += ` AND (acquired_at, id) < (?, ?)`
		args = append(args, cursorAcquiredAt, cursorID)
	}

	query += `
            ORDER BY acquired_at DESC, id DESC`

	limit := req.Limit
	if limit <= 0 {
		limit = 100
	}
	query += ` LIMIT ?`
	args = append(args, limit+1)

	query += `
        ) fh

        INNER JOIN hotspot.dim_confidence dc
            ON fh.confidence_id = dc.id

        INNER JOIN hotspot.dim_satellite ds
            ON fh.satellite_id = ds.id

        INNER JOIN hotspot.dim_location dl
            ON fh.location_id = dl.id

        LEFT JOIN (
            SELECT *
            FROM hotspot.fact_weather
            WHERE acquired_at >= ?
              AND acquired_at <= ?
        ) fw
            ON fh.location_id = fw.location_id
            AND fh.period_id = fw.period_id

        LEFT JOIN hotspot.dim_weather_condition dwc
            ON fw.weather_condition_id = dwc.id

        ORDER BY fh.acquired_at DESC, fh.id DESC`

	args = append(args, req.StartDate)
	args = append(args, req.EndDate)

	var result []domain.HotspotDetail
	if err := r.conn.Select(ctx, &result, query, args...); err != nil {
		return nil, fmt.Errorf("failed to get hotspots: %w", err)
	}

	hasNext := len(result) > limit
	if hasNext {
		result = result[:limit]
	}

	var nextCursor string
	if hasNext && len(result) > 0 {
		lastRecord := result[len(result)-1]
		cursorData := lastRecord.AcquiredAt.Format(time.RFC3339Nano) + "|" + lastRecord.ID
		nextCursor = base64.StdEncoding.EncodeToString([]byte(cursorData))
	}

	return &domain.GetHotspotsResponse{
		Hotspots: result,
		Pagination: &domain.Pagination{
			TotalCount: totalCount,
			HasNext:    hasNext,
			NextCursor: nextCursor,
			Limit:      limit,
		},
	}, nil
}

func (r *HotspotRepository) GetConfidenceDistribution(ctx context.Context, req domain.GetDistributionRequest) ([]domain.DistributionCount, error) {
	query := `
		SELECT
			dc.confidence_class as name,
			count(*) as count
		FROM hotspot.fact_hotspot fh
		INNER JOIN hotspot.dim_confidence dc ON fh.confidence_id = dc.id
		WHERE 1=1`

	args := make([]interface{}, 0)

	if !req.StartDate.IsZero() {
		query += " AND fh.acquired_at >= ?"
		args = append(args, req.StartDate)
	}

	if !req.EndDate.IsZero() {
		query += " AND fh.acquired_at <= ?"
		args = append(args, req.EndDate)
	}

	query += `
		GROUP BY dc.confidence_class
		ORDER BY count DESC`

	var result []domain.DistributionCount
	if err := r.conn.Select(ctx, &result, query, args...); err != nil {
		return nil, fmt.Errorf("failed to get confidence distribution: %w", err)
	}

	return result, nil
}

func (r *HotspotRepository) GetSatelliteDistribution(ctx context.Context, req domain.GetDistributionRequest) ([]domain.DistributionCount, error) {
	query := `
		SELECT
			ds.satellite_name as name,
			count(*) as count
		FROM hotspot.fact_hotspot fh
		INNER JOIN hotspot.dim_satellite ds ON fh.satellite_id = ds.id
		WHERE 1=1`

	args := make([]interface{}, 0)

	if !req.StartDate.IsZero() {
		query += " AND fh.acquired_at >= ?"
		args = append(args, req.StartDate)
	}

	if !req.EndDate.IsZero() {
		query += " AND fh.acquired_at <= ?"
		args = append(args, req.EndDate)
	}

	query += `
		GROUP BY ds.satellite_name
		ORDER BY count DESC`

	var result []domain.DistributionCount
	if err := r.conn.Select(ctx, &result, query, args...); err != nil {
		return nil, fmt.Errorf("failed to get satellite distribution: %w", err)
	}

	return result, nil
}

func (r *HotspotRepository) GetStats(ctx context.Context, req domain.GetStatsRequest) (*domain.GetStatsResponse, error) {
	query := `
		SELECT
			count(*) as total_hotspots,
			countIf(dc.confidence_class = 'HIGH') as high_confidence,
			count(DISTINCT dl.province_name) as affected_provinces
		FROM hotspot.fact_hotspot fh
		INNER JOIN hotspot.dim_confidence dc ON fh.confidence_id = dc.id
		INNER JOIN hotspot.dim_location dl ON fh.location_id = dl.id
		WHERE 1=1`

	args := make([]interface{}, 0)

	if !req.StartDate.IsZero() {
		query += " AND fh.acquired_at >= ?"
		args = append(args, req.StartDate)
	}

	if !req.EndDate.IsZero() {
		query += " AND fh.acquired_at <= ?"
		args = append(args, req.EndDate)
	}

	var result domain.GetStatsResponse
	if err := r.conn.QueryRow(ctx, query, args...).Scan(
		&result.TotalHotspots,
		&result.HighConfidence,
		&result.AffectedProvinces,
	); err != nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}

	return &result, nil
}

func (r *HotspotRepository) GetTodayStats(ctx context.Context, timezone string) (*domain.GetTodayStatsResponse, error) {
	if timezone == "" {
		timezone = "UTC"
	}

	query := `
		SELECT
			count(*) as today_hotspots,
			count(DISTINCT dl.province_name) as today_affected_provinces,
			countIf(dc.confidence_class = 'HIGH') as today_high_confidence
		FROM hotspot.fact_hotspot fh
		INNER JOIN hotspot.dim_confidence dc ON fh.confidence_id = dc.id
		INNER JOIN hotspot.dim_location dl ON fh.location_id = dl.id
		WHERE toDate(fh.acquired_at, ?) = toDate(now(), ?)`

	var result domain.GetTodayStatsResponse
	if err := r.conn.QueryRow(ctx, query, timezone, timezone).Scan(
		&result.TodayHotspots,
		&result.TodayAffectedProvinces,
		&result.TodayHighConfidence,
	); err != nil {
		return nil, fmt.Errorf("failed to get today stats: %w", err)
	}

	return &result, nil
}

func (r *HotspotRepository) GetConfidenceList(ctx context.Context) ([]domain.FilterOption, error) {
	query := `
		SELECT DISTINCT
			confidence_class as id,
			confidence_class as name
		FROM hotspot.dim_confidence
		ORDER BY confidence_class`

	var result []domain.FilterOption
	if err := r.conn.Select(ctx, &result, query); err != nil {
		return nil, fmt.Errorf("failed to get confidence list: %w", err)
	}

	return result, nil
}

func (r *HotspotRepository) GetSatelliteList(ctx context.Context) ([]domain.FilterOption, error) {
	query := `
		SELECT DISTINCT
			satellite_name as id,
			satellite_name as name
		FROM hotspot.dim_satellite
		ORDER BY satellite_name`

	var result []domain.FilterOption
	if err := r.conn.Select(ctx, &result, query); err != nil {
		return nil, fmt.Errorf("failed to get satellite list: %w", err)
	}

	return result, nil
}

func (r *HotspotRepository) GetProductList(ctx context.Context) ([]domain.FilterOption, error) {
	query := `
		SELECT DISTINCT
			product as id,
			product as name
		FROM hotspot.dim_satellite
		WHERE product != ''
		ORDER BY product`

	var result []domain.FilterOption
	if err := r.conn.Select(ctx, &result, query); err != nil {
		return nil, fmt.Errorf("failed to get product list: %w", err)
	}

	return result, nil
}

func (r *HotspotRepository) GetPeriods(ctx context.Context, req domain.GetPeriodsRequest) (*domain.GetPeriodsResponse, error) {
	response := &domain.GetPeriodsResponse{}

	if req.Year == 0 && req.Semester == 0 && req.Quarter == 0 && req.Month == 0 {
		query := `
			SELECT DISTINCT
				toString(year_value) as value,
				toString(year_value) as label
			FROM hotspot.dim_period
			ORDER BY year_value DESC`

		if err := r.conn.Select(ctx, &response.Years, query); err != nil {
			return nil, fmt.Errorf("failed to get years: %w", err)
		}
		return response, nil
	}

	if req.Year > 0 && req.Semester == 0 {
		query := `
			SELECT DISTINCT
				toString(semester_value) as value,
				toString(semester_value) as label
			FROM hotspot.dim_period
			WHERE year_value = ?
			ORDER BY semester_value`

		if err := r.conn.Select(ctx, &response.Semesters, query, req.Year); err != nil {
			return nil, fmt.Errorf("failed to get semesters: %w", err)
		}
		return response, nil
	}

	if req.Year > 0 && req.Semester > 0 && req.Quarter == 0 {
		query := `
			SELECT DISTINCT
				CONCAT('Q', toString(quarter_value)) as value,
				CONCAT('Q', toString(quarter_value)) as label
			FROM hotspot.dim_period
			WHERE year_value = ?
			  AND semester_value = ?
			ORDER BY quarter_value`

		if err := r.conn.Select(ctx, &response.Quarters, query, req.Year, req.Semester); err != nil {
			return nil, fmt.Errorf("failed to get quarters: %w", err)
		}
		return response, nil
	}

	if req.Year > 0 && req.Semester > 0 && req.Quarter > 0 && req.Month == 0 {
		query := `
			SELECT DISTINCT
				month_name as value,
				month_name as label
			FROM hotspot.dim_period
			WHERE year_value = ?
			  AND semester_value = ?
			  AND quarter_value = ?
			ORDER BY month_value`

		if err := r.conn.Select(ctx, &response.Months, query, req.Year, req.Semester, req.Quarter); err != nil {
			return nil, fmt.Errorf("failed to get months: %w", err)
		}
		return response, nil
	}

	if req.Year > 0 && req.Semester > 0 && req.Quarter > 0 && req.Month > 0 {
		query := `
			SELECT DISTINCT
				toString(week_value) as value,
				toString(week_value) as label
			FROM hotspot.dim_period
			WHERE year_value = ?
			  AND semester_value = ?
			  AND quarter_value = ?
			  AND month_value = ?
			ORDER BY week_value`

		if err := r.conn.Select(ctx, &response.Weeks, query, req.Year, req.Semester, req.Quarter, req.Month); err != nil {
			return nil, fmt.Errorf("failed to get weeks: %w", err)
		}
		return response, nil
	}

	return response, nil
}

func (r *HotspotRepository) GetLocations(ctx context.Context, req domain.GetLocationsRequest) (*domain.GetLocationsResponse, error) {
	response := &domain.GetLocationsResponse{}

	filterConditions := ""
	filterArgs := []interface{}{}

	if !req.StartDate.IsZero() {
		filterConditions += ` AND fh.acquired_at >= ?`
		filterArgs = append(filterArgs, req.StartDate)
	}
	if !req.EndDate.IsZero() {
		filterConditions += ` AND fh.acquired_at <= ?`
		filterArgs = append(filterArgs, req.EndDate)
	}

	if req.SatelliteID != "" {
		filterConditions += ` AND fh.satellite_id IN (SELECT id FROM hotspot.dim_satellite WHERE satellite_name = ?)`
		filterArgs = append(filterArgs, req.SatelliteID)
	}

	if req.ProductID != "" {
		filterConditions += ` AND fh.satellite_id IN (SELECT id FROM hotspot.dim_satellite WHERE product = ?)`
		filterArgs = append(filterArgs, req.ProductID)
	}

	if req.ConfidenceID != "" {
		filterConditions += ` AND fh.confidence_id IN (SELECT id FROM hotspot.dim_confidence WHERE confidence_class = ?)`
		filterArgs = append(filterArgs, req.ConfidenceID)
	}

	if req.Year > 0 {
		filterConditions += ` AND fh.period_id IN (SELECT id FROM hotspot.dim_period WHERE year_value = ?)`
		filterArgs = append(filterArgs, req.Year)
	}
	if req.Semester > 0 {
		filterConditions += ` AND fh.period_id IN (SELECT id FROM hotspot.dim_period WHERE semester_value = ?)`
		filterArgs = append(filterArgs, req.Semester)
	}
	if req.Quarter > 0 {
		filterConditions += ` AND fh.period_id IN (SELECT id FROM hotspot.dim_period WHERE quarter_value = ?)`
		filterArgs = append(filterArgs, req.Quarter)
	}
	if req.Month > 0 {
		filterConditions += ` AND fh.period_id IN (SELECT id FROM hotspot.dim_period WHERE month_value = ?)`
		filterArgs = append(filterArgs, req.Month)
	}
	if req.Week > 0 {
		filterConditions += ` AND fh.period_id IN (SELECT id FROM hotspot.dim_period WHERE week_value = ?)`
		filterArgs = append(filterArgs, req.Week)
	}

	if req.ProvinceCode == "" && req.CityCode == "" && req.DistrictCode == "" {
		query := `
			SELECT
				dl.province_code as code,
				dl.province_name as name,
				count(*) as count,
				avg(toFloat64(fh.latitude)) as lat,
				avg(toFloat64(fh.longitude)) as lng
			FROM hotspot.fact_hotspot fh
			INNER JOIN hotspot.dim_location dl ON fh.location_id = dl.id
			WHERE dl.province_code != '' AND dl.province_name != ''` + filterConditions + `
			GROUP BY dl.province_code, dl.province_name
			ORDER BY count DESC`

		if err := r.conn.Select(ctx, &response.Provinces, query, filterArgs...); err != nil {
			return nil, fmt.Errorf("failed to get provinces: %w", err)
		}
		return response, nil
	}

	if req.ProvinceCode != "" && req.CityCode == "" && req.DistrictCode == "" {
		query := `
			SELECT
				dl.city_code as code,
				dl.city_name as name,
				count(*) as count,
				avg(toFloat64(fh.latitude)) as lat,
				avg(toFloat64(fh.longitude)) as lng
			FROM hotspot.fact_hotspot fh
			INNER JOIN hotspot.dim_location dl ON fh.location_id = dl.id
			WHERE dl.province_code = ?
			  AND dl.city_code != '' AND dl.city_name != ''` + filterConditions + `
			GROUP BY dl.city_code, dl.city_name
			ORDER BY count DESC`

		args := append([]interface{}{req.ProvinceCode}, filterArgs...)
		if err := r.conn.Select(ctx, &response.Cities, query, args...); err != nil {
			return nil, fmt.Errorf("failed to get cities: %w", err)
		}
		return response, nil
	}

	if req.ProvinceCode != "" && req.CityCode != "" && req.DistrictCode == "" {
		query := `
			SELECT
				dl.district_code as code,
				dl.district_name as name,
				count(*) as count,
				avg(toFloat64(fh.latitude)) as lat,
				avg(toFloat64(fh.longitude)) as lng
			FROM hotspot.fact_hotspot fh
			INNER JOIN hotspot.dim_location dl ON fh.location_id = dl.id
			WHERE dl.province_code = ?
			  AND dl.city_code = ?
			  AND dl.district_code != '' AND dl.district_name != ''` + filterConditions + `
			GROUP BY dl.district_code, dl.district_name
			ORDER BY count DESC`

		args := append([]interface{}{req.ProvinceCode, req.CityCode}, filterArgs...)
		if err := r.conn.Select(ctx, &response.Districts, query, args...); err != nil {
			return nil, fmt.Errorf("failed to get districts: %w", err)
		}
		return response, nil
	}

	if req.ProvinceCode != "" && req.CityCode != "" && req.DistrictCode != "" {
		query := `
			SELECT
				dl.subdistrict_code as code,
				dl.subdistrict_name as name,
				count(*) as count,
				avg(toFloat64(fh.latitude)) as lat,
				avg(toFloat64(fh.longitude)) as lng
			FROM hotspot.fact_hotspot fh
			INNER JOIN hotspot.dim_location dl ON fh.location_id = dl.id
			WHERE dl.province_code = ?
			  AND dl.city_code = ?
			  AND dl.district_code = ?
			  AND dl.subdistrict_code != '' AND dl.subdistrict_name != ''` + filterConditions + `
			GROUP BY dl.subdistrict_code, dl.subdistrict_name
			ORDER BY count DESC`

		args := append([]interface{}{req.ProvinceCode, req.CityCode, req.DistrictCode}, filterArgs...)
		if err := r.conn.Select(ctx, &response.Subdistricts, query, args...); err != nil {
			return nil, fmt.Errorf("failed to get subdistricts: %w", err)
		}
		return response, nil
	}

	return response, nil
}
