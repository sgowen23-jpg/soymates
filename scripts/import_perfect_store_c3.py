import pandas as pd
import requests
import json
import numpy as np

SUPABASE_URL = "https://zrqnnyugnxtlmkboegyn.supabase.co"
SUPABASE_KEY = "sb_publishable_pFWQYGJhjM-BGPNbvwGUQg_dK0izygj"
FILE = r"C:\Users\sgowe\Downloads\1. C1 Perfect Store Pipeline 15032026.xlsx"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

# C3 sheet has slightly different column layout:
# O(14)=UHT Core, P(15)=UHT NonCore, Q(16)=Chilled Total,
# T(19)=RTD, U(20)=Yoghurt, V(21)=Total Ranging, W(22)=UHT SOS,
# Z(25)=POG, AB(27)=STRATEGY, AC(28)=FOCUS STORE, AH(33)=BAY COUNT

print("Reading Cycle 3 sheet...")
df = pd.read_excel(FILE, sheet_name="PERFECT STORE CYCLE 3", header=4, engine='openpyxl', dtype=str)
df = df.dropna(subset=[df.columns[4]])
df = df[df.iloc[:,4].str.match(r'^\d+$', na=False)]
print(f"Rows to import: {len(df)}")

rows = []
for _, r in df.iterrows():
    def g(i):
        if i >= len(r): return None
        v = r.iloc[i]
        if str(v) in ('nan', 'None', '', 'NaN'): return None
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
        return s if s and s not in ('nan', 'None') else None

    rows.append({
        "store_id":        gstr(4),
        "store_name":      gstr(3),
        "state":           gstr(0),
        "cluster":         gstr(1),
        "location_type":   gstr(2),
        "mso":             gstr(6),
        "banner":          gstr(7),
        "dist_pct":        gfloat(8),
        "metcash_rank":    gnum(9),
        "vitasoy_rank":    gnum(10),
        "assumed_sales":   gfloat(11),
        "gsv_potential":   gfloat(12),
        "uht_core":        gnum(14),
        "uht_noncore":     gnum(15),
        "chilled":         gnum(16),   # CHILLED TOTAL in C3
        "rtd":             gnum(19),
        "yoghurt":         gnum(20),
        "total_ranging":   gnum(21),
        "uht_sos":         gfloat(22),
        "pog":             gnum(25),
        "strategy_c3":     None,       # No previous-cycle strategy in C3 sheet
        "strategy_c4":     gstr(27),   # AB = STRATEGY (this cycle's strategy)
        "focus_store":     gstr(28),
        "call_fqy_target": gstr(29),
        "c3_call_fqy":     None,
        "c4_call_fqy":     gnum(30),
        "bay_count":       gnum(33),
        "comments":        gstr(34),
        "cycle":           3,
    })

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

print(f"\nDone. {total} C3 rows imported, {errors} batch errors.")
