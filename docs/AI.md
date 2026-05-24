# AI Slotting & Warehouse Optimization Architecture

> Tài liệu này mô tả **vision AI** cho WMS và **hiện trạng repo** `Warehouse_BE_V2`.
> Liên quan: [`flow.md`](./flow.md) (mục 4.4, 9), [`db4.md`](./db4.md), [`request.md`](./request.md).

## Overview

Dự án là **Warehouse Management System (WMS)** theo mô hình **multi-tenant 3PL** với các domain chính:

- `tenant_companies` (API: `/tenants`)
- `warehouses`, `warehouse_zones` (API: `/zones`)
- `racks`, `rack_levels`, `bins`
- `lpns`, `lpn_details`, `skus`, `batches`
- `inbound_requests`, inventories, putaway
- `storage_reservations`, contracts
- `picking_tasks` (outbound — AI không thay FIFO allocation)

Mục tiêu AI trong hệ thống:

- tối ưu vị trí chứa hàng (putaway / slotting)
- giảm thời gian putaway
- tối ưu occupancy
- tạo training dataset cho machine learning về sau

**Ràng buộc nghiệp vụ** (theo `flow.md`): AI chỉ **recommend** và **analytics**; không FIFO allocate, không auto outbound.

---

# 0. As-built vs Planned

| Hạng mục | Hiện trạng (as-built) | Kế hoạch (planned) |
|----------|------------------------|---------------------|
| Backend | Node.js, **Express 5**, ESM | Giữ Express |
| DB | **PostgreSQL** + `pg` pool (`src/config/db.js`) | Giữ |
| ORM | **Custom** `defineModel` / `SchemaModel` | Không bắt buộc Prisma |
| Queue / cache | **Chưa có** Redis, BullMQ | Phase sau MVP |
| Bảng `ai_slot_recommendations` | Có schema **cơ bản** + model | Migration mở rộng (§5) |
| API AI putaway (rule engine) | **Có** Phase 1a | Phase 1b feedback schema |
| Ollama / Llama giải thích | **Có** — `explain`, `explainWithLlm` | Không dùng LLM chọn bin |
| Gợi ý rack theo weight | Có: `GET /api/lpns/:lpnId/rack-suggestion` | Gắn slotting |
| `occupancy_snapshots`, `sku_movement_analytics` | Có bảng + model, **chưa pipeline đầy đủ** | Feed rule engine |
| ML / OR-Tools / Prometheus | **Chưa có** | Phase 2–4 |

---

# 1. AI có thể làm gì trong hệ thống WMS

## 1.1 Smart Slotting / Putaway Recommendation — **MVP / Phase 1**

AI đề xuất `warehouse_zone` + `bin` tốt nhất khi hàng inbound vào kho.

**Input (Phase 1 — dùng dữ liệu có sẵn):**

| Input | Nguồn |
|-------|--------|
| tenant | `inbound_requests.tenant_id`, `lpns` → contract |
| sku | `lpn_details`, inbound items |
| lpn | `lpns` (`weight_kg`, `supported_box_type`, status) |
| bin occupancy | `bins.used_volume_units`, `current_lpn_count`, `max_*` |
| zone occupancy | aggregate bins / `occupancy_snapshots` |
| contract / reservation | `contracts.contract_type`, `storage_reservations` |
| weight → rack type | `lpnRackSuggestion.service.js` (đã có) |

**Input (planned — cần thêm field hoặc derived logic):**

- `sku_velocity` — từ `sku_movement_analytics` khi có dữ liệu
- `distance_to_dock` — chưa có cột DB; có thể heuristic theo `zone_code` / thứ tự zone
- `congestion` — derived từ mật độ LPN trên bin/zone

**Output:**

```json
{
  "recommendedZoneId": "uuid",
  "recommendedBinId": "uuid",
  "score": 0.93,
  "reason": [
    "same SKU nearby",
    "62% free volume",
    "matches RESERVED zone"
  ],
  "modelVersion": "slotting-v1-rule"
}
```

---

## 1.2–1.5 Các hướng AI khác — **Backlog (post-MVP)**

| # | Tính năng | Ghi chú |
|---|-----------|---------|
| 1.2 | Capacity forecasting | `occupancy_snapshots`, contract `RESERVED_STORAGE` |
| 1.3 | Pick path optimization | `picking_tasks` — cần layout graph |
| 1.4 | Anomaly detection | inventory movements, LPN stuck |
| 1.5 | Billing / usage prediction | `storage_usage_snapshots`, invoices |

---

# 2. AI Roadmap

## Phase 1 — Rule-Based Smart Slotting (**SEP — làm ngay**)

Không cần machine learning. Scoring trong Node.js, ghi `ai_slot_recommendations`.

