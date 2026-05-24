-- Reference data: cities + districts for guest rental requests & warehouse region matching.
-- rental_requests / warehouses still store city + district as VARCHAR (no FK).

CREATE TABLE IF NOT EXISTS cities (
  city_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_code VARCHAR(20) NOT NULL UNIQUE,
  city_name VARCHAR(100) NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS districts (
  district_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(city_id) ON DELETE CASCADE,
  district_name VARCHAR(100) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (city_id, district_name)
);

CREATE INDEX IF NOT EXISTS idx_districts_city_id ON districts (city_id);
CREATE INDEX IF NOT EXISTS idx_districts_city_name ON districts (city_id, district_name);
