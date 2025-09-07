from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import io
import traceback
import re
import json
from datetime import datetime
from dataclasses import dataclass
from typing import Dict, List, Optional, Any

app = Flask(__name__)
CORS(app)

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

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
    
    buyer_name: Optional[str] = None
    buyer_address: Optional[str] = None
    buyer_phone: Optional[str] = None
    
    items: List[Dict[str, Any]] = None
    
    total_amount: Optional[str] = None
    tax_amount: Optional[str] = None
    discount: Optional[str] = None
    
    warranty_info: Optional[str] = None
    terms_conditions: Optional[str] = None
    
    def __post_init__(self):
        if self.items is None:
            self.items = []

class BillExtractor:
    def __init__(self):
        # Common patterns for different fields
        self.patterns = {
            'gstin': [
                r'GSTIN[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})',
                r'GST[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})',
            ],
            'phone': [
                r'(?:Ph|Phone|Tel|Mobile|Mob)[:\s]*(\+?91[-\s]?[6-9]\d{9})',
                r'(\+?91[-\s]?[6-9]\d{9})',
                r'([6-9]\d{9})',
            ],
            'email': [
                r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
            ],
            'amount': [
                r'(?:Total|Amount|Sum)[:\s]*₹?\s*([0-9,]+\.?[0-9]*)',
                r'(?:Rs\.?|₹)\s*([0-9,]+\.?[0-9]*)',
                r'([0-9,]+\.[0-9]{2})',
            ],
            'bill_number': [
                r'(?:Bill|Invoice|Receipt)[:\s]*(?:No\.?|Number)[:\s]*([A-Z0-9/-]+)',
                r'(?:TTS|INV|BILL)[/\-]?([0-9/\-A-Z]+)',
            ],
            'date': [
                r'(?:Date|Dated)[:\s]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})',
                r'(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})',
            ],
            'warranty': [
                r'(?:Warranty|Guarantee)[:\s]*([^.\n]*)',
                r'([0-9]+\s*(?:years?|months?|days?)\s*warranty)',
            ],
        }
    
    def extract_vendor_info(self, text: str) -> Dict[str, str]:
        """Extract vendor information from the top portion of the bill"""
        lines = text.split('\n')[:10]  # Usually vendor info is at the top
        vendor_info = {}
        
        # Find vendor name (usually the first substantial line)
        for line in lines:
            line = line.strip()
            if len(line) > 5 and not re.search(r'^\d+', line):
                if not vendor_info.get('name'):
                    vendor_info['name'] = line
                    break
        
        # Extract other vendor details
        full_text = ' '.join(lines)
        
        # GSTIN
        for pattern in self.patterns['gstin']:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                vendor_info['gstin'] = match.group(1)
                break
        
        # Phone
        for pattern in self.patterns['phone']:
            match = re.search(pattern, full_text)
            if match:
                vendor_info['phone'] = match.group(1)
                break
        
        # Email
        for pattern in self.patterns['email']:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                vendor_info['email'] = match.group(1)
                break
        
        # Address (lines that don't match other patterns)
        address_lines = []
        for line in lines[1:6]:  # Skip first line (vendor name)
            line = line.strip()
            if (line and len(line) > 10 and 
                not re.search(r'(?:gstin|phone|email|bill|invoice)', line, re.IGNORECASE)):
                address_lines.append(line)
        
        if address_lines:
            vendor_info['address'] = ', '.join(address_lines)
        
        return vendor_info
    
    def extract_bill_details(self, text: str) -> Dict[str, str]:
        """Extract bill number, dates, etc."""
        bill_details = {}
        
        # Bill number
        for pattern in self.patterns['bill_number']:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                bill_details['bill_number'] = match.group(1)
                break
        
        # Dates
        date_matches = []
        for pattern in self.patterns['date']:
            matches = re.finditer(pattern, text)
            for match in matches:
                date_matches.append(match.group(1))
        
        if date_matches:
            bill_details['bill_date'] = date_matches[0]
            if len(date_matches) > 1:
                bill_details['due_date'] = date_matches[1]
        
        return bill_details
    
    def extract_items(self, text: str) -> List[Dict[str, Any]]:
        """Extract items/products from the bill"""
        items = []
        lines = text.split('\n')
        
        # Look for table-like structures
        item_section = False
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Detect start of items section
            if re.search(r'(?:description|item|product|sl|sr)', line, re.IGNORECASE):
                item_section = True
                continue
            
            if item_section and line:
                # Stop if we hit total/summary section
                if re.search(r'(?:total|subtotal|tax|grand)', line, re.IGNORECASE):
                    break
                
                # Try to parse item line
                item = self.parse_item_line(line)
                if item:
                    items.append(item)
        
        return items
    
    def parse_item_line(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse individual item line"""
        # Pattern for item with quantity, rate, amount
        pattern = r'(.+?)\s+([0-9]+(?:\.[0-9]+)?)\s+(?:Pcs?\s+)?([0-9,]+(?:\.[0-9]+)?)\s+([0-9,]+(?:\.[0-9]+)?)'
        match = re.search(pattern, line)
        
        if match:
            return {
                'description': match.group(1).strip(),
                'quantity': match.group(2),
                'rate': match.group(3).replace(',', ''),
                'amount': match.group(4).replace(',', '')
            }
        
        # Fallback: if line contains product codes or model numbers
        if re.search(r'[A-Z0-9]{3,}', line) and len(line.strip()) > 5:
            return {
                'description': line.strip(),
                'quantity': '',
                'rate': '',
                'amount': ''
            }
        
        return None
    
    def extract_amounts(self, text: str) -> Dict[str, str]:
        """Extract total amounts, taxes, etc."""
        amounts = {}
        
        # Total amount
        for pattern in self.patterns['amount']:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amounts['total_amount'] = match.group(1).replace(',', '')
                break
        
        # Tax amount
        tax_pattern = r'(?:tax|gst|vat)[:\s]*₹?\s*([0-9,]+\.?[0-9]*)'
        match = re.search(tax_pattern, text, re.IGNORECASE)
        if match:
            amounts['tax_amount'] = match.group(1).replace(',', '')
        
        # Discount
        discount_pattern = r'(?:discount|less)[:\s]*₹?\s*([0-9,]+\.?[0-9]*)'
        match = re.search(discount_pattern, text, re.IGNORECASE)
        if match:
            amounts['discount'] = match.group(1).replace(',', '')
        
        return amounts
    
    def extract_warranty(self, text: str) -> Optional[str]:
        """Extract warranty information"""
        for pattern in self.patterns['warranty']:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
    
    def extract_bill_info(self, text: str) -> BillInfo:
        """Main method to extract all bill information"""
        bill = BillInfo()
        
        # Extract vendor information
        vendor_info = self.extract_vendor_info(text)
        bill.vendor_name = vendor_info.get('name')
        bill.vendor_address = vendor_info.get('address')
        bill.vendor_phone = vendor_info.get('phone')
        bill.vendor_email = vendor_info.get('email')
        bill.vendor_gstin = vendor_info.get('gstin')
        
        # Extract bill details
        bill_details = self.extract_bill_details(text)
        bill.bill_number = bill_details.get('bill_number')
        bill.bill_date = bill_details.get('bill_date')
        bill.due_date = bill_details.get('due_date')
        
        # Extract items
        bill.items = self.extract_items(text)
        
        # Extract amounts
        amounts = self.extract_amounts(text)
        bill.total_amount = amounts.get('total_amount')
        bill.tax_amount = amounts.get('tax_amount')
        bill.discount = amounts.get('discount')
        
        # Extract warranty
        bill.warranty_info = self.extract_warranty(text)
        
        return bill

# Initialize extractor
extractor = BillExtractor()

@app.route("/scan", methods=["POST"])
def ocr_pdf():
    try:
        print("Request received")
        
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        print(f"File received: {file.filename}")

        if not file.filename.lower().endswith(".pdf"):
            return jsonify({"error": "Only PDF files are supported"}), 400

        print("Starting PDF conversion...")
        
        file_content = file.read()
        print(f"File size: {len(file_content)} bytes")
        
        # Convert PDF pages to images
        images = convert_from_bytes(file_content, poppler_path=r"C:\poppler-25.07.0\Library\bin")
        print(f"Converted to {len(images)} pages")

        # Extract text from all pages
        full_text = ""
        for i, image in enumerate(images):
            print(f"Processing page {i+1}")
            text = pytesseract.image_to_string(image, lang="eng")
            full_text += f"\n--- Page {i+1} ---\n{text}"

        print("OCR completed successfully")
        
        # Extract structured information from the bill
        print("Extracting bill information...")
        bill_info = extractor.extract_bill_info(full_text)
        
        # Convert to dictionary for JSON response
        bill_dict = {
            "raw_text": full_text,
            "extracted_info": {
                "vendor": {
                    "name": bill_info.vendor_name,
                    "address": bill_info.vendor_address,
                    "phone": bill_info.vendor_phone,
                    "email": bill_info.vendor_email,
                    "gstin": bill_info.vendor_gstin
                },
                "bill_details": {
                    "bill_number": bill_info.bill_number,
                    "bill_date": bill_info.bill_date,
                    "due_date": bill_info.due_date
                },
                "items": bill_info.items,
                "amounts": {
                    "total_amount": bill_info.total_amount,
                    "tax_amount": bill_info.tax_amount,
                    "discount": bill_info.discount
                },
                "warranty_info": bill_info.warranty_info
            }
        }
        
        return jsonify(bill_dict)

    except Exception as e:
        print(f"Error occurred: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route("/save", methods=["POST"])
def save_ocr_result():
    try:
        data = request.get_json()
        
        # Save both raw text and extracted information
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save raw text
        raw_text = data.get("raw_text", "")
        if raw_text:
            with open(f"ocr_raw_{timestamp}.txt", "w", encoding="utf-8") as f:
                f.write(raw_text)
        
        # Save structured data as JSON
        extracted_info = data.get("extracted_info", {})
        if extracted_info:
            with open(f"bill_info_{timestamp}.json", "w", encoding="utf-8") as f:
                json.dump(extracted_info, f, indent=2, ensure_ascii=False)
        
        return jsonify({
            "message": "Bill information saved successfully",
            "files_saved": [f"ocr_raw_{timestamp}.txt", f"bill_info_{timestamp}.json"]
        })
    
    except Exception as e:
        print(f"Save error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)