# Olmos DSD — Sprint Plan & Product Roadmap

> **Last Updated:** 2026-03-12
> **Stack:** Node/Express/Prisma (backend) · React/Vite/Tailwind (dashboard) · React Native/Expo (driver app)
> **Inspiration:** ServiceTitan field-service UI patterns

---

## ServiceTitan vs Olmos DSD — Feature & UI Gap Analysis

| Category | ServiceTitan | Olmos DSD Current | Gap |
|---|---|---|---|
| **Navigation** | Grouped sidebar + top header | Emoji sidebar, no header | ⚠️ Missing top header, ungrouped nav |
| **Icons** | SVG vector icons (Lucide-style) | Emoji fallbacks | ✅ Fixed in Sprint 1 |
| **Metric Cards** | Icon + value + % change vs prior period | Value only | ⚠️ Missing trend indicators |
| **Global Search** | Command palette / top search bar | None | ⚠️ Missing |
| **Notifications** | Bell icon with badge | None | ⚠️ Missing |
| **User Profile** | Avatar + role in header | None | ⚠️ Missing |
| **Loading States** | Skeleton loaders | Text "Loading..." | ⚠️ Missing skeletons |
| **Toast/Alerts** | Snackbar notifications | None | ⚠️ Missing |
| **Dispatch Board** | Live map + driver cards | Basic list | ⚠️ Basic, needs polish |
| **Invoice List** | Global searchable invoice list | Per-customer only | ⚠️ Missing global list |
| **Route Planning** | Drag-and-drop stop reordering | No UI | ❌ Missing |
| **Reports Page** | Dedicated analytics/reports | Dashboard only | ❌ Missing |
| **Settings Page** | User management, preferences | None | ❌ Missing |
| **Price Level UI** | Visual price tier management | DB only, no UI | ❌ Missing |
| **Promotions UI** | Promo builder with preview | DB only, no UI | ❌ Missing |
| **Customer Portal** | Self-service portal | None | ❌ Out of scope |
| **Mobile App** | Native iOS/Android | React Native (Expo) | ✅ Implemented |
| **Offline Mode** | N/A (cloud-first) | Full SQLite offline | ✅ Ahead of ST |
| **QuickBooks Sync** | Native integration | OAuth + auto-sync | ✅ Implemented |
| **DEX/EDI** | Not offered | Full DEX support | ✅ Ahead of ST |
| **Churn Risk** | Basic | ML-ready with scoring | ✅ Ahead of ST |

---

## What's Already Done ✅

### Backend (Production-Ready)
- [x] Full PostgreSQL schema (30+ tables) with Prisma migrations
- [x] Authentication & RBAC (ADMIN / MANAGER / DRIVER / DISPATCHER)
- [x] Invoice CRUD with 4-tier price resolution (customer > chain > qty > base)
- [x] Payment collection (cash / check / on-account)
- [x] Credit memos with return conditions and approval workflow
- [x] QuickBooks OAuth 2.0 + auto-sync (invoices, payments, credits, customers)
- [x] Offline sync engine (idempotent, conflict-resolved via localId + deviceId)
- [x] Analytics service (revenue, churn risk, LTV, driver performance, inventory)
- [x] DEX/EDI file generation for major grocery chains
- [x] Inventory management (warehouse + truck loads, lot/expiry tracking)
- [x] Route management with stop tracking and GPS logging
- [x] Background jobs (QBO sync every 5 min via node-cron)
- [x] Zod validation on all endpoints, Winston logging

### Dashboard (Web Admin)
- [x] Auth with JWT, protected routes, auto-logout on 401
- [x] Dashboard with 8 metric cards + revenue trend chart + top products
- [x] Customers list with churn risk and lifetime value
- [x] Customer detail with order history, top products, AI suggestions
- [x] Active drivers & routes with progress bars
- [x] Inventory with low-stock/expiry alerts + product catalog
- [x] Pending credits list with approve action
- [x] QuickBooks connection status + sync queue
- [x] Dark theme with Tailwind CSS

### Driver App (React Native / Expo — Offline-First)
- [x] SQLite local database with full schema
- [x] Route list with stop-by-stop navigation
- [x] Invoice creation from truck inventory
- [x] Payment collection (cash / check / on-account)
- [x] Digital signature capture (proof of delivery)
- [x] Credit memo / return workflow
- [x] Daily summary + manual/auto sync
- [x] Pricing engine (4-tier, runs fully offline)
- [x] Barcode scanner support (expo-camera)
- [x] GPS location logging

---

## Sprint 1 — UI Polish & Foundation (Current)
**Goal:** Match ServiceTitan's professional UI quality. Zero new API endpoints.

