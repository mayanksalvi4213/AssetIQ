# Enhanced Invoice Extractor - Stateless LLM Architecture

## Overview

This document describes the refactored architecture where the LLM serves as a **stateless page parser** and all consistency logic is handled deterministically in Python.

## Architecture Principles

### 1. **Stateless LLM Page Parsing**

- LLM processes **one page at a time** with no memory of previous pages
- Each page extraction is independent and idempotent
- LLM returns **strict JSON** containing only what's visible on that page
- NO inference, NO continuation tracking, NO cross-page calculations

### 2. **Deterministic Python Aggregation**

- Backend code handles ALL consistency logic
- Item merging by normalized description + HSN code
- Quantity aggregation across pages
- Serial number collection and validation
- Total calculations and validation

### 3. **Data Flow**

```
Invoice PDF
    ↓
Split by page markers (<<<)
    ↓
For each page:
    ↓
    LLM extracts page-specific JSON
    {
      "invoice_metadata": {...},
      "line_items": [
        {
          "material_description": "...",
          "quantity_on_page": X,  ← Only quantity on THIS page
          "batches": ["serial1", "serial2"],  ← Serials on THIS page
          ...
        }
      ],
      "page_totals": {...}  ← Only if printed on THIS page
    }
    ↓
Python aggregation:
    ↓
    • Merge items by (normalized_desc, HSN)
    • Sum quantities across pages
    • Collect all batches/serials
    • Validate quantity vs serial count
    • Trust totals from final page only
    ↓
Final BillInfo with consistent data
```

## Key Components

### LLM Prompt Schema

```json
{
  "invoice_metadata": {
    "invoice_no": "",
    "invoice_date": "",
    "vendor_name": "",
    "vendor_gstin": ""
  },
  "line_items": [
    {
      "material_description": "",
      "brand": "",
      "model": "",
      "quantity_on_page": 0, // NEW: quantity visible on THIS page only
      "unit_price": 0,
      "total_amount": 0,
      "hsn": "",
      "batches": [] // NEW: serial numbers found on THIS page
    }
  ],
  "page_totals": {
    // NEW: renamed from tax_summary
    "subtotal": 0,
    "cgst": 0,
    "sgst": 0,
    "igst": 0,
    "grand_total": 0
  }
}
```

### Python Aggregation Logic

#### 1. Item Merging (`_aggregate_page_results`)

```python
# Normalize description for matching
norm_desc = " ".join(desc.lower().split())
merge_key = (norm_desc, hsn)

# If same item appears on multiple pages:
- Sum quantity_on_page values
- Collect all batches from all pages
- Prefer latest unit_price if different
```

#### 2. Quantity Validation

```python
if serial_count != quantity:
    # Trust serial numbers over quantity field
    quantity = serial_count
```

#### 3. Total Calculation

```python
# Calculate from items
items_total = sum(item['total_amount'] for item in line_items)

# Tax from final page only
tax_amount = final_page['page_totals']['total_tax']

# Validate LLM total vs calculated
if abs(llm_total - calculated_total) / calculated_total < 0.05:
    use llm_total
else:
    use calculated_total
```

## LLM Constraints

The LLM prompt includes **CRITICAL RULES** to enforce stateless behavior:

1. ✅ Extract ONLY items visible on THIS page
2. ✅ `quantity_on_page` = quantity shown on THIS PAGE ONLY (not cumulative)
3. ✅ `batches` = serial numbers found on THIS page for this item
4. ✅ `page_totals` = totals printed on THIS page (leave 0 if not visible)
5. ❌ DO NOT infer continuation from previous pages
6. ❌ DO NOT sum quantities across different items
7. ❌ DO NOT guess or infer anything not explicitly printed
8. ❌ DO NOT merge items - report each distinct entry separately

## Benefits

### 1. **Reliability**

- No LLM hallucination of quantities or totals
- Consistent item merging using Python logic
- Deterministic calculations

### 2. **Accuracy**

- Serial number counts validated against quantities
- Cross-page item aggregation handled correctly
- No duplicate or missing items

### 3. **Debuggability**

- Each page's extraction is independent and inspectable
- Clear audit trail of merging decisions
- Warnings logged for mismatches

### 4. **Scalability**

- Pages can be processed in parallel (future enhancement)
- No context window limitations from cumulative state
- Handles invoices with 50+ items across multiple pages

## Edge Cases Handled

### Multi-Page Items

```
Page 1: Computer x10 (serials 1-5)
Page 2: Computer x10 (serials 6-10)
Result: Computer x10 with serials [1,2,3,4,5,6,7,8,9,10]
```

### Quantity Mismatches

```
Item: Laptop
quantity_on_page: 3
batches: ["S1", "S2"]
→ WARNING: Trust serials, use quantity=2
```

### Totals on Final Page Only

```
Page 1: Items, no totals
Page 2: Items, no totals
Page 3: Items + Grand Total: 50,000
→ Use Page 3 totals, ignore earlier pages
```

## Configuration

Environment variables in `.env`:

```bash
LOCAL_LLM_URL=http://127.0.0.1:8080
LOCAL_LLM_MODEL=qwen2.5-3b-instruct-q4_k_m.gguf
LOCAL_LLM_TIMEOUT=180
LOCAL_LLM_MAX_TOKENS=1024
LOCAL_LLM_CHUNK_CHARS=8000
```

## Testing

To verify stateless behavior:

1. Test with multi-page invoices where same item appears on multiple pages
2. Verify quantities are summed correctly
3. Check serial numbers are collected from all pages
4. Validate totals match final page
5. Ensure no duplicate items in final output

## Future Enhancements

1. **Parallel Page Processing**: Process pages concurrently since they're independent
2. **Batch Serial Assignment**: Generate sequential serials when not provided
3. **Fuzzy Item Matching**: Handle slight description variations across pages
4. **Invoice Type Detection**: Optimize parsing based on detected invoice format
