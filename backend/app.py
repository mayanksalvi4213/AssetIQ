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
import requests
import time
from dotenv import load_dotenv

# Load env variables
load_dotenv()
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 24))
LLM_WHISPERER_API_KEY = os.getenv("LLM_WHISPERER_API_KEY")

# Import models and services
from models.user import User
from models.bill import Bill, Asset
from enhanced_extractor import EnhancedInvoiceExtractor
from config.database import db
from utils.jwt_utils import decode_token

app = Flask(__name__)
CORS(app)

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Initialize enhanced extractor
extractor = EnhancedInvoiceExtractor()

# -----------------------------
# Authentication Middleware
# -----------------------------
def get_current_user():
    """Get current user from JWT token"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(' ')[1]
    try:
        payload = decode_token(token)
        return User.find_by_id(payload['user_id'])
    except:
        return None

# ============================================
# LLM WHISPERER API INTEGRATION
# ============================================
def extract_text_with_llm_whisperer(file_content: bytes, api_key: str) -> str:
    """
    Extract text from PDF using LLM Whisperer API v2
    API Documentation: https://docs.unstract.com/llmwhisperer/
    """
    
    if not api_key:
        raise ValueError("LLM_WHISPERER_API_KEY not found in environment variables")
    
    # LLM Whisperer API v2 endpoint (CORRECTED URL)
    api_url = "https://llmwhisperer-api.us-central.unstract.com/api/v2/whisper"
    
    headers = {
        "unstract-key": api_key,
    }
    
    # API v2 uses query parameters instead of form data
    params = {
        "mode": "table",  # Use 'table' mode for invoices with tabular data
        "output_mode": "layout_preserving",  # Preserves layout for better extraction
        "page_seperator": "<<<",  # Page separator in output
    }
    
    print(f"API Parameters: {params}")
    
    try:
        print("Sending document to LLM Whisperer API v2...")
        
        # Step 1: Submit the document (API v2 uses binary data directly)
        response = requests.post(
            api_url,
            headers=headers,
            params=params,
            data=file_content,  # Send binary data directly
            timeout=120  # Longer timeout for processing
        )
        
        response.raise_for_status()
        result = response.json()
        
        # API v2 returns 202 with whisper_hash
        if response.status_code == 202:
            whisper_hash = result.get("whisper_hash")
            
            if not whisper_hash:
                raise Exception("No whisper_hash returned from API")
            
            print(f"Document submitted. Whisper hash: {whisper_hash}")
            print("Waiting for processing to complete...")
            
            # Step 2: Poll for results
            extracted_text = poll_llm_whisperer_status(whisper_hash, api_key)
            return extracted_text
            
        else:
            raise Exception(f"Unexpected status code: {response.status_code}")
        
    except requests.exceptions.RequestException as e:
        print(f"LLM Whisperer API Error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response: {e.response.text}")
        raise Exception(f"Failed to extract text from PDF: {str(e)}")


def poll_llm_whisperer_status(whisper_hash: str, api_key: str, max_attempts: int = 30) -> str:
    """
    Poll the LLM Whisperer API v2 for processing status, then retrieve the text
    """
    status_url = "https://llmwhisperer-api.us-central.unstract.com/api/v2/whisper-status"
    retrieve_url = "https://llmwhisperer-api.us-central.unstract.com/api/v2/whisper-retrieve"
    
    headers = {
        "unstract-key": api_key,
    }
    
    params = {
        "whisper_hash": whisper_hash
    }
    
    for attempt in range(max_attempts):
        try:
            response = requests.get(
                status_url,
                headers=headers,
                params=params,
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            status = result.get("status")
            
            if status == "processed":
                print("Processing complete! Retrieving extracted text...")
                
                # Step 2: Retrieve the actual extracted text
                retrieve_response = requests.get(
                    retrieve_url,
                    headers=headers,
                    params=params,
                    timeout=30
                )
                
                retrieve_response.raise_for_status()
                
                # The retrieve endpoint can return either plain text or JSON
                extracted_text = retrieve_response.text
                
                # Check if response is JSON (contains confidence_metadata)
                if extracted_text.startswith('{') and 'confidence_metadata' in extracted_text:
                    print("Response is JSON format, extracting result_text...")
                    try:
                        json_response = retrieve_response.json()
                        # Get the actual text from result_text field
                        extracted_text = json_response.get('result_text', '')
                        if not extracted_text:
                            extracted_text = json_response.get('extracted_text', '')
                        print(f"Extracted result_text field, length: {len(extracted_text)}")
                        print(f"Result text preview: {extracted_text[:200]}")
                    except Exception as json_error:
                        print(f"Error parsing JSON response: {json_error}")
                        # Fallback: try to extract result_text manually
                        result_match = re.search(r'"result_text":"([^"]*)"', extracted_text)
                        if result_match:
                            extracted_text = result_match.group(1)
                            # Unescape JSON string
                            extracted_text = extracted_text.replace('\\n', '\n').replace('\\t', '\t')
                
                if not extracted_text or len(extracted_text.strip()) == 0:
                    print("Warning: Retrieved text is empty")
                else:
                    print(f"Successfully retrieved {len(extracted_text)} characters")
                
                return extracted_text
                
            elif status == "processing":
                print(f"Still processing... (attempt {attempt + 1}/{max_attempts})")
                time.sleep(2)  # Wait 2 seconds before next poll
                
            elif status == "failed":
                error_msg = result.get("error", "Unknown error")
                raise Exception(f"Processing failed: {error_msg}")
                
            else:
                raise Exception(f"Unknown status: {status}")
                
        except requests.exceptions.RequestException as e:
            print(f"Error polling status: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response: {e.response.text}")
            time.sleep(2)
            continue
    
    raise Exception("Processing timeout - max polling attempts reached")


# ============================================
# UPDATED SCAN ROUTE
# ============================================
@app.route("/scan", methods=["POST"])
def enhanced_ocr_scan():
    """Enhanced OCR scanning with LLM Whisperer API"""
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
            
        file = request.files["file"]
        filename_lower = file.filename.lower()
        allowed_extensions = ('.pdf', '.png', '.jpg', '.jpeg')
        
        if not filename_lower.endswith(allowed_extensions):
            return jsonify({"error": "Only PDF, PNG, JPG, and JPEG files are supported"}), 400
        
        # Get custom asset ID prefix if provided
        asset_id_prefix = request.form.get("asset_id_prefix", "").strip()
        print(f"Custom asset ID prefix: '{asset_id_prefix}'")
        
        # Get current user (optional for demo)
        try:
            current_user = get_current_user()
            user_id = current_user.id if current_user else None
        except:
            user_id = None
        
        # Read file content
        file_content = file.read()
        
        # Determine file type
        is_image = filename_lower.endswith(('.png', '.jpg', '.jpeg'))
        is_pdf = filename_lower.endswith('.pdf')
        
        # STEP 1: Extract text using LLM Whisperer API (with fallback to OCR)
        raw_text = None
        
        if is_image:
            # For images, use OCR directly
            print("Processing image file with OCR...")
            try:
                image = Image.open(request.files["file"].stream)
                raw_text = pytesseract.image_to_string(image, lang="eng")
                print(f"Successfully extracted {len(raw_text)} characters from image")
            except Exception as ocr_error:
                return jsonify({
                    "error": f"Failed to extract text from image",
                    "ocr_error": str(ocr_error),
                    "details": "Could not extract text from image file"
                }), 500
        else:
            # For PDFs, use LLM Whisperer with OCR fallback
            print("Extracting text with LLM Whisperer...")
            try:
                raw_text = extract_text_with_llm_whisperer(file_content, LLM_WHISPERER_API_KEY)
                print(f"Successfully extracted {len(raw_text)} characters with LLM Whisperer")
            except Exception as api_error:
                print(f"LLM Whisperer failed: {str(api_error)}")
                print("Falling back to traditional OCR...")
                
                # Fallback to traditional OCR for PDF
                try:
                    images = convert_from_bytes(file_content, poppler_path=r"C:\poppler\Library\bin")
                    raw_text = ""
                    for i, image in enumerate(images):
                        text = pytesseract.image_to_string(image, lang="eng")
                        raw_text += f"\n--- Page {i+1} ---\n{text}"
                    print(f"Successfully extracted {len(raw_text)} characters with fallback OCR")
                except Exception as ocr_error:
                    return jsonify({
                        "error": f"Both LLM Whisperer and OCR failed",
                        "llm_whisperer_error": str(api_error),
                        "ocr_error": str(ocr_error),
                        "details": "Could not extract text from PDF using any method"
                    }), 500
        
        if not raw_text or len(raw_text.strip()) == 0:
            return jsonify({"error": "No text could be extracted from the PDF"}), 400
        
        # STEP 2: Parse the extracted text using enhanced extractor
        print("Parsing bill information...")
        print(f"Raw text preview (first 500 chars): {raw_text[:500]}")
        try:
            bill_info, _ = extractor.extract_bill_info(raw_text)
        except Exception as parse_error:
            print(f"Parse error details: {parse_error}")
            print(traceback.format_exc())
            return jsonify({
                "error": f"Parsing Error: {str(parse_error)}",
                "raw_text": raw_text[:500],
                "details": "Could not parse the extracted text"
            }), 500
        
        # Validate extraction
        if not bill_info.bill_number and not bill_info.vendor_name:
            return jsonify({
                "error": "Could not extract essential bill information",
                "raw_text": raw_text[:1000],
                "hint": "The invoice format may not be recognized. Please check the raw text."
            }), 400
        
        print(f"Extracted bill: {bill_info.bill_number}, Vendor: {bill_info.vendor_name}")
        print(f"Bill date: {bill_info.bill_date}, Due date: {bill_info.due_date}")
        print(f"Total amount: {bill_info.total_amount}, Tax amount: {bill_info.tax_amount}")
        print(f"Found {len(bill_info.assets)} assets")
        
        # Debug: Print first asset if available
        if bill_info.assets:
            first_asset = bill_info.assets[0]
            print(f"First asset - Name: {first_asset.name[:50]}...")
            print(f"First asset - Category: {first_asset.category}, Quantity: {first_asset.quantity}")
        
        # Create bill record
        bill_data = {
            'bill_number': bill_info.bill_number or "UNKNOWN",
            'vendor_name': bill_info.vendor_name or "UNKNOWN",
            'vendor_gstin': bill_info.vendor_gstin,
            'vendor_address': bill_info.vendor_address,
            'vendor_phone': bill_info.vendor_phone,
            'vendor_email': bill_info.vendor_email,
            'bill_date': bill_info.bill_date,
            'due_date': bill_info.due_date,
            'total_amount': float(bill_info.total_amount) if bill_info.total_amount else 0.0,
            'tax_amount': float(bill_info.tax_amount) if bill_info.tax_amount else 0.0,
            'discount': float(bill_info.discount) if bill_info.discount else 0.0,
            'warranty_info': bill_info.warranty_info,
            'raw_text': raw_text
        }
        
        # Create bill record with fallback
        bill = None
        try:
            from models import Bill
            bill = Bill.create_bill(bill_data, user_id)
            print(f"Created bill record with ID: {bill.id}")
        except Exception as db_error:
            print(f"Database error creating bill: {db_error}")
            bill = type('obj', (object,), {
                'id': f"demo-bill-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                'bill_number': bill_info.bill_number,
                'vendor_name': bill_info.vendor_name,
                'total_amount': bill_info.total_amount
            })
        
        # Create asset records - one for each individual unit
        created_assets = []
        asset_counter = 1  # Start from 1 for sequential numbering
        
        for extracted_asset in bill_info.assets:
            # Get serial numbers (batch numbers) for this item
            serial_numbers = []
            if extracted_asset.serial_number:
                serial_numbers = [s.strip() for s in extracted_asset.serial_number.split(',') if s.strip()]
            
            # Create individual assets - one for each quantity
            quantity = extracted_asset.quantity
            print(f"Creating {quantity} individual assets for: {extracted_asset.name}")
            
            for unit_idx in range(quantity):
                try:
                    # Generate unique asset ID for each unit
                    if asset_id_prefix:
                        # Use custom prefix with sequential numbering
                        asset_id = f"{asset_id_prefix}{asset_counter}"
                    else:
                        # Use default asset ID generation
                        try:
                            from models.bill import Asset
                            asset_id = Asset.get_next_asset_id(extracted_asset.category)
                        except:
                            asset_id = f"{extracted_asset.category[:3].upper()}{datetime.now().strftime('%Y%m%d%H%M%S')}{asset_counter}"
                    
                    asset_counter += 1
                    
                    # Get the specific serial number for this unit (if available)
                    unit_serial_number = serial_numbers[unit_idx] if unit_idx < len(serial_numbers) else ''
                    
                    # Generate QR code with invoice number + vendor name + device code
                    qr_code_data = f"{bill_info.bill_number}|{bill_info.vendor_name}|{asset_id}"
                    
                    qr_code_image = extractor.generate_qr_code(qr_code_data)
                    
                    # Create asset record for this individual unit
                    asset_data = {
                        'asset_id': asset_id,
                        'bill_id': str(bill.id),
                        'name': extracted_asset.name,
                        'description': extracted_asset.description,
                        'category': extracted_asset.category,
                        'brand': extracted_asset.brand,
                        'model': extracted_asset.model,
                        'serial_number': unit_serial_number,
                        'quantity': 1,  # Each asset represents 1 unit
                        'unit_price': extracted_asset.unit_price,
                        'total_price': extracted_asset.unit_price,  # Price for 1 unit
                        'warranty_period': extracted_asset.warranty_period,
                        'device_type': extracted_asset.device_type,  # Auto-detected device type
                        'qr_code_data': qr_code_image,
                        'status': 'active'
                    }
                    
                    # Try database creation with fallback
                    asset = None
                    try:
                        from models.bill import Asset
                        asset = Asset.create_asset(asset_data)
                    except Exception as db_error:
                        print(f"Database error creating asset: {db_error}")
                        asset = type('obj', (object,), asset_data)
                        asset.asset_id = asset_id
                    
                    created_assets.append({
                        "asset_id": getattr(asset, 'asset_id', asset_id),
                        "name": getattr(asset, 'name', extracted_asset.name),
                        "category": getattr(asset, 'category', extracted_asset.category),
                        "quantity": 1,
                        "unit_price": getattr(asset, 'unit_price', extracted_asset.unit_price),
                        "total_price": getattr(asset, 'unit_price', extracted_asset.unit_price),
                        "qr_code": getattr(asset, 'qr_code_data', qr_code_image),
                        "brand": getattr(asset, 'brand', extracted_asset.brand),
                        "model": getattr(asset, 'model', extracted_asset.model),
                        "serial_number": unit_serial_number,
                        "warranty_period": getattr(asset, 'warranty_period', extracted_asset.warranty_period),
                        "device_type": getattr(asset, 'device_type', extracted_asset.device_type)  # Include auto-detected device type
                    })
                    
                    print(f"Created asset {unit_idx + 1}/{quantity}: {asset_id} - {extracted_asset.name} (S/N: {unit_serial_number})")
                    
                except Exception as e:
                    print(f"Error creating asset unit {unit_idx + 1}/{quantity}: {e}")
                    print(traceback.format_exc())
                    continue
        
        print(f"Total assets created: {len(created_assets)}")
        
        return jsonify({
            "success": True,
            "message": f"Successfully processed bill and created {len(created_assets)} assets",
            "bill_info": {
                "id": getattr(bill, 'id', 'demo-bill'),
                "bill_number": bill_info.bill_number,
                "vendor_name": bill_info.vendor_name,
                "vendor_gstin": bill_info.vendor_gstin,
                "vendor_address": bill_info.vendor_address,
                "vendor_phone": bill_info.vendor_phone,
                "vendor_email": bill_info.vendor_email,
                "bill_date": bill_info.bill_date,
                "due_date": bill_info.due_date,
                "total_amount": bill_info.total_amount,
                "tax_amount": bill_info.tax_amount,
                "discount": bill_info.discount,
                "warranty_info": bill_info.warranty_info
            },
            "assets": created_assets,
            "raw_text": raw_text[:1000] + "..." if len(raw_text) > 1000 else raw_text
        })
        
    except Exception as e:
        print(f"Error in scan endpoint: {e}")
        print(traceback.format_exc())
        return jsonify({
            "error": str(e), 
            "trace": traceback.format_exc()
        }), 500


@app.route("/save", methods=["POST"])
def save_ocr_result():
    """Legacy save endpoint - kept for backward compatibility"""
    try:
        data = request.get_json()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save raw text if provided
        raw_text = data.get("raw_text", "")
        if raw_text:
            with open(f"ocr_raw_{timestamp}.txt", "w", encoding="utf-8") as f:
                f.write(raw_text)
        
        # Save extracted info if provided
        extracted_info = data.get("extracted_info", {})
        if extracted_info:
            with open(f"bill_info_{timestamp}.json", "w", encoding="utf-8") as f:
                json.dump(extracted_info, f, indent=2, ensure_ascii=False)
        
        return jsonify({
            "message": "OCR result saved successfully",
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
# Manual Entry Endpoint
# -----------------------------
@app.route("/manual_entry", methods=["POST"])
def manual_entry():
    """
    Create assets from manual entry form data (display only, no database)
    """
    try:
        data = request.get_json()
        devices = data.get("devices", [])
        grand_total = data.get("grandTotal", 0)
        stock_entry = data.get("stockEntry", "")
        tax_amount = data.get("taxAmount", 0)
        gstin = data.get("gstin", "")

        if not devices:
            return jsonify({"error": "No devices provided"}), 400

        # Create a bill ID for display
        bill_id = f"MANUAL-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        
        # Get vendor name from first device
        vendor_name = devices[0].get("vendorName", "Manual Entry")
        invoice_no = devices[0].get("invoiceNo", bill_id)
        
        # Calculate totals
        total_amount = sum(device.get("totalAmount", 0) for device in devices)
        
        # Create assets from devices (for display only)
        assets_created = 0
        created_assets = []
        
        for device in devices:
            device_type = device.get("deviceType", "")
            dept = device.get("dept", "")
            material_desc = device.get("materialDescription", "")
            model_no = device.get("modelNo", "")
            brand = device.get("brand", "")
            asset_id_prefix = device.get("assetIdPrefix", "")
            quantity = device.get("quantity", 1)
            amount_per_pcs = device.get("amountPerPcs", 0)

            # Use custom asset ID prefix from user or generate default
            if asset_id_prefix:
                # User provided custom prefix
                asset_id_base = asset_id_prefix
            else:
                # Fallback to auto-generated prefix
                dept_prefix = ''.join([c for c in dept.upper() if c.isalnum()])[:5]
                asset_id_base = f"{dept_prefix}/{device_type.upper()[:3]}"
            
            # Create multiple assets if quantity > 1
            for i in range(quantity):
                asset_counter = assets_created + 1
                asset_id = f"{asset_id_base}/{asset_counter}"
                
                # Generate QR code with invoice number + vendor name + device code
                import qrcode
                from io import BytesIO
                import base64
                
                # Get invoice and vendor from current device
                device_invoice = device.get("invoiceNo", invoice_no)
                device_vendor = device.get("vendorName", vendor_name)
                qr_code_data = f"{device_invoice}|{device_vendor}|{asset_id}"
                
                qr = qrcode.QRCode(version=1, box_size=10, border=5)
                qr.add_data(qr_code_data)
                qr.make(fit=True)
                img = qr.make_image(fill_color="black", back_color="white")
                
                buffered = BytesIO()
                img.save(buffered, format="PNG")
                qr_code_base64 = f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode()}"
                
                # Add to created assets list with QR code
                created_assets.append({
                    "asset_id": asset_id,
                    "name": material_desc,
                    "category": device_type,
                    "quantity": 1,
                    "unit_price": amount_per_pcs,
                    "total_price": amount_per_pcs,
                    "qr_code": qr_code_base64,
                    "brand": brand,
                    "model": model_no,
                    "device_type": device_type
                })
                
                assets_created += 1

        # Return response similar to scan endpoint (for display only)
        return jsonify({
            "success": True,
            "message": f"Generated {assets_created} assets for preview",
            "bill_info": {
                "id": bill_id,
                "bill_number": invoice_no,
                "vendor_name": vendor_name,
                "vendor_gstin": gstin,
                "vendor_address": "",
                "vendor_phone": "",
                "vendor_email": "",
                "bill_date": datetime.now().strftime("%Y-%m-%d"),
                "due_date": "",
                "total_amount": grand_total if grand_total > 0 else total_amount,
                "tax_amount": tax_amount,
                "discount": 0,
                "warranty_info": ""
            },
            "assets": created_assets,
            "raw_text": f"Manual Entry - Stock: {stock_entry}"
        })

    except Exception as e:
        print(f"Error in manual entry: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Save Bill Endpoint
# -----------------------------
@app.route("/save_bill", methods=["POST"])
def save_bill():
    """
    Save bill information to database with duplicate checking
    """
    try:
        data = request.get_json()
        
        # Extract bill information
        invoice_number = data.get("invoiceNumber", "").strip()
        vendor_name = data.get("vendorName", "").strip()
        bill_date = data.get("billDate", "").strip()
        gstin = data.get("gstin", "").strip()
        stock_entry = data.get("stockEntry", "").strip()
        tax_amount = data.get("taxAmount", 0)
        total_amount = data.get("totalAmount", 0)
        overwrite = data.get("overwrite", False)
        
        # Validate required fields
        if not invoice_number or not vendor_name:
            return jsonify({"error": "Invoice Number and Vendor Name are required"}), 400
        
        # Convert DD/MM/YYYY to YYYY-MM-DD for database
        db_bill_date = None
        if bill_date:
            try:
                # Parse DD/MM/YYYY format
                day, month, year = bill_date.split('/')
                db_bill_date = f"{year}-{month}-{day}"
            except:
                return jsonify({"error": "Invalid date format. Use DD/MM/YYYY"}), 400
        
        # Get database connection
        conn = db.get_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        # Check for existing bill with same vendor_name and invoice_number
        cursor = conn.cursor()
        cursor.execute(
            "SELECT bill_id FROM bills WHERE vendor_name = %s AND invoice_number = %s",
            (vendor_name, invoice_number)
        )
        existing_bill = cursor.fetchone()
        
        if existing_bill and not overwrite:
            cursor.close()
            conn.close()
            return jsonify({
                "duplicate": True,
                "message": "A bill with this vendor name and invoice number already exists."
            }), 409
        
        if existing_bill and overwrite:
            # Update existing bill
            cursor.execute(
                """
                UPDATE bills 
                SET gstin = %s, stock_entry = %s, tax_amount = %s, 
                    total_amount = %s, bill_date = %s
                WHERE bill_id = %s
                """,
                (gstin, stock_entry, tax_amount, total_amount, db_bill_date, existing_bill['bill_id'])
            )
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({
                "success": True,
                "message": "Bill updated successfully",
                "bill_id": existing_bill['bill_id']
            })
        else:
            # Insert new bill
            cursor.execute(
                """
                INSERT INTO bills 
                (invoice_number, vendor_name, gstin, stock_entry, tax_amount, total_amount, bill_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING bill_id
                """,
                (invoice_number, vendor_name, gstin, stock_entry, tax_amount, total_amount, db_bill_date)
            )
            result = cursor.fetchone()
            bill_id = result['bill_id']
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({
                "success": True,
                "message": "Bill saved successfully",
                "bill_id": bill_id
            })
    
    except Exception as e:
        print(f"Error saving bill: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Save Devices Endpoint
# -----------------------------
@app.route("/save_devices", methods=["POST"])
def save_devices():
    """
    Save device information to database after bill is saved
    If devices fail to save, rollback the bill
    """
    try:
        data = request.get_json()
        
        # Extract information
        invoice_number = data.get("invoiceNumber", "").strip()
        vendor_name = data.get("vendorName", "").strip()
        devices = data.get("devices", [])
        
        if not invoice_number or not vendor_name:
            return jsonify({"error": "Invoice Number and Vendor Name are required"}), 400
        
        if not devices:
            return jsonify({"error": "No devices to save"}), 400
        
        # Get database connection
        conn = db.get_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        
        # IMPORTANT: Check and fix dept column type if needed
        try:
            cursor.execute("""
                SELECT data_type, character_maximum_length 
                FROM information_schema.columns 
                WHERE table_name = 'devices' AND column_name = 'dept'
            """)
            column_info = cursor.fetchone()
            if column_info:
                data_type = column_info['data_type']
                max_length = column_info['character_maximum_length']
                print(f"dept column type: {data_type}, max_length: {max_length}")
                
                # If it's char with length 1 or too small, we need to alter it
                if (data_type == 'character' and max_length == 1):
                    print("⚠️  WARNING: dept column is 'char(1)' - this will truncate values!")
                    print("🔧 Attempting to alter column to varchar(50)...")
                    try:
                        cursor.execute("ALTER TABLE devices ALTER COLUMN dept TYPE varchar(50)")
                        conn.commit()
                        print("✅ Successfully altered dept column to varchar(50)")
                    except Exception as alter_error:
                        print(f"❌ Failed to alter column: {alter_error}")
                        conn.rollback()
        except Exception as check_error:
            print(f"Could not check column type: {check_error}")
        
        # Fetch bill_id and bill_date from bills table
        cursor.execute(
            "SELECT bill_id, bill_date FROM bills WHERE vendor_name = %s AND invoice_number = %s",
            (vendor_name, invoice_number)
        )
        bill_record = cursor.fetchone()
        
        if not bill_record:
            cursor.close()
            conn.close()
            return jsonify({"error": "Bill not found. Please save bill information first."}), 404
        
        bill_id = bill_record['bill_id']
        bill_date = bill_record['bill_date']
        
        # Delete existing devices with same bill_id and invoice_number
        # This handles the unique constraint and allows users to update their entries
        cursor.execute(
            "DELETE FROM devices WHERE bill_id = %s AND invoice_number = %s",
            (bill_id, invoice_number)
        )
        deleted_count = cursor.rowcount
        if deleted_count > 0:
            print(f"Deleted {deleted_count} existing devices for bill_id={bill_id}, invoice={invoice_number}")
        
        # Device type mapping (from your image)
        device_type_map = {
            "Laptop": 1,
            "PC": 2,
            "AC": 3,
            "Smart Board": 4,
            "Projector": 5,
            "Printer": 6,
            "Scanner": 7,
            "UPS": 8,
            "Router": 9,
            "Switch": 10,
            "Server": 11,
            "Monitor": 12,
            "Keyboard": 13,
            "Mouse": 14,
            "Webcam": 15,
            "Headset": 16,
            "Other": 17
        }
        
        devices_saved = 0
        asset_counter = 1
        
        # Save each device individually
        for device in devices:
            # Debug: Print entire device object
            print(f"\n=== Processing Device ===")
            print(f"Full device data: {device}")
            
            device_type = device.get("deviceType", "")
            custom_device_type = device.get("customDeviceType", "")
            dept = device.get("dept", "")
            material_desc = device.get("materialDescription", "")
            model_no = device.get("modelNo", "")
            brand = device.get("brand", "")
            warranty = device.get("warranty", "0")
            quantity = device.get("quantity", 1)
            unit_price = device.get("amountPerPcs", 0)
            asset_code = device.get("assetCode", "")
            qr_value = device.get("qrValue", "")
            
            # Debug: Print extracted values
            print(f"Device Type: '{device_type}'")
            print(f"Department: '{dept}' (length: {len(dept)})")
            print(f"Brand: '{brand}'")
            print(f"Quantity: {quantity}")
            
            # Get type_id from mapping
            type_id = device_type_map.get(device_type, 17)  # Default to 17 (Other)
            
            # Parse warranty years (extract numeric value)
            warranty_years = 0
            try:
                # Extract numbers from warranty string (e.g., "2 years" -> 2)
                import re
                warranty_match = re.search(r'\d+', str(warranty))
                if warranty_match:
                    warranty_years = int(warranty_match.group())
            except:
                warranty_years = 0
            
            # Create individual device entries based on quantity
            for i in range(quantity):
                # Generate asset_code if not provided
                if not asset_code:
                    # Generate asset code: DEPT/DEVICETYPE/COUNTER
                    dept_prefix = dept.upper()  # Keep full department name
                    device_prefix = device_type.upper()[:2]
                    generated_asset_code = f"{dept_prefix}/{device_prefix}/{asset_counter}"
                else:
                    generated_asset_code = f"{asset_code}/{asset_counter}"
                
                # Generate QR value if not provided
                if not qr_value:
                    generated_qr_value = f"{invoice_number}|{vendor_name}|{generated_asset_code}"
                else:
                    generated_qr_value = qr_value
                
                # Insert device into database
                print(f"\n=== Inserting into database ===")
                print(f"SQL Values: asset_code='{generated_asset_code}', type_id={type_id}, brand='{brand}', model='{model_no}', spec='{material_desc}', price={unit_price}, date={bill_date}, bill_id={bill_id}, dept='{dept}' (len={len(dept)}), warranty={warranty_years}, active=False, invoice='{invoice_number}', qr='{generated_qr_value}'")
                
                cursor.execute(
                    """
                    INSERT INTO devices 
                    (asset_code, type_id, brand, model, specification, unit_price, purchase_date, 
                     bill_id, dept, warranty_years, is_active, invoice_number, qr_value)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (generated_asset_code, type_id, brand, model_no, material_desc, unit_price, 
                     bill_date, bill_id, dept, warranty_years, False, invoice_number, generated_qr_value)
                )
                
                print(f"✅ Inserted device with asset_code: {generated_asset_code}, dept: '{dept}'")
                
                devices_saved += 1
                asset_counter += 1
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": f"Successfully saved {devices_saved} devices",
            "devices_saved": devices_saved
        })
    
    except Exception as e:
        print(f"Error saving devices: {str(e)}")
        traceback.print_exc()
        
        # ROLLBACK: Delete the bill if devices failed to save
        try:
            if 'bill_id' in locals() and 'invoice_number' in locals() and 'vendor_name' in locals():
                rollback_conn = db.get_connection()
                if rollback_conn:
                    rollback_cursor = rollback_conn.cursor()
                    rollback_cursor.execute(
                        "DELETE FROM bills WHERE bill_id = %s AND invoice_number = %s AND vendor_name = %s",
                        (bill_id, invoice_number, vendor_name)
                    )
                    rollback_conn.commit()
                    rollback_cursor.close()
                    rollback_conn.close()
                    print(f"✅ Rolled back bill_id={bill_id} due to device save failure")
        except Exception as rollback_error:
            print(f"❌ Rollback failed: {rollback_error}")
        
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Search Devices Endpoint
# -----------------------------
@app.route("/search_devices", methods=["GET"])
def search_devices():
    """
    Search for unassigned devices by type_id and group them by brand, model, specification
    """
    try:
        type_id = request.args.get("type_id")
        
        if not type_id:
            return jsonify({"error": "type_id is required"}), 400
        
        # Device type mapping (same as in save_devices endpoint)
        device_type_map = {
            1: "Laptop",
            2: "PC",
            3: "AC",
            4: "Smart Board",
            5: "Projector",
            6: "Printer",
            7: "Scanner",
            8: "UPS",
            9: "Router",
            10: "Switch",
            11: "Server",
            12: "Monitor",
            13: "Keyboard",
            14: "Mouse",
            15: "Webcam",
            16: "Headset",
            17: "Other"
        }
        
        device_type_name = device_type_map.get(int(type_id), "Unknown")
        
        # Get database connection
        conn = db.get_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        
        # Query to group devices by bill_id, brand, model, specification
        # Only get devices with assigned_code = NULL or empty
        query = """
            SELECT 
                type_id,
                bill_id,
                brand,
                model,
                specification,
                unit_price,
                purchase_date,
                invoice_number,
                COUNT(*) as quantity
            FROM devices
            WHERE type_id = %s 
                AND (assigned_code IS NULL OR assigned_code = '')
            GROUP BY type_id, bill_id, brand, model, specification, unit_price, purchase_date, invoice_number
            ORDER BY brand, model
        """
        
        cursor.execute(query, (type_id,))
        results = cursor.fetchall()
        
        # Format results
        grouped_devices = []
        for row in results:
            grouped_devices.append({
                "type": device_type_name,
                "typeId": row['type_id'],
                "billId": row['bill_id'],
                "brand": row['brand'],
                "model": row['model'],
                "specification": row['specification'],
                "unitPrice": float(row['unit_price']) if row['unit_price'] else None,
                "purchaseDate": row['purchase_date'].strftime("%Y-%m-%d") if row['purchase_date'] else None,
                "invoiceNumber": row['invoice_number'],
                "quantity": row['quantity']
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "devices": grouped_devices,
            "total_groups": len(grouped_devices)
        })
    
    except Exception as e:
        print(f"Error searching devices: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Get All Labs
# -----------------------------
@app.route("/get_labs", methods=["GET"])
def get_labs():
    """
    Get all labs from database for dropdown
    """
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """SELECT lab_id, lab_name, rows, columns 
               FROM labs 
               ORDER BY lab_id"""
        )
        labs = cursor.fetchall()
        
        return jsonify({
            "success": True,
            "labs": labs
        })
    
    except Exception as e:
        print(f"Error fetching labs: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "error": str(e),
            "success": False
        }), 500

