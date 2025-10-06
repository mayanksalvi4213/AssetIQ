import re
import pandas as pd
import numpy as np
import qrcode
import io
import base64
import uuid
from PIL import Image
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
import pytesseract
from pdf2image import convert_from_bytes
import pdfplumber
import tabula
import cv2

@dataclass
class ExtractedAsset:
    name: str
    description: str
    quantity: int
    unit_price: Optional[float]
    total_price: Optional[float]
    category: str
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    warranty_period: Optional[str] = None

@dataclass
class BillInfo:
    vendor_name: Optional[str] = None
    vendor_address: Optional[str] = None
    vendor_phone: Optional[str] = None
    vendor_email: Optional[str] = None
    vendor_gstin: Optional[str] = None
    bill_number: Optional[str] = None
    bill_date: Optional[str] = None
    due_date: Optional[str] = None
    total_amount: Optional[str] = None
    tax_amount: Optional[str] = None
    discount: Optional[str] = None
    warranty_info: Optional[str] = None
    assets: List[ExtractedAsset] = None

    def __post_init__(self):
        if self.assets is None:
            self.assets = []

class EnhancedBillExtractor:
    def __init__(self):
        # Enhanced patterns for better extraction
        self.patterns = {
            "gstin": [
                r"GSTIN[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})",
                r"GST[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})",
                r"([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})"
            ],
            "phone": [
                r"(?:Ph|Phone|Tel|Mobile|Mob|Contact)[:\s]*(\+?91[-\s]?[6-9]\d{9})",
                r"(?:Ph|Phone|Tel|Mobile|Mob|Contact)[:\s]*([6-9]\d{9})",
                r"(\+?91[-\s]?[6-9]\d{9})",
                r"([6-9]\d{9})"
            ],
            "email": [
                r"(?:Email|E-mail|Mail)[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})",
                r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})"
            ],
            "amount": [
                r"(?:Total|Grand\s*Total|Net\s*Amount|Amount)[:\s]*₹?\s*([0-9,]+\.?[0-9]*)",
                r"₹\s*([0-9,]+\.?[0-9]*)"
            ],
            "bill_number": [
                r"(?:Bill|Invoice|Receipt)[:\s]*(?:No\.?|Number|#)[:\s]*([A-Z0-9/-]+)",
                r"(?:Bill|Invoice|Receipt)[:\s]*([A-Z0-9/-]+)",
                r"(?:No\.?|Number|#)[:\s]*([A-Z0-9/-]+)"
            ],
            "date": [
                r"(?:Date|Dated|Bill\s*Date|Invoice\s*Date)[:\s]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})",
                r"(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})"
            ],
            "warranty": [
                r"(?:Warranty|Guarantee)[:\s]*([^.\n]*)",
                r"(?:Warranty|Guarantee).*?(\d+)\s*(?:year|month|day)s?"
            ]
        }
        
        # Category keywords for asset classification
        self.category_keywords = {
            'computer': ['computer', 'desktop', 'pc', 'cpu', 'tower', 'workstation'],
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

    def extract_with_multiple_methods(self, file_content: bytes) -> Tuple[str, List[pd.DataFrame]]:
        """Extract text and tables using multiple methods for better accuracy"""
        
        # Method 1: OCR with pytesseract
        ocr_text = self._extract_with_ocr(file_content)
        
        # Method 2: Text extraction with pdfplumber
        pdf_text = self._extract_with_pdfplumber(file_content)
        
        # Method 3: Table extraction with tabula
        tables = self._extract_tables_with_tabula(file_content)
        
        # Combine texts (prefer pdfplumber if available, fallback to OCR)
        combined_text = pdf_text if pdf_text.strip() else ocr_text
        
        return combined_text, tables

    def _extract_with_ocr(self, file_content: bytes) -> str:
        """Extract text using OCR"""
        try:
            images = convert_from_bytes(file_content, poppler_path=r"C:\poppler\Library\bin")
            full_text = ""
            
            for i, image in enumerate(images):
                # Enhance image for better OCR
                enhanced_image = self._enhance_image_for_ocr(image)
                text = pytesseract.image_to_string(enhanced_image, lang="eng")
                full_text += f"\n--- Page {i+1} ---\n{text}"
                
            return full_text
        except Exception as e:
            print(f"OCR extraction failed: {e}")
            return ""

    def _extract_with_pdfplumber(self, file_content: bytes) -> str:
        """Extract text using pdfplumber"""
        try:
            with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                full_text = ""
                for i, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    if text:
                        full_text += f"\n--- Page {i+1} ---\n{text}"
                return full_text
        except Exception as e:
            print(f"PDFPlumber extraction failed: {e}")
            return ""

    def _extract_tables_with_tabula(self, file_content: bytes) -> List[pd.DataFrame]:
        """Extract tables using tabula-py"""
        try:
            # Save to temporary file for tabula
            temp_file = f"temp_{uuid.uuid4().hex}.pdf"
            with open(temp_file, 'wb') as f:
                f.write(file_content)
            
            # Extract tables
            tables = tabula.read_pdf(temp_file, pages='all', multiple_tables=True)
            
            # Clean up
            import os
            os.remove(temp_file)
            
            return tables if tables else []
        except Exception as e:
            print(f"Table extraction failed: {e}")
            return []

    def _enhance_image_for_ocr(self, image: Image.Image) -> Image.Image:
        """Enhance image quality for better OCR results"""
        try:
            # Convert PIL to OpenCV
            img_array = np.array(image)
            
            # Convert to grayscale
            if len(img_array.shape) == 3:
                gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            else:
                gray = img_array
            
            # Apply denoising
            denoised = cv2.fastNlMeansDenoising(gray)
            
            # Apply threshold to get binary image
            _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Convert back to PIL
            enhanced_image = Image.fromarray(thresh)
            return enhanced_image
        except:
            # If enhancement fails, return original
            return image

    def extract_vendor_info(self, text: str) -> Dict[str, str]:
        """Extract vendor information from text"""
        lines = text.split("\n")
        vendor_info = {}
        
        # Extract vendor name (usually first meaningful line)
        for line in lines[:15]:  # Check first 15 lines
            line = line.strip()
            if len(line) > 5 and not re.search(r'^\d+|page \d+|---', line, re.IGNORECASE):
                if not vendor_info.get("name"):
                    vendor_info["name"] = line
                    break
        
        full_text = " ".join(lines)
        
        # Extract GSTIN
        for pattern in self.patterns["gstin"]:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                vendor_info["gstin"] = match.group(1)
                break
        
        # Extract phone
        for pattern in self.patterns["phone"]:
            match = re.search(pattern, full_text)
            if match:
                vendor_info["phone"] = match.group(1)
                break
        
        # Extract email
        for pattern in self.patterns["email"]:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                vendor_info["email"] = match.group(1)
                break
        
        # Extract address (lines after vendor name, before GSTIN/phone)
        address_lines = []
        for line in lines[1:10]:
            line = line.strip()
            if (line and len(line) > 10 and 
                not re.search(r'(?:gstin|phone|email|bill|invoice|date)', line, re.IGNORECASE)):
                address_lines.append(line)
        
        if address_lines:
            vendor_info["address"] = ", ".join(address_lines)
        
        return vendor_info

    def extract_bill_details(self, text: str) -> Dict[str, str]:
        """Extract bill details like number and dates"""
        bill_details = {}
        
        # Extract bill number
        for pattern in self.patterns["bill_number"]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                bill_details["bill_number"] = match.group(1)
                break
        
        # Extract dates
        date_matches = []
        for pattern in self.patterns["date"]:
            matches = re.finditer(pattern, text)
            for match in matches:
                date_matches.append(match.group(1))
        
        if date_matches:
            bill_details["bill_date"] = date_matches[0]
            if len(date_matches) > 1:
                bill_details["due_date"] = date_matches[1]
        
        return bill_details

    def extract_assets_from_tables(self, tables: List[pd.DataFrame], text: str) -> List[ExtractedAsset]:
        """Extract assets from detected tables"""
        assets = []
        
        for table in tables:
            if table.empty:
                continue
                
            # Try to identify columns
            assets_from_table = self._parse_table_for_assets(table)
            assets.extend(assets_from_table)
        
        # If no tables found or tables don't contain assets, try text parsing
        if not assets:
            assets = self._extract_assets_from_text(text)
        
        return assets

    def _parse_table_for_assets(self, table: pd.DataFrame) -> List[ExtractedAsset]:
        """Parse a pandas DataFrame table for asset information"""
        assets = []
        
        # Clean column names
        table.columns = [str(col).strip().lower() for col in table.columns]
        
        # Map possible column names
        column_mapping = {
            'description': ['description', 'item', 'product', 'details', 'particulars'],
            'quantity': ['qty', 'quantity', 'nos', 'pcs', 'units'],
            'rate': ['rate', 'price', 'unit price', 'cost'],
            'amount': ['amount', 'total', 'value', 'total amount']
        }
        
        # Find best matching columns
        matched_columns = {}
        for target_col, possible_names in column_mapping.items():
            for col in table.columns:
                for possible_name in possible_names:
                    if possible_name in col:
                        matched_columns[target_col] = col
                        break
                if target_col in matched_columns:
                    break
        
        # Parse rows
        for _, row in table.iterrows():
            try:
                # Get description
                description = ""
                if 'description' in matched_columns:
                    description = str(row[matched_columns['description']]).strip()
                elif len(table.columns) > 0:
                    description = str(row[table.columns[0]]).strip()
                
                # Skip if description is empty or invalid
                if not description or description.lower() in ['nan', 'none', '']:
                    continue
                
                # Get quantity
                quantity = 1
                if 'quantity' in matched_columns:
                    try:
                        qty_val = str(row[matched_columns['quantity']]).strip()
                        quantity = int(float(qty_val)) if qty_val and qty_val != 'nan' else 1
                    except:
                        quantity = 1
                
                # Get unit price
                unit_price = None
                if 'rate' in matched_columns:
                    try:
                        rate_val = str(row[matched_columns['rate']]).strip()
                        unit_price = float(re.sub(r'[^\d.]', '', rate_val)) if rate_val and rate_val != 'nan' else None
                    except:
                        unit_price = None
                
                # Get total amount
                total_price = None
                if 'amount' in matched_columns:
                    try:
                        amount_val = str(row[matched_columns['amount']]).strip()
                        total_price = float(re.sub(r'[^\d.]', '', amount_val)) if amount_val and amount_val != 'nan' else None
                    except:
                        total_price = None
                
                # Classify category
                category = self._classify_asset_category(description)
                
                # Extract brand and model
                brand, model = self._extract_brand_model(description)
                
                asset = ExtractedAsset(
                    name=description,
                    description=description,
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price,
                    category=category,
                    brand=brand,
                    model=model
                )
                
                assets.append(asset)
                
            except Exception as e:
                print(f"Error parsing table row: {e}")
                continue
        
        return assets

    def _extract_assets_from_text(self, text: str) -> List[ExtractedAsset]:
        """Extract assets from plain text when tables are not available"""
        assets = []
        lines = text.split("\n")
        
        # Look for item sections
        item_section = False
        for line in lines:
            line = line.strip()
            
            # Detect start of items section
            if re.search(r'(?:description|item|product|sl|sr|particulars)', line, re.IGNORECASE):
                item_section = True
                continue
            
            # Detect end of items section
            if item_section and re.search(r'(?:subtotal|total|tax|grand|net)', line, re.IGNORECASE):
                break
            
            # Parse item lines
            if item_section and line and len(line) > 5:
                asset = self._parse_item_line(line)
                if asset:
                    assets.append(asset)
        
        return assets

    def _parse_item_line(self, line: str) -> Optional[ExtractedAsset]:
        """Parse a single line for asset information"""
        try:
            # Pattern for structured item lines: Description Qty Rate Amount
            pattern = r"(.+?)\s+([0-9]+(?:\.[0-9]+)?)\s+(?:Pcs?\s+)?([0-9,]+(?:\.[0-9]+)?)\s+([0-9,]+(?:\.[0-9]+)?)"
            match = re.search(pattern, line)
            
            if match:
                description = match.group(1).strip()
                quantity = int(float(match.group(2)))
                unit_price = float(match.group(3).replace(",", ""))
                total_price = float(match.group(4).replace(",", ""))
                
                category = self._classify_asset_category(description)
                brand, model = self._extract_brand_model(description)
                
                return ExtractedAsset(
                    name=description,
                    description=description,
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price,
                    category=category,
                    brand=brand,
                    model=model
                )
            
            # Fallback: just description
            elif re.search(r'[A-Za-z0-9]{3,}', line) and len(line.strip()) > 5:
                description = line.strip()
                category = self._classify_asset_category(description)
                brand, model = self._extract_brand_model(description)
                
                return ExtractedAsset(
                    name=description,
                    description=description,
                    quantity=1,
                    unit_price=None,
                    total_price=None,
                    category=category,
                    brand=brand,
                    model=model
                )
                
        except Exception as e:
            print(f"Error parsing item line: {e}")
        
        return None

    def _classify_asset_category(self, description: str) -> str:
        """Classify asset into category based on description"""
        description_lower = description.lower()
        
        for category, keywords in self.category_keywords.items():
            for keyword in keywords:
                if keyword in description_lower:
                    return category
        
        return 'other'

    def _extract_brand_model(self, description: str) -> Tuple[Optional[str], Optional[str]]:
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

    def extract_amounts(self, text: str) -> Dict[str, str]:
        """Extract financial amounts from text"""
        amounts = {}
        
        # Extract total amount
        for pattern in self.patterns["amount"]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amounts["total_amount"] = match.group(1).replace(",", "")
                break
        
        # Extract tax amount
        tax_pattern = r"(?:tax|gst|vat|cgst|sgst|igst)[:\s]*₹?\s*([0-9,]+\.?[0-9]*)"
        match = re.search(tax_pattern, text, re.IGNORECASE)
        if match:
            amounts["tax_amount"] = match.group(1).replace(",", "")
        
        # Extract discount
        discount_pattern = r"(?:discount|less|rebate)[:\s]*₹?\s*([0-9,]+\.?[0-9]*)"
        match = re.search(discount_pattern, text, re.IGNORECASE)
        if match:
            amounts["discount"] = match.group(1).replace(",", "")
        
        return amounts

    def extract_warranty(self, text: str) -> Optional[str]:
        """Extract warranty information"""
        for pattern in self.patterns["warranty"]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    def extract_bill_info(self, file_content: bytes) -> BillInfo:
        """Main method to extract complete bill information"""
        # Extract text and tables
        text, tables = self.extract_with_multiple_methods(file_content)
        
        # Create bill info object
        bill = BillInfo()
        
        # Extract vendor information
        vendor_info = self.extract_vendor_info(text)
        bill.vendor_name = vendor_info.get("name")
        bill.vendor_address = vendor_info.get("address")
        bill.vendor_phone = vendor_info.get("phone")
        bill.vendor_email = vendor_info.get("email")
        bill.vendor_gstin = vendor_info.get("gstin")
        
        # Extract bill details
        bill_details = self.extract_bill_details(text)
        bill.bill_number = bill_details.get("bill_number")
        bill.bill_date = bill_details.get("bill_date")
        bill.due_date = bill_details.get("due_date")
        
        # Extract assets
        bill.assets = self.extract_assets_from_tables(tables, text)
        
        # Extract amounts
        amounts = self.extract_amounts(text)
        bill.total_amount = amounts.get("total_amount")
        bill.tax_amount = amounts.get("tax_amount")
        bill.discount = amounts.get("discount")
        
        # Extract warranty
        bill.warranty_info = self.extract_warranty(text)
        
        return bill, text

    def generate_qr_code(self, data: str) -> str:
        """Generate QR code and return as base64 string"""
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
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            return f"data:image/png;base64,{img_base64}"
            
        except Exception as e:
            print(f"Error generating QR code: {e}")
            return ""