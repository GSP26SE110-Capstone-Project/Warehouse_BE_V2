/**
 * Seed cities + districts for guest rental request dropdowns.
 * Values match warehouse seed (TP.HCM / Hà Nội + quận/huyện).
 *
 * Usage: npm run seed:locations
 */
import 'dotenv/config';
import pool from '../src/config/db.js';

const LOCATIONS = [
  {
    cityCode: 'HCM',
    cityName: 'TP.HCM',
    displayOrder: 1,
    districts: [
      'Quận 1',
      'Quận 2',
      'Quận 3',
      'Quận 4',
      'Quận 5',
      'Quận 6',
      'Quận 7',
      'Quận 8',
      'Quận 9',
      'Quận 10',
      'Quận 11',
      'Quận 12',
      'Bình Thạnh',
      'Bình Tân',
      'Gò Vấp',
      'Phú Nhuận',
      'Tân Bình',
      'Tân Phú',
      'Thủ Đức',
      'Hóc Môn',
      'Củ Chi',
      'Nhà Bè',
      'Cần Giờ',
      'Bình Chánh',
    ],
  },
  {
    cityCode: 'HN',
    cityName: 'Hà Nội',
    displayOrder: 2,
    districts: [
      'Ba Đình',
      'Hoàn Kiếm',
      'Tây Hồ',
      'Long Biên',
      'Cầu Giấy',
      'Đống Đa',
      'Hai Bà Trưng',
      'Hoàng Mai',
      'Thanh Xuân',
      'Hà Đông',
      'Nam Từ Liêm',
      'Bắc Từ Liêm',
      'Sơn Tây',
      'Ba Vì',
      'Phúc Thọ',
      'Đan Phượng',
      'Hoài Đức',
      'Quốc Oai',
      'Thạch Thất',
      'Chương Mỹ',
      'Thanh Oai',
      'Thường Tín',
      'Phú Xuyên',
      'Ứng Hòa',
      'Mỹ Đức',
      'Gia Lâm',
      'Đông Anh',
      'Sóc Sơn',
      'Mê Linh',
    ],
  },
];

async function upsertCity(client, { cityCode, cityName, displayOrder }) {
  const result = await client.query(
    `INSERT INTO cities (city_code, city_name, display_order, is_active)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (city_code) DO UPDATE SET
       city_name = EXCLUDED.city_name,
       display_order = EXCLUDED.display_order,
       is_active = TRUE
     RETURNING city_id`,
    [cityCode, cityName, displayOrder]
  );
  return result.rows[0].city_id;
}

async function upsertDistrict(client, cityId, districtName, displayOrder) {
  await client.query(
    `INSERT INTO districts (city_id, district_name, display_order, is_active)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (city_id, district_name) DO UPDATE SET
       display_order = EXCLUDED.display_order,
       is_active = TRUE`,
    [cityId, districtName, displayOrder]
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const city of LOCATIONS) {
      const cityId = await upsertCity(client, city);
      for (let i = 0; i < city.districts.length; i += 1) {
        await upsertDistrict(client, cityId, city.districts[i], i + 1);
      }
      console.log(`Seeded ${city.cityName}: ${city.districts.length} quận/huyện`);
    }

    await client.query('COMMIT');
    console.log('Location seed completed.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