```js
// Ví dụ trọng số Phase 1 (điều chỉnh khi implement)
score =
  freeCapacity * 0.35 +
  tenantReservationMatch * 0.25 +
  sameSkuCluster * 0.20 +
  rackTypeWeightMatch * 0.20;
// nearDock / congestion: thêm khi có heuristic hoặc cột DB
```

Ưu điểm: ship nhanh, explainable, debug dễ, khớp domain WMS.

## Phase 2 — Feedback & schema nâng cấp

Migration bảng recommendation (§5), thu thập `APPLIED` / `OVERRIDDEN`, export dataset.

## Phase 3 — Machine Learning (ngoài SEP trừ khi đề tài yêu cầu)

Python FastAPI + XGBoost/LightGBM; input từ `feature_snapshot` + historical status.

## Phase 4 — Optimization

OR-Tools: pick path, zone balancing, congestion.

---

# 3. Tech Architecture

## 3.1 Core stack (as-built)

```txt
Frontend
   ↓
Express API (src/app.js, src/routes/*)
   ↓
PostgreSQL (scripts/sql/db4_schema.sql)
   ↓
Services (src/services/*)
Models (src/models/*)
```

| Thành phần | Repo |
|------------|------|
| Runtime | Node.js, `"type": "module"` |
| HTTP | Express 5 |
| DB client | `pg` |
| Auth | JWT (`src/middleware/authenticate.js`) |
| API docs | Swagger (`src/docs/openapi.js`) |

**Không dùng trong repo hiện tại:** NestJS, Prisma, Redis, BullMQ.

## 3.2 AI architecture (target)

```txt
Express WMS API
   ↓
PostgreSQL
   ↓
AI Slotting (Node.js, cùng process)
   ├── featureExtractors/   — đọc bins, zones, reservations, LPN
   ├── scorers/             — rule weights
   ├── recommendation.service.js
   └── explainability       — reason[] + feature_snapshot
```

## 3.3 Cấu trúc thư mục đề xuất (khớp convention repo)

```txt
src/
 ├── services/
 │   ├── aiSlotting/
 │   │   ├── featureExtractors/
 │   │   │   ├── binOccupancy.extractor.js
 │   │   │   ├── tenantReservation.extractor.js
 │   │   │   └── skuCluster.extractor.js
 │   │   ├── scorers/
 │   │   │   └── ruleSlotting.scorer.js
 │   │   └── recommendation.service.js
 │   ├── aiSlotRecommendation.service.js   — CRUD + lifecycle status
 │   └── lpnRackSuggestion.service.js      — đã có; tái sử dụng weight/rack
 ├── controllers/
 │   └── aiSlotRecommendation.controller.js
 ├── routes/
 │   └── aiSlotRecommendation.routes.js
 ├── models/
 │   └── AiSlotRecommendation.js           — cập nhật sau migration
scripts/sql/
 └── ai_slot_recommendations_v2.sql          — migration Phase 1b
```

## 3.4 AI v2 — ML microservice (planned)

```txt
Express API  →  REST  →  Python FastAPI (xgboost, pandas)
```

## 3.5 Ollama / Llama (as-built — giải thích tiếng Việt)

**Chọn bin = rule engine.** Ollama chỉ paraphrase lý do cho nhân viên.

| Env | Mặc định |
|-----|----------|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | `llama3.2:3b` |
| `OLLAMA_ENABLED` | `true` (set `false` để tắt) |
| `OLLAMA_TIMEOUT_MS` | `60000` |

**API:**

```http
GET  /api/ai/slot-recommendations/ollama/health
GET  /api/ai/slot-recommendations/{recommendationId}/explain
POST /api/ai/slot-recommendations/preview
     { "lpnId", "warehouseId", "explainWithLlm": true }
```

File: `src/services/ollama.service.js`, `src/config/ollama.js`.

---

# 4. Feature sources từ DB

## 4.1 Có sẵn (dùng Phase 1)

| Bảng | Field / logic |
|------|----------------|
| `inventories` | `quantity`, `reserved_quantity`, `available_quantity` |
| `bins` | `used_volume_units`, `max_volume_units`, `current_lpn_count`, `max_lpn_count`, `reservation_type`, `status` |
| `warehouse_zones` | `zone_code`, `status`, qua `racks` → `bins` |
| `lpns` | `weight_kg`, `current_bin_id`, `status`, box type |
| `storage_reservations` | `storage_level`, `zone_id`, `bin_id`, `reservation_type` |
| `contracts` | `contract_type` (`SHARED_STORAGE`, `RESERVED_STORAGE`, …) |
| `occupancy_snapshots` | `occupancy_rate`, `available_capacity` |
| `sku_movement_analytics` | velocity khi đã populate |

