"""
LLM Fallback Module
Uses a local Qwen 2.5 3B Instruct model (running on port 8080) to fill in
fields that regex extraction missed.

Design principles:
  - Only called when regex leaves key fields empty
  - Sends MINIMAL prompt to stay within the 3B model's token budget
  - Only asks for the specific missing fields (not everything)
  - Truncates OCR text to ~1500 chars around the most relevant region
  - Returns a dict of filled-in fields (never overwrites regex results)
"""

import json
import re
import requests
from typing import Dict, List, Optional

LLM_BASE_URL = "http://localhost:8080"

# Fields we consider "key" — if enough are missing, we invoke the LLM
KEY_FIELDS = [
    "vendor_name", "invoice_number", "invoice_date",
    "grand_total", "gstin"
]

# Maximum characters of OCR text to send (keeps prompt small for 3B model)
MAX_TEXT_CHARS = 1500

# Cache the detected model name so we only query once
_cached_model_name = None


def _get_model_name() -> str:
    """Auto-detect the model name from the local server."""
    global _cached_model_name
    if _cached_model_name:
        return _cached_model_name
    try:
        resp = requests.get(f"{LLM_BASE_URL}/v1/models", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            models = data.get("data", [])
            if models:
                _cached_model_name = models[0].get("id", "qwen2.5-3b-instruct")
                print(f"[LLM-Fallback] Detected model: {_cached_model_name}")
                return _cached_model_name
    except Exception:
        pass
    return "qwen2.5-3b-instruct"


def _is_field_empty(value) -> bool:
    """Check if a field value is effectively empty."""
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (int, float)) and value == 0:
        return True
    return False


def _trim_text(raw_text: str, max_chars: int = MAX_TEXT_CHARS) -> str:
    """
    Trim OCR text intelligently — keep the header/top portion (where
    vendor, invoice no, date, GSTIN usually appear) and the footer
    (where totals appear). Skip the middle if the text is too long.
    """
    if len(raw_text) <= max_chars:
        return raw_text

    # Keep 60% from the top (header info), 40% from the bottom (totals)
    top_chars = int(max_chars * 0.6)
    bottom_chars = max_chars - top_chars

    top = raw_text[:top_chars]
    bottom = raw_text[-bottom_chars:]

    return top + "\n...[truncated]...\n" + bottom


def _build_prompt(missing_fields: List[str], ocr_text: str) -> str:
    """
    Build a concise prompt that asks only for the missing fields.
    Kept minimal for the 3B model's token limit.
    """
    field_descriptions = {
        "vendor_name": "vendor/seller company name",
        "invoice_number": "invoice/bill number",
        "invoice_date": "invoice date (DD/MM/YYYY or any format found)",
        "grand_total": "grand total / net amount (number only)",
        "gstin": "GSTIN number (15-char alphanumeric)",
        "cgst": "CGST tax amount (number only)",
        "sgst": "SGST tax amount (number only)",
        "igst": "IGST tax amount (number only)",
        "vendor_address": "vendor/seller address",
        "buyer_name": "buyer/customer name",
        "discount": "discount amount (number only)",
    }

    fields_list = "\n".join(
        f'- "{f}": {field_descriptions.get(f, f)}'
        for f in missing_fields
    )

    prompt = f"""Extract these fields from the invoice text below. Return ONLY a JSON object with the requested fields. If a field is not found, use null.

Fields needed:
{fields_list}

Invoice text:
{ocr_text}

JSON:"""

    return prompt


def _build_items_prompt(ocr_text: str) -> str:
    """
    Build a prompt specifically for extracting line items when regex failed.
    Asks for a simplified structure to keep output small.
    """
    prompt = f"""Extract line items from this invoice. Return a JSON array of items. Each item should have: description, quantity, rate, total, hsn_code. If a field is missing, use empty string. Return ONLY the JSON array.

Invoice text:
{ocr_text}

JSON:"""

    return prompt


