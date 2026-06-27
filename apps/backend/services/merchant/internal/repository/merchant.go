package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/suqafuran/express/services/merchant/internal/model"
)

// MerchantRepository defines merchant database operations.
type MerchantRepository interface {
	CreateMerchant(ctx context.Context, merchant *model.Merchant) error
	GetMerchantByID(ctx context.Context, id uuid.UUID) (*model.Merchant, error)
	GetMerchantBySlug(ctx context.Context, slug string) (*model.Merchant, error)
	ListNearbyMerchants(ctx context.Context, lat, lng float64, radiusKm int, limit int) ([]*model.Merchant, error)
	UpdateMerchant(ctx context.Context, merchant *model.Merchant) error
	ListMerchantsByUser(ctx context.Context, userID uuid.UUID) ([]*model.Merchant, error)

	CreateProduct(ctx context.Context, product *model.Product) error
	GetProduct(ctx context.Context, id uuid.UUID) (*model.Product, error)
	ListProductsByMerchant(ctx context.Context, merchantID uuid.UUID, limit, offset int) ([]*model.Product, int64, error)
	UpdateProduct(ctx context.Context, product *model.Product) error
	UpdateProductStock(ctx context.Context, productID uuid.UUID, newStock int) error
	DeleteProduct(ctx context.Context, productID uuid.UUID) error

	SetStoreHours(ctx context.Context, merchantID uuid.UUID, hours []*model.StoreHours) error
	GetStoreHours(ctx context.Context, merchantID uuid.UUID) ([]*model.StoreHours, error)

	AddEmployee(ctx context.Context, employee *model.MerchantEmployee) error
	RemoveEmployee(ctx context.Context, employeeID uuid.UUID) error
	ListEmployees(ctx context.Context, merchantID uuid.UUID) ([]*model.MerchantEmployee, error)
}

// PostgresMerchantRepository implements MerchantRepository.
type PostgresMerchantRepository struct {
	db *pgxpool.Pool
}

// NewPostgresMerchantRepository creates a new postgres merchant repository.
func NewPostgresMerchantRepository(db *pgxpool.Pool) *PostgresMerchantRepository {
	return &PostgresMerchantRepository{db: db}
}

// CreateMerchant creates a new merchant.
func (r *PostgresMerchantRepository) CreateMerchant(ctx context.Context, merchant *model.Merchant) error {
	query := `
		INSERT INTO merchants (id, user_id, store_name, slug, description_en, description_so, logo_url, banner_url,
			location_lat, location_lng, address, phone, email, is_verified, is_active, rating, total_orders,
			suqafuran_business_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
		RETURNING id, created_at, updated_at
	`

	now := time.Now()
	err := r.db.QueryRow(ctx, query,
		merchant.ID, merchant.UserID, merchant.StoreName, merchant.Slug,
		merchant.DescriptionEn, merchant.DescriptionSo, merchant.LogoURL, merchant.BannerURL,
		merchant.LocationLat, merchant.LocationLng, merchant.Address, merchant.Phone, merchant.Email,
		merchant.IsVerified, merchant.IsActive, merchant.Rating, merchant.TotalOrders,
		merchant.SuqafuranBusinessID, now, now,
	).Scan(&merchant.ID, &merchant.CreatedAt, &merchant.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create merchant: %w", err)
	}

	return nil
}

