package rest

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/zsbahtiar/hotspot/api/domain"
	"github.com/zsbahtiar/hotspot/api/internal/logging"
)

const (
	CacheTTLShort  = 4800
	CacheTTLMedium = 4800
)

type HotspotService interface {
	GetHotspots(ctx context.Context, req domain.GetHotspotsRequest) (*domain.GetHotspotsResponse, error)
	GetHotspotsGeoJSON(ctx context.Context, req domain.GetHotspotsRequest) (*domain.GeoJSON, error)
	GetSummary(ctx context.Context, provinceLimit, cityLimit int, startDate, endDate time.Time, timezone string) (*domain.GetSummaryResponse, error)
	GetFilterOptions(ctx context.Context) (*domain.GetFilterOptionsResponse, error)
	GetPeriods(ctx context.Context, req domain.GetPeriodsRequest) (*domain.GetPeriodsResponse, error)
	GetLocations(ctx context.Context, req domain.GetLocationsRequest) (*domain.GetLocationsResponse, error)
}

type HotspotHandler struct {
	service HotspotService
}

func NewHotspotHandler(r chi.Router, svc HotspotService) {
	handler := &HotspotHandler{service: svc}

	r.Route("/hotspots", func(r chi.Router) {
		r.Get("/summary", handler.GetSummary)
		r.Get("/geojson", handler.GetHotspotsGeoJSON)
		r.Get("/filter-options", handler.GetFilterOptions)
		r.Get("/periods", handler.GetPeriods)
		r.Get("/locations", handler.GetLocations)
		r.Get("/", handler.GetHotspots)
	})
}

func (h *HotspotHandler) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *HotspotHandler) writeJSONWithCache(w http.ResponseWriter, status int, data interface{}, cacheTTL int) {
	w.Header().Set("Content-Type", "application/json")
	if cacheTTL > 0 {

		w.Header().Set("Cache-Control", fmt.Sprintf("public, s-maxage=%d, max-age=%d", cacheTTL, cacheTTL/2))
	}
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *HotspotHandler) writeError(w http.ResponseWriter, r *http.Request, status int, message string, err error) {
	response := domain.ErrorResponse{
		Message: message,
		Success: false,
	}

	if err != nil {
		logging.LogError(r.Context(), err, message)
		response.Error = err.Error()
	}

	h.writeJSON(w, status, response)
}

