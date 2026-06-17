"""
Royal Shades Catalog v2.1 Backend Regression Suite
Focus: username login, CAT NO + supplier + qty, returned-> Available CRITICAL FIX,
TXN-NNNN transaction ids, dashboard issued/returned counts, issue reports
(csv/xlsx/pdf), employee-wise report, RBAC, scans, register w/ username.
"""
import os
import io
import time
import re
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Admin@123"


def _login(username, password, key="username"):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE}/api/auth/login", json={key: username, "password": password})
    assert r.status_code == 200, f"login {username}: {r.status_code} {r.text}"
    return s, r.json()


def _clear_lockouts():
    try:
        from pymongo import MongoClient
        m = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        m[os.environ.get("DB_NAME", "fabric_catalog_db")].login_attempts.delete_many({})
    except Exception:
        pass


@pytest.fixture(scope="session")
def admin():
    _clear_lockouts()
    s, _ = _login(ADMIN_USERNAME, ADMIN_PASSWORD)
    return s


@pytest.fixture(scope="session")
def admin_user(admin):
    r = admin.get(f"{BASE}/api/auth/me")
    return r.json()


# Use a unique username for each pytest run to avoid duplicate-user 400s
@pytest.fixture(scope="session")
def test_users(admin):
    ts = int(time.time())
    users = {
        "staff": {"username": f"staff_{ts}", "password": "Stf@12345", "name": "Staff One", "role": "staff"},
        "supervisor": {"username": f"sup_{ts}", "password": "Sup@12345", "name": "Sup One", "role": "supervisor"},
    }
    for u in users.values():
        r = admin.post(f"{BASE}/api/auth/register", json=u)
        assert r.status_code == 200, f"register {u['username']}: {r.text}"
    return users


@pytest.fixture(scope="session")
def staff(test_users):
    s, _ = _login(test_users["staff"]["username"], test_users["staff"]["password"])
    return s


@pytest.fixture(scope="session")
def supervisor(test_users):
    s, _ = _login(test_users["supervisor"]["username"], test_users["supervisor"]["password"])
    return s


# ============ Auth: username login ============
class TestAuthUsername:
    def test_login_by_username(self):
        _clear_lockouts()
        s, data = _login(ADMIN_USERNAME, ADMIN_PASSWORD)
        assert data.get("username") == "admin"
        assert data.get("role") == "admin"

    def test_login_by_email_fallback(self):
        _clear_lockouts()
        # email-as-username (server accepts username OR email)
        s, data = _login("admin@fabriccatalog.com", ADMIN_PASSWORD)
        assert data.get("username") == "admin"

    def test_login_wrong_password(self):
        _clear_lockouts()
        s = requests.Session()
        r = s.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "WRONG_PW"})
        assert r.status_code == 401

    def test_register_with_username(self, admin):
        ts = int(time.time())
        body = {"username": f"testuser_{ts}", "name": "Test", "password": "pass1234", "role": "staff"}
        r = admin.post(f"{BASE}/api/auth/register", json=body)
        assert r.status_code == 200, r.text
        assert r.json()["username"] == body["username"]
        # login as the new user
        _clear_lockouts()
        s, data = _login(body["username"], body["password"])
        assert data.get("role") == "staff"

    def test_register_duplicate_username_400(self, admin):
        body = {"username": "admin", "name": "Dup", "password": "pass1234", "role": "staff"}
        r = admin.post(f"{BASE}/api/auth/register", json=body)
        assert r.status_code == 400, r.text


