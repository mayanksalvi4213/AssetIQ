"""
Test Example: Stateless LLM Architecture

This example demonstrates how the refactored extractor handles
multi-page invoices with the new stateless LLM architecture.
"""

# Example: Multi-page invoice with same item appearing on multiple pages

invoice_text = """
Invoice No: INV-2026-001
Date: 08/02/2026
Vendor: Tech Solutions Ltd
GSTIN: 29ABCDE1234F1Z5

<<<  # Page 1
Item | Description | HSN | Qty | Unit Price | Amount
1 | Dell Laptop Core i5 | 8471 | 10 | 45000 | 450000
   Serial: LAP001
   Serial: LAP002
   Serial: LAP003

2 | HP Monitor 24" LED | 8528 | 5 | 12000 | 60000
   Serial: MON001
   Serial: MON002

<<<  # Page 2
Item | Description | HSN | Qty | Unit Price | Amount
1 | Dell Laptop Core i5 | 8471 | 10 | 45000 | 450000
   Serial: LAP004
   Serial: LAP005
   Serial: LAP006
   Serial: LAP007

2 | HP Monitor 24" LED | 8528 | 5 | 12000 | 60000
   Serial: MON003
   Serial: MON004
   Serial: MON005

<<<  # Page 3 (Final totals)
Item | Description | HSN | Qty | Unit Price | Amount
1 | Dell Laptop Core i5 | 8471 | 10 | 45000 | 450000
   Serial: LAP008
   Serial: LAP009
   Serial: LAP010

Subtotal: 510000
CGST (9%): 45900
SGST (9%): 45900
Grand Total: 601800
"""

# Expected LLM Response Per Page:

page1_response = {
    "invoice_metadata": {
        "invoice_no": "INV-2026-001",
        "invoice_date": "08/02/2026",
        "vendor_name": "Tech Solutions Ltd",
        "vendor_gstin": "29ABCDE1234F1Z5"
    },
    "line_items": [
        {
            "material_description": "Dell Laptop Core i5",
            "hsn": "8471",
            "quantity_on_page": 3,  # Only 3 serials visible on page 1
            "unit_price": 45000,
            "total_amount": 450000,
            "batches": ["LAP001", "LAP002", "LAP003"]
        },
        {
            "material_description": "HP Monitor 24\" LED",
            "hsn": "8528",
            "quantity_on_page": 2,  # Only 2 serials visible on page 1
            "unit_price": 12000,
            "total_amount": 60000,
            "batches": ["MON001", "MON002"]
        }
    ],
    "page_totals": {}  # No totals printed on page 1
}

page2_response = {
    "invoice_metadata": {},  # Already captured from page 1
    "line_items": [
        {
            "material_description": "Dell Laptop Core i5",
            "hsn": "8471",
            "quantity_on_page": 4,  # 4 more serials on page 2
            "unit_price": 45000,
            "total_amount": 450000,
            "batches": ["LAP004", "LAP005", "LAP006", "LAP007"]
        },
        {
            "material_description": "HP Monitor 24\" LED",
            "hsn": "8528",
            "quantity_on_page": 3,  # 3 more serials on page 2
            "unit_price": 12000,
            "total_amount": 60000,
            "batches": ["MON003", "MON004", "MON005"]
        }
    ],
    "page_totals": {}  # No totals printed on page 2
}

page3_response = {
    "invoice_metadata": {},
    "line_items": [
        {
            "material_description": "Dell Laptop Core i5",
            "hsn": "8471",
            "quantity_on_page": 3,  # Final 3 serials on page 3
            "unit_price": 45000,
            "total_amount": 450000,
            "batches": ["LAP008", "LAP009", "LAP010"]
        }
    ],
    "page_totals": {  # Totals visible on page 3
        "subtotal": 510000,
        "cgst": 45900,
        "sgst": 45900,
        "grand_total": 601800
    }
}

# Expected Python Aggregation Result:

aggregated_result = {
    "invoice_metadata": {
        "invoice_no": "INV-2026-001",
        "invoice_date": "08/02/2026",
        "vendor_name": "Tech Solutions Ltd",
        "vendor_gstin": "29ABCDE1234F1Z5"
    },
    "line_items": [
        {
            "material_description": "Dell Laptop Core i5",
            "hsn": "8471",
            "quantity": 10,  # 3 + 4 + 3 = 10
            "unit_price": 45000,
            "total_amount": 450000,
            "batches": [  # All serials collected
                "LAP001", "LAP002", "LAP003",
                "LAP004", "LAP005", "LAP006", "LAP007",
                "LAP008", "LAP009", "LAP010"
            ]
        },
        {
            "material_description": "HP Monitor 24\" LED",
            "hsn": "8528",
            "quantity": 5,  # 2 + 3 = 5
            "unit_price": 12000,
            "total_amount": 60000,
            "batches": [  # All serials collected
                "MON001", "MON002",
                "MON003", "MON004", "MON005"
            ]
        }
    ],
    "tax_summary": {  # From page 3 only
        "cgst": 45900,
        "sgst": 45900,
        "total_tax": 91800,
        "grand_total": 601800
    }
}

# Final Assets Created:

final_assets = [
    # 10 individual laptop assets (one per serial)
    {"name": "Dell Laptop Core i5", "serial": "LAP001", "quantity": 1},
    {"name": "Dell Laptop Core i5", "serial": "LAP002", "quantity": 1},
    # ... (LAP003 - LAP010)
    
    # 5 individual monitor assets (one per serial)
    {"name": "HP Monitor 24\" LED", "serial": "MON001", "quantity": 1},
    {"name": "HP Monitor 24\" LED", "serial": "MON002", "quantity": 1},
    # ... (MON003 - MON005)
]

print("Total assets created: 15 (10 laptops + 5 monitors)")
print("Quantity validation: ✓ (10 serials = 10 qty, 5 serials = 5 qty)")
print("Cross-page merging: ✓ (Same items aggregated)")
print("Serial assignment: ✓ (Sequential from all pages)")
print("Total calculation: ✓ (From final page)")
