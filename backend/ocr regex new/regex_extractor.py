"""
Regex Extractor Module
Loads JSON regex templates per invoice type and extracts header/summary fields.

Supports:
 - Multiple pattern alternatives per field (array of patterns, tries each until match)
 - List fields via "_multi" suffix (returns all matches using findall)
 - Post-processing to clean extracted values (addresses, whitespace, etc.)
"""

import json
import os
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "regex_templates")


def load_template(invoice_type):
    """
    Load the regex template JSON for the given invoice type.

    Args:
        invoice_type: str - e.g. 'corporate_gst'

    Returns:
        dict mapping field names to pattern(s)
    """
    template_path = os.path.join(TEMPLATES_DIR, f"{invoice_type}.json")
    if not os.path.exists(template_path):
        return {}
    with open(template_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _clean_value(field_name, value):
    """Post-process extracted values to clean noise."""
    if value is None:
        return None
    value = value.strip()

    # Clean multi-line address fields
    if "address" in field_name:
        # Remove pipe characters (table artifacts)
        value = value.replace("|", "")
        # Remove plus/dash line separators
        value = re.sub(r"[+\-]{3,}", "", value)
        # Remove short noise words (logo fragments like ONE, life simple)
        lines = value.split("\n")
        cleaned_lines = []
        for line in lines:
            stripped = line.strip()
            # Skip lines that are only 1-3 chars or common logo noise
            if len(stripped) <= 3:
                continue
            if stripped.lower() in ("life simple", "one", "yertes simple", "pertes life simple"):
                continue
            cleaned_lines.append(stripped)
        value = ", ".join(cleaned_lines)
        # Collapse multiple spaces/commas
        value = re.sub(r",\s*,", ",", value)
        value = re.sub(r"\s{2,}", " ", value)
        value = value.strip(", ")

    return value


def extract_fields(text, invoice_type):
    """
    Apply the regex template for the given invoice type to the OCR text.

    Template format:
    - field_name: "pattern" or ["pattern1", "pattern2", ...]
      → Tries each pattern in order, returns first match.
    - field_name_multi: "pattern" or ["pattern1", ...]
      → Uses findall on all patterns, returns deduplicated list of all matches.

    Returns:
        dict of extracted field values (field_name -> matched value or None/list)
    """
    template = load_template(invoice_type)
    results = {}

    for field_name, patterns in template.items():
        # Skip item config keys — handled separately below
        if field_name in ("items_multi", "item_groups"):
            continue

        # Normalize to list of patterns
        if isinstance(patterns, str):
            patterns = [patterns]

        # Determine if this is a multi-match (list) field
        is_multi = field_name.endswith("_multi")
        clean_name = field_name[:-6] if is_multi else field_name

        if is_multi:
            # Collect all matches across all patterns
            all_matches = []
            for pattern in patterns:
                try:
                    matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
                    all_matches.extend(matches)
                except re.error:
                    continue
            # Deduplicate while preserving order
            seen = set()
            unique = []
            for m in all_matches:
                if m not in seen:
                    seen.add(m)
                    unique.append(m)
            results[clean_name] = unique
        else:
            # Try each pattern until one matches
            value = None
            for pattern in patterns:
                try:
                    match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE | re.DOTALL)
                except re.error:
                    continue
                if match:
                    value = match.group(1).strip() if match.lastindex else match.group(0).strip()
                    break
            results[clean_name] = _clean_value(clean_name, value)

    # --- Line-item extraction via items_multi + item_groups ----------------
    items_pats = template.get("items_multi", [])
    item_groups = template.get("item_groups", {})
    if isinstance(items_pats, str):
        items_pats = [items_pats]
    items = []
    # Words that indicate summary rows, not actual line items
    _SKIP_DESCRIPTIONS = {
        'sub total', 'subtotal', 'total', 'grand total', 'net total',
        'discount', 'tax', 'round off', 'rounding', 'balance',
    }
    if items_pats and item_groups:
        for pat in items_pats:
            try:
                for m in re.finditer(pat, text, re.IGNORECASE | re.MULTILINE):
                    item = {}
                    for col, grp in item_groups.items():
                        try:
                            val = m.group(int(grp))
                            item[col] = val.strip() if val else ""
                        except (IndexError, AttributeError):
                            item[col] = ""
                    # Skip summary/total rows
                    desc = item.get("description", "").strip().lower()
                    if desc in _SKIP_DESCRIPTIONS:
                        continue
                    if any(item.values()):
                        items.append(item)
            except re.error:
                continue
    results["items"] = items

    # --- Fallback: re-extract items if template found too few ----------------
    results = _try_items_fallback(text, results)

    # --- Universal fallback: fill blanks from _universal_fallback.json -----
    results = _apply_fallback(text, results)

    return results


