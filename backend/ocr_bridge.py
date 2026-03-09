"""
OCR Bridge Module
Maps the new regex-based extraction pipeline (ocr regex new/) to the
BillInfo / ExtractedAsset format expected by app.py and the frontend.

Flow:
  raw_text ──► classifier.predict_invoice_type()
           ──► regex_extractor.extract_fields()
           ──► map to BillInfo + ExtractedAsset
"""

import os
import sys
import re
import qrcode
import base64
from io import BytesIO
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import List, Dict, Optional

# Add the "ocr regex new" directory to sys.path so its modules are importable
_OCR_REGEX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ocr regex new")
if _OCR_REGEX_DIR not in sys.path:
    sys.path.insert(0, _OCR_REGEX_DIR)

from classifier import predict_invoice_type
from regex_extractor import extract_fields

# LLM fallback for when regex misses fields
try:
    from llm_fallback import fill_missing_fields, is_llm_available
    _LLM_AVAILABLE = True
except ImportError:
    _LLM_AVAILABLE = False


# ── Dataclasses (same as enhanced_extractor.py) ──────────────────────────

@dataclass
class ExtractedAsset:
    name: str
    description: str
    category: str
    brand: str
    model: str
    serial_number: str
    quantity: int
    unit_price: float
    total_price: float
    warranty_period: str
    hsn_code: str
    device_type: str = ''


@dataclass
class BillInfo:
    bill_number: str
    vendor_name: str
    vendor_gstin: str
    vendor_address: str
    vendor_phone: str
    vendor_email: str
    bill_date: str
    due_date: str
    total_amount: float
    tax_amount: float
    discount: float
    warranty_info: str
    assets: List[ExtractedAsset]


# ── Helper maps ──────────────────────────────────────────────────────────

CATEGORY_KEYWORDS = {
    'computer': ['computer', 'desktop', 'pc', 'cpu', 'tower', 'workstation', 'system'],
    'laptop': ['laptop', 'notebook', 'ultrabook', 'chromebook', 'thinkpad'],
    'printer': ['printer', 'printing', 'inkjet', 'laser', 'multifunction'],
    'monitor': ['monitor', 'display', 'screen', 'lcd', 'led', 'tft'],
    'keyboard': ['keyboard', 'keys'],
    'mouse': ['mouse', 'mice'],
    'tablet': ['tablet', 'ipad'],
    'phone': ['phone', 'mobile', 'smartphone'],
    'camera': ['camera', 'webcam', 'camcorder'],
    'projector': ['projector', 'projection'],
    'scanner': ['scanner', 'scanning'],
    'server': ['server', 'rack'],
    'router': ['router', 'wifi', 'wireless'],
    'switch': ['switch', 'ethernet'],
    'ups': ['ups', 'battery', 'backup'],
    'cable': ['cable', 'wire', 'cord'],
    'adapter': ['adapter', 'charger', 'power', 'convertor'],
    'storage': ['hdd', 'ssd', 'hard drive', 'storage', 'disk'],
    'memory': ['ram', 'memory', 'dimm'],
    'speaker': ['speaker', 'bluetooth speaker'],
    'smartwatch': ['smartwatch', 'fitness band'],
    'television': ['television', 'tv', 'led tv', 'smart tv'],
    'ac': ['ac', 'air conditioner', 'split ac', 'hvac'],
    'smart board': ['smart board', 'interactive board', 'digital board'],
    'other': []
}

DEVICE_TYPE_KEYWORDS = {
    'Computer': ['computer', 'desktop', 'pc', 'cpu', 'tower', 'workstation', 'system unit'],
    'Laptop': ['laptop', 'notebook', 'ultrabook', 'chromebook', 'thinkpad'],
    'Monitor': ['monitor', 'display', 'screen', 'lcd', 'led', 'tft'],
    'Printer': ['printer', 'printing', 'inkjet', 'laser', 'multifunction', 'mfp'],
    'Scanner': ['scanner', 'scanning'],
    'Projector': ['projector', 'projection'],
    'AC': ['ac', 'air conditioner', 'aircon', 'cooling', 'hvac', 'split ac'],
    'Smart Board': ['smart board', 'smartboard', 'interactive board', 'digital board', 'interactive flat panel'],
    'UPS': ['ups', 'uninterruptible power', 'battery backup'],
    'Router': ['router', 'wifi router', 'wireless router', 'broadband router'],
    'Switch': ['switch', 'network switch', 'ethernet switch'],
    'Server': ['server', 'rack server', 'blade server'],
    'Storage Device': ['hdd', 'ssd', 'hard drive', 'storage', 'disk', 'external drive', 'nas'],
    'Camera': ['camera', 'webcam', 'camcorder', 'cctv', 'surveillance'],
    'Television': ['television', 'tv', 'led tv', 'smart tv'],
    'Speaker': ['speaker', 'bluetooth speaker', 'portable speaker'],
}

