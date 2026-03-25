import pandas as pd
import requests
import json
import numpy as np
import sys

SUPABASE_URL = "https://zrqnnyugnxtlmkboegyn.supabase.co"
SUPABASE_KEY = "sb_publishable_pFWQYGJhjM-BGPNbvwGUQg_dK0izygj"
FILE = r"C:\Users\sgowe\Downloads\1. C1 Perfect Store Pipeline 15032026.xlsx"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def clean(v):
    if v is None: return None
    if isinstance(v, float) and np.isnan(v): return None
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,)): return float(v)
    if isinstance(v, str): return v.strip() or None
    return v

print("Reading Excel...")
df = pd.read_excel(FILE, sheet_name="PERFECT STORE CYCLE 4", header=4, engine='openpyxl', dtype=str)

# Drop rows without a Store ID (col index 4 = E)
df = df.dropna(subset=[df.columns[4]])
# Also drop strategy/total rows at bottom
df = df[df.iloc[:,4].str.match(r'^\d+$', na=False)]

print(f"Rows to import: {len(df)}")

rows = []
for _, r in df.iterrows():
    def g(i):
        v = r.iloc[i] if i < len(r) else None
        if pd.isna(v) if isinstance(v, float) else (v == 'nan' or v == '' or pd.isna(str(v)) if False else str(v) in ('nan','None','')) : return None
        return v

    def gnum(i):
        v = g(i)
        if v is None: return None
        try: return int(float(str(v)))
        except: return None

    def gfloat(i):
        v = g(i)
        if v is None: return None
        try: return round(float(str(v)), 6)
        except: return None

    def gstr(i):
        v = g(i)
        if v is None: return None
        s = str(v).strip()
        return s if s and s != 'nan' else None

    rows.append({
        "store_id":       gstr(4),
        "store_name":     gstr(3),
        "state":          gstr(0),
        "cluster":        gstr(1),
        "location_type":  gstr(2),
        "mso":            gstr(6),
        "banner":         gstr(7),
        "dist_pct":       gfloat(8),
        "metcash_rank":   gnum(9),
        "vitasoy_rank":   gnum(10),
        "assumed_sales":  gfloat(11),
        "gsv_potential":  gfloat(12),
        "uht_core":       gnum(14),
        "uht_noncore":    gnum(15),
        "chilled":        gnum(16),
        "rtd":            gnum(17),
        "yoghurt":        gnum(18),
        "total_ranging":  gnum(19),
        "uht_sos":        gfloat(20),
        "pog":            gnum(23),
        "strategy_c3":    gstr(26),
        "strategy_c4":    gstr(27),
        "focus_store":    gstr(28),
        "call_fqy_target": gstr(29),
        "c3_call_fqy":    gnum(30),
        "c4_call_fqy":    gnum(31),
        "bay_count":      gnum(32),
        "comments":       gstr(33),
    })

# Upsert in batches of 200
BATCH = 200
total = 0
errors = 0
for i in range(0, len(rows), BATCH):
    batch = rows[i:i+BATCH]
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/perfect_store",
        headers=headers,
        data=json.dumps(batch)
    )
    if resp.status_code in (200, 201):
        total += len(batch)
        print(f"  Upserted rows {i+1}–{i+len(batch)}")
    else:
        errors += 1
        print(f"  ERROR rows {i+1}–{i+len(batch)}: {resp.status_code} {resp.text[:200]}")

print(f"\nDone. {total} rows imported, {errors} batch errors.")
