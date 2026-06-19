# Fabric Catalog & Swatch Management System — PRD

## Problem statement
Professional web application that manages fabric catalogs and swatches with catalog
management, barcode/QR tracking, issue/return flow, supplier & category management,
user roles, reports, audit logs, and a dashboard. Archive instead of delete philosophy.

## Stack
- Backend: FastAPI + Motor (MongoDB), all routes under `/api`
- Frontend: React + Tailwind + shadcn/ui + Recharts + html5-qrcode
- Auth: JWT (httpOnly cookies), bcrypt, RBAC (admin/manager/staff)
- Images: base64 in MongoDB
- Barcode: Code128 (python-barcode SVG) + QR (qrcode SVG)
- Exports: CSV (csv), Excel (openpyxl), PDF (reportlab)

## User personas
- **Admin** — full access, manages users
- **Manager** — manages catalogs, categories, suppliers, issues/returns, reports, audit
- **Staff** — view catalogs, issue, return, scan

## Architecture
- Single `/app/backend/server.py` (auth, categories, suppliers, catalogs, issues, returns, scans, dashboard, reports, users, audit)
- React app with `AuthProvider` (`/lib/auth.jsx`) + axios with `withCredentials`
- Pages under `/app/frontend/src/pages/`
- Sidebar layout via `/components/AppLayout.jsx`

## Core requirements (static)
1. Catalog CRUD + archive/restore + image upload + barcode/QR auto-generated
2. Catalog detail with barcode/QR (download/print) + history tabs (issues, returns, scans)
3. Categories & Suppliers CRUD + archive/restore
4. Issue catalog (customer/employee, dept, dates, remarks); Return (condition, remarks)
5. Scanner page: USB/manual + Camera (html5-qrcode)
6. Dashboard: totals + monthly issues/returns, category/supplier distribution, most issued/scanned, overdue
7. Reports: PDF/Excel/CSV catalog exports
8. Audit logs (admin/manager only)
9. Users (admin only) — create, toggle active
10. Auth: login, logout, change password, forgot/reset password, brute-force lockout (email keyed)

## 2026-02-19 — Scanner tablet + USB hardware support + multi-field lookup
- **P0 fix — tablet camera decoding**: `Scanner.jsx` upgraded with multi-format support (12 formats incl. CODE_128, CODE_39, EAN_13, DATA_MATRIX, QR), `useBarCodeDetectorIfSupported=true` (routes to native iPad/Android Chrome BarcodeDetector — orders of magnitude faster than ZXing-WASM), 15fps, dynamic rectangular qrbox, 1920×1080 ideal video with continuous autofocus.
- **P1 feature — USB plug-and-play scanner**: global window `keydown` listener buffers rapid keystrokes (<60ms apart) and dispatches scan on Enter — works without needing to click into the input. Visible "USB scanner LISTENING" badge + Enable/Disable toggle. Correctly ignores typing inside other inputs/textareas. Auto-paused while picker dialog is open.
- **P1 feature — Lookup by cat no / catalog name (in addition to code)**: `/api/scans` extended to a 3-tier lookup (exact codes → catalog_name exact case-insensitive → fuzzy contains on name/cat_no). Multi-match returns HTTP 409 with `{matches: [...]}`; frontend shows a Dialog picker (`multi-match-dialog`) so the user can disambiguate. Single-match flows are unchanged.
- Verified: iteration_5 (USB + camera) 10/10 PASS, iteration_6 (cat_no/name + picker) 9/9 PASS.
- Note: Real tablet decoding must be smoke-tested by the user against an actual fabric label — headless Chromium has no real BarcodeDetector or camera.

## What's been implemented (2026-02-11)
- Full backend with JWT cookie auth, RBAC, brute-force lockout (email-keyed), password reset
- Dashboard stats + 4 charts (line, pie, two bars)
- Catalogs with image upload, search/filter, archive/restore, barcode/QR SVG generation
- Catalog detail with print/download + history tabs
- Categories, Suppliers, Users, Audit, Reports pages
- Scanner with USB input + camera QR scanning
- Issue & Return flow with status transitions and audit
- CSV/XLSX/PDF report exports
- Dark mode toggle, responsive sidebar layout
- Seeded admin (`admin@fabriccatalog.com / Admin@123`)
- Tests: 34/34 backend pytest pass; frontend smoke pass

## Backlog / next features (P1)
- Notifications panel (overdue, upcoming returns, damaged returns, new additions)
- Bulk catalog import (CSV upload)
- Catalog images: multiple swatch images / gallery view
- Email notifications (Resend/SendGrid)
- Pagination controls on tables (server-side cursors already in place)
- Settings page (org info, default expected-return-window)

## P2 / future enhancements
- Multi-branch / multi-tenant
- Mobile app (PWA already responsive)
- WhatsApp/SMS notifications (Twilio)
- RFID tracking
- AI-based catalog recommendations
- Customer/vendor portals

## Known nits
- Cookies use `secure=False` (preview HTTP-friendly); harden to `True` for prod over HTTPS
- Audit IP records ingress hop instead of real client (X-Forwarded-For not honored for audit; only for brute-force)