KNOWN_BRANDS = [
    'Dell', 'HP', 'Lenovo', 'Acer', 'Asus', 'Apple', 'Samsung', 'LG',
    'Sony', 'Logitech', 'Microsoft', 'Epson', 'Canon', 'Brother',
    'TP-Link', 'Cisco', 'Netgear', 'D-Link', 'BenQ', 'Daikin',
    'Voltas', 'Blue Star', 'Raspberry', 'Arduino', 'Zebronics',
    'Realme', 'Boat', 'JBL',
]


# HSN code prefix → generic product description (for fallback when items regex misses)
HSN_DESCRIPTIONS = {
    '8471': 'Computer / Laptop',
    '8528': 'Monitor / Display Unit',
    '8443': 'Printer',
    '8473': 'Computer Parts / Accessories',
    '8517': 'Telephone / Networking Equipment',
    '8521': 'Video Recording Equipment',
    '8525': 'Camera / Surveillance Equipment',
    '8415': 'Air Conditioner',
    '8507': 'UPS / Battery',
    '8534': 'Electronic Circuit / PCB',
    '8472': 'Office Machine',
    '9405': 'LED / Lighting Equipment',
    '8414': 'Fan / Blower',
    '8516': 'Electric Heater / Water Heater',
}


# ── Core bridge class ────────────────────────────────────────────────────