// GetMerchantByID retrieves a merchant by ID.
func (r *PostgresMerchantRepository) GetMerchantByID(ctx context.Context, id uuid.UUID) (*model.Merchant, error) {
	query := `
		SELECT id, user_id, store_name, slug, description_en, description_so, logo_url, banner_url,
			location_lat, location_lng, address, phone, email, is_verified, is_active, rating, total_orders,
			suqafuran_business_id, created_at, updated_at
		FROM merchants
		WHERE id = $1 AND is_active = true
	`

	merchant := &model.Merchant{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&merchant.ID, &merchant.UserID, &merchant.StoreName, &merchant.Slug,
		&merchant.DescriptionEn, &merchant.DescriptionSo, &merchant.LogoURL, &merchant.BannerURL,
		&merchant.LocationLat, &merchant.LocationLng, &merchant.Address, &merchant.Phone, &merchant.Email,
		&merchant.IsVerified, &merchant.IsActive, &merchant.Rating, &merchant.TotalOrders,
		&merchant.SuqafuranBusinessID, &merchant.CreatedAt, &merchant.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("merchant not found")
		}
		return nil, fmt.Errorf("failed to get merchant: %w", err)
	}

	return merchant, nil
}

// GetMerchantBySlug retrieves a merchant by slug.
func (r *PostgresMerchantRepository) GetMerchantBySlug(ctx context.Context, slug string) (*model.Merchant, error) {
	query := `
		SELECT id, user_id, store_name, slug, description_en, description_so, logo_url, banner_url,
			location_lat, location_lng, address, phone, email, is_verified, is_active, rating, total_orders,
			suqafuran_business_id, created_at, updated_at
		FROM merchants
		WHERE slug = $1 AND is_active = true
	`

	merchant := &model.Merchant{}
	err := r.db.QueryRow(ctx, query, slug).Scan(
		&merchant.ID, &merchant.UserID, &merchant.StoreName, &merchant.Slug,
		&merchant.DescriptionEn, &merchant.DescriptionSo, &merchant.LogoURL, &merchant.BannerURL,
		&merchant.LocationLat, &merchant.LocationLng, &merchant.Address, &merchant.Phone, &merchant.Email,
		&merchant.IsVerified, &merchant.IsActive, &merchant.Rating, &merchant.TotalOrders,
		&merchant.SuqafuranBusinessID, &merchant.CreatedAt, &merchant.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("merchant not found")
		}
		return nil, fmt.Errorf("failed to get merchant: %w", err)
	}

	return merchant, nil
}

// ListNearbyMerchants retrieves merchants within a radius using PostGIS.
func (r *PostgresMerchantRepository) ListNearbyMerchants(ctx context.Context, lat, lng float64, radiusKm int, limit int) ([]*model.Merchant, error) {
	query := `
		SELECT id, user_id, store_name, slug, description_en, description_so, logo_url, banner_url,
			location_lat, location_lng, address, phone, email, is_verified, is_active, rating, total_orders,
			suqafuran_business_id, created_at, updated_at
		FROM merchants
		WHERE is_active = true AND is_verified = true
		AND earth_distance(ll_to_earth($1, $2), ll_to_earth(location_lat, location_lng)) < ($3 * 1000)
		ORDER BY earth_distance(ll_to_earth($1, $2), ll_to_earth(location_lat, location_lng))
		LIMIT $4
	`

	rows, err := r.db.Query(ctx, query, lat, lng, radiusKm, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list nearby merchants: %w", err)
	}
	defer rows.Close()

	merchants := []*model.Merchant{}
	for rows.Next() {
		merchant := &model.Merchant{}
		err := rows.Scan(
			&merchant.ID, &merchant.UserID, &merchant.StoreName, &merchant.Slug,
			&merchant.DescriptionEn, &merchant.DescriptionSo, &merchant.LogoURL, &merchant.BannerURL,
			&merchant.LocationLat, &merchant.LocationLng, &merchant.Address, &merchant.Phone, &merchant.Email,
			&merchant.IsVerified, &merchant.IsActive, &merchant.Rating, &merchant.TotalOrders,
			&merchant.SuqafuranBusinessID, &merchant.CreatedAt, &merchant.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan merchant: %w", err)
		}
		merchants = append(merchants, merchant)
	}

	return merchants, nil
}