// GetHotspots godoc
//
//	@Summary		List hotspots
//	@Description	Retrieve a paginated list of raw hotspot detections.
//	@Tags			hotspots
//	@Produce		json
//	@Param			limit	query		int	false	"Max records to return (1-100)"
//	@Success		200		{object}	domain.Response[domain.GetHotspotsResponse]
//	@Failure		500		{object}	domain.ErrorResponse
//	@Router			/api/v1/hotspots/ [get]
func (h *HotspotHandler) GetHotspots(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	limit := 0
	if limitParam := r.URL.Query().Get("limit"); limitParam != "" {
		if parsed, err := strconv.Atoi(limitParam); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	req := domain.GetHotspotsRequest{
		Limit: limit,
	}
	hotspots, err := h.service.GetHotspots(ctx, req)
	if err != nil {
		h.writeError(w, r, http.StatusInternalServerError, "Failed to fetch hotspots", err)
		return
	}

	response := domain.Response[*domain.GetHotspotsResponse]{
		Message: "Hotspots retrieved successfully",
		Success: true,
		Data:    hotspots,
	}

	h.writeJSON(w, http.StatusOK, response)
}

// GetHotspotsGeoJSON godoc
//
//	@Summary		Hotspots as GeoJSON
//	@Description	Retrieve hotspot detections as a GeoJSON FeatureCollection with cursor pagination. Supports date-range, time-period, location and product (NRT/SP) filters.
//	@Tags			hotspots
//	@Produce		json
//	@Param			start_date			query		string	false	"Start date (RFC3339)"
//	@Param			end_date			query		string	false	"End date (RFC3339)"
//	@Param			year				query		int		false	"Filter by year"
//	@Param			semester			query		int		false	"Filter by semester"
//	@Param			quarter				query		int		false	"Filter by quarter"
//	@Param			month				query		int		false	"Filter by month"
//	@Param			week				query		int		false	"Filter by week"
//	@Param			province_code		query		string	false	"Filter by province code"
//	@Param			city_code			query		string	false	"Filter by city code"
//	@Param			district_code		query		string	false	"Filter by district code"
//	@Param			subdistrict_code	query		string	false	"Filter by subdistrict code"
//	@Param			satellite			query		string	false	"Filter by satellite name"
//	@Param			confidence			query		string	false	"Filter by confidence class"
//	@Param			product				query		string	false	"Filter by product"	Enums(NRT, SP)
//	@Param			cursor				query		string	false	"Pagination cursor from previous page"
//	@Param			limit				query		int		false	"Max features to return (1-50000, default 500)"
//	@Success		200					{object}	domain.Response[domain.GeoJSON]
//	@Failure		500					{object}	domain.ErrorResponse
//	@Router			/api/v1/hotspots/geojson [get]
func (h *HotspotHandler) GetHotspotsGeoJSON(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	req := domain.GetHotspotsRequest{
		Cursor:          r.URL.Query().Get("cursor"),
		SatelliteID:     r.URL.Query().Get("satellite"),
		ProductID:       r.URL.Query().Get("product"),
		ConfidenceID:    r.URL.Query().Get("confidence"),
		ProvinceCode:    r.URL.Query().Get("province_code"),
		CityCode:        r.URL.Query().Get("city_code"),
		DistrictCode:    r.URL.Query().Get("district_code"),
		SubdistrictCode: r.URL.Query().Get("subdistrict_code"),
	}

	if startDateStr := r.URL.Query().Get("start_date"); startDateStr != "" {
		if startDate, err := time.Parse(time.RFC3339, startDateStr); err == nil {
			req.StartDate = startDate
		}
	}
	if endDateStr := r.URL.Query().Get("end_date"); endDateStr != "" {
		if endDate, err := time.Parse(time.RFC3339, endDateStr); err == nil {
			req.EndDate = endDate
		}
	}

	if yearStr := r.URL.Query().Get("year"); yearStr != "" {
		if year, err := strconv.Atoi(yearStr); err == nil {
			req.Year = year
		}
	}
	if semesterStr := r.URL.Query().Get("semester"); semesterStr != "" {
		if semester, err := strconv.Atoi(semesterStr); err == nil {
			req.Semester = semester
		}
	}
	if quarterStr := r.URL.Query().Get("quarter"); quarterStr != "" {
		if quarter, err := strconv.Atoi(quarterStr); err == nil {
			req.Quarter = quarter
		}
	}
	if monthStr := r.URL.Query().Get("month"); monthStr != "" {
		if month, err := strconv.Atoi(monthStr); err == nil {
			req.Month = month
		}
	}
	if weekStr := r.URL.Query().Get("week"); weekStr != "" {
		if week, err := strconv.Atoi(weekStr); err == nil {
			req.Week = week
		}
	}

	if req.Year > 0 && req.StartDate.IsZero() && req.EndDate.IsZero() {
		req.StartDate = time.Date(req.Year, 1, 1, 0, 0, 0, 0, time.UTC)
		req.EndDate = time.Date(req.Year, 12, 31, 23, 59, 59, 999999999, time.UTC)
	}

	limit := 500
	if limitParam := r.URL.Query().Get("limit"); limitParam != "" {
		if parsed, err := strconv.Atoi(limitParam); err == nil && parsed > 0 && parsed <= 50000 {
			limit = parsed
		}
	}

	req.Limit = limit

	geoJSON, err := h.service.GetHotspotsGeoJSON(ctx, req)
	if err != nil {
		h.writeError(w, r, http.StatusInternalServerError, "Failed to fetch hotspots GeoJSON", err)
		return
	}

	response := domain.Response[*domain.GeoJSON]{
		Message: "Hotspots GeoJSON retrieved successfully",
		Success: true,
		Data:    geoJSON,
	}

	h.writeJSONWithCache(w, http.StatusOK, response, CacheTTLShort)
}

// GetSummary godoc
//
//	@Summary		Dashboard summary
//	@Description	Aggregated dashboard summary: top provinces/cities, satellite and confidence distribution, overall stats, monthly stats and today's stats.
//	@Tags			hotspots
//	@Produce		json
//	@Param			province_limit	query		int		false	"Top provinces limit (1-100, default 10)"
//	@Param			city_limit		query		int		false	"Top cities limit (1-100, default 10)"
//	@Param			start_date		query		string	false	"Start date (RFC3339)"
//	@Param			end_date		query		string	false	"End date (RFC3339)"
//	@Success		200				{object}	domain.Response[domain.GetSummaryResponse]
//	@Failure		500				{object}	domain.ErrorResponse
//	@Router			/api/v1/hotspots/summary [get]
func (h *HotspotHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	provinceLimit := 10
	if limitParam := r.URL.Query().Get("province_limit"); limitParam != "" {
		if parsed, err := strconv.Atoi(limitParam); err == nil && parsed > 0 && parsed <= 100 {
			provinceLimit = parsed
		}
	}

	cityLimit := 10
	if limitParam := r.URL.Query().Get("city_limit"); limitParam != "" {
		if parsed, err := strconv.Atoi(limitParam); err == nil && parsed > 0 && parsed <= 100 {
			cityLimit = parsed
		}
	}

	var startDate, endDate time.Time
	timezone := "UTC"

	if startDateStr := r.URL.Query().Get("start_date"); startDateStr != "" {
		if parsed, err := time.Parse(time.RFC3339, startDateStr); err == nil {
			startDate = parsed

			_, offset := parsed.Zone()
			timezone = offsetToTimezone(offset)
		}
	}
	if endDateStr := r.URL.Query().Get("end_date"); endDateStr != "" {
		if parsed, err := time.Parse(time.RFC3339, endDateStr); err == nil {
			endDate = parsed
		}
	}

	summary, err := h.service.GetSummary(ctx, provinceLimit, cityLimit, startDate, endDate, timezone)
	if err != nil {
		h.writeError(w, r, http.StatusInternalServerError, "Failed to fetch summary", err)
		return
	}

	response := domain.Response[*domain.GetSummaryResponse]{
		Message: "Summary retrieved successfully",
		Success: true,
		Data:    summary,
	}

	h.writeJSONWithCache(w, http.StatusOK, response, CacheTTLShort)
}

// GetFilterOptions godoc
//
//	@Summary		Filter options
//	@Description	Distinct confidence classes, satellite names, and products (NRT/SP) for filter dropdowns.
//	@Tags			hotspots
//	@Produce		json
//	@Success		200	{object}	domain.Response[domain.GetFilterOptionsResponse]
//	@Failure		500	{object}	domain.ErrorResponse
//	@Router			/api/v1/hotspots/filter-options [get]
func (h *HotspotHandler) GetFilterOptions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	filterOptions, err := h.service.GetFilterOptions(ctx)
	if err != nil {
		h.writeError(w, r, http.StatusInternalServerError, "Failed to fetch filter options", err)
		return
	}

	response := domain.Response[*domain.GetFilterOptionsResponse]{
		Message: "Filter options retrieved successfully",
		Success: true,
		Data:    filterOptions,
	}

	h.writeJSONWithCache(w, http.StatusOK, response, CacheTTLMedium)
}

