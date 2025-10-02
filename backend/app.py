from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import traceback
import re
import json
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Dict, List, Optional, Any
import bcrypt
import jwt
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 24))

# Import User model and DB
from models.user import User
from config.database import db

app = Flask(__name__)
CORS(app)

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# -----------------------------
# OCR Classes & Dataclasses
# -----------------------------
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
    items: List[Dict[str, Any]] = None
    total_amount: Optional[str] = None
    tax_amount: Optional[str] = None
    discount: Optional[str] = None
    warranty_info: Optional[str] = None

    def __post_init__(self):
        if self.items is None:
            self.items = []

class BillExtractor:
    def __init__(self):
        self.patterns = {
            "gstin": [
                r"GSTIN[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})"
            ],
            "phone": [
                r"(?:Ph|Phone|Tel|Mobile|Mob)[:\s]*(\+?91[-\s]?[6-9]\d{9})",
                r"([6-9]\d{9})",
            ],
            "email": [r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})"],
            "amount": [r"(?:Total|Amount|Sum)[:\s]*₹?\s*([0-9,]+\.?[0-9]*)"],
            "bill_number": [
                r"(?:Bill|Invoice|Receipt)[:\s]*(?:No\.?|Number)[:\s]*([A-Z0-9/-]+)"
            ],
            "date": [r"(?:Date|Dated)[:\s]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})"],
            "warranty": [r"(?:Warranty|Guarantee)[:\s]*([^.\n]*)"],
        }

    def extract_vendor_info(self, text: str) -> Dict[str, str]:
        lines = text.split("\n")[:10]
        vendor_info = {}
        for line in lines:
            line = line.strip()
            if len(line) > 5 and not re.search(r"^\d+", line):
                if not vendor_info.get("name"):
                    vendor_info["name"] = line
                    break
        full_text = " ".join(lines)
        for pattern in self.patterns["gstin"]:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                vendor_info["gstin"] = match.group(1)
                break
        for pattern in self.patterns["phone"]:
            match = re.search(pattern, full_text)
            if match:
                vendor_info["phone"] = match.group(1)
                break
        for pattern in self.patterns["email"]:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                vendor_info["email"] = match.group(1)
                break
        address_lines = []
        for line in lines[1:6]:
            line = line.strip()
            if (
                line
                and len(line) > 10
                and not re.search(r"(?:gstin|phone|email|bill|invoice)", line, re.IGNORECASE)
            ):
                address_lines.append(line)
        if address_lines:
            vendor_info["address"] = ", ".join(address_lines)
        return vendor_info

    def extract_bill_details(self, text: str) -> Dict[str, str]:
        bill_details = {}
        for pattern in self.patterns["bill_number"]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                bill_details["bill_number"] = match.group(1)
                break
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

    def extract_items(self, text: str) -> List[Dict[str, Any]]:
        items = []
        lines = text.split("\n")
        item_section = False
        for line in lines:
            line = line.strip()
            if re.search(r"(?:description|item|product|sl|sr)", line, re.IGNORECASE):
                item_section = True
                continue
            if item_section and line:
                if re.search(r"(?:total|subtotal|tax|grand)", line, re.IGNORECASE):
                    break
                item = self.parse_item_line(line)
                if item:
                    items.append(item)
        return items

    def parse_item_line(self, line: str) -> Optional[Dict[str, Any]]:
        pattern = r"(.+?)\s+([0-9]+(?:\.[0-9]+)?)\s+(?:Pcs?\s+)?([0-9,]+(?:\.[0-9]+)?)\s+([0-9,]+(?:\.[0-9]+)?)"
        match = re.search(pattern, line)
        if match:
            return {
                "description": match.group(1).strip(),
                "quantity": match.group(2),
                "rate": match.group(3).replace(",", ""),
                "amount": match.group(4).replace(",", ""),
            }
        if re.search(r"[A-Z0-9]{3,}", line) and len(line.strip()) > 5:
            return {"description": line.strip(), "quantity": "", "rate": "", "amount": ""}
        return None

    def extract_amounts(self, text: str) -> Dict[str, str]:
        amounts = {}
        for pattern in self.patterns["amount"]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amounts["total_amount"] = match.group(1).replace(",", "")
                break
        tax_pattern = r"(?:tax|gst|vat)[:\s]*₹?\s*([0-9,]+\.?[0-9]*)"
        match = re.search(tax_pattern, text, re.IGNORECASE)
        if match:
            amounts["tax_amount"] = match.group(1).replace(",", "")
        discount_pattern = r"(?:discount|less)[:\s]*₹?\s*([0-9,]+\.?[0-9]*)"
        match = re.search(discount_pattern, text, re.IGNORECASE)
        if match:
            amounts["discount"] = match.group(1).replace(",", "")
        return amounts

    def extract_warranty(self, text: str) -> Optional[str]:
        for pattern in self.patterns["warranty"]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    def extract_bill_info(self, text: str) -> BillInfo:
        bill = BillInfo()
        vendor_info = self.extract_vendor_info(text)
        bill.vendor_name = vendor_info.get("name")
        bill.vendor_address = vendor_info.get("address")
        bill.vendor_phone = vendor_info.get("phone")
        bill.vendor_email = vendor_info.get("email")
        bill.vendor_gstin = vendor_info.get("gstin")
        bill_details = self.extract_bill_details(text)
        bill.bill_number = bill_details.get("bill_number")
        bill.bill_date = bill_details.get("bill_date")
        bill.due_date = bill_details.get("due_date")
        bill.items = self.extract_items(text)
        amounts = self.extract_amounts(text)
        bill.total_amount = amounts.get("total_amount")
        bill.tax_amount = amounts.get("tax_amount")
        bill.discount = amounts.get("discount")
        bill.warranty_info = self.extract_warranty(text)
        return bill

