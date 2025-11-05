import re
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
                bill_details['bill_number'] = invoice_match.group(1).strip()
                print(f"DEBUG: Found invoice number: {bill_details['bill_number']}")
                break
        
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