def _call_llm(prompt: str, max_tokens: int = 500) -> Optional[str]:
    """
    Call the local Qwen 2.5 3B model via OpenAI-compatible API.
    Returns the raw text response or None on failure.
    """
    try:
        response = requests.post(
            f"{LLM_BASE_URL}/v1/chat/completions",
            json={
                "model": _get_model_name(),
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a precise invoice data extractor. Return only valid JSON, no explanations."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "max_tokens": max_tokens,
                "temperature": 0.1,
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()
        print(f"[LLM-Fallback] Got response ({len(content)} chars): {content[:200]}")
        return content
    except requests.exceptions.ConnectionError:
        print("[LLM-Fallback] Cannot connect to local LLM on port 8080 — skipping")
        return None
    except requests.exceptions.Timeout:
        print("[LLM-Fallback] LLM request timed out — skipping")
        return None
    except Exception as e:
        print(f"[LLM-Fallback] LLM call failed: {e}")
        return None


def _parse_json_response(raw_response: str) -> Optional[dict]:
    """
    Parse JSON from the LLM response, handling common quirks like
    markdown code fences or trailing text.
    """
    if not raw_response:
        return None

    text = raw_response.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

    # Try to find JSON object or array in the response
    # Look for the outermost { } or [ ]
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = text.find(start_char)
        if start == -1:
            continue
        # Find matching closing bracket
        depth = 0
        for i in range(start, len(text)):
            if text[i] == start_char:
                depth += 1
            elif text[i] == end_char:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        break

    # Last resort: try parsing the whole thing
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"[LLM-Fallback] Could not parse JSON from LLM response: {text[:200]}")
        return None


def fill_missing_fields(regex_results: Dict, raw_text: str) -> Dict:
    """
    Main entry point. Checks which key fields regex missed,
    calls the LLM to fill ONLY those fields, and returns a merged dict.

    Never overwrites values that regex already extracted.

    Returns:
        dict with two keys:
          - "fields": the merged fields dict
          - "llm_enhanced": bool indicating if LLM was actually used
    """
    # Determine which key fields are missing
    missing = [f for f in KEY_FIELDS if _is_field_empty(regex_results.get(f))]

    # Also check some secondary fields if they're empty
    secondary_fields = ["cgst", "sgst", "igst", "vendor_address", "discount"]
    missing_secondary = [f for f in secondary_fields if _is_field_empty(regex_results.get(f))]

    # Only invoke LLM if at least 2 key fields are missing
    if len(missing) < 2:
        # Check items — if no line items extracted, try LLM for that
        if not regex_results.get("items"):
            return _try_llm_items(regex_results, raw_text)
        return {"fields": regex_results, "llm_enhanced": False}

    print(f"[LLM-Fallback] Regex missed {len(missing)} key fields: {missing}")

    # Include some secondary missing fields too (but keep total manageable)
    all_missing = missing + missing_secondary[:3]

    # Trim OCR text to fit token budget
    trimmed_text = _trim_text(raw_text)
    prompt = _build_prompt(all_missing, trimmed_text)

    # Call LLM
    raw_response = _call_llm(prompt, max_tokens=400)
    parsed = _parse_json_response(raw_response)

    if not parsed or not isinstance(parsed, dict):
        print("[LLM-Fallback] No usable response from LLM")
        # Still try items if missing
        if not regex_results.get("items"):
            return _try_llm_items(regex_results, raw_text)
        return {"fields": regex_results, "llm_enhanced": False}

    # Merge: only fill fields that regex missed (never overwrite)
    merged = dict(regex_results)
    fields_filled = []
    for field, value in parsed.items():
        if field in merged and _is_field_empty(merged.get(field)) and value is not None:
            # Clean numeric fields
            if field in ("grand_total", "cgst", "sgst", "igst", "discount"):
                try:
                    value = float(str(value).replace(",", "").strip())
                except (ValueError, TypeError):
                    continue
            merged[field] = value
            fields_filled.append(field)

    if fields_filled:
        print(f"[LLM-Fallback] Filled {len(fields_filled)} fields via LLM: {fields_filled}")

    # Also try items if missing
    if not merged.get("items"):
        items_result = _try_llm_items(merged, raw_text)
        merged = items_result["fields"]
        if items_result["llm_enhanced"]:
            return {"fields": merged, "llm_enhanced": True}

    return {"fields": merged, "llm_enhanced": bool(fields_filled)}


def _try_llm_items(regex_results: Dict, raw_text: str) -> Dict:
    """
    Try to extract line items via LLM when regex found none.
    Only sends a focused portion of the text.
    """
    if regex_results.get("items"):
        return {"fields": regex_results, "llm_enhanced": False}

    print("[LLM-Fallback] No line items from regex — trying LLM extraction")

    trimmed_text = _trim_text(raw_text, max_chars=1800)
    prompt = _build_items_prompt(trimmed_text)

    raw_response = _call_llm(prompt, max_tokens=600)
    parsed = _parse_json_response(raw_response)

    if not parsed:
        return {"fields": regex_results, "llm_enhanced": False}

    # Accept either a list directly or a dict with an "items" key
    items = []
    if isinstance(parsed, list):
        items = parsed
    elif isinstance(parsed, dict) and "items" in parsed:
        items = parsed["items"]

    if not items or not isinstance(items, list):
        return {"fields": regex_results, "llm_enhanced": False}

    # Normalize item keys to match what ocr_bridge expects
    normalized_items = []
    for item in items:
        if not isinstance(item, dict):
            continue
        normalized = {
            "description": str(item.get("description", "") or item.get("name", "") or "").strip(),
            "quantity": str(item.get("quantity", "1") or "1"),
            "rate": str(item.get("rate", "") or item.get("unit_price", "") or item.get("price", "") or ""),
            "total": str(item.get("total", "") or item.get("amount", "") or ""),
            "hsn_code": str(item.get("hsn_code", "") or item.get("hsn", "") or ""),
        }
        if normalized["description"]:
            normalized_items.append(normalized)

    if normalized_items:
        print(f"[LLM-Fallback] Extracted {len(normalized_items)} line items via LLM")
        merged = dict(regex_results)
        merged["items"] = normalized_items
        return {"fields": merged, "llm_enhanced": True}

    return {"fields": regex_results, "llm_enhanced": False}


def is_llm_available() -> bool:
    """Quick health check — is the local LLM server reachable?"""
    try:
        resp = requests.get(f"{LLM_BASE_URL}/v1/models", timeout=3)
        return resp.status_code == 200
    except Exception:
        return False
