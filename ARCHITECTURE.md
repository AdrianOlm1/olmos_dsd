# OLMOS_DSD - Direct Store Delivery Route Accounting System

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        OLMOS_DSD Platform                          │
├──────────────┬──────────────────────┬───────────────────────────┤
│  Driver App  │   Dashboard (Web)    │     Backend API           │
│ React Native │   React + Vite       │   Node.js + Express       │
│ + SQLite     │                      │   + PostgreSQL            │
│ (Offline)    │                      │   + QuickBooks Online     │
└──────┬───────┴──────────┬───────────┴─────────┬─────────────────┘
       │                  │                     │
       │   ┌──────────────┴──────────┐          │
       └───│    Sync Engine          │──────────┘
           │  (Conflict Resolution)  │
           └─────────────────────────┘
```

## System Components

### 1. Backend API (`/backend`)
- **Runtime:** Node.js + Express + TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** JWT tokens with role-based access (driver, admin, manager)
- **Key Services:**
  - CustomerService - CRUD + analytics
  - ProductService - Catalog, pricing engine
  - InvoiceService - Creation, PDF generation
  - InventoryService - Warehouse + truck inventory
  - PaymentService - Cash/check recording
  - RouteService - Route management + optimization
  - SyncService - Offline data reconciliation
  - QuickBooksService - QBO API integration
  - DEXService - DEX/EDI file generation
  - AnalyticsService - Business intelligence

### 2. Driver App (`/driver-app`)
- **Framework:** React Native (Expo)
- **Local DB:** SQLite via expo-sqlite
- **Offline-First:** All operations work offline, queue syncs
- **Key Features:**
  - Route stop list with GPS navigation
  - Invoice creation from truck inventory
  - Barcode scanning (camera + external scanner)
  - Digital signature capture
  - Payment recording (cash/check)
  - Thermal printer support (Bluetooth)
  - DEX cable data transfer
  - Credits/returns/refusals
  - Customer insights (AI-suggested orders)

### 3. Dashboard (`/dashboard`)
- **Framework:** React + Vite + TypeScript
- **UI:** Tailwind CSS + shadcn/ui components
- **Key Views:**
  - Real-time route tracking
  - Sales analytics & trends
  - Customer deep-dive profiles
  - Inventory levels & alerts
  - Driver performance metrics
  - QuickBooks sync status
  - Route optimization suggestions

## Database Design Philosophy

We maintain our OWN PostgreSQL database as the source of truth for operational
data. QuickBooks Online is synced asynchronously to handle its rate limits and
non-concurrent API. This means:

1. Driver creates invoice → saved to our DB immediately
2. Background job syncs invoice to QBO when API is available
3. QBO confirmation stored back in our DB
4. Dashboard reads from our DB (fast) not QBO (slow/rate-limited)

## Smart Features (Data-Driven)

1. **Predictive Ordering** - Analyze customer purchase history to suggest
   likely orders before the driver arrives
2. **Anomaly Detection** - Flag unusual order patterns (shrinkage, fraud)
3. **Dynamic Route Scoring** - Score each stop's profitability in real-time
4. **Churn Prediction** - Identify customers with declining order frequency
5. **Optimal Delivery Windows** - Learn when each customer is most likely
   to accept deliveries and order the most
6. **Smart Promotions** - Suggest which promotions to offer which customers
   based on their purchase patterns
7. **Driver Performance Index** - Composite score of efficiency, accuracy,
   customer satisfaction
