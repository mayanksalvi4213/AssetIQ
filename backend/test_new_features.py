"""
Test Examples: New Invoice Extraction Features

This file demonstrates the fixes implemented for:
1. Batch-only page detection
2. has_explicit_quantity filtering
3. Separate serial extraction
4. Validation with flagging
"""

# ============================================
# TEST 1: BATCH-ONLY PAGE DETECTION
# ============================================

batch_only_page_example = """
Serial Numbers - Page 2

Batch No: COMP001
Batch No: COMP002
Batch No: COMP003
Batch No: COMP004
Batch No: COMP005
Serial: COMP006
Serial: COMP007
Serial: COMP008
Serial: COMP009
Serial: COMP010
"""

# Expected Behavior:
# - _is_batch_only_page() returns True
# - Uses _build_batch_only_prompt()
# - LLM returns: {"batches": ["COMP001", "COMP002", ..., "COMP010"]}
# - NO fake items created

# ============================================
# TEST 2: has_explicit_quantity FILTERING
# ============================================

item_page_with_specs = """
Invoice Items

SI | Description | HSN | Qty | Rate | Amount
1  | Dell Computer i5 8GB | 8471 | 5 Pcs | 45000 | 225000
   Part no: ABC123
   Warranty: 3 years on-site
   Model: Optiplex 7080

2  | HP Monitor 24" | 8528 | 3 Nos | 12000 | 36000
   Resolution: 1920x1080
   Panel: IPS
"""

# Expected LLM Output:
# {
#   "line_items": [
#     {
#       "material_description": "Dell Computer i5 8GB",
#       "quantity_on_page": 5,
#       "has_explicit_quantity": true,  # <-- "5 Pcs" is explicit
#       "unit_price": 45000,
#       "total_amount": 225000,
#       "hsn": "8471"
#     },
#     {
#       "material_description": "Part no: ABC123",
#       "quantity_on_page": 0,
#       "has_explicit_quantity": false,  # <-- NO quantity printed
#       ...
#     },
#     {
#       "material_description": "HP Monitor 24\"",
#       "quantity_on_page": 3,
#       "has_explicit_quantity": true,  # <-- "3 Nos" is explicit
#       ...
#     }
#   ]
# }

# Backend Filtering:
# - Item 1: has_explicit_quantity=true → KEEP
# - "Part no" line: has_explicit_quantity=false → DISCARD
# - "Warranty" line: has_explicit_quantity=false → DISCARD
# - Item 2: has_explicit_quantity=true → KEEP

# Result: Only 2 items (Computer and Monitor)

# ============================================
# TEST 3: SEPARATE SERIAL EXTRACTION
# ============================================

multi_page_invoice = """
<<<  # Page 1 - Items
Invoice No: INV-001
Vendor: Tech Corp

SI | Description | Qty | Amount
1  | Laptop Dell | 10 | 450000

<<<  # Page 2 - Batch-only
Serial Numbers:
LAP001
LAP002
LAP003
LAP004
LAP005

<<<  # Page 3 - Batch-only
LAP006
LAP007
LAP008
LAP009
LAP010

<<<  # Page 4 - Totals
Grand Total: 450000
"""

# Processing Flow:
# Page 1: Normal extraction
#   - line_items: [{"material_description": "Laptop Dell", "quantity_on_page": 10}]
#   - batches field NOT included (removed from schema)
#
# Page 2: Batch-only detection
#   - _is_batch_only_page() = True
#   - Uses batch-only prompt
#   - Returns: {"batches_only": ["LAP001", "LAP002", "LAP003", "LAP004", "LAP005"]}
#
# Page 3: Batch-only detection
#   - Returns: {"batches_only": ["LAP006", "LAP007", "LAP008", "LAP009", "LAP010"]}
#
# Page 4: Normal extraction (totals)
#   - page_totals: {"grand_total": 450000}

# Aggregation:
# - all_batches: ["LAP001", ..., "LAP010"] (collected from pages 2 & 3)
# - line_items: [{"quantity": 10, "description": "Laptop Dell"}]
# - Sequential assignment: 10 assets with LAP001-LAP010

# ============================================
# TEST 4: VALIDATION WITH FLAGGING
# ============================================

# Scenario A: Quantity Matches Serials
# - Items: 10 laptops
# - Serials: 10 serials
# - Result: requires_manual_review = False

# Scenario B: Quantity Mismatch
# - Items: 10 laptops
# - Serials: 8 serials
# - Result:
#   * requires_manual_review = True
#   * review_reason = "Serial count mismatch: 10 items vs 8 serials"
#   * warranty_info = "REVIEW REQUIRED: Serial count mismatch..."
#   * Pipeline continues (does NOT fail)

# Scenario C: No Serials
# - Items: 10 laptops
# - Serials: 0 (none provided)
# - Result:
#   * requires_manual_review = False (validation skipped)
#   * Assets created with empty serial_number

# ============================================
# TEST 5: GST & TOTAL TRUST
# ============================================

invoice_with_printed_gst = """
Page 1:
Items: Computer x5 @ 40000 = 200000

Page 2:
Subtotal: 200000
CGST (9%): 18000
SGST (9%): 18000
Grand Total: 236000
"""

# Backend Behavior:
# - Reads CGST: 18000 (TRUST IT - no recalculation)
# - Reads SGST: 18000 (TRUST IT - no recalculation)
# - Reads Grand Total: 236000 (TRUST IT - no recalculation)
# - total_tax = 18000 + 18000 = 36000 (sum of printed values)
# - Does NOT calculate: 200000 * 0.18 = 36000 (ignores calculation)

invoice_without_printed_gst = """
Page 1:
Items: Computer x5 @ 40000 = 200000

Page 2:
Grand Total: 200000
"""

# Backend Behavior:
# - No CGST/SGST/IGST printed
# - total_tax = 0.0 (not calculated from items)
# - grand_total = 200000 (TRUST printed value)

# ============================================
# EXPECTED DEBUG OUTPUT
# ============================================

"""
DEBUG: Page 1 chunk length: 1500 chars
DEBUG: Page 2 chunk length: 800 chars
DEBUG: Detected batch-only page (batch_count=10, has_items=False)
DEBUG: Page 2 batch-only extraction...
DEBUG: Collected 5 serials from batch-only page
DEBUG: Page 3 chunk length: 600 chars
DEBUG: Detected batch-only page (batch_count=5, has_items=False)
DEBUG: Collected 5 serials from batch-only page
DEBUG: Skipping fake item (no explicit quantity): Part no: ABC123
DEBUG: Skipping fake item (no explicit quantity): Warranty: 3 years
DEBUG: Merged item 'Laptop Dell' from pages [1]: qty=10
WARNING: Serial count mismatch - Quantity: 10, Serials: 8
DEBUG: Bill flagged for manual review: Serial count mismatch: 10 items vs 8 serials
DEBUG: Using PRINTED grand total: 236000
DEBUG: Final bill - Items: 10, Items total: 200000, Tax: 36000, Grand total: 236000
"""

print("Test examples documented successfully!")
print("All new features demonstrated with expected behavior.")