class OcrRegexExtractor:
    """
    Drop-in replacement for EnhancedInvoiceExtractor.
    Uses classifier + regex templates from 'ocr regex new/' folder.
    """

    def extract_bill_info(self, raw_text_or_bytes, use_llm_fallback: bool = True) -> tuple:
        """
        Main entry point — mirrors EnhancedInvoiceExtractor.extract_bill_info().
        Accepts raw text (str) or bytes.
        Returns (BillInfo, raw_text).  BillInfo has an extra attribute
        ``llm_enhanced`` (bool) indicating whether the LLM filled any gaps.
        """
        raw_text = raw_text_or_bytes.decode('utf-8') if isinstance(raw_text_or_bytes, bytes) else raw_text_or_bytes

        # 1. Classify invoice type
        invoice_type = predict_invoice_type(raw_text)
        print(f"[OCR-Bridge] Classifier predicted invoice type: {invoice_type}")

        # 2. Extract fields via regex templates
        fields = extract_fields(raw_text, invoice_type)
        print(f"[OCR-Bridge] Extracted fields: { {k: v for k, v in fields.items() if k != 'items'} }")
        print(f"[OCR-Bridge] Extracted {len(fields.get('items', []))} line items")

        # 3. LLM fallback — fill gaps that regex missed
        llm_enhanced = False
        if use_llm_fallback and _LLM_AVAILABLE:
            try:
                result = fill_missing_fields(fields, raw_text)
                fields = result["fields"]
                llm_enhanced = result["llm_enhanced"]
                if llm_enhanced:
                    print("[OCR-Bridge] LLM fallback filled missing fields")
            except Exception as e:
                print(f"[OCR-Bridge] LLM fallback error (non-fatal): {e}")

        # 4. Map to BillInfo
        bill_info = self._map_to_bill_info(fields, raw_text)
        bill_info.llm_enhanced = llm_enhanced
        return bill_info, raw_text

    # Alias so app.py can also call extract_bill_info_ai
    def extract_bill_info_ai(self, raw_text: str) -> tuple:
        return self.extract_bill_info(raw_text)

    # ── Mapping helpers ──────────────────────────────────────────────────

    def _map_to_bill_info(self, fields: Dict, raw_text: str) -> BillInfo:
        """Convert regex_extractor output dict → BillInfo dataclass."""

        # Tax calculation
        tax_amount = self._calc_tax(fields)

        # Total amount
        total_amount = self._to_float(fields.get('grand_total'))

        # Discount
        discount = self._to_float(fields.get('discount'))

        # Bill date
        bill_date = self._normalize_date(fields.get('invoice_date', ''))

        # Due date (estimate 30 days out if not found)
        due_date = ''
        if bill_date:
            try:
                dt = datetime.strptime(bill_date, '%Y-%m-%d')
                due_date = (dt + timedelta(days=30)).strftime('%Y-%m-%d')
            except ValueError:
                pass

        # Vendor phone / email (not typically in regex templates, extract from raw)
        phone = self._extract_phone(raw_text)
        email = self._extract_email(raw_text)

        # Warranty (global)
        warranty_info = fields.get('warranty', '') or ''

        # Assets
        assets = self._map_items_to_assets(fields, raw_text)

        return BillInfo(
            bill_number=fields.get('invoice_number', '') or '',
            vendor_name=fields.get('vendor_name', '') or '',
            vendor_gstin=fields.get('gstin', '') or '',
            vendor_address=fields.get('vendor_address', '') or '',
            vendor_phone=phone,
            vendor_email=email,
            bill_date=bill_date,
            due_date=due_date,
            total_amount=total_amount,
            tax_amount=tax_amount,
            discount=discount,
            warranty_info=warranty_info,
            assets=assets,
        )

    def _infer_product_description(self, raw_text: str, fields: Dict) -> str:
        """Try to extract a product name from the first table row when full item regex fails."""
        # Try to grab the description cell from the first numbered table row
        m = re.search(r'\|\s*1\s*\|\s*([^|\n]{5,100})', raw_text, re.IGNORECASE)
        if m:
            desc = re.sub(r'\s+', ' ', m.group(1)).strip()
            if len(desc) >= 5:
                return desc
        # HSN-based fallback using lookup table
        hsn = fields.get('hsn_code', '') or ''
        for prefix, name in HSN_DESCRIPTIONS.items():
            if hsn.startswith(prefix):
                return name
        return 'Electronic Device'

    def _map_items_to_assets(self, fields: Dict, raw_text: str = '') -> List[ExtractedAsset]:
        """Convert the items list from regex_extractor → ExtractedAsset list.
        When a line item has qty > 1 and batch/serial numbers exist,
        expand into individual assets and assign serials sequentially."""
        items = fields.get('items', [])
        assets: List[ExtractedAsset] = []

        # Batch / serial numbers extracted globally
        batch_numbers = fields.get('batch_numbers', [])
        if isinstance(batch_numbers, str):
            batch_numbers = [batch_numbers]

        # When no line items were parsed but serial/batch numbers exist,
        # create one asset per serial number using an inferred description.
        if not items and batch_numbers:
            description = self._infer_product_description(raw_text, fields)
            hsn = fields.get('hsn_code', '') or ''
            category = self._classify_category(description)
            device_type = self._detect_device_type(description)
            brand, model = self._extract_brand_model(description)
            print(f"[OCR-Bridge] No line items found — creating {len(batch_numbers)} assets from batch/serial numbers")
            for serial in batch_numbers:
                assets.append(ExtractedAsset(
                    name=description,
                    description=description,
                    category=category,
                    brand=brand,
                    model=model,
                    serial_number=serial,
                    quantity=1,
                    unit_price=0.0,
                    total_price=0.0,
                    warranty_period='',
                    hsn_code=hsn,
                    device_type=device_type,
                ))
            return assets

        # Track which batch number to assign next (sequential across items)
        batch_idx = 0

        for idx, item in enumerate(items):
            description = item.get('description', '').strip()
            if not description:
                continue

            quantity = self._to_int(item.get('quantity', '1'))
            if quantity < 1:
                quantity = 1

            rate = self._to_float(item.get('rate') or item.get('price_per_unit') or item.get('unit_price', '0'))
            total = self._to_float(item.get('total', '0'))
            hsn = item.get('hsn_code', '') or ''

            # If total is 0 but rate and quantity exist, compute
            if total == 0 and rate > 0:
                total = rate * quantity
            # If rate is 0 but total and quantity > 0, compute
            if rate == 0 and total > 0 and quantity > 0:
                rate = total / quantity

            category = self._classify_category(description)
            device_type = self._detect_device_type(description)
            brand, model = self._extract_brand_model(description)

            # Expand: if qty > 1 and we have batch/serial numbers, create
            # one asset per unit with its own serial number.
            if quantity > 1 and batch_numbers:
                print(f"[OCR-Bridge] Expanding item '{description}' qty={quantity} into individual assets")
                for _ in range(quantity):
                    serial = batch_numbers[batch_idx] if batch_idx < len(batch_numbers) else ''
                    batch_idx += 1
                    assets.append(ExtractedAsset(
                        name=description,
                        description=description,
                        category=category,
                        brand=brand,
                        model=model,
                        serial_number=serial,
                        quantity=1,
                        unit_price=rate,
                        total_price=rate,
                        warranty_period='',
                        hsn_code=hsn,
                        device_type=device_type,
                    ))
            else:
                serial = batch_numbers[batch_idx] if batch_idx < len(batch_numbers) else ''
                batch_idx += 1
                assets.append(ExtractedAsset(
                    name=description,
                    description=description,
                    category=category,
                    brand=brand,
                    model=model,
                    serial_number=serial,
                    quantity=quantity,
                    unit_price=rate,
                    total_price=total,
                    warranty_period='',
                    hsn_code=hsn,
                    device_type=device_type,
                ))

        return assets

    # ── Tax helpers ──────────────────────────────────────────────────────

    def _calc_tax(self, fields: Dict) -> float:
        cgst = self._to_float(fields.get('cgst'))
        sgst = self._to_float(fields.get('sgst'))
        igst = self._to_float(fields.get('igst'))
        if cgst or sgst or igst:
            return cgst + sgst + igst
        return 0.0

    # ── Classification helpers ───────────────────────────────────────────

    def _classify_category(self, description: str) -> str:
        desc_lower = description.lower()
        for category, keywords in CATEGORY_KEYWORDS.items():
            if any(kw in desc_lower for kw in keywords):
                return category
        return 'other'

    def _detect_device_type(self, description: str) -> str:
        desc_lower = description.lower()
        for device_type, keywords in DEVICE_TYPE_KEYWORDS.items():
            if any(kw in desc_lower for kw in keywords):
                return device_type
        return ''

    def _extract_brand_model(self, description: str) -> tuple:
        brand = ''
        model = ''
        for known_brand in KNOWN_BRANDS:
            if known_brand.lower() in description.lower():
                brand = known_brand
                # Try to extract model after brand name
                pattern = re.compile(
                    re.escape(known_brand) + r'\s+([A-Za-z0-9][\w\-. ]{1,40})',
                    re.IGNORECASE,
                )
                m = pattern.search(description)
                if m:
                    model = m.group(1).strip()
                break
        return brand, model

    # ── Text-level extraction helpers ────────────────────────────────────

    def _extract_phone(self, text: str) -> str:
        patterns = [
            r'(?:Phone|Tel|Mobile|Contact|Ph|M)[:\s]*([+\d\s\-()]{10,})',
            r'(\+91[\s\-]?\d{10})',
            r'(?<!\d)(\d{10})(?!\d)',
        ]
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                return m.group(1).strip()
        return ''

    def _extract_email(self, text: str) -> str:
        m = re.search(r'([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', text)
        return m.group(1) if m else ''

    # ── Date normalization ───────────────────────────────────────────────

    def _normalize_date(self, date_str: str) -> str:
        """Try to parse various date formats and return YYYY-MM-DD."""
        if not date_str:
            return ''
        date_str = date_str.strip()

        formats = [
            '%d-%b-%Y',   # 15-Jan-2024
            '%d-%b-%y',   # 15-Jan-24
            '%d/%m/%Y',   # 15/01/2024
            '%d-%m-%Y',   # 15-01-2024
            '%d/%m/%y',   # 15/01/24
            '%d-%m-%y',   # 15-01-24
            '%Y-%m-%d',   # 2024-01-15
            '%d %B %Y',   # 15 January 2024
            '%d %b %Y',   # 15 Jan 2024
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        # Return as-is if no format matched
        return date_str

    # ── Numeric helpers ──────────────────────────────────────────────────

    def _to_float(self, value, default: float = 0.0) -> float:
        if value is None:
            return default
        try:
            return float(str(value).replace(',', '').strip())
        except (ValueError, TypeError):
            return default

    def _to_int(self, value, default: int = 0) -> int:
        if value is None:
            return default
        try:
            return int(float(str(value).replace(',', '').strip()))
        except (ValueError, TypeError):
            return default

    # ── QR code (same as enhanced_extractor) ─────────────────────────────

    def generate_qr_code(self, data: str) -> str:
        try:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(data)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            return f"data:image/png;base64,{img_str}"
        except Exception as e:
            print(f"Error generating QR code: {e}")
            return ""
