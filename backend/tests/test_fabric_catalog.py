"""
Comprehensive backend tests for Fabric Catalog & Swatch Management System.
Uses REACT_APP_BACKEND_URL with cookie-based auth.
"""
import os
import time
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fabric-catalog-hub-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@fabriccatalog.com"
ADMIN_PASS = "Admin@123"
MGR_EMAIL = "manager@test.com"
MGR_PASS = "Pass@1234"
MGR_NEW_PASS = "NewPass@123"

# Shared module-level state (created in order, used by later tests)
STATE = {}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    assert "access_token" in s.cookies, "access_token cookie not set"
    assert "refresh_token" in s.cookies, "refresh_token cookie not set"
    return s


# ----- auth -----
class TestAuth:
    def test_login_and_me(self, admin):
        r = admin.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "password_hash" not in data

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_invalid_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "bad"}, timeout=10)
        assert r.status_code == 401


# ----- dashboard -----
class TestDashboard:
    def test_stats(self, admin):
        r = admin.get(f"{API}/dashboard/stats", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "totals" in d and "recently_added" in d and "recently_returned" in d and "overdue_catalogs" in d
        for k in ["total_catalogs", "available", "issued", "returned", "archived", "overdue"]:
            assert k in d["totals"]

    def test_charts(self, admin):
        r = admin.get(f"{API}/dashboard/charts", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "monthly" in d and isinstance(d["monthly"], list)
        assert len(d["monthly"]) == 6
        assert "category_distribution" in d
        assert "supplier_distribution" in d


# ----- categories & suppliers -----
class TestCategoriesSuppliers:
    def test_create_category(self, admin):
        # cleanup pre-existing
        existing = admin.get(f"{API}/categories?include_archived=true").json()
        for c in existing:
            if c["name"] == "Cotton":
                # nothing to delete - we'll reuse
                STATE["category_id"] = c["id"]
                return
        r = admin.post(f"{API}/categories", json={"name": "Cotton", "description": "Cotton fabrics"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "Cotton"
        assert "id" in d
        STATE["category_id"] = d["id"]

    def test_list_category(self, admin):
        r = admin.get(f"{API}/categories")
        assert r.status_code == 200
        assert any(c["name"] == "Cotton" for c in r.json())

    def test_create_supplier(self, admin):
        existing = admin.get(f"{API}/suppliers?include_archived=true").json()
        for s in existing:
            if s["name"] == "Acme Textiles":
                STATE["supplier_id"] = s["id"]
                return
        r = admin.post(f"{API}/suppliers", json={
            "name": "Acme Textiles", "email": "info@acme.com", "gst_number": "GST123"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "Acme Textiles"
        STATE["supplier_id"] = d["id"]


# ----- catalogs -----
class TestCatalogs:
    def test_create_catalog(self, admin):
        # remove if exists for idempotency
        existing = admin.get(f"{API}/catalogs?q=FC-001&include_archived=true").json()
        for c in existing.get("items", []):
            if c.get("catalog_code") == "FC-001":
                STATE["catalog_id"] = c["id"]
                # reset to Available if not
                admin.post(f"{API}/catalogs/{c['id']}/restore")
                return
        payload = {
            "catalog_code": "FC-001",
            "catalog_name": "Premium Cotton Linen",
            "category_id": STATE.get("category_id"),
            "supplier_id": STATE.get("supplier_id"),
            "fabric_type": "Cotton",
            "gsm": 180,
            "color": "Indigo",
            "total_swatches": 12,
        }
        r = admin.post(f"{API}/catalogs", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["catalog_code"] == "FC-001"
        assert d["status"] == "Available"
        assert d["barcode_value"] == "FC-001"
        STATE["catalog_id"] = d["id"]

    def test_get_catalog(self, admin):
        r = admin.get(f"{API}/catalogs/{STATE['catalog_id']}")
        assert r.status_code == 200
        assert r.json()["catalog_code"] == "FC-001"

    def test_barcode_svg(self, admin):
        r = admin.get(f"{API}/catalogs/{STATE['catalog_id']}/barcode.svg")
        assert r.status_code == 200
        assert "image/svg+xml" in r.headers.get("content-type", "")
        assert len(r.content) > 100
        assert b"<svg" in r.content

    def test_qr_svg(self, admin):
        r = admin.get(f"{API}/catalogs/{STATE['catalog_id']}/qr.svg")
        assert r.status_code == 200
        assert "image/svg+xml" in r.headers.get("content-type", "")
        assert b"<svg" in r.content

    def test_history_empty(self, admin):
        r = admin.get(f"{API}/catalogs/{STATE['catalog_id']}/history")
        assert r.status_code == 200
        d = r.json()
        assert "issues" in d and "returns" in d and "scans" in d


# ----- issues & returns -----
class TestIssuesReturns:
    def test_issue(self, admin):
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        r = admin.post(f"{API}/issues", json={
            "catalog_id": STATE["catalog_id"],
            "customer_name": "Test Customer",
            "department": "Design",
            "mobile": "9999999999",
            "expected_return_date": tomorrow,
        })
        assert r.status_code == 200, r.text
        # catalog should be Issued
        c = admin.get(f"{API}/catalogs/{STATE['catalog_id']}").json()
        assert c["status"] == "Issued"

    def test_list_issues_enriched(self, admin):
        r = admin.get(f"{API}/issues?active_only=true")
        assert r.status_code == 200
        items = r.json()
        found = [i for i in items if i.get("catalog_id") == STATE["catalog_id"]]
        assert found, "Active issue not found"
        assert found[0].get("catalog_code") == "FC-001"
        assert found[0].get("catalog_name") == "Premium Cotton Linen"

    def test_return(self, admin):
        r = admin.post(f"{API}/returns", json={
            "catalog_id": STATE["catalog_id"],
            "condition": "Good",
            "returned_by": "Test Customer",
        })
        assert r.status_code == 200, r.text
        c = admin.get(f"{API}/catalogs/{STATE['catalog_id']}").json()
        assert c["status"] == "Returned"

    def test_dashboard_after_return(self, admin):
        d = admin.get(f"{API}/dashboard/stats").json()
        assert d["totals"]["returned"] >= 1
        assert any(rr.get("catalog_id") == STATE["catalog_id"] for rr in d["recently_returned"])


# ----- scans -----
class TestScans:
    def test_scan_by_barcode(self, admin):
        r = admin.post(f"{API}/scans", json={"barcode_value": "FC-001", "action": "Search"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["catalog"]["catalog_code"] == "FC-001"

    def test_scan_unknown(self, admin):
        r = admin.post(f"{API}/scans", json={"barcode_value": "NOPE-XYZ", "action": "Search"})
        assert r.status_code == 404


# ----- reports -----
class TestReports:
    def test_csv(self, admin):
        r = admin.get(f"{API}/reports/catalogs/csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert b"FC-001" in r.content

    def test_xlsx(self, admin):
        r = admin.get(f"{API}/reports/catalogs/xlsx")
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")
        assert len(r.content) > 100

    def test_pdf(self, admin):
        r = admin.get(f"{API}/reports/catalogs/pdf")
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"


# ----- archive/restore -----
class TestArchive:
    def test_archive_catalog(self, admin):
        r = admin.post(f"{API}/catalogs/{STATE['catalog_id']}/archive")
        assert r.status_code == 200
        c = admin.get(f"{API}/catalogs/{STATE['catalog_id']}").json()
        assert c["status"] == "Archived"
        assert c["is_archived"] is True

    def test_restore_catalog(self, admin):
        r = admin.post(f"{API}/catalogs/{STATE['catalog_id']}/restore")
        assert r.status_code == 200
        c = admin.get(f"{API}/catalogs/{STATE['catalog_id']}").json()
        assert c["status"] == "Available"
        assert c["is_archived"] is False

    def test_archive_restore_category(self, admin):
        cid = STATE["category_id"]
        r = admin.post(f"{API}/categories/{cid}/archive"); assert r.status_code == 200
        rows = admin.get(f"{API}/categories").json()
        assert not any(c["id"] == cid for c in rows)
        r = admin.post(f"{API}/categories/{cid}/restore"); assert r.status_code == 200
        rows = admin.get(f"{API}/categories").json()
        assert any(c["id"] == cid for c in rows)


# ----- audit logs -----
class TestAuditLogs:
    def test_audit_logs(self, admin):
        r = admin.get(f"{API}/audit-logs?limit=200")
        assert r.status_code == 200
        actions = {row.get("action") for row in r.json()}
        for needed in ["login", "catalog_created", "catalog_issued", "catalog_returned"]:
            assert needed in actions, f"audit action {needed} missing; got {actions}"


# ----- users & RBAC -----
class TestUsersRBAC:
    def test_create_manager(self, admin):
        # if exists, delete via patch (no delete endpoint) - we'll skip if exists
        users = admin.get(f"{API}/users").json()
        existing = next((u for u in users if u["email"] == MGR_EMAIL), None)
        if existing:
            # reset password and is_active
            admin.patch(f"{API}/users/{existing['id']}",
                        json={"password": MGR_PASS, "is_active": True, "role": "manager", "name": "Manager Test"})
            STATE["manager_id"] = existing["id"]
            return
        r = admin.post(f"{API}/auth/register", json={
            "email": MGR_EMAIL, "password": MGR_PASS, "name": "Manager Test", "role": "manager"
        })
        assert r.status_code == 200, r.text
        STATE["manager_id"] = r.json()["id"]

    def test_list_users_admin(self, admin):
        r = admin.get(f"{API}/users")
        assert r.status_code == 200
        assert any(u["email"] == MGR_EMAIL for u in r.json())

    def test_toggle_is_active(self, admin):
        r = admin.patch(f"{API}/users/{STATE['manager_id']}", json={"is_active": False})
        assert r.status_code == 200
        assert r.json()["is_active"] is False
        r = admin.patch(f"{API}/users/{STATE['manager_id']}", json={"is_active": True})
        assert r.status_code == 200
        assert r.json()["is_active"] is True

    def test_manager_rbac(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": MGR_EMAIL, "password": MGR_PASS}, timeout=10)
        assert r.status_code == 200, r.text
        # manager cannot list users
        r = s.get(f"{API}/users")
        assert r.status_code == 403
        # but can list categories
        r = s.get(f"{API}/categories")
        assert r.status_code == 200

    def test_manager_change_password_and_relogin(self):
        s = requests.Session()
        assert s.post(f"{API}/auth/login", json={"email": MGR_EMAIL, "password": MGR_PASS}).status_code == 200
        r = s.post(f"{API}/auth/change-password",
                   json={"old_password": MGR_PASS, "new_password": MGR_NEW_PASS})
        assert r.status_code == 200
        # re-login with new password
        s2 = requests.Session()
        r = s2.post(f"{API}/auth/login", json={"email": MGR_EMAIL, "password": MGR_NEW_PASS})
        assert r.status_code == 200


# ----- forgot/reset password -----
class TestForgotReset:
    def test_forgot_then_reset(self, admin):
        # Use a throwaway user instead of admin to avoid disrupting admin tests
        # Create a temp user
        tmp_email = "tmpreset@test.com"
        tmp_pass = "Temp@1234"
        users = admin.get(f"{API}/users").json()
        existing = next((u for u in users if u["email"] == tmp_email), None)
        if existing:
            tmp_id = existing["id"]
            admin.patch(f"{API}/users/{tmp_id}", json={"password": tmp_pass, "is_active": True})
        else:
            r = admin.post(f"{API}/auth/register",
                           json={"email": tmp_email, "password": tmp_pass, "name": "Tmp", "role": "staff"})
            assert r.status_code == 200

        # forgot
        r = requests.post(f"{API}/auth/forgot-password", json={"email": tmp_email})
        assert r.status_code == 200

        # Token printed in logs only - fetch directly from DB via admin api?
        # No endpoint. We'll read from supervisor log file.
        import subprocess
        out = subprocess.run(
            ["bash", "-lc", "grep 'Password reset link for tmpreset@test.com' /var/log/supervisor/backend.*.log | tail -1"],
            capture_output=True, text=True
        )
        token = None
        if "token=" in out.stdout:
            token = out.stdout.split("token=")[-1].strip()
        if not token:
            pytest.skip("Could not capture reset token from backend logs")

        new_pass = "Reset@9999"
        r = requests.post(f"{API}/auth/reset-password", json={"token": token, "new_password": new_pass})
        assert r.status_code == 200, r.text
        # login with new password
        r = requests.post(f"{API}/auth/login", json={"email": tmp_email, "password": new_pass})
        assert r.status_code == 200


# ----- brute force - LAST -----
class TestBruteForce:
    def test_lockout_after_5_failures(self):
        # use a unique bogus email so we don't lock real admin
        target = "brute_test@test.com"
        # ensure user exists so we hit real password check path? Actually invalid user also increments
        for i in range(5):
            r = requests.post(f"{API}/auth/login", json={"email": target, "password": "wrong"})
            assert r.status_code == 401
        # 6th attempt should be 429
        r = requests.post(f"{API}/auth/login", json={"email": target, "password": "wrong"})
        assert r.status_code == 429, f"Expected 429 lockout, got {r.status_code}"

    def test_cleanup_lockouts(self):
        # Reset login_attempts so subsequent runs work
        import pymongo
        c = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        c[os.environ.get("DB_NAME", "fabric_catalog_db")].login_attempts.delete_many({})
        c.close()
