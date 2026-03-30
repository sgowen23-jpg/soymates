#!/usr/bin/env python3
"""
Import Promo Calendar from Excel into Supabase promo_calendar table.

Excel: C:/Users/sgowe/Downloads/1. UPDATED - 03032026 Promo Calendar_VAP_By MSO_updated 11.02.26 (1).xlsx
Table: promo_calendar
"""

import openpyxl
import urllib.request
import urllib.error
import json
import datetime
import sys

# ── Config ────────────────────────────────────────────────────────────────────

EXCEL_PATH = (
    r"C:\Users\sgowe\Downloads"
    r"\1. UPDATED - 03032026 Promo Calendar_VAP_By MSO_updated 11.02.26 (1).xlsx"
)

SUPABASE_URL = "https://zrqnnyugnxtlmkboegyn.supabase.co"
SUPABASE_KEY = "sb_publishable_pFWQYGJhjM-BGPNbvwGUQg_dK0izygj"
TABLE = "promo_calendar"

SHEET_TO_RETAILER = {
    "IGA Promotions": "IGA",
    "Ritchies Promotions": "Ritchies",
    "Foodworks.": "Foodworks",
    "Foodland": "Foodland",
    "Drakes  ": "Drakes",
    # Also handle single-space variant just in case
    "Drakes ": "Drakes",
}

BATCH_SIZE = 200

# ── Helpers ───────────────────────────────────────────────────────────────────

def format_display_value(val):
    """Return a display string for a numeric promo value."""
    if isinstance(val, (int, float)):
        if val > 0:
            return f"${val:.2f}".rstrip("0").rstrip(".")
        return str(val)
    return str(val)


def parse_value(raw):
    """
    Parse a promo cell value.
    Returns (value, display_value, skip) where:
      - skip=True means ignore this cell entirely
      - value is float or None
      - display_value is a string
    """
    if raw is None:
        return None, None, True

    # datetime objects are not valid promo values
    if isinstance(raw, datetime.datetime):
        return None, None, True

    if isinstance(raw, (int, float)):
        v = float(raw)
        return v, format_display_value(v), False

    if isinstance(raw, str):
        stripped = raw.strip()
        if not stripped:
            return None, None, True

        # Long text → annotation note, skip
        if len(stripped) > 30:
            return None, None, True

        # 'Deleted' or similar → skip
        if stripped.lower() in ("deleted", "n/a", "tbc", "."):
            return None, None, True

        # Multi-buy patterns like '2 for $5', '3 for $10', '2 for $4.80'
        lower = stripped.lower()
        if "for $" in lower or " for " in lower:
            return None, stripped, False

        # Try to coerce plain numeric strings
        try:
            v = float(stripped.replace("$", "").strip())
            return v, format_display_value(v), False
        except ValueError:
            pass

        # Everything else that's short enough: treat as display_value with no numeric
        return None, stripped, False

    return None, None, True


def parse_promo_type(raw):
    """Map raw Type cell to 'price' or 'case_deal', or None to skip."""
    if raw is None:
        return None
    s = str(raw).strip()
    if s == "1. Price":
        return "price"
    if s == "2. Case Deal":
        return "case_deal"
    return None


def detect_columns(row12, row11):
    """
    Scan row 12 (0-indexed list) to find:
      type_col, desc_col, sku_col, week_cols {col_index: week_start_str}

    row12 date cells are the Customer Week (Wednesday) dates — these are correct.
    row11 (VAP week, Monday dates) is kept as a parameter for backwards compatibility
    but is no longer used for week_start values.
    """
    type_col = None
    desc_col = None
    sku_col = None
    week_cols = {}  # col_index → "YYYY-MM-DD"

    for i, cell in enumerate(row12):
        if cell is None:
            continue

        if isinstance(cell, datetime.datetime):
            # Use the Customer Week date from row 12 (Wednesday) directly
            week_cols[i] = cell.strftime("%Y-%m-%d")
            continue

        h = str(cell).strip().lower()

        if h == "type":
            type_col = i
        elif "description" in h:
            # 'Description' always wins over SKU as the description column
            desc_col = i
        elif "sku" in h:
            if sku_col is None:
                sku_col = i

    # If no explicit 'Description' column was found, fall back to SKU column for description text
    if desc_col is None and sku_col is not None:
        desc_col = sku_col

    return type_col, desc_col, sku_col, week_cols


# ── Core parser ───────────────────────────────────────────────────────────────

