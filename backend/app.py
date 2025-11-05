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
                    
                    # Generate QR code for this specific unit
                    qr_data = {
                        "asset_id": asset_id,
                        "bill_id": str(bill.id),
                        "name": extracted_asset.name,
                        "category": extracted_asset.category,
                        "bill_number": bill_info.bill_number,
                        "vendor": bill_info.vendor_name,
                        "date": bill_info.bill_date,
                        "serial_number": unit_serial_number,
                        "unit": f"{unit_idx + 1} of {quantity}"
                    }
                    
                    qr_code_image = extractor.generate_qr_code(json.dumps(qr_data))
                    
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
# Run App
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)