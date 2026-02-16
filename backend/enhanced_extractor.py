import re
import json
import os
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass
import qrcode
from io import BytesIO
import base64

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
    device_type: str = ''  # Auto-detected device type

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

class EnhancedInvoiceExtractor:
    
    def __init__(self):
        """Initialize the extractor with category keywords"""
        # Category keywords for asset classification
        self.category_keywords = {
            'computer': ['computer', 'desktop', 'pc', 'cpu', 'tower', 'workstation', 'system'],
            'laptop': ['laptop', 'notebook', 'ultrabook', 'chromebook'],
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
            'grocery': ['besan', 'oil', 'cookies', 'biscuit', 'sugar', 'dal', 'soap', 'chana', 'masoor'],
            'other': []
        }
        
        # Device type keywords for auto-tagging
        self.device_type_keywords = {
            'Computer': ['computer', 'desktop', 'pc', 'cpu', 'tower', 'workstation', 'system unit'],
            'Laptop': ['laptop', 'notebook', 'ultrabook', 'chromebook'],
            'Monitor': ['monitor', 'display', 'screen', 'lcd', 'led', 'tft'],
            'Printer': ['printer', 'printing', 'inkjet', 'laser', 'multifunction', 'mfp'],
            'Scanner': ['scanner', 'scanning'],
            'Projector': ['projector', 'projection'],
            'AC': ['ac', 'air conditioner', 'aircon', 'cooling', 'hvac', 'split ac'],
            'Smart Board': ['smart board', 'smartboard', 'interactive board', 'digital board'],
            'UPS': ['ups', 'uninterruptible power', 'battery backup'],
            'Router': ['router', 'wifi router', 'wireless router', 'broadband router'],
            'Switch': ['switch', 'network switch', 'ethernet switch'],
            'Server': ['server', 'rack server', 'blade server'],
            'Storage Device': ['hdd', 'ssd', 'hard drive', 'storage', 'disk', 'external drive', 'nas'],
            'Camera': ['camera', 'webcam', 'camcorder', 'cctv', 'surveillance'],
        }

        # Local LLM configuration
        self.local_llm_url = os.getenv("LOCAL_LLM_URL", "http://127.0.0.1:8080").rstrip("/")
        self.local_llm_model = os.getenv("LOCAL_LLM_MODEL", "qwen2.5-3b-instruct-q4_k_m.gguf")
        self.local_llm_timeout = int(os.getenv("LOCAL_LLM_TIMEOUT", "180"))
        # Use more of the 4096 token context: ~2500 tokens = ~10000 chars
        self.local_llm_max_tokens = int(os.getenv("LOCAL_LLM_MAX_TOKENS", "1024"))  # Increased for many items
        self.local_llm_chunk_chars = int(os.getenv("LOCAL_LLM_CHUNK_CHARS", "8000"))  # Increased significantly
        self.local_llm_max_item_lines = int(os.getenv("LOCAL_LLM_MAX_ITEM_LINES", "500"))  # More item lines
        self.ai_only_mode = os.getenv("AI_ONLY_MODE", "false").lower() in ("1", "true", "yes")
    
    def extract_vendor_info(self, text: str) -> Dict:
        """Extract vendor information - works with multiple formats"""
        vendor_info = {
            'name': '',
            'gstin': '',
            'address': '',
            'phone': '',
            'email': ''
        }
        
        lines = text.split('\n')
        
        # Extract vendor name - look for company keywords or first bold/prominent line
        company_keywords = ['LLP', 'Ltd', 'Limited', 'Pvt', 'Solutions', 'Technologies', 'Industries', 
                           'Corporation', 'Company', 'Co.', 'Inc', 'Enterprises', 'Services', 'Systems',
                           'Trust', 'Institute', 'Kirana', 'Shop', 'Store']
        
        for i, line in enumerate(lines[:30]):
            line_clean = line.strip().replace('|', '').strip()
            # Skip common non-vendor lines
            if any(skip in line_clean for skip in ['E-Way Bill', 'E-WAY', 'Tax Invoice', 'ORIGINAL', 'Invoice No', 'Generated', 'Bill To', 'Ship To', 'Page', 'Dated', 'Delivery Note']):
                continue
            # Only match if line is reasonably short (company names aren't super long)
            if len(line_clean) > 3 and len(line_clean) < 100 and any(keyword in line_clean for keyword in company_keywords):
                vendor_info['name'] = line_clean
                break
        
        # If no company name found, use first substantial line
        if not vendor_info['name']:
            for line in lines[:15]:
                line_clean = line.strip().replace('|', '').strip()
                skip_terms = ['invoice', 'bill', 'receipt', 'tax', 'page', 'gstin', 'e-way', 'generated', 'mode:', 'type:', 'dated', 'delivery']
                if len(line_clean) > 5 and len(line_clean) < 100 and not any(skip in line_clean.lower() for skip in skip_terms):
                    vendor_info['name'] = line_clean
                    break
        
        # Extract GSTIN - multiple patterns (handles ## masked digits)
        gstin_patterns = [
            r'GSTIN[/:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})',
            r'GST[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})',
            r'UIN[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})',
            r'([0-9]{2}[A-Z#]{5}[0-9#]{4}[A-Z#]{1}[1-9A-Z#]{1}Z[0-9A-Z#]{1})',  # Handles masked GSTIN
            r'([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[A-Z]{1}[0-9A-Z]{1})'  # Alternative format
        ]
        
        for pattern in gstin_patterns:
            gstin_match = re.search(pattern, text, re.IGNORECASE)
            if gstin_match:
                vendor_info['gstin'] = gstin_match.group(1)
                break
        
        # Extract phone - various formats
        phone_patterns = [
            r'(?:Phone|Tel|Mobile|Contact)[:\s]*([+\d\s\-()]{10,})',
            r'(?:Ph|M)[:\s]*([+\d\s\-()]{10,})',
            r'(\+91[\s\-]?\d{10})',
            r'Mobile[:\s]*(\d{10})',
            r'(\d{10})'
        ]
        
        for pattern in phone_patterns:
            phone_match = re.search(pattern, text, re.IGNORECASE)
            if phone_match:
                vendor_info['phone'] = phone_match.group(1).strip()
                break
        
        # Extract email
        email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', text)
        if email_match:
            vendor_info['email'] = email_match.group(1)
        
        # Extract address - be flexible
        if vendor_info['name']:
            address_lines = []
            capturing = False
            for i, line in enumerate(lines[:50]):
                line_clean = line.strip().replace('|', '').strip()
                
                if vendor_info['name'] in line:
                    capturing = True
                    continue
                
                if capturing:
                    # Stop at GSTIN or invoice details
                    stop_terms = ['GSTIN', 'INVOICE', 'BILL NO', 'DATE', 'E-WAY', 'GENERATED', 'MODE:', 'TYPE:', 'BILL TO', 'SHIP TO']
                    if any(stop in line_clean.upper() for stop in stop_terms):
                        break
                    
                    # Collect address-like lines
                    if len(line_clean) > 5 and not line_clean.startswith('+') and not line_clean.startswith('-'):
                        # Filter out lines that are clearly not address
                        if not any(skip in line_clean.lower() for skip in ['invoice', 'page', 'original', 'recipient']):
                            address_lines.append(line_clean)
                    
                    if len(address_lines) >= 3:
                        break
            
            vendor_info['address'] = ', '.join(address_lines[:3])
        
        return vendor_info
    
    def extract_bill_details(self, text: str) -> Dict:
        """Extract bill details - flexible patterns for various formats"""
        bill_details = {
            'bill_number': '',
            'bill_date': '',
            'due_date': '',
            'total_amount': 0.0,
            'tax_amount': 0.0,
            'discount': 0.0
        }
        
        print("DEBUG: Extracting bill details...")
        
        # Extract invoice/bill number - multiple patterns
        invoice_patterns = [
            r'Invoice\s*(?:No|Number|#)[:\s]*([A-Z0-9/-]+)',
            r'Bill\s*(?:No|Number|#)[:\s]*([A-Z0-9/-]+)',
            r'Receipt\s*(?:No|Number|#)[:\s]*([A-Z0-9/-]+)',
            r'(?:INV|BILL)[:\s-]*([A-Z0-9/-]+)',
            r'([A-Z]{2,}[/-]\d{2,}[/-]\d+)',  # Pattern like TTS/22-23/0499
        ]
        
        for pattern in invoice_patterns:
            invoice_match = re.search(pattern, text, re.IGNORECASE)
            if invoice_match:
                candidate = invoice_match.group(1).strip()
                # Basic validation: must contain at least one digit and be reasonably long
                if len(candidate) >= 4 and re.search(r"\d", candidate):
                    bill_details['bill_number'] = candidate
                    print(f"DEBUG: Found invoice number: {bill_details['bill_number']}")
                    break
                else:
                    print(f"DEBUG: Ignored weak invoice candidate: {candidate}")
        
        # Extract date - multiple formats
        date_patterns = [
            (r'(?:Date|Dated)[:\s]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})', '%d-%m-%Y'),
            (r'(?:Date|Dated)[:\s]*(\d{1,2}-[A-Za-z]{3}-\d{4})', '%d-%b-%Y'),
            (r'(?:Date|Dated)[:\s]*(\d{1,2}\s+[A-Za-z]+\s+\d{4})', '%d %B %Y'),
            (r'(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})', '%d-%m-%Y'),
            (r'(\d{1,2}-[A-Za-z]{3}-\d{4})', '%d-%b-%Y'),
            (r'(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})', '%Y-%m-%d'),
        ]
        
        for pattern, date_format in date_patterns:
            date_match = re.search(pattern, text, re.IGNORECASE)
            if date_match:
                date_str = date_match.group(1)
                print(f"DEBUG: Found date: {date_str}")
                try:
                    # Try multiple date formats
                    for fmt in [date_format, '%d/%m/%Y', '%d.%m.%Y', '%d-%m-%Y', '%d-%b-%Y', '%d %B %Y', '%Y-%m-%d']:
                        try:
                            date_obj = datetime.strptime(date_str.strip(), fmt)
                            bill_details['bill_date'] = date_obj.strftime('%Y-%m-%d')
                            break
                        except:
                            continue
                    if bill_details['bill_date']:
                        break
                except Exception as e:
                    print(f"DEBUG: Date parsing error: {e}")
                    bill_details['bill_date'] = date_str
                    break
        
        # Extract due date
        due_date_patterns = [
            r'Due\s*Date[:\s]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})',
            r'Payment\s*Due[:\s]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})',
        ]
        
        for pattern in due_date_patterns:
            due_match = re.search(pattern, text, re.IGNORECASE)
            if due_match:
                due_str = due_match.group(1)
                try:
                    for fmt in ['%d-%m-%Y', '%d/%m/%Y', '%d.%m.%Y', '%Y-%m-%d']:
                        try:
                            due_obj = datetime.strptime(due_str, fmt)
                            bill_details['due_date'] = due_obj.strftime('%Y-%m-%d')
                            break
                        except:
                            continue
                    if bill_details['due_date']:
                        break
                except:
                    pass
        
        # Calculate due date from payment terms if not found
        if not bill_details['due_date'] and bill_details['bill_date']:
            payment_terms_match = re.search(r'(\d+)\s*Days?', text, re.IGNORECASE)
            if payment_terms_match:
                days = int(payment_terms_match.group(1))
                try:
                    bill_date_obj = datetime.strptime(bill_details['bill_date'], '%Y-%m-%d')
                    due_date_obj = bill_date_obj + timedelta(days=days)
                    bill_details['due_date'] = due_date_obj.strftime('%Y-%m-%d')
                except:
                    pass
        
        # Extract amounts - find all monetary values and identify the largest as total
        amount_patterns = [
            r'(?:Total|Grand Total|Net Amount)[:\s]*(?:₹|Rs\.?|INR)?[\s]*([\d,]+\.?\d*)',
            r'(?:Amount Payable|Amount Due)[:\s]*(?:₹|Rs\.?|INR)?[\s]*([\d,]+\.?\d*)',
            r'₹\s*([\d,]+\.?\d*)',
            r'Rs\.?\s*([\d,]+\.?\d*)',
            r'INR\s*([\d,]+\.?\d*)'
        ]
        
        all_amounts = []
        for pattern in amount_patterns[:2]:  # Priority patterns first
            total_match = re.search(pattern, text, re.IGNORECASE)
            if total_match:
                amount_str = total_match.group(1).replace(',', '')
                try:
                    amount = float(amount_str)
                    if amount > 0:
                        bill_details['total_amount'] = amount
                        print(f"DEBUG: Found total amount: {bill_details['total_amount']}")
                        break
                except:
                    continue
        
        # If still not found, find all amounts and take the largest
        if bill_details['total_amount'] == 0.0:
            for pattern in amount_patterns[2:]:
                for match in re.finditer(pattern, text):
                    amount_str = match.group(1).replace(',', '')
                    try:
                        amount = float(amount_str)
                        if amount > 100:  # Filter out small numbers
                            all_amounts.append(amount)
                    except:
                        continue
            
            if all_amounts:
                bill_details['total_amount'] = max(all_amounts)
                print(f"DEBUG: Found total amount (max): {bill_details['total_amount']}")
        
        # Extract tax amounts
        tax_patterns = [
            r'(?:Total Tax|Tax Amount)[:\s]*(?:₹|Rs\.?)?[\s]*([\d,]+\.?\d*)',
            r'CGST[:\s]*(?:₹|Rs\.?)?[\s]*([\d,]+\.?\d*)',
            r'SGST[:\s]*(?:₹|Rs\.?)?[\s]*([\d,]+\.?\d*)',
            r'IGST[:\s]*(?:₹|Rs\.?)?[\s]*([\d,]+\.?\d*)',
            r'GST[:\s]*(?:₹|Rs\.?)?[\s]*([\d,]+\.?\d*)'
        ]
        
        # Try total tax first
        total_tax_match = re.search(tax_patterns[0], text, re.IGNORECASE)
        if total_tax_match:
            bill_details['tax_amount'] = float(total_tax_match.group(1).replace(',', ''))
            print(f"DEBUG: Found tax amount: {bill_details['tax_amount']}")
        else:
            # Sum CGST + SGST or use IGST
            cgst = sgst = igst = 0.0
            
            cgst_matches = re.findall(tax_patterns[1], text, re.IGNORECASE)
            if cgst_matches:
                cgst = sum(float(m.replace(',', '')) for m in cgst_matches)
            
            sgst_matches = re.findall(tax_patterns[2], text, re.IGNORECASE)
            if sgst_matches:
                sgst = sum(float(m.replace(',', '')) for m in sgst_matches)
            
            igst_matches = re.findall(tax_patterns[3], text, re.IGNORECASE)
            if igst_matches:
                igst = sum(float(m.replace(',', '')) for m in igst_matches)
            
            if cgst > 0 or sgst > 0:
                bill_details['tax_amount'] = cgst + sgst
                print(f"DEBUG: Found tax amount: CGST={cgst}, SGST={sgst}, Total={bill_details['tax_amount']}")
            elif igst > 0:
                bill_details['tax_amount'] = igst
                print(f"DEBUG: Found tax amount: IGST={igst}")
        
        # Extract discount
        discount_patterns = [
            r'Discount[:\s]*(?:₹|Rs\.?)?[\s]*([\d,]+\.?\d*)',
            r'Less[:\s]*(?:₹|Rs\.?)?[\s]*([\d,]+\.?\d*)'
        ]
        
        for pattern in discount_patterns:
            discount_match = re.search(pattern, text, re.IGNORECASE)
            if discount_match:
                bill_details['discount'] = float(discount_match.group(1).replace(',', ''))
                break
        
        print(f"DEBUG: Bill details extracted: {bill_details}")
        return bill_details
    
    def extract_assets(self, text: str) -> List[ExtractedAsset]:
        """Extract asset information - comprehensive system for various invoice formats"""
        assets = []
        
        print("DEBUG: Extracting assets from invoice...")
        
        # Comprehensive patterns for different invoice formats:
        # Format 1: E-Way Bill format (HSN | Product | Qty | Amount | Tax)
        # Format 2: Tax Invoice format (SI | Description | HSN | Qty | Rate | Amount)
        # Format 3: Kirana Bill format (S.No | Items | HSN | QTY | RATE | TAX | AMOUNT)
        # Format 4: Simple format without pipes
        
        item_patterns = [
            # Pattern 1: E-Way Bill style - | HSN | Product | Qty | Amount | Tax rates...
            r'\|\s*(\d{4,8})\s*\|\s*([^|]+?)\s*\|\s*([\d.]+)\s*\|\s*([\d,]+\.?\d*)\s*\|',
            
            # Pattern 2: Tax Invoice with serial number - | SN | Description | HSN | Qty Pcs | Rate | Amount |
            r'\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(\d{4,8})\s*\|\s*([\d.]+)\s*(?:Pcs|pcs|PCS|Nos|nos|NOS|BOR|PET)\s*\|\s*([\d,]+\.?\d*)\s*\|\s*(?:Pcs|pcs|PCS|Nos|nos|NOS|BOR|PET)\s*\|\s*([\d,]+\.?\d*)\s*\|',
            
            # Pattern 3: Kirana Bill style - | SN | ITEMS | HSN | QTY. | RATE | TAX | AMOUNT |
            r'\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([.\-\d]*)\s*\|\s*([\d.]+)\s*(?:PCS|Pcs|pcs|BOR|PET)\s*\|\s*([\d,]+\.?\d*)\s*\|\s*([^|]*)\s*\|\s*([\d,]+\.?\d*)\s*\|',
            
            # Pattern 4: Without HSN - | SN | Description | Qty | Rate | Amount |
            r'\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([\d.]+)\s*(?:Pcs|pcs|PCS|Nos|nos|NOS|BOR|PET)?\s*\|\s*([\d,]+\.?\d*)\s*\|\s*([\d,]+\.?\d*)\s*\|',
            
            # Pattern 5: Goods Details table - simpler format
            r'([^|]*(?:Computer|Laptop|Monitor|Keyboard|Mouse|Printer|Scanner|UPS|Server|Router|Switch|Cable|Adapter|Item \d+)[^|]*)\s+(\d+\.?\d*)\s+(?:Pcs|pcs|PCS|Nos|nos|NOS)?\s*([\d,]+\.?\d*)\s+([\d,]+\.?\d*)',
        ]
        
        lines = text.split('\n')
        current_item = None
        current_batches = []
        collecting_details = False
        detail_lines = []
        found_items = []
        
        # Track which pattern is being used
        pattern_used = None
        
        for i, line in enumerate(lines):
            # Skip separator lines and headers
            if (line.strip().startswith('+') or line.strip().startswith('-') or 
                len(line.strip()) < 3 or 'Description of Goods' in line or
                'HSN/SAC' in line and 'Quantity' in line):
                continue
            
            # Skip table headers
            if any(header in line.upper() for header in ['S.NO.', 'SI NO.', 'ITEMS', 'HSN CODE', 'PRODUCT NAME', 'TAXABLE AMOUNT']):
                continue
            
            # Try Pattern 1: E-Way Bill format (HSN first)
            match = re.search(item_patterns[0], line)
            if match and not pattern_used:
                hsn_code = match.group(1)
                description = match.group(2).strip()
                quantity = float(match.group(3))
                total_price = float(match.group(4).replace(',', ''))
                
                # Skip if it looks like a total row
                if 'Total' in description or 'Tot.' in description:
                    continue
                
                category = self._classify_asset_category(description)
                brand, model = self._extract_brand_model(description)
                device_type = self._detect_device_type(description)
                
                asset = ExtractedAsset(
                    name=description,
                    description=description,
                    category=category,
                    brand=brand,
                    model=model,
                    serial_number='',
                    quantity=int(quantity),
                    unit_price=total_price / quantity if quantity > 0 else 0.0,
                    total_price=total_price,
                    warranty_period='',
                    hsn_code=hsn_code,
                    device_type=device_type
                )
                assets.append(asset)
                found_items.append(description)
                print(f"DEBUG: Found item (E-Way Bill format): {description}, Qty: {quantity}, HSN: {hsn_code}")
                pattern_used = 1
                continue
            
            # Try Pattern 2: Tax Invoice with HSN (SI | Description | HSN | Qty | Rate | Unit | Amount)
            match = re.search(item_patterns[1], line)
            if match:
                if current_item:
                    self._finalize_asset(current_item, current_batches, detail_lines, assets)
                
                sl_no = match.group(1)
                description = match.group(2).strip()
                hsn_code = match.group(3)
                quantity = float(match.group(4))
                unit_price = float(match.group(5).replace(',', ''))
                total_price = float(match.group(6).replace(',', ''))
                
                # Skip if it's a batch line, total row, or specification line
                skip_terms = ['Batch', 'Total', 'CGST', 'SGST', 'Model:', 'Part no:', 'Warranty:', 'with mini', 'No Warranty', 'convertor', 'converter']
                if any(term in description for term in skip_terms):
                    continue
                
                category = self._classify_asset_category(description)
                brand, model = self._extract_brand_model(description)
                device_type = self._detect_device_type(description)
                
                current_item = ExtractedAsset(
                    name=description,
                    description=description,
                    category=category,
                    brand=brand,
                    model=model,
                    serial_number='',
                    quantity=int(quantity),
                    unit_price=unit_price,
                    total_price=total_price,
                    warranty_period='',
                    hsn_code=hsn_code,
                    device_type=device_type
                )
                current_batches = []
                detail_lines = []
                collecting_details = True
                found_items.append(description)
                print(f"DEBUG: Found item (Tax Invoice format): {description}, Qty: {quantity}, HSN: {hsn_code}")
                pattern_used = 2
                continue
            
            # Try Pattern 3: Kirana Bill format (S.No | ITEMS | HSN | QTY | RATE | TAX | AMOUNT)
            match = re.search(item_patterns[2], line)
            if match:
                sl_no = match.group(1)
                description = match.group(2).strip()
                hsn_code = match.group(3) if match.group(3) and match.group(3).strip() not in ['.', '-', ''] else ''
                quantity = float(match.group(4))
                unit_price = float(match.group(5).replace(',', ''))
                total_price = float(match.group(7).replace(',', ''))
                
                # Skip if it's a total row
                if 'TOTAL' in description.upper() or 'RECEIVED' in description.upper() or 'BALANCE' in description.upper():
                    continue
                
                category = self._classify_asset_category(description)
                brand, model = self._extract_brand_model(description)
                device_type = self._detect_device_type(description)
                
                asset = ExtractedAsset(
                    name=description,
                    description=description,
                    category=category,
                    brand=brand,
                    model=model,
                    serial_number='',
                    quantity=int(quantity),
                    unit_price=unit_price,
                    total_price=total_price,
                    warranty_period='',
                    hsn_code=hsn_code,
                    device_type=device_type
                )
                assets.append(asset)
                found_items.append(description)
                print(f"DEBUG: Found item (Kirana format): {description}, Qty: {quantity}")
                pattern_used = 3
                continue
            
            # Try Pattern 4: Without HSN (SI | Description | Qty | Rate | Amount)
            if not pattern_used or pattern_used == 2:
                match = re.search(item_patterns[3], line)
                if match:
                    sl_no = match.group(1)
                    description = match.group(2).strip()
                    quantity = float(match.group(3))
                    unit_price = float(match.group(4).replace(',', ''))
                    total_price = float(match.group(5).replace(',', ''))
                    
                    # Skip if it's a batch line, total row, or specification line
                    skip_terms = ['Batch', 'Total', 'CGST', 'SGST', 'Model:', 'Part no:', 'Warranty:', 'with mini', 'No Warranty', 'convertor', 'converter', 'with', 'Limited by']
                    if any(term in description for term in skip_terms):
                        continue
                    
                    # Skip if description is too short (likely not a real item)
                    if len(description.strip()) < 5:
                        continue
                    
                    category = self._classify_asset_category(description)
                    brand, model = self._extract_brand_model(description)
                    device_type = self._detect_device_type(description)
                    
                    asset = ExtractedAsset(
                        name=description,
                        description=description,
                        category=category,
                        brand=brand,
                        model=model,
                        serial_number='',
                        quantity=int(quantity),
                        unit_price=unit_price,
                        total_price=total_price,
                        warranty_period='',
                        hsn_code='',
                        device_type=device_type
                    )
                    assets.append(asset)
                    found_items.append(description)
                    print(f"DEBUG: Found item (Simple format): {description}, Qty: {quantity}")
                    continue
            
            # Collect batch/serial numbers if we're in an item section
            if collecting_details and current_item:
                batch_patterns = [
                    r'Batch\s*:?\s*([A-Z0-9]+)',
                    r'Serial\s*:?\s*([A-Z0-9]+)',
                    r'S/?N\s*:?\s*([A-Z0-9]+)',
                ]
                
                for pattern in batch_patterns:
                    batch_match = re.search(pattern, line, re.IGNORECASE)
                    if batch_match:
                        current_batches.append(batch_match.group(1))
                        print(f"DEBUG: Found batch/serial: {batch_match.group(1)}")
                        break
                
                # Collect detail lines (Model, Part no, Warranty, etc.)
                if '|' in line:
                    detail_match = re.search(r'\|\s*([^|]+?)\s*\|', line)
                    if detail_match:
                        detail_text = detail_match.group(1).strip()
                        # Include lines that start with common specification keywords
                        spec_starters = ['Model:', 'Part no:', 'Warranty:', 'with', 'No Warranty', 'Brand:', 'Serial:']
                        is_spec_line = any(detail_text.startswith(starter) for starter in spec_starters)
                        
                        if (detail_text and 
                            len(detail_text) > 3 and
                            not detail_text.startswith('+') and
                            not detail_text.startswith('-') and
                            'Batch' not in detail_text and
                            detail_text not in found_items and
                            not detail_text.replace(',', '').replace('.', '').isdigit() and
                            (is_spec_line or not any(skip in detail_text for skip in ['CGST', 'SGST', 'Total']))):
                            detail_lines.append(detail_text)
                            print(f"DEBUG: Collected detail line: {detail_text[:50]}...")
                
                # Check for end of item details
                if any(end_marker in line for end_marker in ['| Total |', '| CGST |', '| SGST |', '| Tax |', 'HSN/SAC', 'Amount in Words', 'Company\'s Bank', 'Tax Amount (in words)']):
                    collecting_details = False
        
        # Finalize last item if exists
        if current_item:
            self._finalize_asset(current_item, current_batches, detail_lines, assets)
        
        # If no items found with table patterns, try simple text extraction
        if not assets:
            print("DEBUG: No items found with table patterns, trying text extraction...")
            assets = self._extract_assets_from_text(text)
        
        print(f"DEBUG: Total assets extracted: {len(assets)}")
        return assets
    
    def _extract_assets_from_text(self, text: str) -> List[ExtractedAsset]:
        """Fallback method to extract assets from plain text"""
        assets = []
        lines = text.split('\n')
        
        # Look for item descriptions followed by quantity and amounts
        for i, line in enumerate(lines):
            line_clean = line.strip()
            
            # Check if line contains product keywords
            product_found = False
            for category, keywords in self.category_keywords.items():
                if category != 'other' and any(keyword in line_clean.lower() for keyword in keywords):
                    product_found = True
                    break
            
            if not product_found:
                continue
            
            # Try to extract quantity and prices from this line or nearby lines
            qty_pattern = r'(\d+\.?\d*)\s*(?:Pcs|pcs|PCS|Nos|nos|NOS|Qty|qty|QTY)'
            price_pattern = r'(?:₹|Rs\.?|INR)?\s*([\d,]+\.?\d*)'
            
            qty_match = re.search(qty_pattern, line_clean)
            price_matches = re.findall(price_pattern, line_clean)
            
            quantity = int(float(qty_match.group(1))) if qty_match else 1
            
            # Extract description (clean up)
            description = re.sub(r'\d+\.?\d*\s*(?:Pcs|pcs|PCS|Nos|nos|NOS|Qty|qty|QTY)', '', line_clean)
            description = re.sub(r'(?:₹|Rs\.?|INR)?\s*[\d,]+\.?\d*', '', description)
            description = description.strip('| \t')
            
            if len(description) < 5:
                continue
            
            # Extract prices
            unit_price = 0.0
            total_price = 0.0
            
            if len(price_matches) >= 2:
                unit_price = float(price_matches[-2].replace(',', ''))
                total_price = float(price_matches[-1].replace(',', ''))
            elif len(price_matches) == 1:
                total_price = float(price_matches[0].replace(',', ''))
                unit_price = total_price / quantity if quantity > 0 else total_price
            
            category = self._classify_asset_category(description)
            brand, model = self._extract_brand_model(description)
            device_type = self._detect_device_type(description)
            
            asset = ExtractedAsset(
                name=description,
                description=description,
                category=category,
                brand=brand,
                model=model,
                serial_number='',
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
                warranty_period='',
                hsn_code='',
                device_type=device_type
            )
            
            assets.append(asset)
            print(f"DEBUG: Found item (text extraction): {description}, Qty: {quantity}")
        
        return assets
    
    def _finalize_asset(self, asset: ExtractedAsset, batches: List[str], details: List[str], assets_list: List[ExtractedAsset]):
        """Finalize an asset by adding batches and details"""
        # Add serial numbers (batches)
        if batches:
            asset.serial_number = ','.join(batches)
        
        # Build detailed description from detail lines
        if details:
            # Extract specific info
            for detail in details:
                # Skip if detail is just numbers or too short
                if len(detail.strip()) < 3 or detail.strip().replace(',', '').replace('.', '').isdigit():
                    continue
                
                # Extract part number
                if 'Part no' in detail or 'Part No' in detail or 'Part#' in detail:
                    part_match = re.search(r'Part\s*[nN]o[:#\s]*([A-Z0-9-]+)', detail, re.IGNORECASE)
                    if part_match and not asset.model:
                        asset.model = part_match.group(1)
                
                # Extract model
                if 'Model' in detail:
                    model_match = re.search(r'Model[:#\s]*([A-Z0-9-]+)', detail, re.IGNORECASE)
                    if model_match and not asset.model:
                        asset.model = model_match.group(1)
                
                # Extract warranty - combine all warranty-related lines
                if 'Warranty' in detail or 'warranty' in detail or 'No Warranty' in detail:
                    if asset.warranty_period:
                        asset.warranty_period += ' | ' + detail
                    else:
                        asset.warranty_period = detail
                
                # Look for specifications and accessories
                spec_keywords = ['CORE', 'GB', 'RAM', 'SSD', 'HDD', 'WIN', 'LED', 'LCD', 'INCH', 'GHz', 'TB', 'MHz']
                accessory_keywords = ['with', 'convertor', 'converter', 'cable', 'adapter', 'includes']
                
                if any(keyword in detail.upper() for keyword in spec_keywords) or any(keyword in detail.lower() for keyword in accessory_keywords):
                    if asset.description == asset.name:
                        asset.description = f"{asset.name} - {detail}"
                    else:
                        # Avoid duplicating the same detail
                        if detail not in asset.description:
                            asset.description += f" | {detail}"
            
            # If we have details but description wasn't updated, add them
            if len(details) > 0 and asset.description == asset.name:
                meaningful_details = [d for d in details if len(d) > 5 and not d.replace(',', '').replace('.', '').isdigit()]
                if meaningful_details:
                    asset.description = f"{asset.name} - " + ' | '.join(meaningful_details[:3])
        
        assets_list.append(asset)
        print(f"DEBUG: Finalized asset: {asset.name}, Category: {asset.category}, Qty: {asset.quantity}, Warranty: {asset.warranty_period[:50] if asset.warranty_period else 'N/A'}")
    
    def _classify_asset_category(self, description: str) -> str:
        """Classify asset into category based on description"""
        description_lower = description.lower()
        
        for category, keywords in self.category_keywords.items():
            for keyword in keywords:
                if keyword in description_lower:
                    return category
        
        return 'other'
    
    def _detect_device_type(self, description: str) -> str:
        """Auto-detect device type from asset description"""
        description_lower = description.lower()
        
        # Check each device type's keywords
        for device_type, keywords in self.device_type_keywords.items():
            for keyword in keywords:
                if keyword in description_lower:
                    print(f"DEBUG: Detected device type '{device_type}' from keyword '{keyword}' in '{description}'")
                    return device_type
        
        # Default to 'Other' if no match found
        print(f"DEBUG: No device type detected for '{description}', defaulting to 'Other'")
        return 'Other'
    
    def _extract_brand_model(self, description: str) -> tuple:
        """Extract brand and model from description"""
        # Extended list of IT and office equipment brands
        brands = [
            'hp', 'dell', 'lenovo', 'asus', 'acer', 'apple', 'microsoft', 'samsung',
            'lg', 'canon', 'epson', 'brother', 'cisco', 'd-link', 'tp-link',
            'intel', 'amd', 'nvidia', 'western digital', 'seagate', 'corsair',
            'logitech', 'razer', 'cooler master', 'thermaltake', 'adata', 'kingston',
            'sandisk', 'transcend', 'crucial', 'sony', 'panasonic', 'philips',
            'benq', 'viewsonic', 'aoc', 'msi', 'gigabyte', 'asrock', 'evga',
            'compaq', 'fujitsu', 'toshiba', 'nec', 'ibm', 'huawei', 'xiaomi',
            'oneplus', 'oppo', 'vivo', 'realme', 'redmi', 'honor', 'zte',
            'netgear', 'linksys', 'belkin', 'ubiquiti', 'mikrotik', 'fortinet'
        ]
        
        description_lower = description.lower()
        brand = None
        
        # Check for brand names
        for b in brands:
            # Use word boundaries to avoid partial matches
            if re.search(r'\b' + re.escape(b) + r'\b', description_lower):
                brand = b.title()
                break
        
        # If no brand found, check for "Branded-BRAND" pattern
        if not brand:
            branded_match = re.search(r'Branded[-\s]([A-Za-z]+)', description, re.IGNORECASE)
            if branded_match:
                brand = branded_match.group(1).title()
        
        # Extract model - various patterns
        model = None
        model_patterns = [
            r'Model[:\s]+([A-Z0-9][-A-Z0-9]+)',  # Model: ABC-123
            r'\b([A-Z]{2,}[-_][A-Z0-9]{2,}[-_]?[A-Z0-9]*)\b',  # HP-ABC123
            r'\b([A-Z][0-9]{3,}[A-Z]?)\b',  # E5500, G7, etc.
            r'\b([0-9]{2,}[A-Z]{2,}[0-9]{2,})\b',  # 22EA43, etc.
        ]
        
        for pattern in model_patterns:
            model_match = re.search(pattern, description)
            if model_match:
                model = model_match.group(1)
                break
        
        return brand, model
    
    def extract_bill_info(self, pdf_content: bytes) -> tuple[BillInfo, str]:
        """
        Main extraction method
        Args:
            pdf_content: Raw PDF bytes or string text
        Returns:
            Tuple of (BillInfo, raw_text)
        """
        # In your actual implementation, you'd extract text from PDF
        # For now, assuming text is passed directly
        raw_text = pdf_content.decode('utf-8') if isinstance(pdf_content, bytes) else pdf_content
        
        # Extract all components
        vendor_info = self.extract_vendor_info(raw_text)
        bill_details = self.extract_bill_details(raw_text)
        assets = self.extract_assets(raw_text)
        
        # Combine into BillInfo object
        bill_info = BillInfo(
            bill_number=bill_details['bill_number'],
            vendor_name=vendor_info['name'],
            vendor_gstin=vendor_info['gstin'],
            vendor_address=vendor_info['address'],
            vendor_phone=vendor_info['phone'],
            vendor_email=vendor_info['email'],
            bill_date=bill_details['bill_date'],
            due_date=bill_details['due_date'],
            total_amount=bill_details['total_amount'],
            tax_amount=bill_details['tax_amount'],
            discount=bill_details['discount'],
            warranty_info='',
            assets=assets
        )
        
        return bill_info, raw_text

    # =========================================
    # Local LLM Extraction Pipeline - Production Architecture
    # =========================================
    def extract_bill_info_ai(self, raw_text: str) -> tuple[BillInfo, str]:
        """
        Extract bill info using local LLM with strict page-wise processing.
        
        Architecture:
        1. Split bill by page markers (<<<)
        2. Send each page independently to LLM (stateless API)
        3. LLM returns strict JSON per page
        4. Backend aggregates and validates results deterministically
        5. Never rely on LLM for totals or cross-page memory
        """
        print("DEBUG: Starting AI-based extraction...")
        
        # Page-wise extraction (stateless LLM calls)
        pages = self._split_pages(raw_text)
        if not pages:
            print("DEBUG: No page markers found, treating as single page")
            pages = [raw_text]
        
        print(f"DEBUG: Split into {len(pages)} pages")
        
        page_results = []
        for page_num, page_text in enumerate(pages, start=1):
            print(f"DEBUG: Processing page {page_num}/{len(pages)}")
            
            # Extract page via LLM
            page_json = self._extract_page_via_llm(page_text, page_num, len(pages))
            
            if page_json:
                page_results.append(page_json)
                print(f"DEBUG: Page {page_num} extracted successfully")
            else:
                print(f"DEBUG: Page {page_num} extraction failed or returned empty")
        
        if not page_results:
            print("DEBUG: No results from AI extraction, falling back to rule-based")
            if not self.ai_only_mode:
                return self.extract_bill_info(raw_text)
            else:
                # AI-only mode but failed - return minimal structure
                return self._create_empty_bill_info(), raw_text
        
        # Deterministic backend aggregation (NO LLM calculations)
        aggregated = self._aggregate_page_results(page_results)
        
        # Build final BillInfo from aggregated data
        bill_info = self._build_bill_info_from_aggregated(aggregated)
        
        print(f"DEBUG: Final extraction - Invoice: {bill_info.bill_number}, "
              f"Vendor: {bill_info.vendor_name}, Items: {len(bill_info.assets)}, "
              f"Tax: {bill_info.tax_amount}, Total: {bill_info.total_amount}")
        
        return bill_info, raw_text
    
    def _is_batch_only_page(self, page_text: str) -> bool:
        """
        STEP 0: PAGE TYPE CLASSIFICATION
        Detect if page is BATCH_ONLY_PAGE (not ITEM_PAGE).
        
        BATCH_ONLY_PAGE:
        - Contains ONLY "Batch :" rows or serial listings
        - Each serial/batch may have "1.00 Pcs" or similar unit quantity
        - NO item table with Description + Quantity columns
        
        ITEM_PAGE:
        - Has table with Description + Quantity + Rate/Amount columns
        - Quantity column shows item quantities (not batch counts)
        """
        lines = [l.strip() for l in page_text.split("\n") if l.strip()]

        has_real_item = False
        batch_rows = 0

        for line in lines:
            lower = line.lower()

            # Detect batch rows explicitly
            if "batch :" in lower or lower.startswith("batch "):
                batch_rows += 1
                continue

            # Detect REAL item rows from item table:
            # Must have: description (NOT "batch") + quantity pattern + amount/rate
            qty_match = re.search(r"\b(\d+(\.\d+)?)\s*(pcs|nos|qty)\b", lower)
            has_amount = bool(re.search(r"\b(rs\.?|₹|inr)\b|\d{3,}\.\d{2}", lower))

            if qty_match and has_amount and "batch" not in lower:
                has_real_item = True
                break

        # BATCH_ONLY_PAGE if many batch rows and ZERO real item table rows
        is_batch_only = batch_rows >= 3 and not has_real_item

        if is_batch_only:
            print(f"DEBUG: PAGE TYPE = BATCH_ONLY_PAGE ({batch_rows} batch rows, no item table)")
        else:
            print(f"DEBUG: PAGE TYPE = ITEM_PAGE (has item table with Description + Quantity)")

        return is_batch_only
    
    def _build_batch_only_prompt(self, page_text: str, page_num: int) -> dict:
        """
        Build prompt for extracting ONLY batch/serial numbers from a page.
        Used when page contains only serials with no items.
        """
        system_message = """Extract ONLY serial numbers / batch codes from this page. Return ONLY valid JSON.

OUTPUT FORMAT:
{
  "batches": ["SERIAL1", "SERIAL2", "SERIAL3", ...]
}

RULES:
1. Extract ALL serial numbers, batch codes, or device identifiers
2. Skip any text that is not a serial/batch identifier
3. Return ONLY the JSON array of serials
4. DO NOT extract item names, quantities, or prices"""

        user_message = f"""PAGE {page_num} - Extract all serial/batch numbers:

{page_text}"""

        return {
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.0,
            "max_tokens": 512,
            "stop": ["</s>", "<|im_end|>", "```"]
        }
    
    def _extract_page_via_llm(self, page_text: str, page_num: int, total_pages: int) -> Optional[dict]:
        """
        Extract structured data from a single page using LLM.
        Returns strict JSON matching schema or None.
        """
        # Send full page text (truncated to context limit)
        # Don't filter aggressively - let LLM see everything
        chunk = self._truncate(page_text, self.local_llm_chunk_chars)
        
        if not chunk or len(chunk.strip()) < 50:
            print(f"DEBUG: Page {page_num} is too short, skipping")
            return None
        
        print(f"DEBUG: Page {page_num} chunk length: {len(chunk)} chars")
        
        # STEP 0: PAGE TYPE CLASSIFICATION - Check for BATCH_ONLY_PAGE
        is_batch_only = self._is_batch_only_page(chunk)
        
        if is_batch_only:
            # STEP 4: BATCH_ONLY_PAGE - Extract ONLY serials, NO items
            prompt = self._build_batch_only_prompt(chunk, page_num)
            response_text = self._call_local_llm(prompt)
            
            if response_text:
                parsed = self._extract_json_from_text(response_text)
                if parsed and isinstance(parsed, dict) and "batches" in parsed:
                    # Return batch-only result - NO line_items, NO metadata
                    print(f"DEBUG: Page {page_num} - Extracted {len(parsed.get('batches', []))} serials from BATCH_ONLY_PAGE")
                    return {
                        "invoice_metadata": {},
                        "line_items": [],
                        "page_totals": {},
                        "batches_only": parsed.get("batches", [])
                    }
            print(f"DEBUG: Page {page_num} BATCH_ONLY_PAGE extraction failed")
            return None
        
        # STEP 2: ITEM_PAGE - Extract items from item table
        prompt = self._build_page_extraction_prompt(chunk, page_num, total_pages)
        
        # Call LLM API
        response_text = self._call_local_llm(prompt)
        
        if not response_text:
            print(f"DEBUG: Page {page_num} - LLM returned empty response")
            return None
        
        print(f"DEBUG: Page {page_num} LLM response: {response_text[:200]}...")
        
        # Parse strict JSON
        parsed = self._extract_json_from_text(response_text)
        
        if not parsed:
            print(f"DEBUG: Page {page_num} - Failed to parse JSON")
            return None
        
        print(f"DEBUG: Page {page_num} parsed keys: {list(parsed.keys())}")
        
        if isinstance(parsed, dict):
            # Validate schema
            if self._validate_page_json(parsed, page_num):
                items_count = len(parsed.get("line_items", []))
                print(f"DEBUG: Page {page_num} - Valid JSON, {items_count} items")
                return parsed
            else:
                print(f"DEBUG: Page {page_num} - JSON validation failed")
        
        return None
    
    def _build_batch_only_prompt(self, page_text: str, page_num: int) -> dict:
        """
        Build prompt for extracting ONLY batch/serial numbers from a page.
        Used when page contains only serials with no items.
        """
        system_message = """Extract ONLY serial numbers / batch codes from this page. Return ONLY valid JSON.

OUTPUT FORMAT:
{
  "batches": ["SERIAL1", "SERIAL2", "SERIAL3", ...]
}

RULES:
1. Extract ALL serial numbers, batch codes, or device identifiers
2. Skip any text that is not a serial/batch identifier
3. Return ONLY the JSON array of serials
4. DO NOT extract item names, quantities, or prices"""

        user_message = f"""PAGE {page_num} - Extract all serial/batch numbers:

{page_text}"""

        return {
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.0,
            "max_tokens": 512,
            "stop": ["</s>", "<|im_end|>", "```"]
        }
    
    def _build_page_extraction_prompt(self, page_text: str, page_num: int, total_pages: int) -> dict:
        """
        Build prompt for LLM to extract page data in strict JSON format.
        ONLY extracts from ITEM_PAGE (pages with item tables).
        """
        system_message = """You are a stateless invoice page parser. Classify page type then extract accordingly.

PAGE TYPE CLASSIFICATION:
• ITEM_PAGE: Has table with columns like Description/Item + Quantity + Rate/Price
• BATCH_ONLY_PAGE: Only contains "Batch :" rows or serial numbers (already handled separately)

OUTPUT FORMAT:
{
  "invoice_metadata": {"invoice_no": "", "invoice_date": "", "vendor_name": "", "vendor_gstin": ""},
  "line_items": [
    {
      "material_description": "",
      "brand": "",
      "model": "",
      "quantity_on_page": 0,
      "has_explicit_quantity": true,
      "unit_price": 0,
      "total_amount": 0,
      "hsn": ""
    }
  ],
  "page_totals": {"subtotal": 0, "cgst": 0, "sgst": 0, "igst": 0, "grand_total": 0}
}

METADATA EXTRACTION (PRIORITY ON FIRST PAGE):
- invoice_no: Extract from "Invoice No:", "Bill No:", "Receipt No:" fields
- invoice_date: Extract from "Invoice Date:", "Date:", "Bill Date:" fields (format: DD-MM-YYYY or DD/MM/YYYY)
- vendor_name: Company/business name at top of invoice
- vendor_gstin: Extract GSTIN/GST No (15-character format: 22AAAAA0000A1Z5)

CRITICAL EXTRACTION RULES (THIS IS AN ITEM_PAGE):
1. ONLY extract rows from item table (with Description + Quantity columns)
2. quantity_on_page = EXACT number printed in Quantity column for THIS row
3. has_explicit_quantity = true ONLY if quantity is printed in item table
4. has_explicit_quantity = false if quantity is missing/blank in table
5. DO NOT extract items from:
   - Batch rows ("Batch : XYZ")
   - Serial number lists
   - Specification lines ("Part no:", "Warranty:", "Model:")
   - Continuation markers
6. DO NOT infer quantity from:
   - Counting serial numbers
   - Batch row count
   - Previous pages
   - Item repetition
7. Each line_item must have:
   - Material description from Description column
   - Quantity from Quantity column (or null if blank)
   - Unit price from Rate column
   - HSN from HSN column
8. page_totals (ONLY if visible on THIS page - otherwise leave as 0):
   - cgst: CGST amount printed (e.g., "CGST @ 9%: 37944.43")
   - sgst: SGST amount printed (e.g., "SGST @ 9%: 37944.43")
   - igst: IGST amount printed (e.g., "IGST @ 18%: 75888.86")
   - grand_total: Final total amount printed (e.g., "Grand Total: 497777.72", "Total Amount: 497777.72")
   - Extract EXACT amounts printed, do NOT calculate
9. Return ONLY JSON - no explanations

EXAMPLE:
INPUT: "Dell Monitor E2216HV | 8473.60 | 55.00 Pcs | 9.00 | 466049.60"
OUTPUT: {"material_description": "Dell Monitor E2216HV", "quantity_on_page": 55, "has_explicit_quantity": true, "unit_price": 8473.60, "total_amount": 466049.60}

INPUT: "Batch : ABC123 | 1.00 Pcs"
OUTPUT: (DO NOT extract this - it's a batch row, not an item)"""

        user_message = f"""PAGE {page_num} of {total_pages} - Extract ONLY what appears on THIS page.

PAGE TEXT:
{page_text}"""

        return {
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.0,
            "max_tokens": self.local_llm_max_tokens,
            "stop": ["</s>", "<|im_end|>", "```"]
        }
    
    def _validate_page_json(self, data: dict, page_num: int) -> bool:
        """Validate that JSON matches expected schema."""
        if not isinstance(data, dict):
            return False
        
        # Check top-level keys
        if "invoice_metadata" not in data or "line_items" not in data:
            return False
        
        # Validate types
        if not isinstance(data["invoice_metadata"], dict):
            return False
        if not isinstance(data["line_items"], list):
            return False
        
        # Validate line items structure
        for item in data["line_items"]:
            if not isinstance(item, dict):
                return False
            # Check for required field (quantity_on_page instead of quantity)
            if "material_description" not in item:
                return False
            # Ensure batches is a list if present
            if "batches" in item and not isinstance(item["batches"], list):
                return False
        
        return True
    
    def _aggregate_page_results(self, page_results: List[dict]) -> dict:
        """
        Aggregate results from all pages deterministically.
        Backend logic - NO LLM involvement.
        
        Process:
        1. Collect metadata (prefer first non-empty)
        2. Merge items by normalized description + HSN
        3. Sum quantities across pages for same item
        4. Collect serial numbers from batch-only pages separately
        5. Validate quantity vs serial count
        6. Trust totals only from final page
        """
        aggregated = {
            "invoice_metadata": {},
            "line_items": [],
            "tax_summary": {},
            "all_batches": []  # Collect all serials from batch-only pages
        }
        
        # 1. Collect metadata (prefer first non-empty value)
        for page_data in page_results:
            meta = page_data.get("invoice_metadata", {})
            for key in ["invoice_no", "invoice_date", "vendor_name", "vendor_gstin"]:
                if not aggregated["invoice_metadata"].get(key) and meta.get(key):
                    aggregated["invoice_metadata"][key] = meta[key]
        
        # 1.5. Collect batches from batch-only pages
        for page_data in page_results:
            batches_only = page_data.get("batches_only", [])
            if batches_only and isinstance(batches_only, list):
                aggregated["all_batches"].extend(batches_only)
                print(f"DEBUG: Collected {len(batches_only)} serials from batch-only page")
        
        # 2. Merge items by normalized description + HSN
        item_map = {}  # Key: (normalized_desc, hsn) -> merged item data
        
        for page_num, page_data in enumerate(page_results, start=1):
            for item in page_data.get("line_items", []):
                if not isinstance(item, dict):
                    continue
                
                # FIX 2: ENFORCE has_explicit_quantity (NO EXCEPTIONS)
                # Default to FALSE if missing - only TRUE if explicitly set by LLM
                has_explicit_qty = item.get("has_explicit_quantity", False)
                if not has_explicit_qty:
                    desc = item.get('material_description', 'unknown')[:50]
                    print(f"DEBUG: DROPPING fake item (has_explicit_quantity=false): {desc}")
                    continue
                
                # Normalize description for matching
                desc = (item.get("material_description") or "").strip()
                hsn = (item.get("hsn") or "").strip()
                
                if not desc:
                    continue
                
                # Create normalized key (case-insensitive, whitespace-normalized)
                norm_desc = " ".join(desc.lower().split())
                merge_key = (norm_desc, hsn)
                
                # STEP 1: HARD ISOLATION - reset variables per item
                # STEP 0: Handle null quantities (from batch-only pages)
                qty_raw = item.get("quantity_on_page", item.get("quantity"))
                qty_on_page = self._to_int(qty_raw) if qty_raw is not None else None
                unit_price = self._to_float(item.get("unit_price"))
                total_amount = self._to_float(item.get("total_amount"))
                
                if merge_key not in item_map:
                    # First occurrence - create entry
                    item_map[merge_key] = {
                        "material_description": desc,  # Keep original casing
                        "brand": item.get("brand", ""),
                        "model": item.get("model", ""),
                        "hsn": hsn,
                        "unit_price": unit_price,
                        "total_amount": total_amount,
                        "quantity": qty_on_page,  # May be None
                        "pages_seen": [page_num]
                    }
                else:
                    # STEP 1 & 2: USE MAX of NON-NULL quantities
                    # First valid explicit quantity wins
                    existing_qty = item_map[merge_key]["quantity"]
                    
                    if existing_qty is None and qty_on_page is not None:
                        # First valid quantity - use it
                        item_map[merge_key]["quantity"] = qty_on_page
                    elif existing_qty is not None and qty_on_page is not None:
                        # Both valid - take max
                        item_map[merge_key]["quantity"] = max(existing_qty, qty_on_page)
                    # else: both None or new is None - keep existing
                    
                    item_map[merge_key]["pages_seen"].append(page_num)
                    
                    # Update pricing (prefer non-zero values)
                    if unit_price > 0:
                        item_map[merge_key]["unit_price"] = unit_price
                    if total_amount > 0:
                        item_map[merge_key]["total_amount"] = total_amount
        
        # 3. Validate and finalize items
        for merge_key, item_data in item_map.items():
            norm_desc, hsn = merge_key
            
            # STEP 2: Skip items with null quantity (no valid quantity found across all pages)
            quantity = item_data["quantity"]
            if quantity is None or quantity == 0:
                desc_short = item_data['material_description'][:50]
                print(f"DEBUG: SKIPPING item with null/zero quantity: {desc_short}")
                continue
            
            # Calculate total_amount if missing (quantity * unit_price)
            if item_data["total_amount"] == 0 and item_data["unit_price"] > 0:
                item_data["total_amount"] = quantity * item_data["unit_price"]
            
            # Remove debug field
            pages_seen = item_data.pop("pages_seen")
            print(f"DEBUG: Merged item '{item_data['material_description']}' from pages {pages_seen}: "
                  f"qty={quantity}")
            
            aggregated["line_items"].append(item_data)
        
        # FIX 4: SERIAL ↔ QUANTITY VALIDATION (GOLD FEATURE)
        total_quantity = sum(item["quantity"] for item in aggregated["line_items"])
        total_serials = len(aggregated["all_batches"])
        
        aggregated["requires_manual_review"] = False
        aggregated["review_reason"] = ""
        
        # Only validate if serials exist (FIX 3: serials are optional)
        if total_serials > 0 and total_quantity != total_serials:
            print(f"WARNING: Serial ↔ Quantity mismatch - Items: {total_quantity}, Serials: {total_serials}")
            aggregated["requires_manual_review"] = True
            aggregated["review_reason"] = f"Serial count mismatch: {total_quantity} items vs {total_serials} serials"
            # DO NOT FAIL PIPELINE - just flag for manual review
        elif total_serials == 0:
            print(f"DEBUG: No serials extracted (valid - serials are optional)")
        
        # 4. Trust totals only from FINAL page (GST & TOTAL RULE)
        final_page_totals = {}
        if page_results:
            # Look for page_totals in final page result
            final_page_totals = page_results[-1].get("page_totals", page_results[-1].get("tax_summary", {}))
        
        # TRUST printed GST values - do not recalculate
        cgst = self._to_float(final_page_totals.get("cgst"))
        sgst = self._to_float(final_page_totals.get("sgst"))
        igst = self._to_float(final_page_totals.get("igst"))
        grand_total = self._to_float(final_page_totals.get("grand_total"))
        
        # STRICTLY use printed values - NO calculations
        total_tax = (cgst or 0.0) + (sgst or 0.0) + (igst or 0.0)
        
        print(f"DEBUG: Tax from PDF - CGST: {cgst}, SGST: {sgst}, IGST: {igst}, Total Tax: {total_tax}, Grand Total: {grand_total}")
        
        aggregated["tax_summary"] = {
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total_tax": total_tax,
            "grand_total": grand_total
        }
        
        print(f"DEBUG: Aggregated {len(aggregated['line_items'])} unique items from {len(page_results)} pages")
        
        return aggregated
    
    def _build_bill_info_from_aggregated(self, aggregated: dict) -> BillInfo:
        """Build BillInfo object from aggregated page results."""
        meta = aggregated.get("invoice_metadata", {})
        line_items = aggregated.get("line_items", [])
        tax_summary = aggregated.get("tax_summary", {})
        all_batches = aggregated.get("all_batches", [])
        requires_review = aggregated.get("requires_manual_review", False)
        review_reason = aggregated.get("review_reason", "")
        
        # Parse date
        bill_date_str = meta.get("invoice_date", "")
        bill_date = self._parse_date(bill_date_str) if bill_date_str else ""
        
        # Due date (assume 7 days if not specified)
        due_date = ""
        if bill_date:
            try:
                date_obj = datetime.strptime(bill_date, "%Y-%m-%d")
                due_date = (date_obj + timedelta(days=7)).strftime("%Y-%m-%d")
            except:
                pass
        
        # Build assets with serial number assignment
        assets = []
        
        # FIX 3: SERIAL EXTRACTION IS OPTIONAL
        # Determine if we have serials to assign (if not, create assets without serials)
        if all_batches and len(all_batches) > 0:
            # We have serials from batch-only pages - assign them sequentially
            serial_index = 0
            
            for item in line_items:
                if not isinstance(item, dict):
                    continue
                
                # STEP 2: HARD ISOLATION - reset per-item variables
                description = (item.get("material_description") or "").strip()
                if not description:
                    continue
                
                device_type = self._detect_device_type(description)
                brand = item.get("brand", "")
                model = item.get("model", "")
                
                if not brand or not model:
                    extracted_brand, extracted_model = self._extract_brand_model(description)
                    brand = brand or extracted_brand or ""
                    model = model or extracted_model or ""
                
                category = self._classify_asset_category(description)
                quantity = self._to_int(item.get("quantity", 1))
                unit_price = self._to_float(item.get("unit_price"))
                total_price = self._to_float(item.get("total_amount"))
                hsn_code = item.get("hsn", "")
                
                # STEP 3: SERIAL ASSIGNMENT WITHOUT QUANTITY MUTATION
                # Count available serials for this item
                serials_for_item = min(quantity, len(all_batches) - serial_index)
                
                # Create individual assets for serials (1:1 mapping)
                for i in range(serials_for_item):
                    serial = str(all_batches[serial_index]).strip()
                    serial_index += 1
                    
                    asset = ExtractedAsset(
                        name=description,
                        description=description,
                        category=category,
                        brand=brand,
                        model=model,
                        serial_number=serial,
                        quantity=1,
                        unit_price=unit_price,
                        total_price=unit_price if unit_price > 0 else (total_price / quantity if quantity > 0 else 0),
                        warranty_period="",
                        hsn_code=hsn_code,
                        device_type=device_type
                    )
                    assets.append(asset)
                
                # STEP 3: If quantity > serials, create ONE bulk asset for remainder
                remaining_qty = quantity - serials_for_item
                if remaining_qty > 0:
                    asset = ExtractedAsset(
                        name=description,
                        description=description,
                        category=category,
                        brand=brand,
                        model=model,
                        serial_number="",  # No serial for bulk
                        quantity=remaining_qty,
                        unit_price=unit_price,
                        total_price=unit_price * remaining_qty if unit_price > 0 else (total_price - (unit_price * serials_for_item)),
                        warranty_period="",
                        hsn_code=hsn_code,
                        device_type=device_type
                    )
                    assets.append(asset)
        else:
            # FIX 3: No serials - create assets based on quantity (VALID scenario)
            # Assets will have empty serial_number - this is acceptable
            for item in line_items:
                if not isinstance(item, dict):
                    continue
                
                description = (item.get("material_description") or "").strip()
                if not description:
                    continue
                
                device_type = self._detect_device_type(description)
                brand = item.get("brand", "")
                model = item.get("model", "")
                
                if not brand or not model:
                    extracted_brand, extracted_model = self._extract_brand_model(description)
                    brand = brand or extracted_brand or ""
                    model = model or extracted_model or ""
                
                category = self._classify_asset_category(description)
                quantity = self._to_int(item.get("quantity", 1))
                unit_price = self._to_float(item.get("unit_price"))
                total_price = self._to_float(item.get("total_amount"))
                hsn_code = item.get("hsn", "")
                
                # No serials available - create single asset with quantity
                asset = ExtractedAsset(
                    name=description,
                    description=description,
                    category=category,
                    brand=brand,
                    model=model,
                    serial_number="",
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price,
                    warranty_period="",
                    hsn_code=hsn_code,
                    device_type=device_type
                )
                assets.append(asset)
        
        # STRICTLY use printed values from PDF - NO calculations
        # Tax amount (printed value from final page)
        tax_amount = self._to_float(tax_summary.get("total_tax"), default=0.0)
        
        # Grand total (printed value from final page)
        grand_total = self._to_float(tax_summary.get("grand_total"), default=0.0)
        
        print(f"DEBUG: Bill Date from PDF: '{bill_date_str}' -> Parsed: '{bill_date}'")
        print(f"DEBUG: Tax Amount from PDF: {tax_amount}")
        print(f"DEBUG: Grand Total from PDF: {grand_total}")
        
        if not bill_date:
            print(f"WARNING: Bill date not extracted - check invoice_metadata in LLM response")
        if grand_total == 0:
            print(f"WARNING: Grand total is 0 - check page_totals.grand_total in LLM response")
        
        # Store review info in warranty_info if flagged
        warranty_info = ""
        if requires_review:
            warranty_info = f"REVIEW REQUIRED: {review_reason}"
            print(f"DEBUG: Bill flagged for manual review: {review_reason}")
        
        print(f"DEBUG: Final BillInfo - Date: {bill_date}, Invoice: {meta.get('invoice_no', '')}, Vendor: {meta.get('vendor_name', '')}, Assets: {len(assets)}, Tax: {tax_amount}, Total: {grand_total}")
        
        return BillInfo(
            bill_number=meta.get("invoice_no", ""),
            vendor_name=meta.get("vendor_name", ""),
            vendor_gstin=meta.get("vendor_gstin", ""),
            vendor_address="",
            vendor_phone="",
            vendor_email="",
            bill_date=bill_date,
            due_date=due_date,
            total_amount=grand_total,
            tax_amount=tax_amount,
            discount=0.0,
            warranty_info=warranty_info,
            assets=assets
        )
    
    def _create_empty_bill_info(self) -> BillInfo:
        """Create empty BillInfo when AI extraction completely fails."""
        return BillInfo(
            bill_number="",
            vendor_name="",
            vendor_gstin="",
            vendor_address="",
            vendor_phone="",
            vendor_email="",
            bill_date="",
            due_date="",
            total_amount=0.0,
            tax_amount=0.0,
            discount=0.0,
            warranty_info="",
            assets=[]
        )

        if not ai_results:
            return self.extract_bill_info(raw_text)

        merged = self._merge_ai_results(ai_results)
        bill_data = merged.get("bill", {}) if isinstance(merged, dict) else {}
        items = merged.get("items", []) if isinstance(merged, dict) else []

        assets = []
        for item in items:
            if not isinstance(item, dict):
                continue

            description = (item.get("description") or "").strip()
            if not description:
                continue

            quantity = self._to_int(item.get("quantity"), default=1)
            unit_price = self._to_float(item.get("unit_price"), default=0.0)
            total_price = self._to_float(item.get("total_price"), default=0.0)
            if total_price == 0.0 and unit_price > 0 and quantity > 0:
                total_price = unit_price * quantity

            brand = item.get("brand") or None
            model = item.get("model") or None
            if not brand or not model:
                inferred_brand, inferred_model = self._extract_brand_model(description)
                brand = brand or inferred_brand
                model = model or inferred_model

            device_type = item.get("device_type") or self._detect_device_type(description)
            category = self._classify_asset_category(description)

            assets.append(
                ExtractedAsset(
                    name=description,
                    description=description,
                    category=category,
                    brand=brand or "",
                    model=model or "",
                    serial_number=item.get("serial_number") or "",
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price,
                    warranty_period=item.get("warranty_period") or "",
                    hsn_code=item.get("hsn_code") or "",
                    device_type=device_type or "Other",
                )
            )

        bill_info = BillInfo(
            bill_number=(bill_data.get("bill_number") or ("" if self.ai_only_mode else bill_details.get("bill_number")) or "").strip(),
            vendor_name=(bill_data.get("vendor_name") or ("" if self.ai_only_mode else vendor_info.get("name")) or "").strip(),
            vendor_gstin=(bill_data.get("vendor_gstin") or ("" if self.ai_only_mode else vendor_info.get("gstin")) or "").strip(),
            vendor_address=(bill_data.get("vendor_address") or ("" if self.ai_only_mode else vendor_info.get("address")) or "").strip(),
            vendor_phone=(bill_data.get("vendor_phone") or ("" if self.ai_only_mode else vendor_info.get("phone")) or "").strip(),
            vendor_email=(bill_data.get("vendor_email") or ("" if self.ai_only_mode else vendor_info.get("email")) or "").strip(),
            bill_date=(bill_data.get("bill_date") or ("" if self.ai_only_mode else bill_details.get("bill_date")) or "").strip(),
            due_date=(bill_data.get("due_date") or ("" if self.ai_only_mode else bill_details.get("due_date")) or "").strip(),
            total_amount=self._to_float(
                bill_data.get("total_amount"),
                default=(0.0 if self.ai_only_mode else self._to_float(bill_details.get("total_amount"), default=0.0)),
            ),
            tax_amount=self._to_float(
                bill_data.get("tax_amount"),
                default=(0.0 if self.ai_only_mode else self._to_float(bill_details.get("tax_amount"), default=0.0)),
            ),
            discount=self._to_float(
                bill_data.get("discount"),
                default=(0.0 if self.ai_only_mode else self._to_float(bill_details.get("discount"), default=0.0)),
            ),
            warranty_info=(bill_data.get("warranty_info") or "").strip(),
            assets=assets,
        )

        # If AI-only mode is on, do not fallback; return whatever AI produced
        if self.ai_only_mode:
            return bill_info, raw_text

        # If AI did not yield items, fall back to rule-based asset extraction
        if not assets:
            try:
                assets = self.extract_assets(raw_text)
                bill_info.assets = assets
            except Exception as e:
                print(f"Fallback asset extraction failed: {e}")

        if not bill_info.bill_number and not bill_info.vendor_name and not bill_info.assets:
            return self.extract_bill_info(raw_text)

        return bill_info, raw_text

    def _split_text_for_llm(self, text: str, max_chars: int = 1800) -> List[str]:
        """Split text into chunks to fit local LLM context."""
        if not text:
            return []

        if "<<<" in text:
            pages = [p.strip() for p in text.split("<<<") if p.strip()]
        else:
            pages = [p.strip() for p in text.split("\n\n") if p.strip()]

        chunks = []
        current = ""
        for page in pages:
            if len(current) + len(page) + 2 <= max_chars:
                current = f"{current}\n\n{page}".strip()
            else:
                if current:
                    chunks.append(current)
                current = page
        if current:
            chunks.append(current)

        if not chunks:
            chunks = [text[i:i + max_chars] for i in range(0, len(text), max_chars)]

        return chunks

    def _build_llm_prompt(self, chunk: str, chunk_index: int, chunk_count: int) -> Dict[str, str]:
        system_prompt = (
            "Extract invoice data. Return ONLY JSON (no markdown) with keys bill and items. "
            "bill: bill_number, bill_date, due_date, vendor_name, vendor_gstin, vendor_address, "
            "vendor_phone, vendor_email, total_amount, tax_amount (CGST+SGST or IGST), discount, warranty_info. "
            "items: description, brand, model, quantity, unit_price, total_price, serial_number, "
            "hsn_code, warranty_period, device_type. Use null when unknown. Numbers must be numeric. "
            "IMPORTANT: Extract tax_amount by summing all CGST, SGST, or IGST values."
        )

        user_prompt = (
            f"Invoice page {chunk_index}/{chunk_count}. Extract all fields present in this page. "
            "If chunk 1, extract bill header (bill_number, vendor_name, total_amount, tax_amount, etc.). "
            "For all chunks, extract items with description, quantity, unit_price, total_price. "
            "Use null when unknown. Output JSON only.\n\n"
            f"TEXT:\n{chunk}"
        )

        return {"system": system_prompt, "user": user_prompt}

    def _split_pages(self, text: str) -> List[str]:
        """Split invoice text by explicit page markers or heuristic breaks."""
        if not text:
            return []

        # Preferred explicit separators
        if "<<<" in text:
            pages = [p.strip() for p in text.split("<<<") if p.strip()]
        elif "--- Page" in text:
            pages = [p.strip() for p in re.split(r"---\s*Page\s*\d+\s*---", text) if p.strip()]
        elif "\f" in text:
            pages = [p.strip() for p in text.split("\f") if p.strip()]
        else:
            # Fallback: chunk every ~1200 chars as a pseudo-page
            pages = []
            step = max(self.local_llm_chunk_chars, 900)
            for i in range(0, len(text), step):
                pages.append(text[i:i + step])

        return pages

    def _truncate(self, text: str, max_chars: int) -> str:
        if not text:
            return ""
        if len(text) <= max_chars:
            return text
        return text[:max_chars]

    def _select_item_text(self, text: str, max_lines: int = 400) -> str:
        """Reduce raw text to likely line-item lines to keep LLM context small."""
        if not text:
            return ""

        lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
        item_lines = []

        patterns = [
            r"\|",  # table lines
            r"\bHSN\b|\bSAC\b",
            r"\bQty\b|\bQuantity\b",
            r"\bRate\b|\bUnit\b|\bPrice\b",
            r"₹|Rs\.?|INR",
            r"\bCGST\b|\bSGST\b|\bIGST\b|\bTax\b|\bGST\b",
            r"\bTotal\b|\bAmount\b|\bGrand\b",
        ]

        for line in lines:
            if any(re.search(p, line, re.IGNORECASE) for p in patterns):
                item_lines.append(line)
            elif re.search(r"\d+\.\d{2}|\d{3,}", line) and len(line) <= 180:
                item_lines.append(line)

            if len(item_lines) >= max_lines:
                break

        return "\n".join(item_lines)

    def _call_local_llm(self, payload: Dict) -> str:
        """
        Call local LLM API (llama.cpp server).
        Accepts payload with 'messages' array (new format) or 'system'/'user' (legacy).
        """
        timeout = (10, self.local_llm_timeout)
        
        # Convert to messages format if needed
        if "messages" in payload:
            messages = payload["messages"]
            temperature = payload.get("temperature", 0.1)
            max_tokens = payload.get("max_tokens", self.local_llm_max_tokens)
            stop = payload.get("stop", [])
        else:
            # Legacy format (system/user keys)
            messages = [
                {"role": "system", "content": payload.get("system", "")},
                {"role": "user", "content": payload.get("user", "")}
            ]
            temperature = 0.1
            max_tokens = self.local_llm_max_tokens
            stop = []
        
        # Try chat completions endpoint (OpenAI-compatible)
        for attempt in range(2):
            try:
                chat_url = f"{self.local_llm_url}/v1/chat/completions"
                chat_payload = {
                    "model": self.local_llm_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stop": stop
                }
                chat_response = requests.post(chat_url, json=chat_payload, timeout=timeout)
                if chat_response.ok:
                    data = chat_response.json()
                    choices = data.get("choices", [])
                    if choices:
                        message = choices[0].get("message", {})
                        content = message.get("content", "")
                        if content:
                            return content.strip()
            except Exception as e:
                print(f"Local LLM chat endpoint attempt {attempt+1} failed: {e}")
        
        # Fallback to legacy completion endpoint
        for attempt in range(2):
            try:
                completion_url = f"{self.local_llm_url}/completion"
                prompt_text = "\n\n".join([m["content"] for m in messages if m.get("content")])
                completion_payload = {
                    "prompt": prompt_text,
                    "temperature": temperature,
                    "n_predict": max_tokens,
                    "stop": stop
                }
                completion_response = requests.post(completion_url, json=completion_payload, timeout=timeout)
                if completion_response.ok:
                    data = completion_response.json()
                    if isinstance(data, dict):
                        if "content" in data:
                            return data["content"].strip()
                        choices = data.get("choices", [])
                        if choices and "text" in choices[0]:
                            return choices[0]["text"].strip()
            except Exception as e:
                print(f"Local LLM completion endpoint attempt {attempt+1} failed: {e}")
        
        return ""

    def _extract_json_from_text(self, text: str) -> Optional[Dict]:
        if not text:
            return None
        cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).strip().strip("`")
        try:
            return json.loads(cleaned)
        except Exception:
            pass

        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            snippet = cleaned[start:end + 1]
            try:
                return json.loads(snippet)
            except Exception:
                return None
        return None

    def _merge_ai_results(self, results: List[Dict]) -> Dict:
        merged_bill = {
            "bill_number": None,
            "bill_date": None,
            "due_date": None,
            "vendor_name": None,
            "vendor_gstin": None,
            "vendor_address": None,
            "vendor_phone": None,
            "vendor_email": None,
            "total_amount": None,
            "tax_amount": None,
            "discount": None,
            "warranty_info": None,
        }
        merged_items = []
        seen = set()

        for result in results:
            if not isinstance(result, dict):
                continue
            bill = result.get("bill", {}) or {}
            items = result.get("items", []) or []

            for key in merged_bill.keys():
                if merged_bill[key] in (None, "", 0, 0.0):
                    value = bill.get(key)
                    if value not in (None, "", 0, 0.0):
                        merged_bill[key] = value

            # Merge numeric totals by max when present
            for num_key in ["total_amount", "tax_amount", "discount"]:
                current = self._to_float(merged_bill.get(num_key), default=0.0)
                candidate = self._to_float(bill.get(num_key), default=0.0)
                if candidate > current:
                    merged_bill[num_key] = candidate

            for item in items:
                if not isinstance(item, dict):
                    continue
                description = (item.get("description") or "").strip().lower()
                model = (item.get("model") or "").strip().lower()
                quantity = self._to_int(item.get("quantity"), default=1)
                unit_price = self._to_float(item.get("unit_price"), default=0.0)
                total_price = self._to_float(item.get("total_price"), default=0.0)
                key = (description, model, quantity, unit_price, total_price)
                if description and key not in seen:
                    seen.add(key)
                    merged_items.append(item)

        return {"bill": merged_bill, "items": merged_items}

    def _to_float(self, value, default: float = 0.0) -> float:
        try:
            if value is None or value == "":
                return default
            if isinstance(value, str):
                value = value.replace(",", "").strip()
            return float(value)
        except Exception:
            return default

    def _to_int(self, value, default: int = 0) -> int:
        try:
            if value is None or value == "":
                return default
            if isinstance(value, str):
                value = value.replace(",", "").strip()
            return int(float(value))
        except Exception:
            return default
    
    def _normalize_description(self, description: str) -> str:
        """
        Normalize item description for consistent matching across pages.
        Removes extra whitespace, converts to lowercase.
        """
        if not description:
            return ""
        # Convert to lowercase and normalize whitespace
        normalized = " ".join(description.lower().split())
        return normalized
    
    def _parse_date(self, date_str: str) -> str:
        """
        Parse various date formats and return YYYY-MM-DD.
        Returns empty string if parsing fails.
        """
        if not date_str:
            return ""
        
        date_formats = [
            '%d/%m/%Y',
            '%d-%m-%Y',
            '%d.%m.%Y',
            '%Y-%m-%d',
            '%d/%m/%y',
            '%d-%m-%y',
            '%d %b %Y',
            '%d %B %Y',
            '%b %d, %Y',
            '%B %d, %Y'
        ]
        
        for fmt in date_formats:
            try:
                date_obj = datetime.strptime(date_str.strip(), fmt)
                return date_obj.strftime("%Y-%m-%d")
            except:
                continue
        
        return ""
    
    def generate_qr_code(self, data: str) -> str:
        """
        Generate QR code from data and return as base64 string
        Args:
            data: String data to encode in QR code
        Returns:
            Base64 encoded QR code image
        """
        try:
            # Create QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(data)
            qr.make(fit=True)
            
            # Create image
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            
            return f"data:image/png;base64,{img_str}"
        except Exception as e:
            print(f"Error generating QR code: {e}")
            return ""

# Usage example:
# extractor = EnhancedInvoiceExtractor()
# bill_info, raw_text = extractor.extract_bill_info(pdf_content)