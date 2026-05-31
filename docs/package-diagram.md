# Package Diagram — Warehouse_BE_V2 (`src/`)

> Tài liệu mô tả cấu trúc gói (package) của backend, dùng cho **báo cáo Capstone** và **on-board developer mới**.
> Cập nhật: 2026-05-29.

## Mục lục

- [1. Tổng quan cấu trúc thư mục](#1-tổng-quan-cấu-trúc-thư-mục)
- [2. Package Diagram — Mermaid (cấp cao)](#2-package-diagram--mermaid-cấp-cao)
- [3. Package Diagram — Mermaid (chi tiết với sub-package)](#3-package-diagram--mermaid-chi-tiết-với-sub-package)
- [4. Package Diagram — PlantUML chuẩn UML](#4-package-diagram--plantuml-chuẩn-uml)
- [5. Package Diagram — ASCII (paste vào Word)](#5-package-diagram--ascii-paste-vào-word)
- [6. Quy tắc phụ thuộc (Dependency rules)](#6-quy-tắc-phụ-thuộc-dependency-rules)
- [7. Bảng mô tả từng package](#7-bảng-mô-tả-từng-package)
- [8. Layered View (kèm Mermaid)](#8-layered-view-kèm-mermaid)

---

## 1. Tổng quan cấu trúc thư mục

Backend tổ chức theo mô hình **layered architecture** với 9 package chính dưới `src/`:

```
src/
├── app.js                        ← Bootstrap Express app
├── config/        (4 files)      ← Cấu hình hạ tầng
├── constants/     (5 files)      ← Enum & magic value
├── docs/          (1 file)       ← OpenAPI spec
├── middleware/    (5 files)      ← HTTP middleware
├── models/        (38 files)     ← Data access layer
│   └── utils/    (1 file)        ← Field mapper camel↔snake
├── routes/        (27 files)     ← HTTP routing
├── services/      (34 files)     ← Business logic
├── controllers/   (27 files)     ← HTTP handler
└── utils/         (6 files)      ← Cross-cutting helper
```

**Tổng**: ~150 file, ~3 lớp logic chính.

---

## 2. Package Diagram — Mermaid (cấp cao)

> Paste block dưới vào file `.md` trên GitHub / GitLab / Notion để render tự động.

```mermaid
graph TB
    %% Bootstrap
    APP["📦 app.js<br/>(Bootstrap)"]

    %% Presentation
    ROUTES["📦 routes<br/>(27 files)"]
    CONTROLLERS["📦 controllers<br/>(27 files)"]

    %% Business
    SERVICES["📦 services<br/>(34 files)"]

    %% Data
    MODELS["📦 models<br/>(38 files)"]
    MODEL_UTILS["📦 models/utils<br/>(fieldMapper)"]

    %% Cross-cutting
    MIDDLEWARE["📦 middleware<br/>(5 files)"]
    UTILS["📦 utils<br/>(6 files)"]
    CONSTANTS["📦 constants<br/>(5 files)"]
    CONFIG["📦 config<br/>(db, jwt, mail, swagger)"]
    DOCS["📦 docs<br/>(openapi.js)"]

    %% External
    DB[("🗄 PostgreSQL")]
    EXPRESS["⚙ Express"]
    PG["⚙ pg"]
    JWT_LIB["⚙ jsonwebtoken"]
    NODEMAILER["⚙ nodemailer"]

    %% Dependencies
    APP --> ROUTES
    APP --> MIDDLEWARE
    APP --> CONFIG
    APP --> DOCS
    APP --> EXPRESS

    ROUTES --> CONTROLLERS
    ROUTES --> MIDDLEWARE

    CONTROLLERS --> SERVICES
    CONTROLLERS --> UTILS

    SERVICES --> MODELS
    SERVICES --> UTILS
    SERVICES --> CONSTANTS
    SERVICES --> CONFIG

    MODELS --> MODEL_UTILS
    MODELS --> CONFIG
    MODELS --> UTILS

    MIDDLEWARE --> UTILS
    MIDDLEWARE --> CONFIG

    CONFIG --> PG
    CONFIG --> JWT_LIB
    CONFIG --> NODEMAILER
    CONFIG --> DB

    DOCS --> EXPRESS

    %% Styling
    classDef bootstrap fill:#FFE4B5,stroke:#FF8C00,stroke-width:2px
    classDef presentation fill:#B0E0E6,stroke:#4682B4,stroke-width:2px
    classDef business fill:#90EE90,stroke:#228B22,stroke-width:2px
    classDef data fill:#FFB6C1,stroke:#DC143C,stroke-width:2px
    classDef cross fill:#D3D3D3,stroke:#696969,stroke-width:2px
    classDef external fill:#F0E68C,stroke:#DAA520,stroke-width:2px,stroke-dasharray: 5 5

    class APP bootstrap
    class ROUTES,CONTROLLERS presentation
    class SERVICES business
    class MODELS,MODEL_UTILS data
    class MIDDLEWARE,UTILS,CONSTANTS,CONFIG,DOCS cross
    class DB,EXPRESS,PG,JWT_LIB,NODEMAILER external
```

### Chú thích màu

- 🟠 **Cam** — Bootstrap (entry point).
- 🔵 **Xanh dương** — Presentation Layer.
- 🟢 **Xanh lá** — Business Layer.
- 🩷 **Hồng** — Data Access Layer.
- ⚪ **Xám** — Cross-cutting concern.
- 🟡 **Vàng đứt nét** — External library / database.

---

## 3. Package Diagram — Mermaid (chi tiết với sub-package)

> Có chia rõ domain bên trong controllers/services/models cho báo cáo dài.

```mermaid
graph LR
    subgraph "Bootstrap"
        APP[app.js]
        SERVER[server.js]
    end

    subgraph "Presentation Layer"
        subgraph "routes"
            R_AUTH[auth.routes]
            R_USER[user.routes]
            R_WH[warehouse.routes]
            R_INBOUND[inboundRequest.routes]
            R_OUTBOUND[outboundRequest.routes]
            R_OTHER["... 22 files khác"]
            R_INDEX[index.js]
        end

        subgraph "controllers"
            C_AUTH[auth.controller]
            C_USER[user.controller]
            C_WH[warehouse.controller]
            C_INBOUND[inboundRequest.controller]
            C_OUTBOUND[outboundRequest.controller]
            C_OTHER["... 22 files khác"]
        end
    end

    subgraph "Business Layer"
        subgraph "services"
            S_AUTH[auth.service]
            S_USER[user.service]
            S_WH[warehouse.service]
            S_INBOUND[inboundRequest.service]
            S_OUTBOUND[outboundRequest.service]
            S_LPN_AI[lpnRackSuggestion.service]
            S_OTHER["... 28 files khác"]
        end
    end

    subgraph "Data Access Layer"
        subgraph "models"
            M_BASE[BaseModel]
            M_SCHEMA[SchemaModel]
            M_DEFINE[defineModel]
            M_INDEX[index.js]
            M_ENTITIES["Entities: User, Warehouse,<br/>Zone, Rack, Bin, LPN,<br/>Inbound, Outbound,<br/>Contract, ... (~30 file)"]
        end
        M_FIELDMAP["models/utils<br/>fieldMapper"]
    end

    subgraph "Cross-cutting"
        subgraph "middleware"
            MW_AUTH[authenticate]
            MW_AUTHZ[authorize]
            MW_ASYNC[asyncHandler]
            MW_ERR[errorHandler]
            MW_404[notFound]
        end

        subgraph "utils"
            U_APIRES[apiResponse]
            U_ERR[AppError]
            U_OTP[otpStore]
            U_PWD[password]
            U_VALID[validate]
            U_PUB[userPublic]
        end

        subgraph "constants"
            K_AUTH[auth]
            K_INBOUND[inbound]
            K_OUTBOUND[outbound]
            K_ONBOARD[tenantOnboarding]
            K_WH[warehouseStructure]
        end

        subgraph "config"
            CFG_DB[db]
            CFG_JWT[jwt]
            CFG_MAIL[mail]
            CFG_SW[swagger]
        end

        subgraph "docs"
            D_OPENAPI[openapi]
        end
    end

    %% External
    EXT_PG[("PostgreSQL")]
    EXT_GMAIL[("Gmail SMTP")]

    %% Top-level deps
    SERVER --> APP
    APP --> R_INDEX
    APP --> MW_ERR
    APP --> MW_404
    APP --> CFG_SW
    APP --> CFG_DB

    R_INDEX --> R_AUTH
    R_INDEX --> R_USER
    R_INDEX --> R_WH
    R_INDEX --> R_INBOUND
    R_INDEX --> R_OUTBOUND
    R_INDEX --> R_OTHER

    %% Route → controller + middleware
    R_AUTH --> C_AUTH
    R_AUTH --> MW_AUTH
    R_AUTH --> MW_ASYNC
    R_INBOUND --> C_INBOUND
    R_INBOUND --> MW_AUTH
    R_OUTBOUND --> C_OUTBOUND
    R_OUTBOUND --> MW_AUTH

    %% Controller → service
    C_AUTH --> S_AUTH
    C_AUTH --> U_APIRES
    C_INBOUND --> S_INBOUND
    C_INBOUND --> U_APIRES
    C_INBOUND --> U_VALID
    C_OUTBOUND --> S_OUTBOUND
    C_OUTBOUND --> U_APIRES

    %% Service → model + utils + constants
    S_AUTH --> M_ENTITIES
    S_AUTH --> U_PWD
    S_AUTH --> U_OTP
    S_AUTH --> U_ERR
    S_AUTH --> CFG_MAIL
    S_AUTH --> CFG_JWT

    S_INBOUND --> M_ENTITIES
    S_INBOUND --> U_ERR
    S_INBOUND --> U_VALID
    S_INBOUND --> K_INBOUND
    S_INBOUND --> S_WH

    S_OUTBOUND --> M_ENTITIES
    S_OUTBOUND --> U_ERR
    S_OUTBOUND --> U_VALID
    S_OUTBOUND --> K_OUTBOUND
    S_OUTBOUND --> S_WH

    %% Model deps
    M_ENTITIES --> M_DEFINE
    M_DEFINE --> M_SCHEMA
    M_SCHEMA --> M_BASE
    M_BASE --> M_FIELDMAP
    M_BASE --> CFG_DB
    M_BASE --> U_ERR

    %% Middleware deps
    MW_AUTH --> CFG_JWT
    MW_AUTH --> U_ERR
    MW_AUTHZ --> U_ERR
    MW_ERR --> U_ERR
    MW_ERR --> U_APIRES

    %% Config to external
    CFG_DB --> EXT_PG
    CFG_MAIL --> EXT_GMAIL

    %% Docs
    CFG_SW --> D_OPENAPI
```

> Lưu ý: diagram chi tiết này nên dùng cho slide / báo cáo dài. Cho slide ngắn dùng diagram cấp cao ở mục 2.

---

## 4. Package Diagram — PlantUML chuẩn UML

> Render bằng `plantuml.com/plantuml/uml/` hoặc plugin IDE (PlantUML Integration). Đây là notation chuẩn UML 2.5 cho package diagram.

```plantuml
@startuml WarehouseBE_PackageDiagram

skinparam packageStyle rectangle
skinparam shadowing false
skinparam defaultFontName "Segoe UI"

title Warehouse_BE_V2 — Package Diagram (src/)

' ============== Bootstrap ==============
package "Bootstrap" as bootstrap #FFE4B5 {
  [server.js]
  [app.js]
}

' ============== Presentation Layer ==============
package "Presentation Layer" as presentation #B0E0E6 {
  package "routes" as routes {
    [auth.routes]
    [user.routes]
    [warehouse.routes]
    [inboundRequest.routes]
    [outboundRequest.routes]
    [...(22 files khác)]
    [index.js]
  }

  package "controllers" as controllers {
    [auth.controller]
    [user.controller]
    [warehouse.controller]
    [inboundRequest.controller]
    [outboundRequest.controller]
    [...(22 files khác)]
  }
}

' ============== Business Layer ==============
package "Business Layer" as business #90EE90 {
  package "services" as services {
    [auth.service]
    [user.service]
    [warehouse.service]
    [inboundRequest.service]
    [outboundRequest.service]
    [lpnRackSuggestion.service]
    [...(28 files khác)]
  }
}

' ============== Data Access Layer ==============
package "Data Access Layer" as data #FFB6C1 {
  package "models" as models {
    [BaseModel]
    [SchemaModel]
    [defineModel]
    [index.js]
    [User]
    [Warehouse]
    [Zone, Rack, Bin]
    [LPN, LpnDetail]
    [Inbound, Outbound]
    [Contract, ContractItem]
    [Inventory, Movement]
    [...(20+ entities khác)]
  }
  package "models/utils" as model_utils {
    [fieldMapper]
  }
}

' ============== Cross-cutting ==============
package "Cross-cutting" as cross #D3D3D3 {

  package "middleware" as middleware {
    [authenticate]
    [authorize]
    [asyncHandler]
    [errorHandler]
    [notFound]
  }

  package "utils" as utils {
    [AppError]
    [apiResponse]
    [validate]
    [password]
    [otpStore]
    [userPublic]
  }

  package "constants" as constants {
    [auth]
    [inbound]
    [outbound]
    [tenantOnboarding]
    [warehouseStructure]
  }

  package "config" as config {
    [db]
    [jwt]
    [mail]
    [swagger]
  }

  package "docs" as openapi_pkg {
    [openapi.js]
  }
}

' ============== External ==============
database "PostgreSQL" as pg #F0E68C
cloud "Gmail SMTP" as gmail #F0E68C
node "Express" as express #F0E68C

' ============== Dependencies ==============
bootstrap ..> presentation : uses
bootstrap ..> middleware : uses
bootstrap ..> config : uses
bootstrap ..> openapi_pkg : mount swagger

presentation ..> business : delegates
presentation ..> middleware : protected by
presentation ..> utils : format response

business ..> data : reads/writes
business ..> utils : validate, errors
business ..> constants : enum check
business ..> config : send mail

data ..> model_utils : map fields
data ..> config : pg pool
data ..> utils : throw error

middleware ..> utils : throw error
middleware ..> config : verify JWT

config ..> pg : connect
config ..> gmail : SMTP
config ..> express : mount swagger

@enduml
```

### Cách render

1. **Online**: copy code, paste vào https://www.plantuml.com/plantuml/uml/.
2. **VS Code**: cài extension *PlantUML* + Java + Graphviz, mở file `.puml` → Alt+D.
3. **IntelliJ**: cài plugin *PlantUML Integration*.
4. **Export**: PNG / SVG / PDF cho báo cáo.

---

## 5. Package Diagram — ASCII (paste vào Word)

> Cho báo cáo Word / Google Docs không render Mermaid được. Dùng font **Consolas** / **Courier New** để giữ alignment.

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                   WAREHOUSE_BE_V2 — PACKAGE DIAGRAM                        ║
║                                                                            ║
║   ┌─────────────────────────────────────────────────────────────────────┐ ║
║   │                          BOOTSTRAP                                   │ ║
║   │   ┌──────────────┐    ┌──────────────┐                              │ ║
║   │   │  server.js   │───▶│   app.js     │                              │ ║
║   │   └──────────────┘    └──────┬───────┘                              │ ║
║   └─────────────────────────────┬┼─────────────────────────────────────┘ ║
║                                 ││                                        ║
║                                 ▼▼                                        ║
║   ┌─────────────────────────────────────────────────────────────────────┐ ║
║   │                    PRESENTATION LAYER                                │ ║
║   │   ┌────────────────────────────────────────────────────────────────┐│ ║
║   │   │  routes  (27 files)                                            ││ ║
║   │   │  ├─ index.js (mount all)                                       ││ ║
║   │   │  ├─ auth.routes        ├─ user.routes                          ││ ║
║   │   │  ├─ warehouse.routes   ├─ zone.routes                          ││ ║
║   │   │  ├─ rack.routes        ├─ rackLevel.routes                     ││ ║
║   │   │  ├─ bin.routes         ├─ rentalRequest.routes                 ││ ║
║   │   │  ├─ contract.routes    ├─ contractItem.routes                  ││ ║
║   │   │  ├─ tenantCompany.routes                                       ││ ║
║   │   │  ├─ storageReservation.routes                                  ││ ║
║   │   │  ├─ category.routes    ├─ season.routes                        ││ ║
║   │   │  ├─ collection.routes  ├─ sku.routes                           ││ ║
║   │   │  ├─ batch.routes       ├─ lpn.routes                           ││ ║
║   │   │  ├─ lpnDetail.routes   ├─ inboundRequest.routes                ││ ║
║   │   │  └─ outboundRequest.routes                                     ││ ║
║   │   └────────────────────────┬───────────────────────────────────────┘│ ║
║   │                            │                                        │ ║
║   │   ┌────────────────────────▼───────────────────────────────────────┐│ ║
║   │   │  controllers (27 files) — Parse req, format response only      ││ ║
║   │   └────────────────────────┬───────────────────────────────────────┘│ ║
║   └────────────────────────────┼─────────────────────────────────────────┘ ║
║                                │                                          ║
║                                ▼                                          ║
║   ┌─────────────────────────────────────────────────────────────────────┐ ║
║   │                    BUSINESS LAYER                                    │ ║
║   │   ┌────────────────────────────────────────────────────────────────┐│ ║
║   │   │  services  (34 files) — Validation + business rules            ││ ║
║   │   │  ├─ auth.service          ├─ user.service                      ││ ║
║   │   │  ├─ warehouse.service     ├─ warehouseZone.service              ││ ║
║   │   │  ├─ rack.service          ├─ rackLevel.service                  ││ ║
║   │   │  ├─ bin.service           ├─ rentalRequest.service              ││ ║
║   │   │  ├─ tenantCompany.service ├─ contract.service                   ││ ║
║   │   │  ├─ contractItem.service  ├─ storageReservation.service         ││ ║
║   │   │  ├─ category.service      ├─ season.service                     ││ ║
║   │   │  ├─ collection.service    ├─ sku.service                        ││ ║
║   │   │  ├─ batch.service         ├─ lpn.service                        ││ ║
║   │   │  ├─ lpnDetail.service     ├─ lpnRackSuggestion.service          ││ ║
║   │   │  ├─ inboundRequest.service                                      ││ ║
║   │   │  └─ outboundRequest.service                                     ││ ║
║   │   └────────────────────────┬───────────────────────────────────────┘│ ║
║   └────────────────────────────┼─────────────────────────────────────────┘ ║
║                                │                                          ║
║                                ▼                                          ║
║   ┌─────────────────────────────────────────────────────────────────────┐ ║
║   │                    DATA ACCESS LAYER                                 │ ║
║   │   ┌────────────────────────────────────────────────────────────────┐│ ║
║   │   │  models  (38 files) — CRUD wrapper trên pg                     ││ ║
║   │   │                                                                ││ ║
║   │   │   BaseModel ◀── SchemaModel ◀── defineModel ◀─ index.js       ││ ║
║   │   │      │                                                         ││ ║
║   │   │      └──▶ models/utils/fieldMapper.js                          ││ ║
║   │   │                                                                ││ ║
║   │   │   Entities (~30 files):                                        ││ ║
║   │   │     User, TenantCompany, Warehouse, WarehouseZone,             ││ ║
║   │   │     Rack, RackLevel, Bin,                                      ││ ║
║   │   │     RentalRequest, Contract, ContractItem,                     ││ ║
║   │   │     StorageReservation,                                        ││ ║
║   │   │     Category, Season, Collection, Sku, Batch,                  ││ ║
║   │   │     Lpn, LpnDetail,                                            ││ ║
║   │   │     Inventory, InventoryMovement,                              ││ ║
║   │   │     InboundRequest, InboundRequestItem,                        ││ ║
║   │   │     OutboundRequest, OutboundRequestItem,                      ││ ║
║   │   │     PickingTask, PickingTaskItem, Shipment,                    ││ ║
║   │   │     PricingPolicy, Invoice, InvoiceItem, Payment,              ││ ║
║   │   │     StorageUsageSnapshot, OccupancySnapshot,                   ││ ║
║   │   │     AiSlotRecommendation, SkuMovementAnalytics                 ││ ║
║   │   └────────────────────────┬───────────────────────────────────────┘│ ║
║   └────────────────────────────┼─────────────────────────────────────────┘ ║
║                                │                                          ║
║                                ▼                                          ║
║                       ┌────────────────┐                                  ║
║                       │  PostgreSQL    │                                  ║
║                       │ smart_warehouse│                                  ║
║                       └────────────────┘                                  ║
║                                                                            ║
║   ┌─────────────────────────────────────────────────────────────────────┐ ║
║   │                       CROSS-CUTTING                                  │ ║
║   │                                                                      │ ║
║   │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │ ║
║   │  │  middleware (5) │  │   utils (6)     │  │  constants (5)     │  │ ║
║   │  │  authenticate   │  │  AppError       │  │  auth              │  │ ║
║   │  │  authorize      │  │  apiResponse    │  │  inbound           │  │ ║
║   │  │  asyncHandler   │  │  validate       │  │  outbound          │  │ ║
║   │  │  errorHandler   │  │  password       │  │  tenantOnboarding  │  │ ║
║   │  │  notFound       │  │  otpStore       │  │  warehouseStructure│  │ ║
║   │  │                 │  │  userPublic     │  │                    │  │ ║
║   │  └─────────────────┘  └─────────────────┘  └────────────────────┘  │ ║
║   │                                                                      │ ║
║   │  ┌──────────────────────┐                ┌────────────────────────┐ │ ║
║   │  │     config (4)       │                │     docs (1)           │ │ ║
║   │  │   db    │  jwt       │                │   openapi.js (50+ paths)│ │ ║
║   │  │   mail  │  swagger   │                │                        │ │ ║
║   │  └──────────────────────┘                └────────────────────────┘ │ ║
║   └──────────────────────────────────────────────────────────────────────┘ ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## 6. Quy tắc phụ thuộc (Dependency rules)

> Bảng này là **rule cứng** — vi phạm dẫn tới circular import hoặc khó test.

### 6.1 Ma trận phụ thuộc

✅ = được phép import / phụ thuộc.
❌ = KHÔNG được phép.

| Từ ↓ \ Đến → | bootstrap | routes | controllers | services | models | middleware | utils | constants | config | docs |
|---|---|---|---|---|---|---|---|---|---|---|
| **bootstrap** | – | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **routes** | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **controllers** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **services** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **models** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **middleware** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **utils** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **constants** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **config** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **docs** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 6.2 Diễn giải

- **bootstrap** → routes, config, middleware, docs (entry point setup).
- **routes** → controllers + middleware. Không gọi service trực tiếp.
- **controllers** → services + utils (apiResponse, validate). Không truy cập DB.
- **services** → models + utils + constants + (config khi cần send mail / JWT). Cross-service call OK.
- **models** → models khác (ít) + config/db + utils. Không gọi service/controller/route.
- **middleware** → utils + config. Không phụ thuộc tầng business.
- **utils** → chỉ external + utils khác. Là nền tảng nhất.
- **constants** → 100% pure, không import gì.
- **config** → external lib + utils (rất hạn chế).

### 6.3 Vi phạm thường gặp & cách fix

| Vi phạm | Triệu chứng | Cách fix |
|---------|-------------|---------|
| Controller import model trực tiếp | DB query lộn xộn, khó refactor | Bọc qua service |
| Service A import Service B + Service B import Service A | Circular import, undefined exports | Tách helper riêng vào utils |
| Model gọi service | Vô lý — logic ngược chiều | Move logic về service |
| Route gọi DB | Bypass tầng business | Refactor qua controller → service |
| Utils import service/controller | Phá nguyên tắc utility độc lập | Move tới service |

---

## 7. Bảng mô tả từng package

| Package | File count | Trách nhiệm | Ví dụ file |
|---------|-----------|-------------|-----------|
| `bootstrap` (root + app.js) | 2 | Khởi tạo Express, mount middleware + routes, listen port | `server.js`, `app.js` |
| `config` | 4 | Cấu hình hạ tầng: DB pool, JWT signer, mail transporter, Swagger UI | `db.js`, `jwt.js`, `mail.js`, `swagger.js` |
| `constants` | 5 | Enum, magic value dùng chung, FREEZE để bất biến | `auth.js`, `inbound.js`, `outbound.js`, `tenantOnboarding.js`, `warehouseStructure.js` |
| `docs` | 1 | OpenAPI 3.0 spec single-file cho Swagger UI | `openapi.js` (~3000 dòng, 50+ paths) |
| `middleware` | 5 | Express middleware: auth, async wrap, error handler, 404 | `authenticate.js`, `authorize.js`, `asyncHandler.js`, `errorHandler.js`, `notFound.js` |
| `models` | 38 | Data access — wrapper trên pg, schema definition, CRUD generic | `BaseModel.js`, `SchemaModel.js`, `defineModel.js`, `User.js`, `OutboundRequest.js`,... |
| `models/utils` | 1 | Field mapper camelCase ↔ snake_case | `fieldMapper.js` |
| `routes` | 27 | HTTP routing: method + path + middleware + controller | `auth.routes.js`, `outboundRequest.routes.js`, `index.js` (mount all) |
| `controllers` | 27 | Parse req, gọi service, format response. Không có business logic | `auth.controller.js`, `outboundRequest.controller.js` |
| `services` | 34 | Business logic, validate, normalize, orchestration | `auth.service.js`, `outboundRequest.service.js`, `lpnRackSuggestion.service.js` |
| `utils` | 6 | Cross-cutting helper: error class, response format, validate, OTP, password | `AppError.js`, `apiResponse.js`, `validate.js`, `password.js`, `otpStore.js`, `userPublic.js` |

### Phân bổ độ phức tạp

```
Tổng: ~150 file
├─ services        ~22% (logic phức tạp nhất)
├─ models          ~25%
├─ routes          ~18%
├─ controllers     ~18%
├─ docs (openapi)   ~1% nhưng dòng code lớn (~3000)
├─ middleware       ~3%
├─ utils            ~4%
├─ constants        ~3%
├─ config           ~3%
└─ bootstrap        ~1%
```

---

## 8. Layered View (kèm Mermaid)

> View kiến trúc nhìn theo **tầng** — phù hợp slide thuyết trình.

```mermaid
flowchart TB
    CLIENT["💻 Client (FE Web / Mobile)"]

    subgraph SERVER ["🖥 Node.js Server"]
        L1["🟠 Bootstrap Layer<br/>app.js, server.js"]
        L2["🔵 Presentation Layer<br/>routes/, controllers/"]
        L3["🟢 Business Layer<br/>services/"]
        L4["🩷 Data Access Layer<br/>models/, models/utils/"]
        CC["⚪ Cross-cutting<br/>middleware/, utils/,<br/>constants/, config/, docs/"]
    end

    DB[("🗄 PostgreSQL")]
    MAIL["✉ Gmail SMTP"]
    CDN["☁ Cloudinary"]

    CLIENT -- "HTTP / JSON" --> L1
    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 -- "SQL (parameterised)" --> DB

    CC -.-> L1
    CC -.-> L2
    CC -.-> L3
    CC -.-> L4

    L3 -.-> MAIL
    L3 -.-> CDN

    classDef bootstrap fill:#FFE4B5,stroke:#FF8C00
    classDef presentation fill:#B0E0E6,stroke:#4682B4
    classDef business fill:#90EE90,stroke:#228B22
    classDef data fill:#FFB6C1,stroke:#DC143C
    classDef cross fill:#D3D3D3,stroke:#696969
    classDef ext fill:#F0E68C,stroke:#DAA520,stroke-dasharray: 5 5

    class L1 bootstrap
    class L2 presentation
    class L3 business
    class L4 data
    class CC cross
    class DB,MAIL,CDN,CLIENT ext
```

### Mô tả

- **Bootstrap** — entry point, khởi tạo Express, mount router + middleware, listen port 3000.
- **Presentation Layer** — nhận HTTP, parse JSON, route theo URL, gọi controller. Controller parse `req`, delegate cho service, format `res`.
- **Business Layer** — chứa business rules. Validate input, check rule (vd contract phải ACTIVE), orchestrate nhiều model.
- **Data Access Layer** — wrapper CRUD trên `pg`, map camel ↔ snake, parameterised SQL.
- **Cross-cutting** — sử dụng xuyên các tầng. Không phụ thuộc tầng nào (trừ utils & config).

---

## 9. Hướng dẫn cập nhật

Khi thêm domain mới (ví dụ thêm `Shipment` API):

1. **Thêm model**: `src/models/Shipment.js`.
2. **Thêm constant** (nếu có enum): `src/constants/shipment.js`.
3. **Thêm service**: `src/services/shipment.service.js`.
4. **Thêm controller**: `src/controllers/shipment.controller.js`.
5. **Thêm route**: `src/routes/shipment.routes.js`.
6. **Mount route** vào `src/routes/index.js`.
7. **Cập nhật OpenAPI**: `src/docs/openapi.js`.
8. **Cập nhật file này**: bump số `services 34 → 35`, `controllers 27 → 28`,...

> Khi thêm cross-domain dependency (vd service A gọi service B), kiểm tra ma trận §6.1 để đảm bảo không vi phạm dependency rule.

---

## 10. Phụ lục — file cụ thể của từng domain

Mỗi domain có 4 file song hành. Đây là bảng tham chiếu nhanh:

| Domain | Model | Service | Controller | Route |
|--------|-------|---------|-----------|-------|
| Auth | (User) | `auth.service.js` | `auth.controller.js` | `auth.routes.js` |
| User | `User.js` | `user.service.js` | `user.controller.js` | `user.routes.js` |
| Warehouse | `Warehouse.js` | `warehouse.service.js` | `warehouse.controller.js` | `warehouse.routes.js` |
| Zone | `WarehouseZone.js` | `warehouseZone.service.js` | `warehouseZone.controller.js` | `zone.routes.js` |
| Rack | `Rack.js` | `rack.service.js` | `rack.controller.js` | `rack.routes.js` |
| RackLevel | `RackLevel.js` | `rackLevel.service.js` | `rackLevel.controller.js` | `rackLevel.routes.js` |
| Bin | `Bin.js` | `bin.service.js` | `bin.controller.js` | `bin.routes.js` |
| RentalRequest | `RentalRequest.js` | `rentalRequest.service.js` | `rentalRequest.controller.js` | `rentalRequest.routes.js` |
| TenantCompany | `TenantCompany.js` | `tenantCompany.service.js` | `tenantCompany.controller.js` | `tenantCompany.routes.js` |
| Contract | `Contract.js` | `contract.service.js` | `contract.controller.js` | `contract.routes.js` |
| ContractItem | `ContractItem.js` | `contractItem.service.js` | `contractItem.controller.js` | `contractItem.routes.js` |
| StorageReservation | `StorageReservation.js` | `storageReservation.service.js` | `storageReservation.controller.js` | `storageReservation.routes.js` |
| Category | `Category.js` | `category.service.js` | `category.controller.js` | `category.routes.js` |
| Season | `Season.js` | `season.service.js` | `season.controller.js` | `season.routes.js` |
| Collection | `Collection.js` | `collection.service.js` | `collection.controller.js` | `collection.routes.js` |
| SKU | `Sku.js` | `sku.service.js` | `sku.controller.js` | `sku.routes.js` |
| Batch | `Batch.js` | `batch.service.js` | `batch.controller.js` | `batch.routes.js` |
| LPN | `Lpn.js` | `lpn.service.js`, `lpnRackSuggestion.service.js` | `lpn.controller.js` | `lpn.routes.js` |
| LpnDetail | `LpnDetail.js` | `lpnDetail.service.js` | `lpnDetail.controller.js` | `lpnDetail.routes.js` |
| InboundRequest | `InboundRequest.js`, `InboundRequestItem.js` | `inboundRequest.service.js` | `inboundRequest.controller.js` | `inboundRequest.routes.js` |
| OutboundRequest | `OutboundRequest.js`, `OutboundRequestItem.js` | `outboundRequest.service.js` | `outboundRequest.controller.js` | `outboundRequest.routes.js` |

---

> Đây là tài liệu **package-level**. Để xem chi tiết class diagram cho từng entity, xem `docs/db4.md` và `docs/relationship.md`.

> Người duy trì: **BE Team Lead**. Cập nhật mỗi khi thêm domain mới.