# ============ Catalogs: cat_no, qty, supplier, search ============
class TestCatalogsV21:
    def test_total_catalogs_around_1316(self, admin):
        r = admin.get(f"{BASE}/api/catalogs?limit=1&page=1")
        assert r.status_code == 200
        assert r.json()["total"] >= 1300, f"total={r.json()['total']}"

    def test_search_by_name(self, admin):
        r = admin.get(f"{BASE}/api/catalogs?q=INFINITY&limit=10")
        assert r.status_code == 200
        items = r.json()["items"]
        assert any("INFINITY" in (it.get("catalog_name") or "").upper() for it in items)

    def test_search_by_cat_no(self, admin):
        r = admin.get(f"{BASE}/api/catalogs?q=BX-440A&limit=10")
        assert r.status_code == 200
        items = r.json()["items"]
        assert items, "expected at least one item with cat_no BX-440A"
        assert any((it.get("cat_no") or "").upper() == "BX-440A" for it in items)

    def test_catalog_item_includes_v21_fields(self, admin):
        r = admin.get(f"{BASE}/api/catalogs?q=BX-440A&limit=1")
        items = r.json()["items"]
        assert items
        it = items[0]
        # required new fields exist (may be empty strings/None but must be in the dict)
        for k in ("cat_no", "quantity", "supplier_id"):
            assert k in it, f"missing field {k} in catalog item: {list(it.keys())}"

    def test_suppliers_count(self, admin):
        r = admin.get(f"{BASE}/api/suppliers")
        assert r.status_code == 200
        sups = r.json()
        assert isinstance(sups, list)
        assert 90 <= len(sups) <= 120, f"unexpected supplier count: {len(sups)}"

    def test_staff_no_buying_price(self, staff):
        r = staff.get(f"{BASE}/api/catalogs?limit=5")
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert "buying_price" not in it

    def test_admin_has_buying_price(self, admin):
        r = admin.get(f"{BASE}/api/catalogs?limit=5")
        assert r.status_code == 200
        # at least one item should expose buying_price key (even if None)
        keys_seen = set()
        for it in r.json()["items"]:
            keys_seen.update(it.keys())
        assert "buying_price" in keys_seen

    def test_patch_rbac(self, admin, supervisor, staff):
        # pick a catalog
        r = admin.get(f"{BASE}/api/catalogs?limit=1")
        cid = r.json()["items"][0]["id"]
        code = r.json()["items"][0]["catalog_code"]
        name = r.json()["items"][0]["catalog_name"]
        payload = {"catalog_code": code, "catalog_name": name, "selling_price": 1.0}
        assert staff.patch(f"{BASE}/api/catalogs/{cid}", json=payload).status_code == 403
        assert supervisor.patch(f"{BASE}/api/catalogs/{cid}", json=payload).status_code == 403
        assert admin.patch(f"{BASE}/api/catalogs/{cid}", json=payload).status_code == 200


# ============ CRITICAL FIX: returned -> Available; re-issue ============
TXN_RE = re.compile(r"^TXN-\d{4,}$")


class TestReturnsCriticalFix:
    def _get_available_catalog(self, admin):
        # pick a catalog whose status is Available; fall back by creating one
        r = admin.get(f"{BASE}/api/catalogs?status=Available&limit=1")
        items = r.json()["items"]
        if items:
            return items[0]
        # create one
        code = f"TST-{int(time.time()*1000)}"
        r = admin.post(f"{BASE}/api/catalogs",
                       json={"catalog_code": code, "catalog_name": "TST",
                             "selling_price": 1.0})
        assert r.status_code == 200, r.text
        return r.json()

    def test_issue_then_return_then_reissue_with_txn(self, admin):
        cat = self._get_available_catalog(admin)
        cid = cat["id"]

        # 1) Issue
        r = admin.post(f"{BASE}/api/issues",
                       json={"catalog_id": cid, "customer_name": "C1",
                             "mobile": "+971501112233",
                             "expected_return_date": "2030-01-01"})
        assert r.status_code == 200, r.text
        issue1 = r.json()
        assert issue1.get("transaction_id"), f"no transaction_id on issue: {issue1}"
        assert TXN_RE.match(issue1["transaction_id"]), issue1["transaction_id"]

        # catalog now Issued
        c = admin.get(f"{BASE}/api/catalogs/{cid}").json()
        assert c["status"] == "Issued", c

        # 2) Return
        r = admin.post(f"{BASE}/api/returns",
                       json={"catalog_id": cid, "condition": "Good"})
        assert r.status_code == 200, r.text
        ret = r.json()
        assert ret.get("transaction_id"), f"no transaction_id on return: {ret}"
        assert TXN_RE.match(ret["transaction_id"]), ret["transaction_id"]

        # 3) CRITICAL: catalog must be Available
        c = admin.get(f"{BASE}/api/catalogs/{cid}").json()
        assert c["status"] == "Available", f"expected Available after return, got {c['status']}"

        # 4) Re-issue the SAME catalog
        r = admin.post(f"{BASE}/api/issues",
                       json={"catalog_id": cid, "customer_name": "C2",
                             "mobile": "+971502223344",
                             "expected_return_date": "2030-02-01"})
        assert r.status_code == 200, f"re-issue failed: {r.status_code} {r.text}"
        issue2 = r.json()
        assert TXN_RE.match(issue2["transaction_id"])
        # second issue's TXN counter should be > first (within session at least)
        n1 = int(issue1["transaction_id"].split("-")[1])
        n2 = int(issue2["transaction_id"].split("-")[1])
        nr = int(ret["transaction_id"].split("-")[1])
        assert n2 > n1 and nr > n1, (n1, nr, n2)

    def test_staff_blocked_post_return(self, staff):
        r = staff.post(f"{BASE}/api/returns",
                       json={"catalog_id": "000000000000000000000000", "condition": "Good"})
        assert r.status_code == 403

    def test_supervisor_can_post_return(self, supervisor, admin):
        # supervisor needs an Issued catalog. issue one first as admin.
        r = admin.get(f"{BASE}/api/catalogs?status=Available&limit=1")
        cid = r.json()["items"][0]["id"]
        ri = admin.post(f"{BASE}/api/issues",
                        json={"catalog_id": cid, "customer_name": "Sup test",
                              "mobile": "+971503334455",
                              "expected_return_date": "2030-03-01"})
        assert ri.status_code == 200, ri.text
        r = supervisor.post(f"{BASE}/api/returns",
                            json={"catalog_id": cid, "condition": "Good"})
        assert r.status_code == 200, r.text