// UpdateMerchant updates an existing merchant.
func (r *PostgresMerchantRepository) UpdateMerchant(ctx context.Context, merchant *model.Merchant) error {
	query := `
		UPDATE merchants
		SET store_name = $1, description_en = $2, description_so = $3, logo_url = $4, banner_url = $5,
			location_lat = $6, location_lng = $7, address = $8, phone = $9, email = $10,
			is_verified = $11, is_active = $12, rating = $13, updated_at = $14
		WHERE id = $15
	`

	_, err := r.db.Exec(ctx, query,
		merchant.StoreName, merchant.DescriptionEn, merchant.DescriptionSo, merchant.LogoURL, merchant.BannerURL,
		merchant.LocationLat, merchant.LocationLng, merchant.Address, merchant.Phone, merchant.Email,
		merchant.IsVerified, merchant.IsActive, merchant.Rating, time.Now(), merchant.ID,
	)

	if err != nil {
		return fmt.Errorf("failed to update merchant: %w", err)
	}

	return nil
}

// ListMerchantsByUser retrieves all merchants owned by a user.
func (r *PostgresMerchantRepository) ListMerchantsByUser(ctx context.Context, userID uuid.UUID) ([]*model.Merchant, error) {
	query := `
		SELECT id, user_id, store_name, slug, description_en, description_so, logo_url, banner_url,
			location_lat, location_lng, address, phone, email, is_verified, is_active, rating, total_orders,
			suqafuran_business_id, created_at, updated_at
		FROM merchants
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list merchants: %w", err)
	}
	defer rows.Close()

	merchants := []*model.Merchant{}
	for rows.Next() {
		merchant := &model.Merchant{}
		err := rows.Scan(
			&merchant.ID, &merchant.UserID, &merchant.StoreName, &merchant.Slug,
			&merchant.DescriptionEn, &merchant.DescriptionSo, &merchant.LogoURL, &merchant.BannerURL,
			&merchant.LocationLat, &merchant.LocationLng, &merchant.Address, &merchant.Phone, &merchant.Email,
			&merchant.IsVerified, &merchant.IsActive, &merchant.Rating, &merchant.TotalOrders,
			&merchant.SuqafuranBusinessID, &merchant.CreatedAt, &merchant.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan merchant: %w", err)
		}
		merchants = append(merchants, merchant)
	}

	return merchants, nil
}

// CreateProduct creates a new product.
func (r *PostgresMerchantRepository) CreateProduct(ctx context.Context, product *model.Product) error {
	imagesJSON, _ := json.Marshal(product.Images)
	variantsJSON, _ := json.Marshal(product.Variants)

	query := `
		INSERT INTO products (id, merchant_id, name_en, name_so, description_en, description_so, sku, price,
			discount_price, stock_level, low_stock_threshold, category, images, variants, is_active,
			suqafuran_product_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
		RETURNING id, created_at, updated_at
	`

	now := time.Now()
	err := r.db.QueryRow(ctx, query,
		product.ID, product.MerchantID, product.NameEn, product.NameSo,
		product.DescriptionEn, product.DescriptionSo, product.SKU, product.Price,
		product.DiscountPrice, product.StockLevel, product.LowStockThreshold, product.Category,
		imagesJSON, variantsJSON, product.IsActive, product.SuqafuranProductID, now, now,
	).Scan(&product.ID, &product.CreatedAt, &product.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create product: %w", err)
	}

	return nil
}

// GetProduct retrieves a product by ID.
func (r *PostgresMerchantRepository) GetProduct(ctx context.Context, id uuid.UUID) (*model.Product, error) {
	query := `
		SELECT id, merchant_id, name_en, name_so, description_en, description_so, sku, price,
			discount_price, stock_level, low_stock_threshold, category, images, variants, is_active,
			suqafuran_product_id, created_at, updated_at
		FROM products
		WHERE id = $1 AND is_active = true
	`

	product := &model.Product{}
	var imagesJSON, variantsJSON []byte

	err := r.db.QueryRow(ctx, query, id).Scan(
		&product.ID, &product.MerchantID, &product.NameEn, &product.NameSo,
		&product.DescriptionEn, &product.DescriptionSo, &product.SKU, &product.Price,
		&product.DiscountPrice, &product.StockLevel, &product.LowStockThreshold, &product.Category,
		&imagesJSON, &variantsJSON, &product.IsActive, &product.SuqafuranProductID,
		&product.CreatedAt, &product.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("product not found")
		}
		return nil, fmt.Errorf("failed to get product: %w", err)
	}

	json.Unmarshal(imagesJSON, &product.Images)
	json.Unmarshal(variantsJSON, &product.Variants)

	return product, nil
}

// ListProductsByMerchant retrieves products for a merchant.
func (r *PostgresMerchantRepository) ListProductsByMerchant(ctx context.Context, merchantID uuid.UUID, limit, offset int) ([]*model.Product, int64, error) {
	countQuery := `SELECT COUNT(*) FROM products WHERE merchant_id = $1 AND is_active = true`
	var total int64
	err := r.db.QueryRow(ctx, countQuery, merchantID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count products: %w", err)
	}

	query := `
		SELECT id, merchant_id, name_en, name_so, description_en, description_so, sku, price,
			discount_price, stock_level, low_stock_threshold, category, images, variants, is_active,
			suqafuran_product_id, created_at, updated_at
		FROM products
		WHERE merchant_id = $1 AND is_active = true
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, merchantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list products: %w", err)
	}
	defer rows.Close()

	products := []*model.Product{}
	for rows.Next() {
		product := &model.Product{}
		var imagesJSON, variantsJSON []byte

		err := rows.Scan(
			&product.ID, &product.MerchantID, &product.NameEn, &product.NameSo,
			&product.DescriptionEn, &product.DescriptionSo, &product.SKU, &product.Price,
			&product.DiscountPrice, &product.StockLevel, &product.LowStockThreshold, &product.Category,
			&imagesJSON, &variantsJSON, &product.IsActive, &product.SuqafuranProductID,
			&product.CreatedAt, &product.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan product: %w", err)
		}

		json.Unmarshal(imagesJSON, &product.Images)
		json.Unmarshal(variantsJSON, &product.Variants)
		products = append(products, product)
	}

	return products, total, nil
}

