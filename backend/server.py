from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import csv
import secrets
import logging
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

import bcrypt
import jwt
import barcode as pybarcode
from barcode.writer import SVGWriter
import qrcode
import qrcode.image.svg
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse, PlainTextResponse
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId


# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------
JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 8  # 8h for usability
REFRESH_TTL_DAYS = 7

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Fabric Catalog API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s - %(message)s')
log = logging.getLogger("fabric")


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def now() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": now() + timedelta(minutes=ACCESS_TTL_MIN), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now() + timedelta(days=REFRESH_TTL_DAYS), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax",
                        max_age=ACCESS_TTL_MIN * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax",
                        max_age=REFRESH_TTL_DAYS * 86400, path="/")

def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")

def doc_to_json(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    for k, v in list(doc.items()):
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account disabled")
        user["id"] = str(user.pop("_id"))
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(*roles: str):
    async def checker(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker

async def audit(user: dict, action: str, description: str, request: Request = None):
    ip = request.client.host if request and request.client else "n/a"
    await db.audit_logs.insert_one({
        "user_id": user["id"], "user_email": user["email"], "action": action,
        "description": description, "ip_address": ip, "created_at": iso(now())
    })


# -----------------------------------------------------------------------------
# Pydantic Models (Inputs only - we return dicts)
# -----------------------------------------------------------------------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "manager", "staff"] = "staff"

class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    new_password: str

class CategoryIn(BaseModel):
    name: str
    description: Optional[str] = ""

class SupplierIn(BaseModel):
    name: str
    contact_person: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    gst_number: Optional[str] = ""
    notes: Optional[str] = ""

class CatalogIn(BaseModel):
    catalog_code: str
    catalog_name: str
    category_id: Optional[str] = None
    supplier_id: Optional[str] = None
    fabric_type: Optional[str] = ""
    material_composition: Optional[str] = ""
    gsm: Optional[float] = None
    color: Optional[str] = ""
    total_swatches: Optional[int] = 0
    description: Optional[str] = ""
    catalog_image: Optional[str] = ""  # base64

class IssueIn(BaseModel):
    catalog_id: str
    customer_name: Optional[str] = ""
    employee_name: Optional[str] = ""
    department: Optional[str] = ""
    mobile: Optional[str] = ""
    email: Optional[str] = ""
    issue_date: Optional[str] = None  # ISO
    expected_return_date: Optional[str] = None
    remarks: Optional[str] = ""

class ReturnIn(BaseModel):
    catalog_id: str
    returned_by: Optional[str] = ""
    return_date: Optional[str] = None
    condition: Literal["Excellent", "Good", "Damaged", "Missing Swatches"] = "Good"
    remarks: Optional[str] = ""

class ScanIn(BaseModel):
    barcode_value: str
    device_type: Optional[str] = "Web"
    action: Literal["Search", "Issue", "Return", "View"] = "Search"
    remarks: Optional[str] = ""


# -----------------------------------------------------------------------------
# Auth Endpoints
# -----------------------------------------------------------------------------
@api.post("/auth/login")
async def login(body: LoginIn, response: Response, request: Request):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "n/a"
    identifier = f"{ip}:{email}"

    # brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("locked_until"):
        locked_until = datetime.fromisoformat(attempt["locked_until"])
        if locked_until > now():
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        # record failure
        attempts = (attempt.get("count", 0) if attempt else 0) + 1
        update = {"count": attempts, "updated_at": iso(now())}
        if attempts >= 5:
            update["locked_until"] = iso(now() + timedelta(minutes=15))
            update["count"] = 0
        await db.login_attempts.update_one({"identifier": identifier},
                                           {"$set": {"identifier": identifier, **update}}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")

    await db.login_attempts.delete_one({"identifier": identifier})

    uid = str(user["_id"])
    access = create_access_token(uid, email, user["role"])
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)

    user["id"] = uid
    user.pop("_id"); user.pop("password_hash", None)
    await db.audit_logs.insert_one({"user_id": uid, "user_email": email, "action": "login",
                                    "description": "User logged in", "ip_address": ip,
                                    "created_at": iso(now())})
    return doc_to_json(user)

@api.post("/auth/register")
async def register(body: RegisterIn, request: Request, current=Depends(get_current_user)):
    if current["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create users")
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {"email": email, "password_hash": hash_password(body.password),
           "name": body.name, "role": body.role, "is_active": True,
           "created_at": iso(now())}
    res = await db.users.insert_one(doc)
    await audit(current, "user_created", f"Created user {email} ({body.role})", request)
    doc["id"] = str(res.inserted_id); doc.pop("password_hash")
    return doc_to_json(doc)

@api.post("/auth/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(str(user["_id"]), user["email"], user["role"])
        response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax",
                            max_age=ACCESS_TTL_MIN * 60, path="/")
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, request: Request, user=Depends(get_current_user)):
    record = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not verify_password(body.old_password, record["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one({"_id": ObjectId(user["id"])},
                              {"$set": {"password_hash": hash_password(body.new_password)}})
    await audit(user, "password_change", "User changed password", request)
    return {"ok": True}

@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": str(user["_id"]),
            "expires_at": now() + timedelta(hours=1),
            "used": False, "created_at": iso(now())
        })
        log.info(f"Password reset link for {email}: /reset-password?token={token}")
    return {"ok": True, "message": "If account exists, a reset link has been sent."}

