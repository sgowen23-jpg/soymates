"""
import_store_visits.py
──────────────────────────────────────────────────────────────────────────────
Upsert one weekly TaskStatus export into the store_visits table.

Usage:
    python scripts/import_store_visits.py <path-to-excel>

What it does:
    1. Read the single sheet from the TaskStatus export (header in row 1)
    2. Reject only structurally corrupt rows:
         - schedule_id null or non-numeric
         - location_no null or non-numeric
       Everything else is kept (all schedule states, ex-reps, out-of-territory).
    3. Upsert in batches of 200 on schedule_id (conflict = update all fields).
       Re-running the same file is safe — row counts won't move.
──────────────────────────────────────────────────────────────────────────────
"""

import sys
import os
import io
import json
import math
import pandas as pd
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ── Credentials ───────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
env_candidates = [
    os.path.join(SCRIPT_DIR, '.env'),
    os.path.join(SCRIPT_DIR, '..', '.env'),
    os.path.join(SCRIPT_DIR, '..', '.env.local'),
]
env_file = next((p for p in env_candidates if os.path.exists(p)), None)
if env_file:
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())
    print(f'✓ Loaded env from {env_file}')

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
if not SUPABASE_URL or not SUPABASE_KEY:
    print('❌  SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in scripts/.env')
    sys.exit(1)

HEADERS = {
    'apikey':        SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type':  'application/json',
}

# ── Excel path ────────────────────────────────────────────────────────────────
if len(sys.argv) < 2:
    print('❌  Usage: python scripts/import_store_visits.py <path-to-excel>')
    sys.exit(1)

EXCEL_PATH = os.path.abspath(sys.argv[1])
if not os.path.exists(EXCEL_PATH):
    print(f'❌  File not found: {EXCEL_PATH}')
    sys.exit(1)

print(f'Reading: {EXCEL_PATH}')

# ── Helpers ───────────────────────────────────────────────────────────────────
def clean_str(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    s = str(v).strip()
    return None if s in ('', 'nan', 'NaN', 'None', 'NULL') else s

def clean_int(v):
    s = clean_str(v)
    if s is None:
        return None
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None

def clean_float(v):
    s = clean_str(v)
    if s is None:
        return None
    try:
        return round(float(s), 1)
    except (ValueError, TypeError):
        return None

def clean_date(v):
    s = clean_str(v)
    if s is None:
        return None
    try:
        return pd.to_datetime(s, dayfirst=True).strftime('%Y-%m-%d')
    except Exception:
        return None

def clean_ts(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    try:
        ts = pd.to_datetime(v, utc=True)
        return ts.isoformat()
    except Exception:
        s = clean_str(v)
        if s is None:
            return None
        try:
            ts = pd.to_datetime(s, utc=True)
            return ts.isoformat()
        except Exception:
            return None

def is_numeric_str(v):
    s = clean_str(v)
    if s is None:
        return False
    try:
        float(s)
        return True
    except (ValueError, TypeError):
        return False

# ── Read Excel ────────────────────────────────────────────────────────────────
xl = pd.ExcelFile(EXCEL_PATH)
print(f'Sheets: {xl.sheet_names}')

# TaskStatus exports have a blank row 0; the real header is row 1 (0-indexed).
df = pd.read_excel(EXCEL_PATH, sheet_name=0, header=1, dtype=str)
print(f'Raw shape: {df.shape[0]} rows × {df.shape[1]} columns\n')

# ── Footer / corrupt-row rejection ───────────────────────────────────────────
# Reject if Schedule ID or Location No is null or non-numeric.
# This catches Power BI footer rows, Total rows, and filter-metadata blobs
# regardless of which column they corrupt. Everything else is kept.
before = len(df)
df = df[df['Schedule ID'].apply(is_numeric_str) & df['Location No'].apply(is_numeric_str)]
rejected = before - len(df)
if rejected:
    print(f'⚠  Rejected {rejected} corrupt/footer rows (null or non-numeric Schedule ID or Location No)')
print(f'Valid rows to upsert: {len(df)}\n')

# ── Build records ─────────────────────────────────────────────────────────────
records = []
for _, row in df.iterrows():
    schedule_id = clean_int(row.get('Schedule ID'))
    location_no = clean_int(row.get('Location No'))
    if schedule_id is None or location_no is None:
        continue  # belt-and-suspenders; already filtered above

    records.append({
        'schedule_id':        schedule_id,
        'schedule_people_id': clean_int(row.get('SchedulePeople ID')),
        'location_no':        location_no,
        'store_name':         clean_str(row.get('Company Name')),
        'state':              clean_str(row.get('Region')),
        'group_name':         clean_str(row.get('Group Name')),
        'rep':                clean_str(row.get('Rep')),
        'cycle':              clean_str(row.get('Cycle')),
        'schedule_state':     clean_str(row.get('Schedule State')),
        'date_scheduled':     clean_date(row.get('Date Schedule')),
        'work_type':          clean_str(row.get('WorkType')),
        'schedule_type':      clean_str(row.get('Schedule Type')),
        'start_task':         clean_ts(row.get('Start Task')),
        'end_task':           clean_ts(row.get('End Task')),
        'budgeted_duration':  clean_int(row.get('Budgeted Duration')),
        'actual_duration':    clean_int(row.get('Reported Minutes')),
        'timer_minutes':      clean_int(row.get('Timer Minutes')),
        'kms':                clean_float(row.get('KMs')),
        'forms':              clean_int(row.get('Forms')),
        'photos':             clean_int(row.get('Photos')),
        'schedule_comment':   clean_str(row.get('Schedule Comment')),
        'manager_comment':    clean_str(row.get('Manager Comment')),
        'last_modified':      clean_ts(row.get('Last Modified')),
    })

print(f'Records built: {len(records)}\n')

# ── Upsert ────────────────────────────────────────────────────────────────────
BATCH = 200
upserted = 0
errors = 0
total_batches = math.ceil(len(records) / BATCH)

upsert_headers = {
    **HEADERS,
    'Prefer': 'resolution=merge-duplicates,return=minimal',
}

print(f'Upserting {len(records)} rows in batches of {BATCH}…')

for i in range(0, len(records), BATCH):
    batch = records[i:i + BATCH]
    batch_n = i // BATCH + 1
    resp = requests.post(
        f'{SUPABASE_URL}/rest/v1/store_visits',
        headers=upsert_headers,
        data=json.dumps(batch),
    )
    if resp.status_code in (200, 201):
        upserted += len(batch)
        print(f'  ✓ Batch {batch_n}/{total_batches} ({len(batch)} rows)')
    else:
        errors += 1
        print(f'  ❌  Batch {batch_n}/{total_batches} FAILED: {resp.status_code} {resp.text[:300]}')

# ── Summary ───────────────────────────────────────────────────────────────────
print()
print('═' * 52)
print('  IMPORT COMPLETE — store_visits')
print('═' * 52)
print(f'  File:           {os.path.basename(EXCEL_PATH)}')
print(f'  Rows upserted:  {upserted}')
print(f'  Rows rejected:  {rejected}')
print(f'  Batch errors:   {errors}')
print('═' * 52)

if errors:
    print('\n⚠  Some batches failed — see errors above.')
    sys.exit(1)