# -----------------------------
# Get Lab Configuration
# -----------------------------
@app.route("/get_lab/<lab_id>", methods=["GET"])
def get_lab(lab_id):
    """
    Get complete lab configuration including equipment and seating arrangement
    """
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # Get lab basic info
        cursor.execute(
            """SELECT lab_id, lab_name, rows, columns 
               FROM labs 
               WHERE lab_id = %s""",
            (lab_id,)
        )
        lab = cursor.fetchone()
        
        if not lab:
            return jsonify({
                "error": "Lab not found",
                "success": False
            }), 404
        
        # Get equipment pool for this lab with unit prices from devices table
        cursor.execute(
            """SELECT lep.equipment_type, lep.brand, lep.model, lep.specification, 
                      lep.quantity_added, lep.invoice_number, lep.bill_id,
                      AVG(d.unit_price) as avg_unit_price
               FROM lab_equipment_pool lep
               LEFT JOIN devices d ON lep.bill_id = d.bill_id 
                   AND lep.equipment_type = (
                       CASE d.type_id
                           WHEN 1 THEN 'Laptop'
                           WHEN 2 THEN 'PC'
                           WHEN 3 THEN 'AC'
                           WHEN 4 THEN 'Smart Board'
                           WHEN 5 THEN 'Projector'
                           WHEN 6 THEN 'Printer'
                           WHEN 7 THEN 'Scanner'
                           WHEN 8 THEN 'UPS'
                           WHEN 9 THEN 'Router'
                           WHEN 10 THEN 'Switch'
                           WHEN 11 THEN 'Server'
                           WHEN 12 THEN 'Monitor'
                           WHEN 13 THEN 'Keyboard'
                           WHEN 14 THEN 'Mouse'
                           WHEN 15 THEN 'Webcam'
                           WHEN 16 THEN 'Headset'
                           WHEN 17 THEN 'Other'
                       END
                   )
                   AND lep.brand = d.brand
                   AND lep.model = d.model
               WHERE lep.lab_id = %s
               GROUP BY lep.equipment_type, lep.brand, lep.model, lep.specification, 
                        lep.quantity_added, lep.invoice_number, lep.bill_id""",
            (lab_id,)
        )
        equipment_pool = cursor.fetchall()
        print(f"📦 Equipment pool fetched: {len(equipment_pool)} items")
        for eq in equipment_pool:
            print(f"  - {eq['equipment_type']} {eq['brand']} {eq['model']}: {eq['quantity_added']} units @ ₹{eq.get('avg_unit_price', 0) or 0}")
        
        # Get grid cells to reconstruct seating arrangement
        cursor.execute(
            """SELECT row_number, column_number, assigned_code, 
                      equipment_type, os_windows, os_linux, os_other, 
                      is_empty, station_id
               FROM lab_grid_cells
               WHERE lab_id = %s
               ORDER BY row_number, column_number""",
            (lab_id,)
        )
        grid_cells = cursor.fetchall()
        print(f"🗺️ Grid cells fetched: {len(grid_cells)} cells")
        
        # Get station devices for each station
        cursor.execute(
            """SELECT lsd.station_id, lsd.device_id, lsd.device_type, lsd.brand, lsd.model,
                      lsd.specification, lsd.invoice_number, lsd.bill_id,
                      lsd.is_linked, lsd.linked_group_id,
                      ls.assigned_code,
                      d.is_active,
                      d.assigned_code AS device_assigned_code,
                      d.type_id
               FROM lab_station_devices lsd
               JOIN lab_stations ls ON lsd.station_id = ls.station_id
               LEFT JOIN devices d ON lsd.device_id = d.device_id
               WHERE ls.lab_id = %s
               ORDER BY lsd.station_id, lsd.device_type""",
            (lab_id,)
        )
        station_devices = cursor.fetchall()
        print(f"🔧 Station devices fetched: {len(station_devices)} device assignments")
        for sd in station_devices:
            print(f"  - Station {sd['station_id']}: {sd['device_type']} {sd['brand']} {sd['model']} (device_id={sd['device_id']})")

        # Check if severity column exists so we can shape queries without altering schema
        cursor.execute(
            """SELECT 1 FROM information_schema.columns
               WHERE table_name = 'device_issues' AND column_name = 'severity'"""
        )
        severity_exists = cursor.fetchone() is not None

        # Existing station device ids
        device_ids = [sd['device_id'] for sd in station_devices if sd.get('device_id')]

        # Fallback: devices assigned to this lab by assigned_code but missing in lab_station_devices
        cursor.execute(
            """SELECT d.device_id, d.assigned_code, d.is_active, d.brand, d.model,
                          d.bill_id, d.invoice_number, et.name AS device_type, ls.station_id
                   FROM devices d
                   JOIN lab_stations ls ON d.assigned_code = ls.assigned_code
                   LEFT JOIN equipment_types et ON d.type_id = et.type_id
                   WHERE ls.lab_id = %s""",
            (lab_id,)
        )
        fallback_devices = cursor.fetchall()
        fallback_device_ids = [fd['device_id'] for fd in fallback_devices]
        # Merge device ids so we fetch issues for all
        merged_device_ids = list({*device_ids, *fallback_device_ids})

        # Fetch issues for all devices in this lab so UI can show counts/colors
        issues_map = {}
        if merged_device_ids:
            if severity_exists:
                cursor.execute(
                    """SELECT issue_id, device_id, issue_title, description,
                              LOWER(status) AS status, reported_at, resolved_at,
                              COALESCE(severity, 'medium') AS severity
                       FROM device_issues
                       WHERE device_id = ANY(%s)
                       ORDER BY reported_at DESC""",
                    (merged_device_ids,)
                )
            else:
                cursor.execute(
                    """SELECT issue_id, device_id, issue_title, description,
                              LOWER(status) AS status, reported_at, resolved_at,
                              'medium' AS severity
                       FROM device_issues
                       WHERE device_id = ANY(%s)
                       ORDER BY reported_at DESC""",
                    (merged_device_ids,)
                )
            issues = cursor.fetchall()
            for issue in issues:
                dev_id = issue['device_id']
                if dev_id not in issues_map:
                    issues_map[dev_id] = []
                issues_map[dev_id].append({
                    "id": issue['issue_id'],
                    "title": issue['issue_title'],
                    "description": issue['description'],
                    "severity": issue['severity'],
                    "status": issue['status'],
                    "reportedDate": issue['reported_at'].isoformat() if issue['reported_at'] else None,
                })
        
        # Build grid structure
        rows = lab['rows']
        columns = lab['columns']
        grid = [[{"id": None, "equipmentType": "Empty", "os": []} 
                 for _ in range(columns)] for _ in range(rows)]
        
        # Map station_id to devices
        station_device_map = {}
        for sd in station_devices:
            station_id = sd['station_id']
            if station_id not in station_device_map:
                station_device_map[station_id] = {
                    'devices': [],
                    'assigned_code': sd['assigned_code']
                }
            station_device_map[station_id]['devices'].append({
                'deviceId': sd['device_id'],
                'type': sd['device_type'],
                'brand': sd['brand'],
                'model': sd['model'],
                'billId': sd['bill_id'],
                'invoiceNumber': sd['invoice_number'],
                'isActive': sd['is_active'] if sd['is_active'] is not None else True,
                'assignedCode': sd['device_assigned_code'] or sd['assigned_code'],
                'issues': issues_map.get(sd['device_id'], [])
            })

        # Use fallback devices for stations missing lab_station_devices rows
        for fd in fallback_devices:
            station_id = fd['station_id']
            if station_id not in station_device_map:
                station_device_map[station_id] = {
                    'devices': [],
                    'assigned_code': fd['assigned_code']
                }
            if not station_device_map[station_id]['devices']:
                station_device_map[station_id]['devices'].append({
                    'deviceId': fd['device_id'],
                    'type': fd['device_type'],
                    'brand': fd['brand'],
                    'model': fd['model'],
                    'billId': fd['bill_id'],
                    'invoiceNumber': fd['invoice_number'],
                    'isActive': fd['is_active'] if fd['is_active'] is not None else True,
                    'assignedCode': fd['assigned_code'],
                    'issues': issues_map.get(fd['device_id'], [])
                })
        
        # Populate grid with cells
        for cell in grid_cells:
            row_idx = cell['row_number']
            col_idx = cell['column_number']
            
            if row_idx < rows and col_idx < columns:
                os_list = []
                if cell['os_windows']:
                    os_list.append("Windows")
                if cell['os_linux']:
                    os_list.append("Linux")
                if cell['os_other']:
                    os_list.append("Other")
                
                grid_cell = {
                    "id": cell['assigned_code'],
                    "equipmentType": cell['equipment_type'] or "Empty",
                    "os": os_list
                }
                
                # Add device group if station has devices
                station_id = cell['station_id']
                if station_id and station_id in station_device_map:
                    grid_cell['deviceGroup'] = {
                        'assignedCode': station_device_map[station_id]['assigned_code'],
                        'devices': station_device_map[station_id]['devices']
                    }
                
                grid[row_idx][col_idx] = grid_cell
        
        # Format equipment for frontend
        equipment = []
        for eq in equipment_pool:
            equipment.append({
                'type': eq['equipment_type'],
                'quantity': eq['quantity_added'],
                'brand': eq['brand'],
                'model': eq['model'],
                'specification': eq['specification'],
                'invoiceNumber': eq['invoice_number'],
                'billId': eq['bill_id'],
                'unitPrice': float(eq['avg_unit_price']) if eq.get('avg_unit_price') else 0
            })
        
        # Extract assigned code prefix from first assigned code (e.g., "apsit/it/309/1" -> "apsit/it/309")
        assigned_code_prefix = ""
        if grid_cells:
            first_code = None
            for cell in grid_cells:
                if cell['assigned_code']:
                    first_code = cell['assigned_code']
                    break
            
            if first_code:
                # Remove the trailing number (e.g., "apsit/it/309/1" -> "apsit/it/309")
                parts = first_code.rsplit('/', 1)
                if len(parts) == 2:
                    assigned_code_prefix = parts[0]
        
        return jsonify({
            "success": True,
            "lab": {
                "labNumber": lab['lab_id'],
                "labName": lab['lab_name'],
                "equipment": equipment,
                "assignedCodePrefix": assigned_code_prefix,
                "seatingArrangement": {
                    "rows": rows,
                    "columns": columns,
                    "grid": grid
                }
            }
        })
    
    except Exception as e:
        print(f"Error fetching lab configuration: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "error": str(e),
            "success": False
        }), 500