## 4.2 Chưa có / derived

| Feature | Trạng thái |
|---------|------------|
| `distance_to_dock` | Không có cột — heuristic zone order hoặc migration sau |
| `congestion` | Derived từ bin LPN count / volume |
| `sku_velocity` | Bảng có; cần job snapshot hoặc query aggregate |

---

# 5. `ai_slot_recommendations` — Current vs Target schema

## 5.1 Schema hiện tại (as-built)

File: `scripts/sql/db4_schema.sql`, model: `src/models/AiSlotRecommendation.js`

```sql
-- Đã migrate
CREATE TABLE ai_slot_recommendations (
  recommendation_id UUID PRIMARY KEY,
  inbound_request_id UUID REFERENCES inbound_requests,
  lpn_id UUID REFERENCES lpns,
  sku_id UUID REFERENCES skus,
  recommended_zone_id UUID REFERENCES warehouse_zones (zone_id),
  recommended_bin_id UUID REFERENCES bins (bin_id),
  recommendation_score NUMERIC(10, 4),
  reason TEXT,
  is_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 5.2 Schema mục tiêu (planned migration)

```sql
-- scripts/sql/ai_slot_recommendations_v2.sql (chưa tạo — Phase 1b)
ALTER TABLE ai_slot_recommendations
  ADD COLUMN tenant_id UUID REFERENCES tenant_companies (tenant_id),
  ADD COLUMN actual_zone_id UUID REFERENCES warehouse_zones (zone_id),
  ADD COLUMN actual_bin_id UUID REFERENCES bins (bin_id),
  ADD COLUMN status recommendation_status_enum DEFAULT 'PENDING',
  ADD COLUMN feature_snapshot JSONB,
  ADD COLUMN model_version VARCHAR(50) DEFAULT 'slotting-v1-rule',
  ADD COLUMN applied_at TIMESTAMPTZ;

-- Sau backfill: DROP is_applied; ALTER reason TYPE JSONB (hoặc giữ TEXT + parse)
```

```sql
CREATE TYPE recommendation_status_enum AS ENUM (
  'PENDING', 'APPLIED', 'REJECTED', 'OVERRIDDEN', 'EXPIRED'
);
```

| Cột | Mục đích |
|-----|----------|
| `tenant_id` | Multi-tenant audit & scoring theo contract |
| `actual_zone_id`, `actual_bin_id` | Feedback khi operator chọn khác |
| `status` | Thay `is_applied` boolean |
| `reason` | JSON array hoặc object (explainability) |
| `feature_snapshot` | Features tại thời điểm predict — retrain / debug |
| `model_version` | `slotting-v1-rule`, sau này `xgboost-v3` |

**Lưu ý tên:** DB dùng `warehouse_zones.zone_id`; API list zones là `/api/zones`.

---

# 6. Recommendation status enum

| Status | Ý nghĩa |
|--------|---------|
| `PENDING` | AI đã gợi ý, chưa putaway |
| `APPLIED` | Operator dùng đúng bin AI gợi ý |
| `REJECTED` | Operator từ chối gợi ý |
| `OVERRIDDEN` | Operator chọn bin/zone khác |
| `EXPIRED` | Gợi ý quá cũ (TTL) |

---

# 7. Recommendation flow (Phase 1)

```txt
1. Inbound / LPN created (hoặc trước putaway)
      ↓
2. POST recommend (hoặc GET preview)
      → rule engine score top-N bins
      → INSERT ai_slot_recommendations (PENDING hoặc is_applied=false)
      ↓
3. Operator putaway: PATCH /api/lpns/:lpnId { currentBinId, status: STORED }
      → resolve recommendation: APPLIED | OVERRIDDEN
      → set actual_bin_id, applied_at
      ↓