# ============ Issues list contains v2.1 fields ============
class TestIssuesList:
    def test_issue_fields_present(self, admin):
        r = admin.get(f"{BASE}/api/issues?limit=5")
        assert r.status_code == 200
        items = r.json()
        assert items, "expected at least one issue from prior tests"
        it = items[0]
        for k in ("transaction_id", "supplier_name", "cat_no",
                  "catalog_code", "catalog_name"):
            assert k in it, f"issue missing {k}: {list(it.keys())}"


# ============ Dashboard widgets ============
class TestDashboard:
    def test_stats_keys(self, admin):
        r = admin.get(f"{BASE}/api/dashboard/stats")
        assert r.status_code == 200
        t = r.json()["totals"]
        for k in ("due_today", "due_week", "overdue", "issued", "returned"):
            assert k in t, f"missing {k}"
        # returned should be >=1 because a previous test returned one catalog
        assert t["returned"] >= 1


# ============ Reports: issues csv/xlsx/pdf, employee-wise ============
class TestReports:
    def test_issues_csv(self, admin):
        r = admin.get(f"{BASE}/api/reports/issues/csv")
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "csv" in ct.lower()
        body = r.text
        required_cols = ["Txn ID", "Catalog Code", "Catalog Name", "Supplier",
                         "Customer Name", "Employee Name", "Mobile",
                         "Issue Date", "Due Date", "Is Overdue", "Is Available",
                         "Issued By", "Status"]
        header_line = body.splitlines()[0]
        for col in required_cols:
            assert col in header_line, f"missing column {col} in CSV header: {header_line}"

    def test_issues_xlsx(self, admin):
        r = admin.get(f"{BASE}/api/reports/issues/xlsx")
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "spreadsheet" in ct.lower() or "xlsx" in ct.lower() or "officedocument" in ct.lower()
        assert r.content[:2] == b"PK"  # zip magic

    def test_issues_pdf(self, admin):
        r = admin.get(f"{BASE}/api/reports/issues/pdf")
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "pdf" in ct.lower()
        assert r.content[:4] == b"%PDF"

    def test_employee_wise(self, admin):
        r = admin.get(f"{BASE}/api/reports/employee-wise")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            for k in ("employee_name", "total_issues", "active", "returned"):
                assert k in row, f"missing {k} in row: {row}"


# ============ Scans ============
class TestScans:
    def test_scan_existing_code(self, admin):
        r = admin.post(f"{BASE}/api/scans",
                       json={"barcode_value": "RSC-00001", "action": "Search"})
        assert r.status_code == 200, r.text
        cat = r.json()["catalog"]
        assert cat["catalog_code"] == "RSC-00001"

    def test_scan_nonexistent_code(self, admin):
        r = admin.post(f"{BASE}/api/scans",
                       json={"barcode_value": "ZZZZ-NOPE-9999999", "action": "Search"})
        assert r.status_code == 404