// GetPeriods godoc
//
//	@Summary		Time period options
//	@Description	Drill-down time period options (years then semesters, quarters, months, weeks) based on the params supplied.
//	@Tags			hotspots
//	@Produce		json
//	@Param			year		query		int	false	"Selected year"
//	@Param			semester	query		int	false	"Selected semester"
//	@Param			quarter		query		int	false	"Selected quarter"
//	@Param			month		query		int	false	"Selected month"
//	@Success		200			{object}	domain.Response[domain.GetPeriodsResponse]
//	@Failure		500			{object}	domain.ErrorResponse
//	@Router			/api/v1/hotspots/periods [get]
func (h *HotspotHandler) GetPeriods(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	req := domain.GetPeriodsRequest{}

	if yearStr := r.URL.Query().Get("year"); yearStr != "" {
		if year, err := strconv.Atoi(yearStr); err == nil {
			req.Year = year
		}
	}

	if semesterStr := r.URL.Query().Get("semester"); semesterStr != "" {
		if semester, err := strconv.Atoi(semesterStr); err == nil {
			req.Semester = semester
		}
	}

	if quarterStr := r.URL.Query().Get("quarter"); quarterStr != "" {
		if quarter, err := strconv.Atoi(quarterStr); err == nil {
			req.Quarter = quarter
		}
	}

	if monthStr := r.URL.Query().Get("month"); monthStr != "" {
		if month, err := strconv.Atoi(monthStr); err == nil {
			req.Month = month
		}
	}

	periods, err := h.service.GetPeriods(ctx, req)
	if err != nil {
		h.writeError(w, r, http.StatusInternalServerError, "Failed to fetch periods", err)
		return
	}

	response := domain.Response[*domain.GetPeriodsResponse]{
		Message: "Periods retrieved successfully",
		Success: true,
		Data:    periods,
	}

	h.writeJSONWithCache(w, http.StatusOK, response, CacheTTLMedium)
}