extractor = BillExtractor()

# -----------------------------
# OCR Routes
# -----------------------------
@app.route("/scan", methods=["POST"])
def ocr_pdf():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        file = request.files["file"]
        if not file.filename.lower().endswith(".pdf"):
            return jsonify({"error": "Only PDF files are supported"}), 400
        file_content = file.read()
        images = convert_from_bytes(file_content, poppler_path=r"C:\poppler\Library\bin")
        full_text = ""
        for i, image in enumerate(images):
            text = pytesseract.image_to_string(image, lang="eng")
            full_text += f"\n--- Page {i+1} ---\n{text}"
        bill_info = extractor.extract_bill_info(full_text)
        return jsonify({
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
        })
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

@app.route("/save", methods=["POST"])
def save_ocr_result():
    try:
        data = request.get_json()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        raw_text = data.get("raw_text", "")
        if raw_text:
            with open(f"ocr_raw_{timestamp}.txt", "w", encoding="utf-8") as f:
                f.write(raw_text)
        extracted_info = data.get("extracted_info", {})
        if extracted_info:
            with open(f"bill_info_{timestamp}.json", "w", encoding="utf-8") as f:
                json.dump(extracted_info, f, indent=2, ensure_ascii=False)
        return jsonify({
            "message": "Bill information saved successfully",
            "files_saved": [f"ocr_raw_{timestamp}.txt", f"bill_info_{timestamp}.json"]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Authentication Routes
# -----------------------------
@app.route("/signup", methods=["POST"])
def register():
    data = request.get_json()
    required_fields = ["firstName", "lastName", "email", "password", "role"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    assigned_lab = None
    if data["role"] == "Lab Incharge":
        assigned_lab = data.get("accessScope", {}).get("lab")

    user = User.create_user(
        first_name=data["firstName"],
        last_name=data["lastName"],
        email=data["email"],
        password=data["password"],
        role=data["role"],
        assigned_lab=assigned_lab
    )
    if isinstance(user, dict) and "error" in user:
        return jsonify(user), 400

    token = jwt.encode({
        "user_id": user.id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }, JWT_SECRET_KEY, algorithm="HS256")
    return jsonify({"message": "User registered successfully", "token": token})


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if "email" not in data or "password" not in data:
        return jsonify({"error": "Email and password required"}), 400
    user = User.find_by_email(data["email"])
    if not user or not User.verify_password(data["password"], user.password_hash):
        return jsonify({"error": "Invalid credentials"}), 401
    user.update_last_login()
    token = jwt.encode({
        "user_id": user.id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }, JWT_SECRET_KEY, algorithm="HS256")
    return jsonify({"message": "Login successful", "token": token})

# -----------------------------
# Run App
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)