@api.post("/auth/reset-password")
async def reset_password(body: ResetPasswordIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or used token")
    if rec["expires_at"] < now():
        raise HTTPException(status_code=400, detail="Token expired")
    await db.users.update_one({"_id": ObjectId(rec["user_id"])},
                              {"$set": {"password_hash": hash_password(body.new_password)}})
    await db.password_reset_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    return {"ok": True}


# -----------------------------------------------------------------------------
# Users (Admin)
# -----------------------------------------------------------------------------
@api.get("/users")
async def list_users(user=Depends(require_role("admin"))):
    cursor = db.users.find({}, {"password_hash": 0}).sort("created_at", -1)
    return [doc_to_json(d) for d in await cursor.to_list(500)]

@api.patch("/users/{user_id}")
async def update_user(user_id: str, payload: dict, request: Request, user=Depends(require_role("admin"))):
    allowed = {k: v for k, v in payload.items() if k in ("name", "role", "is_active")}
    if "password" in payload and payload["password"]:
        allowed["password_hash"] = hash_password(payload["password"])
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": allowed})
    await audit(user, "user_updated", f"Updated user {user_id}", request)
    doc = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    return doc_to_json(doc)


# -----------------------------------------------------------------------------
# Categories
# -----------------------------------------------------------------------------
@api.get("/categories")
async def list_categories(include_archived: bool = False, user=Depends(get_current_user)):
    q = {} if include_archived else {"is_archived": {"$ne": True}}
    rows = await db.categories.find(q).sort("name", 1).to_list(500)
    return [doc_to_json(d) for d in rows]

@api.post("/categories")
async def create_category(body: CategoryIn, request: Request, user=Depends(require_role("admin", "manager"))):
    doc = {"name": body.name.strip(), "description": body.description or "",
           "is_archived": False, "created_at": iso(now()), "updated_at": iso(now())}
    res = await db.categories.insert_one(doc)
    await audit(user, "category_created", f"Category {body.name}", request)
    doc["id"] = str(res.inserted_id); doc.pop("_id", None)
    return doc

@api.patch("/categories/{cid}")
async def update_category(cid: str, body: CategoryIn, request: Request, user=Depends(require_role("admin", "manager"))):
    await db.categories.update_one({"_id": ObjectId(cid)},
                                   {"$set": {"name": body.name, "description": body.description,
                                             "updated_at": iso(now())}})
    await audit(user, "category_updated", f"Category {cid}", request)
    return doc_to_json(await db.categories.find_one({"_id": ObjectId(cid)}))

@api.post("/categories/{cid}/archive")
async def archive_category(cid: str, request: Request, user=Depends(require_role("admin", "manager"))):
    await db.categories.update_one({"_id": ObjectId(cid)}, {"$set": {"is_archived": True, "updated_at": iso(now())}})
    await audit(user, "category_archived", f"Category {cid}", request)
    return {"ok": True}

@api.post("/categories/{cid}/restore")
async def restore_category(cid: str, request: Request, user=Depends(require_role("admin", "manager"))):
    await db.categories.update_one({"_id": ObjectId(cid)}, {"$set": {"is_archived": False, "updated_at": iso(now())}})
    await audit(user, "category_restored", f"Category {cid}", request)
    return {"ok": True}


# -----------------------------------------------------------------------------
# Suppliers
# -----------------------------------------------------------------------------
@api.get("/suppliers")
async def list_suppliers(include_archived: bool = False, user=Depends(get_current_user)):
    q = {} if include_archived else {"is_archived": {"$ne": True}}
    rows = await db.suppliers.find(q).sort("name", 1).to_list(500)
    return [doc_to_json(d) for d in rows]

@api.post("/suppliers")
async def create_supplier(body: SupplierIn, request: Request, user=Depends(require_role("admin", "manager"))):
    doc = body.model_dump(); doc["is_archived"] = False
    doc["created_at"] = iso(now()); doc["updated_at"] = iso(now())
    res = await db.suppliers.insert_one(doc)
    await audit(user, "supplier_created", f"Supplier {body.name}", request)
    doc["id"] = str(res.inserted_id); doc.pop("_id", None)
    return doc

@api.patch("/suppliers/{sid}")
async def update_supplier(sid: str, body: SupplierIn, request: Request, user=Depends(require_role("admin", "manager"))):
    data = body.model_dump(); data["updated_at"] = iso(now())
    await db.suppliers.update_one({"_id": ObjectId(sid)}, {"$set": data})
    await audit(user, "supplier_updated", f"Supplier {sid}", request)
    return doc_to_json(await db.suppliers.find_one({"_id": ObjectId(sid)}))

@api.post("/suppliers/{sid}/archive")
async def archive_supplier(sid: str, request: Request, user=Depends(require_role("admin", "manager"))):
    await db.suppliers.update_one({"_id": ObjectId(sid)}, {"$set": {"is_archived": True, "updated_at": iso(now())}})
    await audit(user, "supplier_archived", f"Supplier {sid}", request)
    return {"ok": True}

@api.post("/suppliers/{sid}/restore")
async def restore_supplier(sid: str, request: Request, user=Depends(require_role("admin", "manager"))):
    await db.suppliers.update_one({"_id": ObjectId(sid)}, {"$set": {"is_archived": False, "updated_at": iso(now())}})
    await audit(user, "supplier_restored", f"Supplier {sid}", request)
    return {"ok": True}


# -----------------------------------------------------------------------------
# Catalogs
# -----------------------------------------------------------------------------
def gen_barcode_svg(value: str) -> str:
    cls = pybarcode.get_barcode_class('code128')
    obj = cls(value, writer=SVGWriter())
    buf = io.BytesIO()
    obj.write(buf, options={"module_height": 12.0, "font_size": 8, "text_distance": 3, "quiet_zone": 2})
    return buf.getvalue().decode("utf-8")

def gen_qr_svg(payload: str) -> str:
    factory = qrcode.image.svg.SvgImage
    img = qrcode.make(payload, image_factory=factory, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue().decode("utf-8")

@api.get("/catalogs")
async def list_catalogs(
    q: Optional[str] = None,
    status: Optional[str] = None,
    category_id: Optional[str] = None,
    supplier_id: Optional[str] = None,
    fabric_type: Optional[str] = None,
    include_archived: bool = False,
    skip: int = 0,
    limit: int = 50,
    user=Depends(get_current_user)
):
    filt: dict = {}
    if not include_archived:
        filt["is_archived"] = {"$ne": True}
    if status:
        filt["status"] = status
    if category_id:
        filt["category_id"] = category_id
    if supplier_id:
        filt["supplier_id"] = supplier_id
    if fabric_type:
        filt["fabric_type"] = fabric_type
    if q:
        filt["$or"] = [
            {"catalog_code": {"$regex": q, "$options": "i"}},
            {"catalog_name": {"$regex": q, "$options": "i"}},
            {"color": {"$regex": q, "$options": "i"}},
        ]
    total = await db.catalogs.count_documents(filt)
    rows = await db.catalogs.find(filt).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"total": total, "items": [doc_to_json(d) for d in rows]}

@api.get("/catalogs/{cid}")
async def get_catalog(cid: str, user=Depends(get_current_user)):
    doc = await db.catalogs.find_one({"_id": ObjectId(cid)})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc_to_json(doc)

@api.post("/catalogs")
async def create_catalog(body: CatalogIn, request: Request, user=Depends(require_role("admin", "manager"))):
    if await db.catalogs.find_one({"catalog_code": body.catalog_code}):
        raise HTTPException(400, "Catalog code already exists")
    doc = body.model_dump()
    barcode_value = body.catalog_code
    qr_payload = f"CATALOG|{body.catalog_code}|{body.catalog_name}"
    doc.update({
        "barcode_value": barcode_value,
        "qr_value": qr_payload,
        "status": "Available",
        "is_archived": False,
        "created_at": iso(now()),
        "updated_at": iso(now()),
        "created_by": user["email"]
    })
    res = await db.catalogs.insert_one(doc)
    await audit(user, "catalog_created", f"Catalog {body.catalog_code}", request)
    doc["id"] = str(res.inserted_id); doc.pop("_id", None)
    return doc

@api.patch("/catalogs/{cid}")
async def update_catalog(cid: str, body: CatalogIn, request: Request, user=Depends(require_role("admin", "manager"))):
    data = body.model_dump()
    data["updated_at"] = iso(now())
    data["barcode_value"] = body.catalog_code
    data["qr_value"] = f"CATALOG|{body.catalog_code}|{body.catalog_name}"
    await db.catalogs.update_one({"_id": ObjectId(cid)}, {"$set": data})
    await audit(user, "catalog_updated", f"Catalog {cid}", request)
    return doc_to_json(await db.catalogs.find_one({"_id": ObjectId(cid)}))

@api.post("/catalogs/{cid}/archive")
async def archive_catalog(cid: str, request: Request, user=Depends(require_role("admin", "manager"))):
    await db.catalogs.update_one({"_id": ObjectId(cid)},
                                 {"$set": {"is_archived": True, "status": "Archived", "updated_at": iso(now())}})
    await audit(user, "catalog_archived", f"Catalog {cid}", request)
    return {"ok": True}

@api.post("/catalogs/{cid}/restore")
async def restore_catalog(cid: str, request: Request, user=Depends(require_role("admin", "manager"))):
    await db.catalogs.update_one({"_id": ObjectId(cid)},
                                 {"$set": {"is_archived": False, "status": "Available", "updated_at": iso(now())}})
    await audit(user, "catalog_restored", f"Catalog {cid}", request)
    return {"ok": True}

@api.get("/catalogs/{cid}/barcode.svg")
async def catalog_barcode_svg(cid: str, user=Depends(get_current_user)):
    doc = await db.catalogs.find_one({"_id": ObjectId(cid)})
    if not doc:
        raise HTTPException(404, "Not found")
    svg = gen_barcode_svg(doc["barcode_value"])
    return Response(content=svg, media_type="image/svg+xml")

@api.get("/catalogs/{cid}/qr.svg")
async def catalog_qr_svg(cid: str, user=Depends(get_current_user)):
    doc = await db.catalogs.find_one({"_id": ObjectId(cid)})
    if not doc:
        raise HTTPException(404, "Not found")
    svg = gen_qr_svg(doc["qr_value"])
    return Response(content=svg, media_type="image/svg+xml")

@api.get("/catalogs/{cid}/history")
async def catalog_history(cid: str, user=Depends(get_current_user)):
    issues = await db.catalog_issues.find({"catalog_id": cid}).sort("created_at", -1).to_list(200)
    returns = await db.catalog_returns.find({"catalog_id": cid}).sort("created_at", -1).to_list(200)
    scans = await db.scan_history.find({"catalog_id": cid}).sort("created_at", -1).to_list(200)
    return {
        "issues": [doc_to_json(d) for d in issues],
        "returns": [doc_to_json(d) for d in returns],
        "scans": [doc_to_json(d) for d in scans],
    }


# -----------------------------------------------------------------------------
# Issues & Returns
# -----------------------------------------------------------------------------
@api.get("/issues")
async def list_issues(active_only: bool = False, user=Depends(get_current_user)):
    q = {"status": "Active"} if active_only else {}
    rows = await db.catalog_issues.find(q).sort("created_at", -1).to_list(500)
    items = [doc_to_json(d) for d in rows]
    # enrich with catalog info
    for it in items:
        if it.get("catalog_id"):
            cat = await db.catalogs.find_one({"_id": ObjectId(it["catalog_id"])})
            if cat:
                it["catalog_code"] = cat.get("catalog_code")
                it["catalog_name"] = cat.get("catalog_name")
    return items

@api.post("/issues")
async def create_issue(body: IssueIn, request: Request, user=Depends(require_role("admin", "manager", "staff"))):
    cat = await db.catalogs.find_one({"_id": ObjectId(body.catalog_id)})
    if not cat:
        raise HTTPException(404, "Catalog not found")
    if cat.get("status") == "Issued":
        raise HTTPException(400, "Catalog is already issued")
    if cat.get("is_archived"):
        raise HTTPException(400, "Catalog is archived")
    doc = body.model_dump()
    doc["status"] = "Active"
    doc["issued_by"] = user["email"]
    doc["issue_date"] = doc.get("issue_date") or iso(now())
    doc["created_at"] = iso(now())
    res = await db.catalog_issues.insert_one(doc)
    await db.catalogs.update_one({"_id": ObjectId(body.catalog_id)},
                                 {"$set": {"status": "Issued", "updated_at": iso(now())}})
    await audit(user, "catalog_issued", f"Catalog {cat['catalog_code']} issued to {body.customer_name or body.employee_name}", request)
    doc["id"] = str(res.inserted_id); doc.pop("_id", None)
    return doc

@api.get("/returns")
async def list_returns(user=Depends(get_current_user)):
    rows = await db.catalog_returns.find({}).sort("created_at", -1).to_list(500)
    items = [doc_to_json(d) for d in rows]
    for it in items:
        if it.get("catalog_id"):
            cat = await db.catalogs.find_one({"_id": ObjectId(it["catalog_id"])})
            if cat:
                it["catalog_code"] = cat.get("catalog_code")
                it["catalog_name"] = cat.get("catalog_name")
    return items

@api.post("/returns")
async def create_return(body: ReturnIn, request: Request, user=Depends(require_role("admin", "manager", "staff"))):
    cat = await db.catalogs.find_one({"_id": ObjectId(body.catalog_id)})
    if not cat:
        raise HTTPException(404, "Catalog not found")
    if cat.get("status") != "Issued":
        raise HTTPException(400, "Catalog is not currently issued")
    doc = body.model_dump()
    doc["return_date"] = doc.get("return_date") or iso(now())
    doc["received_by"] = user["email"]
    doc["created_at"] = iso(now())
    res = await db.catalog_returns.insert_one(doc)

    # mark related active issue as returned
    await db.catalog_issues.update_many({"catalog_id": body.catalog_id, "status": "Active"},
                                        {"$set": {"status": "Returned", "actual_return_date": doc["return_date"]}})
    await db.catalogs.update_one({"_id": ObjectId(body.catalog_id)},
                                 {"$set": {"status": "Returned", "updated_at": iso(now())}})
    await audit(user, "catalog_returned", f"Catalog {cat['catalog_code']} returned ({body.condition})", request)
    doc["id"] = str(res.inserted_id); doc.pop("_id", None)
    return doc


# -----------------------------------------------------------------------------
# Scans
# -----------------------------------------------------------------------------
@api.post("/scans")
async def scan_barcode(body: ScanIn, request: Request, user=Depends(get_current_user)):
    cat = await db.catalogs.find_one({"barcode_value": body.barcode_value})
    if not cat:
        # try QR payload format CATALOG|code|name
        if body.barcode_value.startswith("CATALOG|"):
            parts = body.barcode_value.split("|")
            if len(parts) >= 2:
                cat = await db.catalogs.find_one({"catalog_code": parts[1]})
    if not cat:
        raise HTTPException(404, "Catalog not found for this code")
    doc = {
        "catalog_id": str(cat["_id"]),
        "user_id": user["id"], "user_email": user["email"],
        "device_type": body.device_type,
        "action": body.action,
        "remarks": body.remarks,
        "created_at": iso(now())
    }
    await db.scan_history.insert_one(doc)
    await audit(user, "barcode_scan", f"Scanned {cat['catalog_code']} ({body.action})", request)
    return {"catalog": doc_to_json(cat), "scan": doc}

@api.get("/scans")
async def list_scans(limit: int = 100, user=Depends(get_current_user)):
    rows = await db.scan_history.find({}).sort("created_at", -1).limit(limit).to_list(limit)
    items = [doc_to_json(d) for d in rows]
    for it in items:
        if it.get("catalog_id"):
            cat = await db.catalogs.find_one({"_id": ObjectId(it["catalog_id"])})
            if cat:
                it["catalog_code"] = cat.get("catalog_code")
                it["catalog_name"] = cat.get("catalog_name")
    return items


# -----------------------------------------------------------------------------
# Audit Logs
# -----------------------------------------------------------------------------
@api.get("/audit-logs")
async def list_audit_logs(limit: int = 200, user=Depends(require_role("admin", "manager"))):
    rows = await db.audit_logs.find({}).sort("created_at", -1).limit(limit).to_list(limit)
    return [doc_to_json(d) for d in rows]


# -----------------------------------------------------------------------------
# Dashboard
# -----------------------------------------------------------------------------
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    today_start = datetime.combine(now().date(), datetime.min.time(), tzinfo=timezone.utc).isoformat()

    total = await db.catalogs.count_documents({"is_archived": {"$ne": True}})
    available = await db.catalogs.count_documents({"status": "Available", "is_archived": {"$ne": True}})
    issued = await db.catalogs.count_documents({"status": "Issued", "is_archived": {"$ne": True}})
    returned = await db.catalogs.count_documents({"status": "Returned", "is_archived": {"$ne": True}})
    archived = await db.catalogs.count_documents({"is_archived": True})
    suppliers = await db.suppliers.count_documents({"is_archived": {"$ne": True}})
    categories = await db.categories.count_documents({"is_archived": {"$ne": True}})
    scans_today = await db.scan_history.count_documents({"created_at": {"$gte": today_start}})

    # overdue: active issues past expected return date
    overdue_cursor = db.catalog_issues.find({
        "status": "Active",
        "expected_return_date": {"$lt": iso(now()), "$ne": None}
    }).sort("expected_return_date", 1).limit(20)
    overdue = []
    for it in await overdue_cursor.to_list(20):
        item = doc_to_json(it)
        cat = await db.catalogs.find_one({"_id": ObjectId(item["catalog_id"])})
        if cat:
            item["catalog_code"] = cat.get("catalog_code")
            item["catalog_name"] = cat.get("catalog_name")
        overdue.append(item)

    recent_added = [doc_to_json(d) for d in await db.catalogs.find({"is_archived": {"$ne": True}})
                    .sort("created_at", -1).limit(8).to_list(8)]
    recent_returned = [doc_to_json(d) for d in await db.catalog_returns.find({}).sort("created_at", -1).limit(8).to_list(8)]

    return {
        "totals": {
            "total_catalogs": total, "available": available, "issued": issued,
            "returned": returned, "archived": archived,
            "suppliers": suppliers, "categories": categories, "scans_today": scans_today,
            "overdue": len(overdue),
        },
        "recently_added": recent_added,
        "recently_returned": recent_returned,
        "overdue_catalogs": overdue,
    }

@api.get("/dashboard/charts")
async def dashboard_charts(user=Depends(get_current_user)):
    # monthly issues vs returns (last 6 months)
    months = []
    today = now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    for i in range(5, -1, -1):
        # naive month subtraction
        month = (today.month - i - 1) % 12 + 1
        year = today.year + ((today.month - i - 1) // 12)
        start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        iss = await db.catalog_issues.count_documents({"created_at": {"$gte": iso(start), "$lt": iso(end)}})
        ret = await db.catalog_returns.count_documents({"created_at": {"$gte": iso(start), "$lt": iso(end)}})
        months.append({"label": start.strftime("%b %Y"), "issues": iss, "returns": ret})

    # category distribution
    cat_pipe = [{"$match": {"is_archived": {"$ne": True}}}, {"$group": {"_id": "$category_id", "count": {"$sum": 1}}}]
    cat_dist = []
    async for r in db.catalogs.aggregate(cat_pipe):
        name = "Uncategorized"
        if r["_id"]:
            c = await db.categories.find_one({"_id": ObjectId(r["_id"])})
            if c: name = c["name"]
        cat_dist.append({"name": name, "value": r["count"]})

    # supplier distribution
    sup_pipe = [{"$match": {"is_archived": {"$ne": True}}}, {"$group": {"_id": "$supplier_id", "count": {"$sum": 1}}}]
    sup_dist = []
    async for r in db.catalogs.aggregate(sup_pipe):
        name = "Unknown"
        if r["_id"]:
            s = await db.suppliers.find_one({"_id": ObjectId(r["_id"])})
            if s: name = s["name"]
        sup_dist.append({"name": name, "value": r["count"]})

    # most issued catalogs
    issued_pipe = [{"$group": {"_id": "$catalog_id", "count": {"$sum": 1}}},
                   {"$sort": {"count": -1}}, {"$limit": 8}]
    most_issued = []
    async for r in db.catalog_issues.aggregate(issued_pipe):
        if not r["_id"]: continue
        c = await db.catalogs.find_one({"_id": ObjectId(r["_id"])})
        if c: most_issued.append({"name": c.get("catalog_name", c.get("catalog_code", "")), "value": r["count"]})

    # most scanned
    scan_pipe = [{"$group": {"_id": "$catalog_id", "count": {"$sum": 1}}},
                 {"$sort": {"count": -1}}, {"$limit": 8}]
    most_scanned = []
    async for r in db.scan_history.aggregate(scan_pipe):
        if not r["_id"]: continue
        c = await db.catalogs.find_one({"_id": ObjectId(r["_id"])})
        if c: most_scanned.append({"name": c.get("catalog_name", c.get("catalog_code", "")), "value": r["count"]})

    return {"monthly": months, "category_distribution": cat_dist,
            "supplier_distribution": sup_dist,
            "most_issued": most_issued, "most_scanned": most_scanned}


# -----------------------------------------------------------------------------
# Reports / Export
# -----------------------------------------------------------------------------
async def _catalog_rows(filter_status: Optional[str] = None, include_archived: bool = False):
    q = {}
    if filter_status:
        q["status"] = filter_status
    if not include_archived:
        q["is_archived"] = {"$ne": True}
    return await db.catalogs.find(q).sort("created_at", -1).to_list(1000)

@api.get("/reports/catalogs/csv")
async def report_catalogs_csv(status: Optional[str] = None, include_archived: bool = False, user=Depends(get_current_user)):
    rows = await _catalog_rows(status, include_archived)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Code", "Name", "Status", "Fabric Type", "GSM", "Color", "Swatches", "Created"])
    for r in rows:
        w.writerow([r.get("catalog_code"), r.get("catalog_name"), r.get("status"),
                    r.get("fabric_type"), r.get("gsm"), r.get("color"),
                    r.get("total_swatches"), r.get("created_at")])
    buf.seek(0)
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=catalogs.csv"})

@api.get("/reports/catalogs/xlsx")
async def report_catalogs_xlsx(status: Optional[str] = None, include_archived: bool = False, user=Depends(get_current_user)):
    rows = await _catalog_rows(status, include_archived)
    wb = Workbook(); ws = wb.active; ws.title = "Catalogs"
    ws.append(["Code", "Name", "Status", "Fabric Type", "GSM", "Color", "Swatches", "Created"])
    for r in rows:
        ws.append([r.get("catalog_code"), r.get("catalog_name"), r.get("status"),
                   r.get("fabric_type"), r.get("gsm"), r.get("color"),
                   r.get("total_swatches"), r.get("created_at")])
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return Response(content=buf.read(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename=catalogs.xlsx"})

@api.get("/reports/catalogs/pdf")
async def report_catalogs_pdf(status: Optional[str] = None, include_archived: bool = False, user=Depends(get_current_user)):
    rows = await _catalog_rows(status, include_archived)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    story = [Paragraph("Fabric Catalog Report", styles["Title"]),
             Paragraph(f"Generated: {now().strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]),
             Spacer(1, 12)]
    data = [["Code", "Name", "Status", "Fabric", "GSM", "Color", "Swatches"]]
    for r in rows:
        data.append([r.get("catalog_code", ""), r.get("catalog_name", ""), r.get("status", ""),
                     r.get("fabric_type", ""), str(r.get("gsm") or ""), r.get("color", ""),
                     str(r.get("total_swatches") or 0)])
    t = Table(data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
    ]))
    story.append(t)
    doc.build(story)
    buf.seek(0)
    return Response(content=buf.read(), media_type="application/pdf",
                    headers={"Content-Disposition": "attachment; filename=catalogs.pdf"})


# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"message": "Fabric Catalog API", "version": "1.0"}


# -----------------------------------------------------------------------------
# Startup
# -----------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
    # Indexes
    try:
        await db.users.create_index("email", unique=True)
        await db.login_attempts.create_index("identifier")
        await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
        await db.catalogs.create_index("catalog_code", unique=True)
        await db.catalogs.create_index("barcode_value")
        await db.catalogs.create_index("status")
        await db.scan_history.create_index("created_at")
        await db.audit_logs.create_index("created_at")
    except Exception as e:
        log.warning(f"Index setup: {e}")

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "System Admin", "role": "admin", "is_active": True,
            "created_at": iso(now())
        })
        log.info(f"Seeded admin: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
        log.info(f"Updated admin password: {admin_email}")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# include router
app.include_router(api)

# CORS - must specify origin when allow_credentials=True
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
allow = [frontend_url]
extra = os.environ.get("CORS_ORIGINS", "")
if extra and extra != "*":
    allow += [o.strip() for o in extra.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