// GetLocations godoc
//
//	@Summary		Location hierarchy
//	@Description	Drill-down geographic hierarchy with hotspot counts. Returns islands with grouped provinces at the top level, or cities/districts/subdistricts as the location code is drilled down.
//	@Tags			hotspots
//	@Produce		json
//	@Param			province_code	query		string	false	"Drill into this province"
//	@Param			city_code		query		string	false	"Drill into this city"
//	@Param			district_code	query		string	false	"Drill into this district"
//	@Param			satellite		query		string	false	"Filter by satellite name"
//	@Param			confidence		query		string	false	"Filter by confidence class"
//	@Param			product			query		string	false	"Filter by product"	Enums(NRT, SP)
//	@Param			start_date		query		string	false	"Start date (RFC3339)"
//	@Param			end_date		query		string	false	"End date (RFC3339)"
//	@Param			year			query		int		false	"Filter by year"
//	@Param			semester		query		int		false	"Filter by semester"
//	@Param			quarter			query		int		false	"Filter by quarter"
//	@Param			month			query		int		false	"Filter by month"
//	@Param			week			query		int		false	"Filter by week"
//	@Success		200				{object}	domain.Response[domain.GetLocationsResponse]
//	@Failure		500				{object}	domain.ErrorResponse
//	@Router			/api/v1/hotspots/locations [get]
func (h *HotspotHandler) GetLocations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	req := domain.GetLocationsRequest{
		ProvinceCode: r.URL.Query().Get("province_code"),
		CityCode:     r.URL.Query().Get("city_code"),
		DistrictCode: r.URL.Query().Get("district_code"),
		SatelliteID:  r.URL.Query().Get("satellite"),
		ProductID:    r.URL.Query().Get("product"),
		ConfidenceID: r.URL.Query().Get("confidence"),
	}

	if startDateStr := r.URL.Query().Get("start_date"); startDateStr != "" {
		if startDate, err := time.Parse(time.RFC3339, startDateStr); err == nil {
			req.StartDate = startDate
		}
	}
	if endDateStr := r.URL.Query().Get("end_date"); endDateStr != "" {
		if endDate, err := time.Parse(time.RFC3339, endDateStr); err == nil {
			req.EndDate = endDate
		}
	}

	if yearStr := r.URL.Query().Get("year"); yearStr != "" {
		if year, err := strconv.Atoi(yearStr); err == nil {
			req.Year = year
		}
	}
	if semesterStr := r.URL.Query().Get("semester"); semesterStr != "" {
		if semester, err := strconv.Atoi(semesterStr); err == nil {
			req.Semester = semester
		}
	}
	if quarterStr := r.URL.Query().Get("quarter"); quarterStr != "" {
		if quarter, err := strconv.Atoi(quarterStr); err == nil {
			req.Quarter = quarter
		}
	}
	if monthStr := r.URL.Query().Get("month"); monthStr != "" {
		if month, err := strconv.Atoi(monthStr); err == nil {
			req.Month = month
		}
	}
	if weekStr := r.URL.Query().Get("week"); weekStr != "" {
		if week, err := strconv.Atoi(weekStr); err == nil {
			req.Week = week
		}
	}

	if req.Year > 0 && req.StartDate.IsZero() && req.EndDate.IsZero() {
		req.StartDate = time.Date(req.Year, 1, 1, 0, 0, 0, 0, time.UTC)
		req.EndDate = time.Date(req.Year, 12, 31, 23, 59, 59, 999999999, time.UTC)
	}

	locations, err := h.service.GetLocations(ctx, req)
	if err != nil {
		h.writeError(w, r, http.StatusInternalServerError, "Failed to fetch locations", err)
		return
	}

	response := domain.Response[*domain.GetLocationsResponse]{
		Message: "Locations retrieved successfully",
		Success: true,
		Data:    locations,
	}

	h.writeJSONWithCache(w, http.StatusOK, response, CacheTTLShort)
}

func offsetToTimezone(offsetSeconds int) string {
	hours := offsetSeconds / 3600

	switch hours {
	case 7:
		return "Asia/Jakarta"
	case 8:
		return "Asia/Makassar"
	case 9:
		return "Asia/Jayapura"
	case 0:
		return "UTC"
	default:

		return "UTC"
	}
}