def _try_items_fallback(text, results):
    """
    When the specific template's items_multi matched very few rows but the raw
    text clearly contains a pipe-delimited table with more rows, re-extract
    using progressively more lenient patterns.
    """
    existing_items = results.get("items", [])

    # Count how many pipe-delimited data rows exist in the text
    # (rows that start/contain | and have at least a number — skip header/separator)
    table_row_pattern = re.compile(
        r'^\s*\|[^+\-]{5,}\|', re.MULTILINE
    )
    table_rows = table_row_pattern.findall(text)
    # Filter out header rows (rows containing column names like "Items", "Quantity", etc.)
    data_rows = [
        r for r in table_rows
        if re.search(r'\d', r) and not re.search(r'Items\s*\|.*Quantity', r, re.IGNORECASE)
    ]

    if len(existing_items) >= len(data_rows):
        return results  # template caught them all

    print(f"[*] Items fallback: template found {len(existing_items)} items but text has ~{len(data_rows)} table rows — re-extracting")

    # Lenient patterns for pipe-delimited tables, ordered from stricter to looser
    fallback_patterns = [
        # Pattern 1: pipes with optional Rs./Rs prefix, 5 columns
        r'\|\s*([^|\n]{2,}?)\s*\|\s*(\d+)\s*(?:KG|NOS|PCS|UNIT|SET|BOX|EA|DOZ|MTR|LTR|GM)?\s*\|\s*(?:Rs\.?\s*)?([0-9,.]+)\s*\|\s*(?:Rs\.?\s*)?([0-9,.]+).*?\|\s*(?:Rs\.?\s*)?([0-9,.]+)',
        # Pattern 2: pipes with 4 numeric columns (no tax column)
        r'\|\s*([^|\n]{2,}?)\s*\|\s*(\d+)\s*(?:KG|NOS|PCS|UNIT|SET|BOX|EA|DOZ|MTR|LTR|GM)?\s*\|\s*(?:Rs\.?\s*)?([0-9,.]+)\s*\|\s*(?:Rs\.?\s*)?([0-9,.]+)\s*\|',
    ]

    for pat in fallback_patterns:
        items = []
        try:
            for m in re.finditer(pat, text, re.IGNORECASE | re.MULTILINE):
                desc = m.group(1).strip()
                # Skip separator lines or header-like content
                if re.match(r'^[\-+= ]+$', desc):
                    continue
                if desc.lower() in ('items', 'item', 'description', 'product', 'particular', 'particulars'):
                    continue

                item = {"description": desc, "quantity": m.group(2).strip()}
                item["rate"] = m.group(3).strip() if m.lastindex >= 3 else ""
                if m.lastindex >= 5:
                    item["tax"] = m.group(4).strip()
                    item["total"] = m.group(5).strip()
                elif m.lastindex >= 4:
                    item["total"] = m.group(4).strip()

                if any(item.values()):
                    items.append(item)
        except re.error:
            continue

        if len(items) > len(existing_items):
            print(f"[*] Items fallback pattern matched {len(items)} items (was {len(existing_items)})")
            results["items"] = items
            return results

    return results


def _apply_fallback(text, results):
    """
    If key fields are mostly empty after specific-template extraction,
    try the universal fallback template and fill in any blank fields.
    Does NOT overwrite values already extracted by the specific template.
    """
    fallback_path = os.path.join(TEMPLATES_DIR, "_universal_fallback.json")
    if not os.path.exists(fallback_path):
        return results

    # Check if we actually need the fallback — skip if most key fields present
    key_fields = ["vendor_name", "invoice_number", "grand_total", "invoice_date", "gstin"]
    filled = sum(1 for k in key_fields if results.get(k))
    if filled >= 3:
        return results

    print("[*] Specific template matched few fields — trying universal fallback")

    with open(fallback_path, "r", encoding="utf-8") as f:
        fallback = json.load(f)

    for field_name, patterns in fallback.items():
        if field_name in ("items_multi", "item_groups"):
            continue
        if isinstance(patterns, str):
            patterns = [patterns]

        is_multi = field_name.endswith("_multi")
        clean_name = field_name[:-6] if is_multi else field_name

        # Skip if already has a value from the specific template
        existing = results.get(clean_name)
        if existing and existing not in (None, "", []):
            continue

        if is_multi:
            all_matches = []
            for pattern in patterns:
                try:
                    matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
                    all_matches.extend(matches)
                except re.error:
                    continue
            seen = set()
            unique = []
            for m in all_matches:
                if m not in seen:
                    seen.add(m)
                    unique.append(m)
            if unique:
                results[clean_name] = unique
        else:
            for pattern in patterns:
                try:
                    match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE | re.DOTALL)
                except re.error:
                    continue
                if match:
                    val = match.group(1).strip() if match.lastindex else match.group(0).strip()
                    results[clean_name] = _clean_value(clean_name, val)
                    break

    # Fill items from fallback only if specific template found none
    if not results.get("items"):
        fb_items_pats = fallback.get("items_multi", [])
        fb_item_groups = fallback.get("item_groups", {})
        if isinstance(fb_items_pats, str):
            fb_items_pats = [fb_items_pats]
        items = []
        if fb_items_pats and fb_item_groups:
            for pat in fb_items_pats:
                try:
                    for m in re.finditer(pat, text, re.IGNORECASE | re.MULTILINE):
                        item = {}
                        for col, grp in fb_item_groups.items():
                            try:
                                val = m.group(int(grp))
                                item[col] = val.strip() if val else ""
                            except (IndexError, AttributeError):
                                item[col] = ""
                        if any(item.values()):
                            items.append(item)
                except re.error:
                    continue
        if items:
            results["items"] = items

    return results
