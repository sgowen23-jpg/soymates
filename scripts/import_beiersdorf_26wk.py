"""
import_beiersdorf_26wk.py
────────────────────────────────────────────────────────────────────────────
Imports Beiersdorf 26-week BNB data into bnb_26wk with client = 'beiersdorf'.

File format expected (Export sheet):
  State, Store Name, POG Category, Category, Item Name, MSO,
  Count of Ranging, Sum of Ranging, Distribution Percentage,
  Ranging Gap, To Target Percentage, Buy Rate Latest

What it does:
  1. Reads Export sheet and drops garbage rows (Total, filter-description)
  2. Deletes all existing rows WHERE client = 'beiersdorf' (Vitasoy data untouched)
  3. Inserts fresh rows with client = 'beiersdorf' (batch size 200)
  4. Reports pre/post row counts for bnb_26wk

Requires the Supabase SERVICE ROLE key (sb_secret_... from Project Settings → API).
The publishable/anon key will NOT have insert permissions.

Usage:
    python scripts/import_beiersdorf_26wk.py <path-to-xlsx>
────────────────────────────────────────────────────────────────────────────
"""

import sys
import os
import json
import math
import pandas as pd
import requests
from datetime import datetime, timezone

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
    print('❌  Usage: python scripts/import_beiersdorf_26wk.py <path-to-xlsx>')
    sys.exit(1)

EXCEL_PATH = os.path.abspath(sys.argv[1])
if not os.path.exists(EXCEL_PATH):
    print(f'❌  File not found: {EXCEL_PATH}')
    sys.exit(1)

# ── Helpers ───────────────────────────────────────────────────────────────────
VALID_STATES = {'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'}

def clean_str(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
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
        return round(float(s), 6)
    except (ValueError, TypeError):
        return None

def count_rows(client_filter=None):
    url = f'{SUPABASE_URL}/rest/v1/bnb_26wk?select=id&limit=0'
    if client_filter:
        url += f'&client=eq.{client_filter}'
    r = requests.get(url, headers={**HEADERS, 'Prefer': 'count=exact'})
    cr = r.headers.get('content-range', '*/0')
    return int(cr.split('/')[-1]) if '/' in cr else 0

# ── Read and clean Excel ──────────────────────────────────────────────────────
print(f'\nReading: {EXCEL_PATH}')

xl = pd.ExcelFile(EXCEL_PATH)
print(f'Sheets: {xl.sheet_names}')

sheet_name = next(
    (s for s in xl.sheet_names if s.strip().lower() == 'export'),
    None
)
if not sheet_name:
    print(f'❌  "Export" sheet not found. Available: {xl.sheet_names}')
    sys.exit(1)

df = pd.read_excel(EXCEL_PATH, sheet_name=sheet_name, dtype=str)
print(f'Raw rows: {len(df):,}')

df = df[df['State'].isin(VALID_STATES)].copy()
print(f'Valid rows (after dropping Total/filter rows): {len(df):,}')

# ── Build records ─────────────────────────────────────────────────────────────
uploaded_at = datetime.now(timezone.utc).isoformat()
records = []
for _, row in df.iterrows():
    records.append({
        'client':                  'beiersdorf',
        'state':                   clean_str(row.get('State')),
        'store_name':              clean_str(row.get('Store Name')),
        'mso':                     clean_str(row.get('MSO')),
        'item_name':               clean_str(row.get('Item Name')),
        'pog_category':            clean_str(row.get('POG Category')),
        'count_of_ranging':        clean_int(row.get('Count of Ranging')),
        'sum_of_ranging':          clean_int(row.get('Sum of Ranging')),
        'distribution_percentage': clean_float(row.get('Distribution Percentage')),
        'ranging_gap':             clean_int(row.get('Ranging Gap')),
        'to_target_percentage':    clean_float(row.get('To Target Percentage')),
        'buy_rate_latest':         clean_float(row.get('Buy Rate Latest')),
        'uploaded_at':             uploaded_at,
        # Not present in Beiersdorf file — left null:
        # store_id, store_region, item_id, rep_name
    })

print(f'Records built: {len(records):,}\n')

# ── Pre-counts ────────────────────────────────────────────────────────────────
pre_total       = count_rows()
pre_beiersdorf  = count_rows('beiersdorf')
pre_vitasoy     = count_rows('vitasoy')
print('Pre-import counts:')
print(f'  bnb_26wk total:       {pre_total:,}')
print(f'  client=vitasoy:       {pre_vitasoy:,}')
print(f'  client=beiersdorf:    {pre_beiersdorf:,}')

# ── Delete old Beiersdorf rows ────────────────────────────────────────────────
print('\nDeleting existing client=beiersdorf rows…', end=' ')
r = requests.delete(
    f'{SUPABASE_URL}/rest/v1/bnb_26wk?client=eq.beiersdorf',
    headers=HEADERS,
)
if r.status_code not in (200, 204):
    print(f'\n❌  Delete failed: {r.status_code} {r.text[:300]}')
    sys.exit(1)
print('✓')

# ── Insert new rows ───────────────────────────────────────────────────────────
BATCH = 200
inserted = 0
errors = 0
ins_headers = {**HEADERS, 'Prefer': 'return=minimal'}

print(f'\nInserting {len(records):,} rows in batches of {BATCH}…')
total_batches = math.ceil(len(records) / BATCH)

for i in range(0, len(records), BATCH):
    batch = records[i:i + BATCH]
    batch_n = i // BATCH + 1
    r = requests.post(
        f'{SUPABASE_URL}/rest/v1/bnb_26wk',
        headers=ins_headers,
        data=json.dumps(batch),
    )
    if r.status_code in (200, 201):
        inserted += len(batch)
        if batch_n % 20 == 0 or batch_n == total_batches:
            pct = round(inserted / len(records) * 100)
            print(f'  {pct}% ({inserted:,}/{len(records):,})')
    else:
        errors += 1
        print(f'  ❌  Batch {batch_n} FAILED: {r.status_code} {r.text[:200]}')

# ── Post-counts ───────────────────────────────────────────────────────────────
post_total      = count_rows()
post_beiersdorf = count_rows('beiersdorf')
post_vitasoy    = count_rows('vitasoy')

# ── Summary ───────────────────────────────────────────────────────────────────
print()
print('═' * 56)
print('  IMPORT SUMMARY — Beiersdorf 26wk BNB')
print('═' * 56)
print(f'  Rows in file:         {len(records):,}')
print(f'  Rows inserted:        {inserted:,}')
print(f'  Batch errors:         {errors}')
print()
print(f'  bnb_26wk total:       {pre_total:,} → {post_total:,}')
print(f'  client=vitasoy:       {pre_vitasoy:,} → {post_vitasoy:,}  {"✓ unchanged" if pre_vitasoy == post_vitasoy else "⚠ CHANGED"}')
print(f'  client=beiersdorf:    {pre_beiersdorf:,} → {post_beiersdorf:,}')
print('═' * 56)

if errors:
    print('\n⚠  Some batches failed — check errors above.')
    sys.exit(1)
elif pre_vitasoy != post_vitasoy:
    print('\n⚠  Vitasoy row count changed — investigate.')
    sys.exit(1)
else:
    print('\n  Import complete.')