// UpdateProduct updates an existing product.
func (r *PostgresMerchantRepository) UpdateProduct(ctx context.Context, product *model.Product) error {
	imagesJSON, _ := json.Marshal(product.Images)
	variantsJSON, _ := json.Marshal(product.Variants)

	query := `
		UPDATE products
		SET name_en = $1, name_so = $2, description_en = $3, description_so = $4, sku = $5, price = $6,
			discount_price = $7, stock_level = $8, low_stock_threshold = $9, category = $10,
			images = $11, variants = $12, is_active = $13, updated_at = $14
		WHERE id = $15
	`

	_, err := r.db.Exec(ctx, query,
		product.NameEn, product.NameSo, product.DescriptionEn, product.DescriptionSo, product.SKU,
		product.Price, product.DiscountPrice, product.StockLevel, product.LowStockThreshold, product.Category,
		imagesJSON, variantsJSON, product.IsActive, time.Now(), product.ID,
	)

	if err != nil {
		return fmt.Errorf("failed to update product: %w", err)
	}

	return nil
}

// UpdateProductStock updates product stock level.
func (r *PostgresMerchantRepository) UpdateProductStock(ctx context.Context, productID uuid.UUID, newStock int) error {
	query := `UPDATE products SET stock_level = $1, updated_at = $2 WHERE id = $3`
	_, err := r.db.Exec(ctx, query, newStock, time.Now(), productID)
	if err != nil {
		return fmt.Errorf("failed to update stock: %w", err)
	}
	return nil
}