# -----------------------------
# Raise Device Issue
# -----------------------------
@app.route("/raise_issue", methods=["POST"])
def raise_issue():
    """
    Create a device issue, log history, and optionally deactivate the device.
    Expects JSON: { deviceId, title, description, severity, deactivate }
    """
    try:
        data = request.get_json(force=True)
        device_id = data.get("deviceId")
        title = (data.get("title") or "").strip()
        description = (data.get("description") or "").strip()
        severity = (data.get("severity") or "medium").lower()
        deactivate = bool(data.get("deactivate"))

        if not device_id:
            return jsonify({"success": False, "error": "deviceId is required"}), 400
        if not title:
            return jsonify({"success": False, "error": "title is required"}), 400

        conn = db.get_connection()
        cursor = conn.cursor()

        # Check if severity column exists; if missing, we still create issue without it
        cursor.execute(
            """SELECT 1 FROM information_schema.columns
               WHERE table_name = 'device_issues' AND column_name = 'severity'"""
        )
        severity_exists = cursor.fetchone() is not None

        # Validate device
        cursor.execute(
            "SELECT device_id, is_active FROM devices WHERE device_id = %s",
            (device_id,)
        )
        device_row = cursor.fetchone()
        if not device_row:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "error": "Device not found"}), 404

        # Insert issue
        if severity_exists:
            cursor.execute(
                """INSERT INTO device_issues (device_id, issue_title, description, status, severity)
                       VALUES (%s, %s, %s, %s, %s)
                       RETURNING issue_id, reported_at""",
                (device_id, title, description, "open", severity)
            )
        else:
            cursor.execute(
                """INSERT INTO device_issues (device_id, issue_title, description, status)
                       VALUES (%s, %s, %s, %s)
                       RETURNING issue_id, reported_at""",
                (device_id, title, description, "open")
            )
        issue_row = cursor.fetchone()
        issue_id = issue_row['issue_id']
        reported_at = issue_row['reported_at']

        # History log
        cursor.execute(
            """INSERT INTO device_issue_history (issue_id, action, old_status, new_status, note)
                   VALUES (%s, %s, %s, %s, %s)""",
            (issue_id, "created", None, "open", f"severity={severity}")
        )

        # Optionally deactivate device
        if deactivate:
            cursor.execute(
                "UPDATE devices SET is_active = FALSE WHERE device_id = %s",
                (device_id,)
            )

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "issue": {
                "id": issue_id,
                "deviceId": device_id,
                "title": title,
                "description": description,
                "severity": severity,
                "status": "open",
                "reportedDate": reported_at.isoformat() if reported_at else None,
                "deactivated": deactivate
            }
        })

    except Exception as e:
        print(f"Error raising issue: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# -----------------------------
# Save Lab Configuration
# -----------------------------
@app.route("/save_lab", methods=["POST"])
def save_lab():
    """
    Save lab configuration to all lab tables and update devices table
    Tables updated:
    - labs: Basic lab info
    - lab_stations: Individual workstations
    - lab_station_devices: Devices assigned to each station
    - lab_grid_cells: Grid layout visualization
    - lab_equipment_pool: Equipment availability tracking
    - devices: Update lab_id, is_active, qr_value, assigned_code
    """
    try:
        data = request.json
        lab_number = data.get("labNumber", "").strip()
        lab_name = data.get("labName", "").strip()
        seating_arrangement = data.get("seatingArrangement", {})
        equipment = data.get("equipment", [])
        
        if not lab_number:
            return jsonify({"error": "Lab number is required"}), 400
        
        if not lab_name:
            return jsonify({"error": "Lab name is required"}), 400
        
        rows = seating_arrangement.get("rows", 6)
        columns = seating_arrangement.get("columns", 6)
        grid = seating_arrangement.get("grid", [])
        
        # Get database connection
        conn = db.get_connection()
        cursor = conn.cursor()
        
        try:
            # STEP 1: Insert/Update lab in labs table
            cursor.execute(
                "SELECT id FROM labs WHERE lab_id = %s",
                (lab_number,)
            )
            existing_lab = cursor.fetchone()
            
            if existing_lab:
                # Update existing lab
                cursor.execute(
                    """UPDATE labs 
                       SET lab_name = %s, rows = %s, columns = %s 
                       WHERE lab_id = %s""",
                    (lab_name, rows, columns, lab_number)
                )
                lab_pk_id = existing_lab['id']
                
                # Reset all existing device assignments for this lab before re-assigning
                cursor.execute(
                    """UPDATE devices
                       SET lab_id = NULL,
                           assigned_code = NULL,
                           qr_value = NULL,
                           is_active = FALSE
                       WHERE lab_id = %s""",
                    (lab_number,)
                )
                print(f"🔄 Reset {cursor.rowcount} devices previously assigned to lab {lab_number}")
                
                # Clean up old data for this lab
                cursor.execute("DELETE FROM lab_grid_cells WHERE lab_id = %s", (lab_number,))
                cursor.execute("DELETE FROM lab_station_devices WHERE station_id IN (SELECT station_id FROM lab_stations WHERE lab_id = %s)", (lab_number,))
                cursor.execute("DELETE FROM lab_stations WHERE lab_id = %s", (lab_number,))
                cursor.execute("DELETE FROM lab_equipment_pool WHERE lab_id = %s", (lab_number,))
            else:
                # Insert new lab
                cursor.execute(
                    """INSERT INTO labs (lab_id, lab_name, rows, columns) 
                       VALUES (%s, %s, %s, %s) RETURNING id""",
                    (lab_number, lab_name, rows, columns)
                )
                lab_pk_id = cursor.fetchone()['id']
            
            # STEP 2: Insert equipment pool
            for eq in equipment:
                cursor.execute(
                    """INSERT INTO lab_equipment_pool 
                       (lab_id, equipment_type, brand, model, specification, quantity_added, 
                        invoice_number, bill_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (lab_number, eq.get('type'), eq.get('brand'), eq.get('model'),
                     eq.get('specification'), eq.get('quantity'), eq.get('invoiceNumber'),
                     eq.get('billId'))
                )
            
            # Track which device_ids we have already assigned in this save to avoid reusing the same row
            used_device_ids = set()

            # STEP 3: Process grid and create stations
            station_counter = 0
            devices_assigned = 0
            
            for row_idx, row in enumerate(grid):
                for col_idx, cell in enumerate(row):
                    device_group = cell.get("deviceGroup")
                    
                    if device_group:
                        assigned_code = device_group.get("assignedCode", "")
                        devices = device_group.get("devices", [])
                        os_list = cell.get("os", [])
                        equipment_type = cell.get("equipmentType", "PC")
                        
                        # Insert station
                        cursor.execute(
                            """INSERT INTO lab_stations 
                               (lab_id, assigned_code, row_number, column_number)
                               VALUES (%s, %s, %s, %s) RETURNING station_id""",
                            (lab_number, assigned_code, row_idx, col_idx)
                        )
                        station_id = cursor.fetchone()['station_id']
                        station_counter += 1
                        
                        # Insert grid cell
                        cursor.execute(
                            """INSERT INTO lab_grid_cells 
                               (lab_id, row_number, column_number, assigned_code, equipment_type,
                                os_windows, os_linux, os_other, is_empty, station_id)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                            (lab_number, row_idx, col_idx, assigned_code, equipment_type,
                             "Windows" in os_list, "Linux" in os_list, "Other" in os_list,
                             False, station_id)
                        )
                        
                        # Process devices in this station
                        # Determine if devices are linked (more than 1 device type in station)
                        is_linked = len(devices) > 1
                        # For linked_group_id, we'll use a simple counter based on order
                        # You can enhance this to track actual group IDs from frontend
                        linked_group_id = station_counter if is_linked else None
                        
                        for device in devices:
                            device_type = device.get("type")
                            brand = device.get("brand")
                            model = device.get("model")
                            bill_id = device.get("billId")
                            invoice_number = device.get("invoiceNumber")
                            
                            # Find device from devices table:
                            # - Either unassigned (assigned_code IS NULL or '')
                            # - OR already assigned to this lab (lab_id matches)
                            # Build dynamic NOT IN clause to avoid reusing the same device_id in this save
                            not_in_clause = ""
                            params = [device_type, brand, model, bill_id, invoice_number]
                            if used_device_ids:
                                placeholders = ','.join(['%s'] * len(used_device_ids))
                                not_in_clause = f" AND device_id NOT IN ({placeholders})"
                                params.extend(list(used_device_ids))

                            cursor.execute(
                                f"""SELECT device_id, specification FROM devices
                                   WHERE type_id = (
                                       SELECT type_id FROM equipment_types WHERE name = %s LIMIT 1
                                   )
                                   AND brand IS NOT DISTINCT FROM %s
                                   AND model IS NOT DISTINCT FROM %s
                                   AND bill_id IS NOT DISTINCT FROM %s
                                   AND invoice_number IS NOT DISTINCT FROM %s
                                   AND (assigned_code IS NULL OR assigned_code = '')
                                   {not_in_clause}
                                   ORDER BY device_id ASC
                                   LIMIT 1""",
                                params
                            )
                            device_record = cursor.fetchone()
                            
                            if device_record:
                                device_id = device_record['device_id']
                                specification = device_record['specification']
                                
                                # Update devices table: set lab_id, is_active=true, qr_value, assigned_code
                                cursor.execute(
                                    """UPDATE devices
                                       SET lab_id = %s,
                                           is_active = TRUE,
                                           qr_value = %s,
                                           assigned_code = %s
                                       WHERE device_id = %s""",
                                    (lab_number, assigned_code, assigned_code, device_id)
                                )
                                
                                # Insert into lab_station_devices with specification, is_linked, linked_group_id
                                cursor.execute(
                                    """INSERT INTO lab_station_devices
                                       (station_id, device_id, device_type, brand, model, specification,
                                        invoice_number, bill_id, is_linked, linked_group_id)
                                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                                    (station_id, device_id, device_type, brand, model, specification,
                                     invoice_number, bill_id, is_linked, linked_group_id)
                                )
                                
                                devices_assigned += 1
                                used_device_ids.add(device_id)
                            else:
                                print(f"Warning: No unassigned device found for {device_type} {brand} {model}")
                    
                    else:
                        # Empty cell
                        cursor.execute(
                            """INSERT INTO lab_grid_cells 
                               (lab_id, row_number, column_number, assigned_code, equipment_type,
                                os_windows, os_linux, os_other, is_empty, station_id)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                            (lab_number, row_idx, col_idx, None, "Empty",
                             False, False, False, True, None)
                        )
            
            # STEP 4: Update quantity_assigned in lab_equipment_pool
            cursor.execute(
                """UPDATE lab_equipment_pool lep
                   SET quantity_assigned = (
                       SELECT COUNT(*)
                       FROM lab_station_devices lsd
                       JOIN lab_stations ls ON lsd.station_id = ls.station_id
                       WHERE ls.lab_id = lep.lab_id
                         AND lsd.device_type = lep.equipment_type
                         AND lsd.brand = lep.brand
                         AND lsd.model = lep.model
                         AND lsd.bill_id = lep.bill_id
                   )
                   WHERE lab_id = %s""",
                (lab_number,)
            )
            
            conn.commit()
            
            return jsonify({
                "success": True,
                "message": f"Lab '{lab_name}' (Lab {lab_number}) saved successfully",
                "stations_created": station_counter,
                "devices_assigned": devices_assigned
            })
            
        except Exception as db_error:
            conn.rollback()
            raise db_error
            
        finally:
            cursor.close()
            conn.close()
    
    except Exception as e:
        print(f"Error saving lab: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Get All Devices Endpoint
# -----------------------------
@app.route("/get_all_devices", methods=["GET"])
def get_all_devices():
    """
    Fetch all devices from the database with their details including lab assignments
    """
    try:
        conn = db.get_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        
        # Query to get all devices with equipment type name and lab name
        query = """
            SELECT 
                d.device_id,
                d.asset_code as asset_id,
                d.assigned_code,
                d.lab_id,
                l.lab_name,
                d.type_id,
                et.name as type_name,
                d.brand,
                d.model,
                d.specification,
                d.invoice_number,
                d.bill_id,
                d.purchase_date,
                d.unit_price,
                d.is_active,
                CASE 
                    WHEN d.purchase_date IS NOT NULL AND d.warranty_years > 0 
                    THEN d.purchase_date + (d.warranty_years || ' years')::interval
                    ELSE NULL
                END as warranty_expiry,
                d.qr_value
            FROM devices d
            LEFT JOIN equipment_types et ON d.type_id = et.type_id
            LEFT JOIN labs l ON d.lab_id = l.lab_id
            ORDER BY et.name, d.brand, d.model, d.device_id
        """
        
        cursor.execute(query)
        devices = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "devices": devices,
            "total": len(devices)
        })
    
    except Exception as e:
        print(f"Error fetching all devices: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Get Bill Details by Bill ID
# -----------------------------
@app.route("/get_bill/<int:bill_id>", methods=["GET"])
def get_bill(bill_id):
    """
    Get bill details by bill_id
    """
    try:
        print(f"Fetching bill details for bill_id: {bill_id}")
        conn = db.get_connection()
        if not conn:
            print("Database connection failed")
            return jsonify({"success": False, "error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        
        # Fetch bill details
        cursor.execute(
            """SELECT bill_id, invoice_number, vendor_name, gstin, 
                      bill_date, total_amount, tax_amount, stock_entry
               FROM bills 
               WHERE bill_id = %s""",
            (bill_id,)
        )
        bill = cursor.fetchone()
        
        if not bill:
            print(f"Bill not found for bill_id: {bill_id}")
            cursor.close()
            conn.close()
            return jsonify({"success": False, "error": "Bill not found"}), 404
        
        print(f"Bill found: {bill['invoice_number']}")
        
        # Fetch devices associated with this bill
        cursor.execute(
            """SELECT asset_code, type_id, brand, model, specification,
                      unit_price, purchase_date, assigned_code, lab_id,
                      warranty_years, is_active, invoice_number, dept, qr_value
               FROM devices
               WHERE bill_id = %s""",
            (bill_id,)
        )
        devices = cursor.fetchall()
        print(f"Found {len(devices)} devices for this bill")
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "bill": {
                "billId": bill['bill_id'],
                "invoiceNumber": bill['invoice_number'],
                "vendorName": bill['vendor_name'],
                "vendorGstin": bill['gstin'],
                "billDate": bill['bill_date'].strftime("%Y-%m-%d") if bill['bill_date'] else None,
                "totalAmount": float(bill['total_amount']) if bill['total_amount'] else 0,
                "taxAmount": float(bill['tax_amount']) if bill['tax_amount'] else 0,
                "stockEntry": bill['stock_entry']
            },
            "devices": [
                {
                    "assetCode": device['asset_code'],
                    "typeId": device['type_id'],
                    "brand": device['brand'],
                    "model": device['model'],
                    "specification": device['specification'],
                    "unitPrice": float(device['unit_price']) if device['unit_price'] else 0,
                    "purchaseDate": device['purchase_date'].strftime("%Y-%m-%d") if device['purchase_date'] else None,
                    "assignedCode": device['assigned_code'],
                    "labId": device['lab_id'],
                    "warrantyYears": device['warranty_years'],
                    "isActive": device['is_active'],
                    "invoiceNumber": device['invoice_number'],
                    "dept": device['dept'],
                    "qrValue": device['qr_value']
                }
                for device in devices
            ]
        })
    
    except Exception as e:
        print(f"Error fetching bill: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# -----------------------------
# Run App
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)