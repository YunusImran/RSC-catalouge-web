"""One-shot script to seed employees from the master list image."""
import asyncio
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")
from motor.motor_asyncio import AsyncIOMotorClient

EMPLOYEES = [
    "royal", "aamir-rs", "accounts-rs", "ashraf-rs", "azim-rs", "fincy-rs",
    "furqan-rs", "huzaifa-rs", "kanan-rs", "mansingh-rs", "prabakaran-rs",
    "priya-v-rs", "rakshitha-rs", "saif-rs", "storenew-rs", "sharafat-rs",
    "sharanya-rs", "shibin-rs", "shana-rs", "sumaiyya-rs", "yasin-rs",
    "sales-rs", "swetha-rs", "shahid-rs", "wahab-rs", "sattar-rs",
    "vaishnav-rs", "yasir-rs", "sajjad-rs",
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    now_iso = datetime.now(timezone.utc).isoformat()
    inserted = 0; skipped = 0
    for name in EMPLOYEES:
        if await db.employees.find_one({"name": name}):
            skipped += 1
            continue
        await db.employees.insert_one({
            "name": name, "employee_code": name.upper(),
            "department": "", "designation": "",
            "mobile": "", "email": "", "is_active": True,
            "created_at": now_iso, "updated_at": now_iso,
            "seeded": True,
        })
        inserted += 1
    print(f"Seeded {inserted} employees ({skipped} already present)")
    client.close()

asyncio.run(main())