// DeleteProduct marks a product as inactive.
func (r *PostgresMerchantRepository) DeleteProduct(ctx context.Context, productID uuid.UUID) error {
	query := `UPDATE products SET is_active = false, updated_at = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, time.Now(), productID)
	if err != nil {
		return fmt.Errorf("failed to delete product: %w", err)
	}
	return nil
}

// SetStoreHours sets operating hours for a merchant.
func (r *PostgresMerchantRepository) SetStoreHours(ctx context.Context, merchantID uuid.UUID, hours []*model.StoreHours) error {
	// Delete existing hours
	_, err := r.db.Exec(ctx, `DELETE FROM store_hours WHERE merchant_id = $1`, merchantID)
	if err != nil {
		return fmt.Errorf("failed to delete existing hours: %w", err)
	}

	// Insert new hours
	for _, h := range hours {
		h.ID = uuid.New()
		h.MerchantID = merchantID
		h.CreatedAt = time.Now()

		_, err := r.db.Exec(ctx, `
			INSERT INTO store_hours (id, merchant_id, day_of_week, open_time, close_time, is_closed, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, h.ID, h.MerchantID, h.DayOfWeek, h.OpenTime, h.CloseTime, h.IsClosed, h.CreatedAt)

		if err != nil {
			return fmt.Errorf("failed to insert store hours: %w", err)
		}
	}

	return nil
}

// GetStoreHours retrieves operating hours for a merchant.
func (r *PostgresMerchantRepository) GetStoreHours(ctx context.Context, merchantID uuid.UUID) ([]*model.StoreHours, error) {
	query := `
		SELECT id, merchant_id, day_of_week, open_time, close_time, is_closed, created_at
		FROM store_hours
		WHERE merchant_id = $1
		ORDER BY day_of_week ASC
	`

	rows, err := r.db.Query(ctx, query, merchantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get store hours: %w", err)
	}
	defer rows.Close()

	hours := []*model.StoreHours{}
	for rows.Next() {
		h := &model.StoreHours{}
		err := rows.Scan(&h.ID, &h.MerchantID, &h.DayOfWeek, &h.OpenTime, &h.CloseTime, &h.IsClosed, &h.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan store hours: %w", err)
		}
		hours = append(hours, h)
	}

	return hours, nil
}

// AddEmployee adds an employee to a merchant.
func (r *PostgresMerchantRepository) AddEmployee(ctx context.Context, employee *model.MerchantEmployee) error {
	query := `
		INSERT INTO merchant_employees (id, merchant_id, user_id, role, is_active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	employee.ID = uuid.New()
	employee.CreatedAt = time.Now()

	_, err := r.db.Exec(ctx, query,
		employee.ID, employee.MerchantID, employee.UserID, employee.Role, employee.IsActive, employee.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to add employee: %w", err)
	}

	return nil
}

// RemoveEmployee marks an employee as inactive.
func (r *PostgresMerchantRepository) RemoveEmployee(ctx context.Context, employeeID uuid.UUID) error {
	query := `UPDATE merchant_employees SET is_active = false WHERE id = $1`
	_, err := r.db.Exec(ctx, query, employeeID)
	if err != nil {
		return fmt.Errorf("failed to remove employee: %w", err)
	}
	return nil
}

// ListEmployees retrieves employees for a merchant.
func (r *PostgresMerchantRepository) ListEmployees(ctx context.Context, merchantID uuid.UUID) ([]*model.MerchantEmployee, error) {
	query := `
		SELECT id, merchant_id, user_id, role, is_active, created_at
		FROM merchant_employees
		WHERE merchant_id = $1 AND is_active = true
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, merchantID)
	if err != nil {
		return nil, fmt.Errorf("failed to list employees: %w", err)
	}
	defer rows.Close()

	employees := []*model.MerchantEmployee{}
	for rows.Next() {
		emp := &model.MerchantEmployee{}
		err := rows.Scan(&emp.ID, &emp.MerchantID, &emp.UserID, &emp.Role, &emp.IsActive, &emp.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan employee: %w", err)
		}
		employees = append(employees, emp)
	}

	return employees, nil
}