def parse_sheet(ws, retailer):
    """
    Parse a worksheet and return a list of row dicts ready for Supabase insert.
    """
    rows_data = list(ws.iter_rows(values_only=True))

    row11 = rows_data[10]  # index 10 = row 11 (VAP week dates)
    row12 = rows_data[11]  # index 11 = row 12 (headers)

    type_col, desc_col, sku_col, week_cols = detect_columns(row12, row11)

    if type_col is None:
        print(f"  WARNING: Could not detect 'Type' column in {retailer} — skipping sheet.")
        return [], 0

    records = []
    skipped = 0

    # Maps (description, sku) → sort_order assigned on first appearance.
    # sort_order reflects the original Excel row number (row 13 = 1, row 14 = 2, …).
    product_sort_order = {}
    next_sort_order = 1

    for excel_row_offset, row in enumerate(rows_data[12:]):  # data starts at index 12 = row 13
        # Get promo type — skip if missing or unrecognised
        raw_type = row[type_col] if type_col < len(row) else None
        promo_type = parse_promo_type(raw_type)
        if promo_type is None:
            skipped += 1
            continue

        # Get description and SKU
        description = None
        if desc_col is not None and desc_col < len(row):
            v = row[desc_col]
            if v is not None:
                description = str(v).strip() or None

        sku = None
        if sku_col is not None and sku_col < len(row):
            v = row[sku_col]
            if v is not None:
                sku = str(int(v)) if isinstance(v, float) and v == int(v) else str(v).strip()
                sku = sku or None

        # Assign sort_order based on the first Excel row this product appears on.
        # Both 'price' and 'case_deal' rows for the same product share the same value.
        product_key = (description, sku)
        if product_key not in product_sort_order:
            product_sort_order[product_key] = next_sort_order
            next_sort_order += 1
        sort_order = product_sort_order[product_key]

        # Iterate week columns
        for col_idx, week_start in week_cols.items():
            raw_val = row[col_idx] if col_idx < len(row) else None
            value, display_value, skip = parse_value(raw_val)

            if skip:
                continue

            records.append(
                {
                    "retailer": retailer,
                    "product_description": description,
                    "sku": sku,
                    "week_start": week_start,
                    "promo_type": promo_type,
                    "value": value,
                    "display_value": display_value,
                    "sort_order": sort_order,
                }
            )

    return records, skipped


# ── Supabase HTTP helpers ─────────────────────────────────────────────────────

def supabase_delete(retailer):
    """Delete all existing rows for this retailer."""
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?retailer=eq.{urllib.parse.quote(retailer)}"
    req = urllib.request.Request(
        url,
        method="DELETE",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        print(f"  ERROR deleting {retailer}: {e.code} {e.read().decode()}")
        return e.code


def supabase_insert_batch(records):
    """POST a batch of records to Supabase."""
    import urllib.parse

    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    body = json.dumps(records).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


# ── Main ──────────────────────────────────────────────────────────────────────

import urllib.parse  # noqa: E402 – needed for supabase_delete


def run(dry_run=False, dry_run_retailer="IGA", dry_run_limit=5):
    print(f"Loading workbook: {EXCEL_PATH}")
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)

    sheets = [s for s in wb.sheetnames if s in SHEET_TO_RETAILER]
    if not sheets:
        print("ERROR: No matching sheets found. Check SHEET_TO_RETAILER mapping.")
        sys.exit(1)

    print(f"Found sheets: {sheets}\n")

    for sheet_name in sheets:
        retailer = SHEET_TO_RETAILER[sheet_name]
        ws = wb[sheet_name]

        print(f"--- {retailer} ({sheet_name}) ---")
        records, skipped = parse_sheet(ws, retailer)

        print(f"  Parsed  : {len(records)} promo entries")
        print(f"  Skipped : {skipped} rows (no valid type)")

        if dry_run:
            if retailer == dry_run_retailer:
                print(f"\n  DRY-RUN — first {dry_run_limit} rows that would be inserted:")
                for i, r in enumerate(records[:dry_run_limit]):
                    print(f"  [{i+1}] {json.dumps(r, default=str)}")
            else:
                print("  DRY-RUN — skipping Supabase operations for this sheet.")
            print()
            continue

        # Live run: delete then insert
        print(f"  Deleting existing {retailer} rows from Supabase…")
        status = supabase_delete(retailer)
        print(f"  Delete status: {status}")

        inserted = 0
        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i : i + BATCH_SIZE]
            status, err = supabase_insert_batch(batch)
            if err:
                print(f"  ERROR on batch {i // BATCH_SIZE + 1}: {status} — {err}")
            else:
                inserted += len(batch)
                print(f"  Inserted batch {i // BATCH_SIZE + 1}: {len(batch)} rows (total {inserted})")

        print(f"  Done — {inserted} rows inserted for {retailer}.\n")


if __name__ == "__main__":
    # ── Dry-run mode (default) ────────────────────────────────────────────────
    # Pass --live as a CLI argument to actually write to Supabase.
    live = "--live" in sys.argv

    if live:
        print("=" * 60)
        print("LIVE MODE — writing to Supabase")
        print("=" * 60)
        run(dry_run=False)
    else:
        print("=" * 60)
        print("DRY-RUN MODE — printing first 5 IGA rows only")
        print("=" * 60)
        run(dry_run=True, dry_run_retailer="IGA", dry_run_limit=5)
        print()
        print("To import all retailers into Supabase, run:")
        print("  python import_promo_calendar.py --live")
