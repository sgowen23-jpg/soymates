"""
Insert 2026 Australian Public Holidays into leave_entries for each rep.
Rep → State mapping:
  Ashleigh Tasdarian → NSW
  David Kerr         → QLD
  Sam Gowen          → SA
  Dipen Surani       → WA
  Shane Vandewardt   → VIC
  Azra Horell        → VIC

Run: python insert_public_holidays_2026.py
"""

import requests
import json

SUPABASE_URL = "https://zrqnnyugnxtlmkboegyn.supabase.co"
SUPABASE_KEY = "sb_publishable_pFWQYGJhjM-BGPNbvwGUQg_dK0izygj"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

def h(rep, date, name):
    return {"rep_name": rep, "start_date": date, "end_date": date,
            "leave_type": "Public Holiday", "notes": name}

holidays = [

    # ── NSW — Ashleigh Tasdarian ──────────────────────────────────────────
    h("Ashleigh Tasdarian", "2026-01-01", "New Year's Day (NSW)"),
    h("Ashleigh Tasdarian", "2026-01-26", "Australia Day (NSW)"),
    h("Ashleigh Tasdarian", "2026-04-03", "Good Friday (NSW)"),
    h("Ashleigh Tasdarian", "2026-04-04", "Easter Saturday (NSW)"),
    h("Ashleigh Tasdarian", "2026-04-05", "Easter Sunday (NSW)"),
    h("Ashleigh Tasdarian", "2026-04-06", "Easter Monday (NSW)"),
    h("Ashleigh Tasdarian", "2026-04-25", "Anzac Day (NSW)"),
    h("Ashleigh Tasdarian", "2026-04-27", "Anzac Day additional holiday (NSW)"),
    h("Ashleigh Tasdarian", "2026-06-08", "King's Birthday (NSW)"),
    h("Ashleigh Tasdarian", "2026-10-05", "Labour Day (NSW)"),
    h("Ashleigh Tasdarian", "2026-12-25", "Christmas Day (NSW)"),
    h("Ashleigh Tasdarian", "2026-12-26", "Boxing Day (NSW)"),
    h("Ashleigh Tasdarian", "2026-12-28", "Boxing Day additional holiday (NSW)"),

    # ── QLD — David Kerr ─────────────────────────────────────────────────
    h("David Kerr", "2026-01-01", "New Year's Day (QLD)"),
    h("David Kerr", "2026-01-26", "Australia Day (QLD)"),
    h("David Kerr", "2026-04-03", "Good Friday (QLD)"),
    h("David Kerr", "2026-04-04", "Day after Good Friday (QLD)"),
    h("David Kerr", "2026-04-05", "Easter Sunday (QLD)"),
    h("David Kerr", "2026-04-06", "Easter Monday (QLD)"),
    h("David Kerr", "2026-04-25", "Anzac Day (QLD)"),
    h("David Kerr", "2026-05-04", "Labour Day (QLD)"),
    h("David Kerr", "2026-08-12", "Royal Queensland Show — Brisbane (QLD)"),
    h("David Kerr", "2026-10-05", "King's Birthday (QLD)"),
    h("David Kerr", "2026-12-24", "Christmas Eve (QLD)"),
    h("David Kerr", "2026-12-25", "Christmas Day (QLD)"),
    h("David Kerr", "2026-12-26", "Boxing Day (QLD)"),
    h("David Kerr", "2026-12-28", "Boxing Day additional holiday (QLD)"),

    # ── SA — Sam Gowen ────────────────────────────────────────────────────
    h("Sam Gowen", "2026-01-01", "New Year's Day (SA)"),
    h("Sam Gowen", "2026-01-26", "Australia Day (SA)"),
    h("Sam Gowen", "2026-03-09", "Adelaide Cup Day (SA)"),
    h("Sam Gowen", "2026-04-03", "Good Friday (SA)"),
    h("Sam Gowen", "2026-04-04", "Easter Saturday (SA)"),
    h("Sam Gowen", "2026-04-05", "Easter Sunday (SA)"),
    h("Sam Gowen", "2026-04-06", "Easter Monday (SA)"),
    h("Sam Gowen", "2026-04-25", "Anzac Day (SA)"),
    h("Sam Gowen", "2026-06-08", "King's Birthday (SA)"),
    h("Sam Gowen", "2026-10-05", "Labour Day (SA)"),
    h("Sam Gowen", "2026-12-24", "Christmas Eve (SA)"),
    h("Sam Gowen", "2026-12-25", "Christmas Day (SA)"),
    h("Sam Gowen", "2026-12-26", "Proclamation Day (SA)"),
    h("Sam Gowen", "2026-12-28", "Proclamation Day additional holiday (SA)"),
    h("Sam Gowen", "2026-12-31", "New Year's Eve (SA)"),

    # ── VIC — Shane Vandewardt ────────────────────────────────────────────
    h("Shane Vandewardt", "2026-01-01", "New Year's Day (VIC)"),
    h("Shane Vandewardt", "2026-01-26", "Australia Day (VIC)"),
    h("Shane Vandewardt", "2026-03-09", "Labour Day (VIC)"),
    h("Shane Vandewardt", "2026-04-03", "Good Friday (VIC)"),
    h("Shane Vandewardt", "2026-04-04", "Saturday before Easter Sunday (VIC)"),
    h("Shane Vandewardt", "2026-04-05", "Easter Sunday (VIC)"),
    h("Shane Vandewardt", "2026-04-06", "Easter Monday (VIC)"),
    h("Shane Vandewardt", "2026-04-25", "Anzac Day (VIC)"),
    h("Shane Vandewardt", "2026-06-08", "King's Birthday (VIC)"),
    h("Shane Vandewardt", "2026-11-03", "Melbourne Cup Day (VIC)"),
    h("Shane Vandewardt", "2026-12-25", "Christmas Day (VIC)"),
    h("Shane Vandewardt", "2026-12-26", "Boxing Day (VIC)"),
    h("Shane Vandewardt", "2026-12-28", "Boxing Day additional holiday (VIC)"),

    # ── VIC — Azra Horell ────────────────────────────────────────────────
    h("Azra Horell", "2026-01-01", "New Year's Day (VIC)"),
    h("Azra Horell", "2026-01-26", "Australia Day (VIC)"),
    h("Azra Horell", "2026-03-09", "Labour Day (VIC)"),
    h("Azra Horell", "2026-04-03", "Good Friday (VIC)"),
    h("Azra Horell", "2026-04-04", "Saturday before Easter Sunday (VIC)"),
    h("Azra Horell", "2026-04-05", "Easter Sunday (VIC)"),
    h("Azra Horell", "2026-04-06", "Easter Monday (VIC)"),
    h("Azra Horell", "2026-04-25", "Anzac Day (VIC)"),
    h("Azra Horell", "2026-06-08", "King's Birthday (VIC)"),
    h("Azra Horell", "2026-11-03", "Melbourne Cup Day (VIC)"),
    h("Azra Horell", "2026-12-25", "Christmas Day (VIC)"),
    h("Azra Horell", "2026-12-26", "Boxing Day (VIC)"),
    h("Azra Horell", "2026-12-28", "Boxing Day additional holiday (VIC)"),

    # ── WA — Dipen Surani ────────────────────────────────────────────────
    h("Dipen Surani", "2026-01-01", "New Year's Day (WA)"),
    h("Dipen Surani", "2026-01-26", "Australia Day (WA)"),
    h("Dipen Surani", "2026-03-02", "Labour Day (WA)"),
    h("Dipen Surani", "2026-04-03", "Good Friday (WA)"),
    h("Dipen Surani", "2026-04-05", "Easter Sunday (WA)"),
    h("Dipen Surani", "2026-04-06", "Easter Monday (WA)"),
    h("Dipen Surani", "2026-04-25", "Anzac Day (WA)"),
    h("Dipen Surani", "2026-04-27", "Anzac Day additional holiday (WA)"),
    h("Dipen Surani", "2026-06-01", "Western Australia Day (WA)"),
    h("Dipen Surani", "2026-09-28", "King's Birthday (WA)"),
    h("Dipen Surani", "2026-12-25", "Christmas Day (WA)"),
    h("Dipen Surani", "2026-12-26", "Boxing Day (WA)"),
    h("Dipen Surani", "2026-12-28", "Boxing Day additional holiday (WA)"),
]

# ── Remove existing public holidays first (avoids duplicates on re-run) ──────
print("Removing existing Public Holiday entries...")
r = requests.delete(
    f"{SUPABASE_URL}/rest/v1/leave_entries",
    headers=HEADERS,
    params={"leave_type": "eq.Public Holiday"}
)
print(f"  Delete status: {r.status_code}")

# ── Insert in batches of 50 ──────────────────────────────────────────────────
BATCH = 50
total, errors = 0, 0
for i in range(0, len(holidays), BATCH):
    batch = holidays[i:i + BATCH]
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/leave_entries",
        headers=HEADERS,
        json=batch
    )
    if r.status_code in (200, 201):
        total += len(batch)
        print(f"  Inserted batch {i//BATCH + 1}: {len(batch)} rows OK")
    else:
        errors += 1
        print(f"  ERROR batch {i//BATCH + 1}: {r.status_code} — {r.text}")

print(f"\nDone. {total} public holidays inserted, {errors} errors.")