4. (Phase 2) Export feedback cho ML
```

**Gắn với putaway hiện có** (`request.md`):

```http
PATCH /api/lpns/{lpnId}
{ "currentBinId": "...", "status": "STORED" }
```

Hook trong `lpn.service.js` (hoặc middleware putaway) để cập nhật recommendation.

---

# 8. Explainable AI

Response API nên luôn có `score` + `reason` (mảng string hoặc object sub-scores).

```json
{
  "recommendationId": "uuid",
  "recommendedBinId": "uuid",
  "recommendedZoneId": "uuid",
  "score": 0.93,
  "reason": [
    "62% free volume on bin",
    "same SKU in adjacent bin",
    "tenant RESERVED zone match"
  ],
  "featureSnapshot": {
    "freeVolumeRatio": 0.62,
    "sameSkuNearby": true,
    "contractType": "RESERVED_STORAGE"
  },
  "modelVersion": "slotting-v1-rule"
}
```

---

# 9. Phase 1 — Implementation checklist

Đánh dấu khi hoàn thành trong PR.

## 9.1 Database & model

- [ ] `scripts/sql/ai_slot_recommendations_v2.sql` — enum + cột mới
- [ ] `npm run db:migrate` script entry trong `package.json` (tuỳ chọn)
- [ ] Cập nhật `src/models/AiSlotRecommendation.js`
- [ ] Cập nhật `docs/db4.md` (bảng AI)

## 9.2 Rule engine

- [ ] `src/services/aiSlotting/featureExtractors/binOccupancy.extractor.js`
- [ ] `src/services/aiSlotting/featureExtractors/tenantReservation.extractor.js`
- [ ] `src/services/aiSlotting/scorers/ruleSlotting.scorer.js`
- [ ] `src/services/aiSlotting/recommendation.service.js` — `recommendForLpn(lpnId, { warehouseId })`
- [ ] Tích hợp `lpnRackSuggestion.service.js` (rack type / level filter trước khi chọn bin)

## 9.3 API

- [ ] `src/services/aiSlotRecommendation.service.js` — create, get, patch status
- [ ] `src/controllers/aiSlotRecommendation.controller.js`
- [ ] `src/routes/aiSlotRecommendation.routes.js` — mount trong `src/routes/index.js`
- [ ] Endpoints đề xuất:

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/api/ai/slot-recommendations` | Tạo gợi ý (body: `lpnId`, `warehouseId`, optional `inboundRequestId`) |
| `GET` | `/api/ai/slot-recommendations/:recommendationId` | Chi tiết |
| `GET` | `/api/ai/slot-recommendations?lpnId=&status=` | List theo LPN |
| `PATCH` | `/api/ai/slot-recommendations/:recommendationId` | `status`, `actualBinId` |

- [ ] `src/docs/openapi.js` — schemas + paths
- [ ] `docs/request.md` — mục Putaway + AI (ngắn)

## 9.4 Putaway feedback

- [ ] Trong `lpn.service.js` `update`: khi `currentBinId` set → match recommendation → `APPLIED` / `OVERRIDDEN`

## 9.5 Kiểm thử thủ công

- [ ] Seed LPN + bins có capacity
- [ ] `POST` recommend → nhận top bin + reasons
- [ ] `PATCH` LPN putaway đúng bin → `APPLIED`
- [ ] `PATCH` LPN putaway bin khác → `OVERRIDDEN` + `actual_bin_id`

---

# 10. Scoring reference (Phase 1 draft)

```js
// ruleSlotting.scorer.js — pseudo
function scoreBin(features) {
  const freeCapacity = 1 - features.volumeUsedRatio;
  const reservationMatch = features.tenantCanUseBin ? 1 : 0;
  const sameSkuCluster = features.nearbySameSku ? 1 : 0;
  const rackMatch = features.rackTypeMatchesLpn ? 1 : 0;

  return (
    freeCapacity * 0.35 +
    reservationMatch * 0.25 +
    sameSkuCluster * 0.2 +
    rackMatch * 0.2
  );
}
```

Chọn bin `status = ACTIVE`, còn capacity, thuộc `warehouseId`, pass rack/weight từ `suggestRackPlacementForLpn`.

---

# 11. Planned infrastructure (post-MVP)

Các mục sau **không** nằm trong Phase 1 SEP; chỉ khi scale / production hardening.

## 11.1 Event-driven (Redis + BullMQ)

Events: `LPN_RECEIVED`, `INVENTORY_UPDATED`, `BIN_FULL` → recompute scores / cache.

## 11.2 Cache (Redis)

Top bins, zone occupancy, hot SKUs.

## 11.3 Monitoring (Prometheus + Grafana)

- recommendation acceptance rate
- override rate
- avg putaway time

---

# 12. Stack summary

| Layer | Phase 1 (SEP) | Later |
|-------|---------------|-------|
| API | Express + pg | + Redis queue |
| AI | Node rule engine | Python ML service |
| DB | PostgreSQL + migration v2 | — |
| Optimize | — | OR-Tools |

---

# 13. Final build order

1. **Phase 1a** — Rule engine + API recommend (schema hiện tại, `reason` TEXT, `is_applied`)
2. **Phase 1b** — Migration v2 + lifecycle `status` + putaway hook
3. **Phase 2** — Populate `sku_movement_analytics`, occupancy jobs; thu feedback
4. **Phase 3** — XGBoost (nếu scope đề tài)
5. **Phase 4** — Routing / congestion / balancing

Đây là hướng phù hợp cho **WMS multi-tenant + Express + PostgreSQL** trong repo `Warehouse_BE_V2`.
