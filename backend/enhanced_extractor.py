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
            'adapter': ['adapter', 'charger', 'power'],
            'storage': ['hdd', 'ssd', 'hard drive', 'storage', 'disk'],
            'memory': ['ram', 'memory', 'dimm'],
            'other': []
        }
    
    def extract_vendor_info(self, text: str) -> Dict:
        """Extract vendor information from LLM Whisperer formatted text"""
        vendor_info = {
            'name': '',
            'gstin': '',
            'address': '',
            'phone': '',
            'email': ''
        }
        
        # Extract vendor name (first few lines, look for company names with LLP, Ltd, etc.)
        lines = text.split('\n')
        for i, line in enumerate(lines[:20]):
            if any(keyword in line for keyword in ['LLP', 'Ltd', 'Private Limited', 'Pvt Ltd', 'Solutions', 'Technologies']):
                vendor_info['name'] = line.strip()
                break
        
        # Extract GSTIN - now matches table format
        gstin_match = re.search(r'GSTIN/UIN[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})', text)
        if gstin_match:
            vendor_info['gstin'] = gstin_match.group(1)
        
        # Extract address - lines between vendor name and GSTIN
        if vendor_info['name']:
            address_start = text.find(vendor_info['name'])
            gstin_pos = text.find('GSTIN')
            if address_start != -1 and gstin_pos != -1:
                address_section = text[address_start:gstin_pos]
                address_lines = [l.strip() for l in address_section.split('\n') if l.strip() and l.strip() != vendor_info['name']]
                # Filter out common non-address items
                address_lines = [l for l in address_lines[:5] if not any(skip in l for skip in ['Invoice', 'Tax', 'Page', '|', '+', '-'])]
                vendor_info['address'] = ', '.join(address_lines[:3]) if address_lines else ''
        
        return vendor_info
    
    def extract_bill_details(self, text: str) -> Dict:
        """Extract bill details from LLM Whisperer formatted text"""
        bill_details = {
            'bill_number': '',
            'bill_date': '',
            'due_date': '',
            'total_amount': 0.0,
            'tax_amount': 0.0,
            'discount': 0.0
        }
        
        print("DEBUG: Extracting bill details...")
        
        # Extract invoice number from table format
        # Pattern: | Invoice No. | ... | or | TTS/22-23/0499 |
        invoice_match = re.search(r'Invoice No\.?\s*[:\|]?\s*([A-Z0-9/-]+)', text)
        if not invoice_match:
            invoice_match = re.search(r'TTS[/-]\d{2}-\d{2}[/-]\d+', text)
        if invoice_match:
            bill_details['bill_number'] = invoice_match.group(1) if hasattr(invoice_match.group(1), 'strip') else invoice_match.group(0)
            print(f"DEBUG: Found invoice number: {bill_details['bill_number']}")
        else:
            print("DEBUG: Invoice number not found")
        
        # Extract date
        date_match = re.search(r'Dated[:\s]*\|?\s*(\d{1,2}-[A-Za-z]{3}-\d{4})', text)
        if date_match:
            date_str = date_match.group(1)
            print(f"DEBUG: Found date: {date_str}")
            try:
                date_obj = datetime.strptime(date_str, '%d-%b-%Y')
                bill_details['bill_date'] = date_obj.strftime('%Y-%m-%d')
            except:
                bill_details['bill_date'] = date_str
        else:
            print("DEBUG: Date not found with 'Dated' pattern, trying alternative...")
            # Try alternative date pattern
            alt_date_match = re.search(r'(\d{1,2}-[A-Za-z]{3}-\d{4})', text)
            if alt_date_match:
                date_str = alt_date_match.group(1)
                print(f"DEBUG: Found date (alternative): {date_str}")
                try:
                    date_obj = datetime.strptime(date_str, '%d-%b-%Y')
                    bill_details['bill_date'] = date_obj.strftime('%Y-%m-%d')
                except:
                    bill_details['bill_date'] = date_str
        
        # Extract payment terms for due date
        payment_terms_match = re.search(r'(\d+)\s+Days?', text)
        if payment_terms_match and bill_details['bill_date']:
            days = int(payment_terms_match.group(1))
            try:
                bill_date_obj = datetime.strptime(bill_details['bill_date'], '%Y-%m-%d')
                due_date_obj = bill_date_obj + timedelta(days=days)
                bill_details['due_date'] = due_date_obj.strftime('%Y-%m-%d')
            except:
                pass
        
        # Extract total amount (look for final total in rupees)
        total_match = re.search(r'₹\s*([\d,]+\.?\d*)', text)
        if total_match:
            amount_str = total_match.group(1).replace(',', '')
            bill_details['total_amount'] = float(amount_str)
            print(f"DEBUG: Found total amount: {bill_details['total_amount']}")
        else:
            # Fallback: look for Total line
            total_line_match = re.search(r'\|\s*Total\s*\|[^|]*\|\s*([\d,]+\.?\d*)\s*\|', text)
            if total_line_match:
                amount_str = total_line_match.group(1).replace(',', '')
                bill_details['total_amount'] = float(amount_str)
                print(f"DEBUG: Found total amount (fallback): {bill_details['total_amount']}")
            else:
                print("DEBUG: Total amount not found")
        
        # Extract tax amounts - look for "Total Tax Amount" or CGST + SGST
        # First try to find the total tax from the tax summary table
        total_tax_match = re.search(r'Total Tax Amount[^|]*\|[^|]*\|\s*([\d,]+\.?\d*)\s*\|', text, re.IGNORECASE)
        if total_tax_match:
            bill_details['tax_amount'] = float(total_tax_match.group(1).replace(',', ''))
            print(f"DEBUG: Found tax amount from Total Tax Amount column: {bill_details['tax_amount']}")
        else:
            # Fallback: Try to find tax from the HSN table Total row
            # Look for pattern like: | Total | 22,71,000.00 | | 2,04,390.00 | | 2,04,390.00 | 4,08,780.00 |
            hsn_total_match = re.search(r'\|\s*Total\s*\|[^|]*\|[^|]*\|\s*([\d,]+\.?\d*)\s*\|[^|]*\|\s*([\d,]+\.?\d*)\s*\|\s*([\d,]+\.?\d*)\s*\|', text)
            if hsn_total_match:
                # The last value should be the total tax amount
                total_tax_str = hsn_total_match.group(3).replace(',', '')
                bill_details['tax_amount'] = float(total_tax_str)
                print(f"DEBUG: Found tax amount from HSN Total row (last column): {bill_details['tax_amount']}")
            else:
                # Final fallback: CGST + SGST from individual lines in the table
                cgst_match = re.search(r'CGST[^|]*\|\s*([\d,]+\.?\d*)\s*\|', text)
                sgst_match = re.search(r'SGST[^|]*\|\s*([\d,]+\.?\d*)\s*\|', text)
                
                if cgst_match and sgst_match:
                    cgst = float(cgst_match.group(1).replace(',', ''))
                    sgst = float(sgst_match.group(1).replace(',', ''))
                    bill_details['tax_amount'] = cgst + sgst
                    print(f"DEBUG: Found tax amount: CGST={cgst}, SGST={sgst}, Total={bill_details['tax_amount']}")
                else:
                    print(f"DEBUG: Tax not found - Total Tax Amount: not found, HSN Total: not found, CGST: {'found' if cgst_match else 'not found'}, SGST: {'found' if sgst_match else 'not found'}")
        
        print(f"DEBUG: Bill details extracted: {bill_details}")
        return bill_details
    
    def extract_assets(self, text: str) -> List[ExtractedAsset]:
        """Extract asset information from LLM Whisperer formatted invoice text"""
        assets = []
        
        # Pattern to match table rows with item details
        # Example: | 1 | Computer System Branded-HP | 847150 | 55.00 Pcs | 40,000.00 | Pcs | 22,00,000.00 |
        item_pattern = r'\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*([\d.]+)\s*Pcs\s*\|\s*([\d,]+\.?\d*)\s*\|\s*Pcs\s*\|\s*([\d,]+\.?\d*)\s*\|'
        
        lines = text.split('\n')
        current_item = None
        current_batches = []
        collecting_details = False
        detail_lines = []
        
        for i, line in enumerate(lines):
            # Match main item line
            match = re.search(item_pattern, line)
            if match:
                # Save previous item if exists
                if current_item:
                    self._finalize_asset(current_item, current_batches, detail_lines, assets)
                
                # Start new item
                sl_no = match.group(1)
                description = match.group(2).strip()
                hsn_code = match.group(3)
                quantity = float(match.group(4))
                unit_price = float(match.group(5).replace(',', ''))
                total_price = float(match.group(6).replace(',', ''))
                
                # Classify category
                category = self._classify_asset_category(description)
                brand, model = self._extract_brand_model(description)
                
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
                    hsn_code=hsn_code
                )
                current_batches = []
                detail_lines = []
                collecting_details = True
                continue
            
            # Collect batch numbers if we're in an item section
            if collecting_details and current_item:
                # Match batch lines: | Batch : 4CE212C3F6 | | 1.00 Pcs |
                batch_match = re.search(r'Batch\s*:\s*([A-Z0-9]+)', line)
                if batch_match:
                    current_batches.append(batch_match.group(1))
                    continue
                
                # Match detail lines (Part no, Model, Warranty, etc.)
                detail_match = re.search(r'\|\s*([^|]+?)\s*\|', line)
                if detail_match:
                    detail_text = detail_match.group(1).strip()
                    # Skip empty lines, batch lines, and table separators
                    if (detail_text and 
                        not detail_text.startswith('+') and 
                        not detail_text.startswith('-') and
                        'Batch' not in detail_text and
                        len(detail_text) > 3):
                        detail_lines.append(detail_text)
                
                # Check if we've reached a new item or end of items
                if '| Total |' in line or '| CGST |' in line or (i > 0 and re.search(item_pattern, lines[i+1] if i+1 < len(lines) else '')):
                    collecting_details = False
        
        # Don't forget the last item
        if current_item:
            self._finalize_asset(current_item, current_batches, detail_lines, assets)
        
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
                if 'Part no:' in detail or 'Part no' in detail:
                    part_match = re.search(r'Part\s*no:?\s*([A-Z0-9]+)', detail)
                    if part_match and not asset.model:
                        asset.model = part_match.group(1)
                
                if 'Warranty' in detail:
                    asset.warranty_period = detail
                
                # Look for model info (lines with specs)
                if any(keyword in detail.upper() for keyword in ['CORE', 'GB', 'SSD', 'WIN', 'LED']):
                    if asset.description == asset.name:
                        asset.description = f"{asset.name}\n{detail}"
                    else:
                        asset.description += f"\n{detail}"
            
            # If we have details but description wasn't updated, add them
            if len(details) > 0 and asset.description == asset.name:
                asset.description = f"{asset.name}\n" + '\n'.join(details[:5])  # Limit to first 5 detail lines
        
        assets_list.append(asset)
    
    def _classify_asset_category(self, description: str) -> str:
        """Classify asset into category based on description"""
        description_lower = description.lower()
        
        for category, keywords in self.category_keywords.items():
            for keyword in keywords:
                if keyword in description_lower:
                    return category
        
        return 'other'
    
    def _extract_brand_model(self, description: str) -> tuple:
        """Extract brand and model from description"""
        # Common IT brands
        brands = [
            'hp', 'dell', 'lenovo', 'asus', 'acer', 'apple', 'microsoft', 'samsung',
            'lg', 'canon', 'epson', 'brother', 'cisco', 'd-link', 'tp-link',
            'intel', 'amd', 'nvidia', 'western digital', 'seagate', 'corsair'
        ]
        
        description_lower = description.lower()
        brand = None
        
        for b in brands:
            if b in description_lower:
                brand = b.title()
                break
        
        # Extract model (usually alphanumeric pattern)
        model_match = re.search(r'([A-Z0-9]{2,}[-_]?[A-Z0-9]{2,})', description, re.IGNORECASE)
        model = model_match.group(1) if model_match else None
        
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