### Dashboard UI
- [x] Replace emoji icons with Lucide SVG icons throughout
- [x] Add top header bar (logo + search + notifications + user avatar)
- [x] Regroup sidebar nav (Operations / Commerce / Warehouse / Finance)
- [x] MetricCard: add icon + optional trend % badge
- [x] Add Toast/Snackbar notification system (context-based)
- [x] Add skeleton loaders (replace "Loading..." text)
- [x] Global design system: updated Tailwind colors, Inter font, custom utilities

### New Pages Added
- [x] InvoicesPage — global invoice list with status filter + search
- [x] RoutesPage — dispatch board showing all active + planned routes

### Pages Polished
- [x] DashboardPage — trend cards, better charts, quick actions
- [x] DriversPage — ServiceTitan-style dispatch cards
- [x] InventoryPage — tabbed (Warehouse / Truck Loads), sort-able table
- [x] CustomersPage — filter chips, "Add Customer" CTA placeholder
- [x] CreditsPage — approve/reject with confirmation
- [x] QBOPage — sync status with action buttons
- [x] LoginPage — polished card with Olmos DSD branding

---

## Sprint 2 — CRUD & Management UIs
**Goal:** Enable managers to create/edit data directly from the dashboard.

### New Features
- [ ] Add Customer modal (name, chain, address, credit limit, payment terms)
- [ ] Add Product modal (name, SKU, UPC, category, base price, cost)
- [ ] Price Level management UI (view/edit tiers per product)
- [ ] Promotions builder (BOGO, % discount, fixed, mix-and-match)
- [ ] Driver management page (add driver, assign vehicle, view history)
- [ ] Truck load UI (assign inventory to driver for the day)
- [ ] Route builder (create route, drag-and-drop stops)
- [ ] Invoice void / re-print from dashboard
- [ ] Credit reject flow (with reason)
- [ ] Pagination on all tables (customers, invoices, products)

### Backend Additions
- [ ] `GET /api/invoices` — global list with status/date/driver filters
- [ ] `GET /api/drivers` — driver list with vehicle and route status
- [ ] `POST /api/customers` — create customer (already exists, wire up UI)
- [ ] `POST /api/products` — create product (already exists, wire up UI)
- [ ] `PUT /api/customers/:id` — update customer
- [ ] `PUT /api/products/:id` — update product

---

## Sprint 3 — Advanced Features
**Goal:** Feature parity with premium DSD software + DSD-specific advantages.

### Analytics & Reports
- [ ] Reports page with export to CSV/PDF
- [ ] Driver performance scorecards (stops/hr, revenue/stop, on-time %)
- [ ] Customer churn heatmap
- [ ] Inventory ABC analysis visualization
- [ ] Revenue by chain / territory breakdown
- [ ] Daily/weekly/monthly PDF summary reports

### Route Intelligence
- [ ] Map view of driver positions (Mapbox or Google Maps)
- [ ] Live ETA updates per stop
- [ ] Optimal stop reordering suggestion
- [ ] Geo-fence arrival/departure automation

### DEX Management
- [ ] DEX cable status per location in Drivers page
- [ ] DEX transaction history per chain
- [ ] Manual DEX re-transmit button
- [ ] DEX acknowledgement tracking (UCS 997/861)

### Settings
- [ ] User management (create/edit/deactivate users)
- [ ] Role assignment UI
- [ ] Company settings (name, address, tax ID, logo)
- [ ] Chain configuration (DEX codes, pricing tiers)
- [ ] Notification preferences

---

## Sprint 4 — Driver App Polish
**Goal:** Bring driver app to the same polish level as the dashboard.

- [ ] Dark/light theme toggle
- [ ] Product barcode scanner on invoice creation
- [ ] Camera capture for delivery photos
- [ ] Customer signature on iPad-friendly full-screen canvas
- [ ] GPS route turn-by-turn (OpenStreetMap or Google)
- [ ] Push notifications (new stop assigned, route changed)
- [ ] Offline-first conflict resolution UI (show sync errors, allow manual retry)
- [ ] Price override with manager approval flow
- [ ] Truck inventory load checklist at route start

---

## Tech Debt & Maintenance

- [ ] Add proper TypeScript types (replace `any` in dashboard)
- [ ] Unit tests for pricing service (4-tier edge cases)
- [ ] Integration tests for sync engine
- [ ] Load test: 50 concurrent driver syncs
- [ ] Docker Compose for local development (postgres + backend + dashboard)
- [ ] Environment config validation at startup
- [ ] Error boundary components in React
- [ ] Prisma query optimization (add missing indexes for analytics)
- [ ] Rate limiting on public endpoints
- [ ] HTTPS + cert management for production

---

## Definition of Done (Per Sprint)

A feature is **done** when:
1. Works in the UI with real API data (not mocked)
2. Error states are handled and displayed to the user
3. Loading states use skeletons (not just text)
4. Mobile-responsive (dashboard ≥ 768px)
5. No TypeScript errors
6. SPRINT_PLAN.md updated
