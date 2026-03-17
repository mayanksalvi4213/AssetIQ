from flask import Flask, request, jsonify, send_file, send_from_directory
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
import uuid
import requests
import time
from dotenv import load_dotenv
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from werkzeug.utils import secure_filename

# Load env variables
load_dotenv()
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 24))
LLM_WHISPERER_API_KEY = os.getenv("LLM_WHISPERER_API_KEY")

# Import models and services
from models.user import User
from models.bill import Bill, Asset
from ocr_bridge import OcrRegexExtractor
from config.database import db
from utils.jwt_utils import decode_token

# LLM fallback availability check
try:
    from llm_fallback import is_llm_available
except ImportError:
    def is_llm_available():
        return False

app = Flask(__name__)
CORS(app)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
ALLOWED_BILL_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Initialize OCR regex extractor (uses classifier + regex templates)
extractor = OcrRegexExtractor()


def _slugify_filename(value: str, fallback: str = "bill") -> str:
    value = (value or "").strip().lower()
    if not value:
        return fallback
    value = re.sub(r"[^a-z0-9]+", "_", value).strip("_")
    return value or fallback


def _save_bill_file(upload, invoice_number: str = "", vendor_name: str = "") -> str:
    if not upload or not upload.filename:
        raise ValueError("No file provided")

    original_name = secure_filename(upload.filename)
    _, ext = os.path.splitext(original_name)
    ext = ext.lower()

    if ext not in ALLOWED_BILL_EXTENSIONS:
        raise ValueError("Only PDF, JPG, JPEG, and PNG files are supported")

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    vendor_slug = _slugify_filename(vendor_name, "vendor")
    invoice_slug = _slugify_filename(invoice_number, "invoice")
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_suffix = uuid.uuid4().hex[:8]
    filename = f"{vendor_slug}_{invoice_slug}_{timestamp}_{unique_suffix}{ext}"

    full_path = os.path.join(UPLOAD_DIR, filename)
    upload.save(full_path)

    return f"uploads/{filename}"


def _delete_bill_file(relative_path: str) -> None:
    if not relative_path:
        return

    filename = os.path.basename(relative_path)
    if not filename:
        return

    full_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(full_path):
        os.remove(full_path)


@app.route("/llm-status", methods=["GET"])
def llm_status():
    """Check if the local LLM server is reachable."""
    available = is_llm_available()
    return jsonify({"available": available, "model": "qwen2.5-3b-instruct", "port": 8080})

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


def poll_llm_whisperer_status(whisper_hash: str, api_key: str, max_attempts: int = 15) -> str:
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
            # For images, try LLM Whisperer first (gives table-structured output),
            # fall back to pytesseract if unavailable
            print("Processing image file with LLM Whisperer (table mode)...")
            try:
                raw_text = extract_text_with_llm_whisperer(file_content, LLM_WHISPERER_API_KEY)
                print(f"Successfully extracted {len(raw_text)} characters from image via LLM Whisperer")
            except Exception as api_error:
                print(f"LLM Whisperer failed for image: {api_error}")
                print("Falling back to pytesseract for image...")
                try:
                    file.stream.seek(0)
                    image = Image.open(file.stream)
                    raw_text = pytesseract.image_to_string(image, lang="eng")
                    print(f"Successfully extracted {len(raw_text)} characters from image via pytesseract")
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
        
        # STEP 2: Parse extracted text using classifier + regex templates
        print("Parsing bill information via OCR regex pipeline...")
        print(f"Raw text preview (first 1000 chars): {raw_text[:1000]}")

        # Check if user wants LLM fallback (default: yes if available)
        use_llm = request.form.get("use_llm", "true").lower() != "false"

        try:
            bill_info, _ = extractor.extract_bill_info(raw_text, use_llm_fallback=use_llm)
        except Exception as parse_error:
            print(f"Parse error details: {parse_error}")
            print(traceback.format_exc())
            return jsonify({
                "error": f"Parsing Error: {str(parse_error)}",
                "raw_text": raw_text,
                "details": "Could not parse the extracted text"
            }), 500
        
        # Validate extraction
        if not bill_info.bill_number and not bill_info.vendor_name:
            return jsonify({
                "error": "Could not extract essential bill information",
                "raw_text": raw_text,
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
        
        # Display-only bill object (no database save during scan)
        bill_id = f"preview-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Build asset records for display only - one for each individual unit
        created_assets = []
        asset_counter = 1  # Start from 1 for sequential numbering
        
        for extracted_asset in bill_info.assets:
            # Get serial numbers (batch numbers) for this item
            serial_numbers = []
            if extracted_asset.serial_number:
                serial_numbers = [s.strip() for s in extracted_asset.serial_number.split(',') if s.strip()]
            
            # Create individual assets - one for each quantity
            quantity = extracted_asset.quantity
            print(f"Building {quantity} individual assets for display: {extracted_asset.name}")
            
            for unit_idx in range(quantity):
                try:
                    # Generate unique asset ID for each unit (display only)
                    if asset_id_prefix:
                        asset_id = f"{asset_id_prefix}{asset_counter}"
                    else:
                        asset_id = f"{extracted_asset.category[:3].upper()}{datetime.now().strftime('%Y%m%d%H%M%S')}{asset_counter}"
                    
                    asset_counter += 1
                    
                    # Get the specific serial number for this unit (if available)
                    unit_serial_number = serial_numbers[unit_idx] if unit_idx < len(serial_numbers) else ''
                    
                    # Generate QR code with invoice number + vendor name + device code
                    qr_code_data = f"{bill_info.bill_number}|{bill_info.vendor_name}|{asset_id}"
                    qr_code_image = extractor.generate_qr_code(qr_code_data)
                    
                    created_assets.append({
                        "asset_id": asset_id,
                        "name": extracted_asset.name,
                        "category": extracted_asset.category,
                        "quantity": 1,
                        "unit_price": extracted_asset.unit_price,
                        "total_price": extracted_asset.unit_price,
                        "qr_code": qr_code_image,
                        "brand": extracted_asset.brand,
                        "model": extracted_asset.model,
                        "serial_number": unit_serial_number,
                        "warranty_period": extracted_asset.warranty_period,
                        "device_type": extracted_asset.device_type
                    })
                    
                    print(f"Built asset {unit_idx + 1}/{quantity}: {asset_id} - {extracted_asset.name} (S/N: {unit_serial_number})")
                    
                except Exception as e:
                    print(f"Error building asset unit {unit_idx + 1}/{quantity}: {e}")
                    print(traceback.format_exc())
                    continue
        
        print(f"Total assets built for display: {len(created_assets)}")
        
        return jsonify({
            "success": True,
            "message": f"Successfully processed bill and created {len(created_assets)} assets",
            "llm_enhanced": getattr(bill_info, 'llm_enhanced', False),
            "bill_info": {
                "id": bill_id,
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
            "raw_text": raw_text
        })
        
    except Exception as e:
        print(f"Error in scan endpoint: {e}")
        print(traceback.format_exc())
        return jsonify({
            "error": str(e), 
            "trace": traceback.format_exc()
        }), 500


@app.route("/upload_bill_file", methods=["POST"])
def upload_bill_file():
    """Upload a bill PDF/image and return its stored path"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Unauthorized"}), 401

        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        upload = request.files["file"]
        invoice_number = request.form.get("invoiceNumber", "")
        vendor_name = request.form.get("vendorName", "")

        stored_path = _save_bill_file(upload, invoice_number, vendor_name)
        return jsonify({"success": True, "path": stored_path})
    except Exception as e:
        print(f"Error uploading bill file: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/delete_bill_file", methods=["POST"])
def delete_bill_file():
    """Delete a previously uploaded bill file"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.get_json() or {}
        file_path = (data.get("path") or "").strip()
        if not file_path:
            return jsonify({"error": "No file path provided"}), 400

        _delete_bill_file(file_path)
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error deleting bill file: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_bill_file(filename: str):
    """Serve a stored bill file from uploads directory (auth required)"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401

    safe_name = os.path.basename(filename)
    if not safe_name:
        return jsonify({"error": "Invalid filename"}), 400

    return send_from_directory(UPLOAD_DIR, safe_name, as_attachment=False)


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
        "role": user.role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }, JWT_SECRET_KEY, algorithm="HS256")
    return jsonify({
        "message": "Login successful", 
        "token": token,
        "user": {
            "id": user.id,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "email": user.email,
            "role": user.role,
            "assignedLab": user.assigned_lab
        }
    })


@app.route("/user/profile", methods=["GET"])
def get_user_profile():
    """Get current user profile"""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    return jsonify({
        "id": user.id,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "email": user.email,
        "role": user.role,
        "assignedLab": user.assigned_lab,
        "accessScope": user.access_scope if hasattr(user, 'access_scope') else {}
    })


@app.route("/user/update", methods=["PUT"])
def update_user_profile():
    """Update current user profile"""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json()
    
    try:
        # Update basic info
        if "firstName" in data:
            user.first_name = data["firstName"]
        if "lastName" in data:
            user.lastName = data["lastName"]
        if "email" in data:
            # Check if email is already taken by another user
            existing = User.find_by_email(data["email"])
            if existing and existing.id != user.id:
                return jsonify({"error": "Email already in use"}), 400
            user.email = data["email"]
        
        # Update role and lab (only if provided)
        if "role" in data:
            user.role = data["role"]
        if "assignedLab" in data:
            user.assigned_lab = data["assignedLab"]
        
        # Handle password change
        if "newPassword" in data and data["newPassword"]:
            if "currentPassword" not in data:
                return jsonify({"error": "Current password required"}), 400
            if not User.verify_password(data["currentPassword"], user.password_hash):
                return jsonify({"error": "Current password is incorrect"}), 401
            user.password_hash = User.hash_password(data["newPassword"])
        
        # Save to database
        cursor = db.cursor()
        cursor.execute("""
            UPDATE users 
            SET first_name = %s, last_name = %s, email = %s, 
                role = %s, assigned_lab = %s, password_hash = %s,
                updated_at = NOW()
            WHERE id = %s
        """, (user.first_name, user.last_name, user.email, 
              user.role, user.assigned_lab, user.password_hash, user.id))
        db.commit()
        cursor.close()
        
        return jsonify({"message": "Profile updated successfully"})
        
    except Exception as e:
        print(f"Error updating profile: {e}")
        return jsonify({"error": "Failed to update profile"}), 500


@app.route("/verify_token", methods=["GET"])
def verify_token():
    """Verify if token is valid and return user info"""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Invalid or expired token"}), 401
    
    return jsonify({
        "valid": True,
        "user": {
            "id": user.id,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "email": user.email,
            "role": user.role,
            "assignedLab": user.assigned_lab
        }
    })

# -----------------------------
# Generate QR Codes Endpoint
# -----------------------------
@app.route("/generate_qr", methods=["POST"])
def generate_qr():
    """
    Generate QR code images from a list of data strings.
    Expects: { "items": [ { "data": "qr_string", "index": 0 }, ... ] }
    Returns: { "qr_codes": [ { "index": 0, "qr_code": "data:image/png;base64,..." }, ... ] }
    """
    try:
        import qrcode
        from io import BytesIO
        import base64

        data = request.get_json()
        items = data.get("items", [])

        if not items:
            return jsonify({"error": "No items provided"}), 400

        results = []
        for item in items:
            qr_data = item.get("data", "")
            idx = item.get("index", 0)

            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_data)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")

            buffered = BytesIO()
            img.save(buffered, format="PNG")
            qr_base64 = f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode()}"

            results.append({"index": idx, "qr_code": qr_base64})

        return jsonify({"qr_codes": results})
    except Exception as e:
        print(f"Error generating QR codes: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

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
        prefix_counters = {}  # per-prefix counter so each prefix starts at 1
        
        for device in devices:
            device_type = device.get("deviceType", "")
            dept = device.get("dept", "")
            material_desc = device.get("materialDescription", "")
            model_no = device.get("modelNo", "")
            brand = device.get("brand", "")
            identity_number = device.get("identityNumber", "")
            quantity = device.get("quantity", 1)
            amount_per_pcs = device.get("amountPerPcs", 0)

            # Use identityNumber (prefix code) from user or generate default
            if identity_number:
                asset_id_base = identity_number
            else:
                # Fallback to auto-generated prefix
                dept_prefix = ''.join([c for c in dept.upper() if c.isalnum()])[:5]
                asset_id_base = f"{dept_prefix}/{device_type.upper()[:3]}"
            
            # Create multiple assets if quantity > 1
            for i in range(quantity):
                if asset_id_base not in prefix_counters:
                    prefix_counters[asset_id_base] = 1
                asset_counter = prefix_counters[asset_id_base]
                prefix_counters[asset_id_base] += 1
                asset_id = f"{asset_id_base}/{asset_counter}"
                
                # Generate QR code with invoice number + vendor name + device code
                import qrcode
                from io import BytesIO
                import base64
                
                # Get invoice and vendor from current device
                device_invoice = device.get("invoiceNo", invoice_no)
                qr_code_data = f"{device_invoice}|{asset_id}"
                
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
        bill_file_path = (data.get("billFilePath") or "").strip()
        
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
            "SELECT bill_id, path FROM bills WHERE vendor_name = %s AND invoice_number = %s",
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
            existing_path = existing_bill.get("path") if existing_bill else None
            if bill_file_path and existing_path and bill_file_path != existing_path:
                _delete_bill_file(existing_path)

            cursor.execute(
                """
                UPDATE bills 
                SET gstin = %s, stock_entry = %s, tax_amount = %s, 
                    total_amount = %s, bill_date = %s, path = %s
                WHERE bill_id = %s
                """,
                (
                    gstin,
                    stock_entry,
                    tax_amount,
                    total_amount,
                    db_bill_date,
                    bill_file_path or existing_path,
                    existing_bill['bill_id']
                )
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
                (invoice_number, vendor_name, gstin, stock_entry, tax_amount, total_amount, bill_date, path)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING bill_id
                """,
                (invoice_number, vendor_name, gstin, stock_entry, tax_amount, total_amount, db_bill_date, bill_file_path)
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
        order_no = data.get("orderNo", "").strip()
        order_date = data.get("orderDate", "").strip()
        central_store_no = data.get("centralStoreNo", "").strip()
        central_store_date = data.get("centralStoreDate", "").strip()
        remarks = data.get("remarks", "").strip()

        # Convert DD/MM/YYYY to YYYY-MM-DD for database
        db_order_date = None
        if order_date:
            try:
                parts = order_date.split('/')
                if len(parts) == 3:
                    db_order_date = f"{parts[2]}-{parts[1]}-{parts[0]}"
            except:
                db_order_date = None

        db_central_store_date = None
        if central_store_date:
            try:
                parts = central_store_date.split('/')
                if len(parts) == 3:
                    db_central_store_date = f"{parts[2]}-{parts[1]}-{parts[0]}"
            except:
                db_central_store_date = None
        
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

        # Build prefix_counters from DB so numbering continues across bills
        prefix_codes = set()
        for device in devices:
            id_num = device.get("identityNumber", "")
            if id_num:
                prefix_codes.add(id_num)

        prefix_counters = {}
        for prefix in prefix_codes:
            cursor.execute(
                "SELECT asset_code FROM devices WHERE asset_code LIKE %s",
                (prefix + "/%",)
            )
            existing = cursor.fetchall()
            max_counter = 0
            for row in existing:
                code = row['asset_code']
                # The counter is the last segment after the prefix
                suffix = code[len(prefix)+1:]  # strip "prefix/"
                try:
                    num = int(suffix)
                    if num > max_counter:
                        max_counter = num
                except (ValueError, IndexError):
                    pass
            prefix_counters[prefix] = max_counter + 1

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
            identity_number = device.get("identityNumber", "")
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
                # Generate asset_code using identity number prefix
                if identity_number:
                    # Use per-prefix counter so each prefix starts from 1
                    if identity_number not in prefix_counters:
                        prefix_counters[identity_number] = 1
                    counter = prefix_counters[identity_number]
                    generated_asset_code = f"{identity_number}/{counter}"
                    prefix_counters[identity_number] += 1
                else:
                    # Fallback: Generate asset code from DEPT/DEVICETYPE/COUNTER
                    dept_prefix = dept.upper()  # Keep full department name
                    device_prefix = device_type.upper()[:2]
                    generated_asset_code = f"{dept_prefix}/{device_prefix}/{asset_counter}"
                
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
                     bill_id, dept, warranty_years, is_active, invoice_number, qr_value,
                     order_no, order_date, central_store_no, central_store_date, remarks)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (generated_asset_code, type_id, brand, model_no, material_desc, unit_price, 
                     bill_date, bill_id, dept, warranty_years, False, invoice_number, generated_qr_value,
                     order_no, db_order_date, central_store_no, db_central_store_date, remarks)
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
        # Only get devices that are truly free (no assigned_code AND not pooled to any lab)
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
                AND lab_id IS NULL
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
# Reserve Devices for Lab (pool by device_id)
# -----------------------------
@app.route("/reserve_devices_for_lab", methods=["POST"])
def reserve_devices_for_lab():
    """Reserve specific device rows for a lab by setting lab_id. Devices become part of the lab pool."""
    try:
        data = request.json
        lab_id = data.get("labId", "").strip()
        type_name = data.get("type", "")
        brand = data.get("brand")
        model = data.get("model")
        bill_id = data.get("billId")
        invoice_number = data.get("invoiceNumber")
        quantity = int(data.get("quantity", 0))

        if not lab_id:
            return jsonify({"error": "labId is required"}), 400
        if not type_name:
            return jsonify({"error": "type is required"}), 400
        if quantity <= 0:
            return jsonify({"error": "quantity must be > 0"}), 400

        conn = db.get_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        cursor = conn.cursor()

        try:
            # Find N free devices matching criteria (not pooled, not assigned)
            cursor.execute("""
                SELECT device_id FROM devices
                WHERE type_id = (SELECT type_id FROM equipment_types WHERE name = %s LIMIT 1)
                  AND brand IS NOT DISTINCT FROM %s
                  AND model IS NOT DISTINCT FROM %s
                  AND bill_id IS NOT DISTINCT FROM %s
                  AND invoice_number IS NOT DISTINCT FROM %s
                  AND (assigned_code IS NULL OR assigned_code = '')
                  AND lab_id IS NULL
                ORDER BY device_id
                LIMIT %s
            """, (type_name, brand, model, bill_id, invoice_number, quantity))
            rows = cursor.fetchall()

            if len(rows) < quantity:
                return jsonify({"error": f"Only {len(rows)} devices available, requested {quantity}"}), 400

            device_ids = [r['device_id'] for r in rows]

            # Mark devices as pooled for this lab
            cursor.execute(
                "UPDATE devices SET lab_id = %s WHERE device_id = ANY(%s)",
                (lab_id, device_ids)
            )

            conn.commit()
            return jsonify({
                "success": True,
                "message": f"{quantity} {type_name}(s) reserved for lab {lab_id}",
                "deviceIds": device_ids
            })
        except Exception as db_err:
            conn.rollback()
            raise db_err
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        print(f"Error reserving devices: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Release Devices from Lab Pool
# -----------------------------
@app.route("/release_devices_from_lab", methods=["POST"])
def release_devices_from_lab():
    """Release pooled-but-unassigned devices from a lab back to free inventory."""
    try:
        data = request.json
        lab_id = data.get("labId", "").strip()
        type_name = data.get("type", "")
        brand = data.get("brand")
        model = data.get("model")
        bill_id = data.get("billId")
        invoice_number = data.get("invoiceNumber")
        quantity = int(data.get("quantity", 0))

        if not lab_id:
            return jsonify({"error": "labId is required"}), 400
        if quantity <= 0:
            return jsonify({"error": "quantity must be > 0"}), 400

        conn = db.get_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        cursor = conn.cursor()

        try:
            # Only release devices that are pooled but NOT yet assigned
            cursor.execute("""
                SELECT device_id FROM devices
                WHERE lab_id = %s
                  AND type_id = (SELECT type_id FROM equipment_types WHERE name = %s LIMIT 1)
                  AND brand IS NOT DISTINCT FROM %s
                  AND model IS NOT DISTINCT FROM %s
                  AND bill_id IS NOT DISTINCT FROM %s
                  AND invoice_number IS NOT DISTINCT FROM %s
                  AND (assigned_code IS NULL OR assigned_code = '')
                ORDER BY device_id
                LIMIT %s
            """, (lab_id, type_name, brand, model, bill_id, invoice_number, quantity))
            rows = cursor.fetchall()
            released_count = len(rows)

            if released_count == 0:
                return jsonify({
                    "success": False,
                    "error": "No unassigned devices of this type to release. Reset assignments first if they are already assigned."
                }), 400

            device_ids = [r['device_id'] for r in rows]
            cursor.execute(
                "UPDATE devices SET lab_id = NULL WHERE device_id = ANY(%s)",
                (device_ids,)
            )

            conn.commit()
            return jsonify({
                "success": True,
                "message": f"{released_count} device(s) released from lab {lab_id}",
                "releasedCount": released_count,
                "deviceIds": device_ids
            })
        except Exception as db_err:
            conn.rollback()
            raise db_err
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        print(f"Error releasing devices: {e}")
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
            """SELECT lab_id, lab_name, rows, columns, layout_id
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
        
        # Get equipment pool directly from devices table (source of truth)
        cursor.execute(
            """SELECT et.name AS equipment_type, d.brand, d.model, d.specification,
                      d.invoice_number, d.bill_id,
                      AVG(d.unit_price) AS avg_unit_price,
                      COUNT(*) AS quantity,
                      COUNT(CASE WHEN d.assigned_code IS NOT NULL AND d.assigned_code != ''
                            THEN 1 END) AS quantity_assigned
               FROM devices d
               JOIN equipment_types et ON d.type_id = et.type_id
               WHERE d.lab_id = %s
               GROUP BY et.name, d.brand, d.model, d.specification,
                        d.invoice_number, d.bill_id""",
            (lab_id,)
        )
        equipment_pool = cursor.fetchall()
        print(f"📦 Equipment pool fetched: {len(equipment_pool)} items")
        for eq in equipment_pool:
            print(f"  - {eq['equipment_type']} {eq['brand']} {eq['model']}: {eq['quantity']} units ({eq['quantity_assigned']} assigned) @ ₹{eq.get('avg_unit_price', 0) or 0}")
        
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

        # Fetch layout blueprint cells (station types) to render empty stations
        layout_map = {}
        layout_id = lab.get('layout_id')
        if layout_id:
            cursor.execute(
                """SELECT lc.row_number, lc.column_number,
                          lc.station_type_id, lc.os_windows, lc.os_linux, lc.os_other,
                          st.name AS station_type_name, st.name AS station_type_label
                   FROM lab_layout_cells lc
                   LEFT JOIN station_types st ON lc.station_type_id = st.station_type_id
                   WHERE lc.layout_id = %s""",
                (layout_id,)
            )
            layout_cells = cursor.fetchall()
            for cell in layout_cells:
                if cell['station_type_id'] is None:
                    continue
                os_list = []
                if cell['os_windows']:
                    os_list.append("Windows")
                if cell['os_linux']:
                    os_list.append("Linux")
                if cell['os_other']:
                    os_list.append("Other")
                layout_map[(cell['row_number'], cell['column_number'])] = {
                    'stationTypeLabel': cell['station_type_label'] or cell['station_type_name'] or 'Empty',
                    'os': os_list
                }
        
        # Get station devices for each station
        # Check if station_qr_value column exists
        cursor.execute(
            """SELECT 1 FROM information_schema.columns
               WHERE table_name = 'lab_stations' AND column_name = 'station_qr_value'"""
        )
        has_station_qr_col = cursor.fetchone() is not None

        station_qr_select = ", ls.station_qr_value" if has_station_qr_col else ""
        cursor.execute(
            f"""SELECT lsd.station_id, lsd.device_id, lsd.device_type, lsd.brand, lsd.model,
                      lsd.specification, lsd.invoice_number, lsd.bill_id,
                      lsd.is_linked, lsd.linked_group_id,
                      ls.assigned_code,
                      d.is_active,
                      d.assigned_code AS device_assigned_code,
                      d.type_id
                      {station_qr_select}
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

        # Existing station device ids
        device_ids = [sd['device_id'] for sd in station_devices if sd.get('device_id')]

        # Fallback: devices assigned to this lab by assigned_code but missing in lab_station_devices
        # Only include devices that are currently assigned to this lab (lab_id matches)
        cursor.execute(
            """SELECT d.device_id, d.assigned_code, d.is_active, d.brand, d.model,
                          d.bill_id, d.invoice_number, et.name AS device_type, ls.station_id
                   FROM devices d
                   JOIN lab_stations ls ON d.assigned_code = ls.assigned_code
                   LEFT JOIN equipment_types et ON d.type_id = et.type_id
                   WHERE ls.lab_id = %s 
                     AND (d.lab_id = %s OR d.lab_id IS NULL)
                     AND d.assigned_code IS NOT NULL
                     AND d.assigned_code != ''""",
            (lab_id, lab_id)
        )
        fallback_devices = cursor.fetchall()
        fallback_device_ids = [fd['device_id'] for fd in fallback_devices]
        # Merge device ids so we fetch issues for all
        merged_device_ids = list({*device_ids, *fallback_device_ids})

        # Fetch issues for all devices in this lab so UI can show counts/colors
        # Only fetch issues for devices that are currently in this lab
        issues_map = {}
        if merged_device_ids:
            cursor.execute(
                """SELECT di.issue_id, di.device_id, di.issue_title, di.description,
                          LOWER(di.status) AS status, di.reported_at, di.resolved_at,
                          COALESCE(di.severity, 'medium') AS severity,
                          COALESCE(di.reported_by, 'System') AS reported_by
                   FROM device_issues di
                   JOIN devices d ON di.device_id = d.device_id
                   WHERE di.device_id = ANY(%s)
                     AND (d.lab_id = %s OR d.assigned_code LIKE %s)
                     AND LOWER(di.status) != 'resolved'
                   ORDER BY di.reported_at DESC""",
                (merged_device_ids, lab_id, f"{lab_id}/%")
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
                    "reportedBy": issue['reported_by'],
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
                    'assigned_code': sd['assigned_code'],
                    'station_qr_value': sd.get('station_qr_value', '')
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

                layout_info = layout_map.get((row_idx, col_idx))
                if not os_list and layout_info:
                    os_list = layout_info['os']
                
                grid_cell = {
                    "id": cell['assigned_code'],
                    "equipmentType": cell['equipment_type'] or (layout_info['stationTypeLabel'] if layout_info else "Empty"),
                    "os": os_list
                }
                
                # Add device group if station has devices
                station_id = cell['station_id']
                if station_id and station_id in station_device_map:
                    smap = station_device_map[station_id]
                    # Build station QR on-the-fly if not stored in DB
                    sqr = smap.get('station_qr_value') or ''
                    if not sqr and smap['devices']:
                        codes = [d.get('assignedCode', '') for d in smap['devices'] if d.get('assignedCode')]
                        if codes:
                            sqr = f"STATION|{smap['assigned_code']}|{','.join(codes)}"
                    grid_cell['deviceGroup'] = {
                        'assignedCode': smap['assigned_code'],
                        'devices': smap['devices'],
                        'stationQrValue': sqr
                    }
                
                grid[row_idx][col_idx] = grid_cell

        # Fill grid with layout station types where no lab_grid_cells row exists
        for (row_idx, col_idx), layout_info in layout_map.items():
            if row_idx < rows and col_idx < columns:
                if grid[row_idx][col_idx].get("equipmentType") == "Empty":
                    grid[row_idx][col_idx]["equipmentType"] = layout_info['stationTypeLabel']
                if not grid[row_idx][col_idx].get("os"):
                    grid[row_idx][col_idx]["os"] = layout_info['os']
        
        # Format equipment for frontend
        equipment = []
        for eq in equipment_pool:
            equipment.append({
                'type': eq['equipment_type'],
                'quantity': eq['quantity'],
                'quantityAssigned': eq['quantity_assigned'],
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
# Get Lab Station List (for export)
# -----------------------------
@app.route("/get_lab_station_list/<lab_id>", methods=["GET"])
def get_lab_station_list(lab_id):
    """
    Get lab stations with their devices in a flat format for table display and Excel export
    """
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # Get lab info
        cursor.execute(
            """SELECT lab_id, lab_name FROM labs WHERE lab_id = %s""",
            (lab_id,)
        )
        lab = cursor.fetchone()
        
        if not lab:
            return jsonify({"success": False, "error": "Lab not found"}), 404

        # Check if station_qr_value column exists
        cursor.execute(
            """SELECT 1 FROM information_schema.columns
               WHERE table_name = 'lab_stations' AND column_name = 'station_qr_value'"""
        )
        has_station_qr = cursor.fetchone() is not None
        sqr_col = ", ls.station_qr_value" if has_station_qr else ""

        # Get all stations with their devices
        cursor.execute(
            f"""SELECT 
                ls.station_id,
                ls.assigned_code,
                lgc.row_number,
                lgc.column_number,
                lgc.os_windows,
                lgc.os_linux,
                lgc.os_other,
                lsd.device_id,
                lsd.device_type,
                lsd.brand,
                lsd.model,
                lsd.specification,
                lsd.invoice_number,
                lsd.is_linked,
                lsd.linked_group_id,
                d.asset_code,
                d.unit_price,
                d.warranty_years,
                d.purchase_date,
                d.is_active,
                d.qr_value,
                d.assigned_code AS device_assigned_code
                {sqr_col}
            FROM lab_stations ls
            LEFT JOIN lab_grid_cells lgc ON ls.station_id = lgc.station_id
            LEFT JOIN lab_station_devices lsd ON ls.station_id = lsd.station_id
            LEFT JOIN devices d ON lsd.device_id = d.device_id
            WHERE ls.lab_id = %s
            ORDER BY ls.assigned_code, lsd.device_type""",
            (lab_id,)
        )
        results = cursor.fetchall()
        
        # Get all device IDs for issue lookup
        device_ids = [row['device_id'] for row in results if row['device_id']]
        
        # Fetch issues for all devices
        issues_map = {}
        if device_ids:
            cursor.execute(
                """SELECT di.issue_id, di.device_id, di.issue_title, di.description,
                          LOWER(di.status) AS status, di.reported_at,
                          COALESCE(di.severity, 'medium') AS severity,
                          COALESCE(di.reported_by, 'System') AS reported_by
                   FROM device_issues di
                   WHERE di.device_id = ANY(%s)
                     AND LOWER(di.status) != 'resolved'
                   ORDER BY di.reported_at DESC""",
                (device_ids,)
            )
            issues = cursor.fetchall()
            for issue in issues:
                dev_id = issue['device_id']
                if dev_id not in issues_map:
                    issues_map[dev_id] = []
                issues_map[dev_id].append({
                    'issueId': issue['issue_id'],
                    'title': issue['issue_title'],
                    'description': issue['description'],
                    'severity': issue['severity'],
                    'status': issue['status'],
                    'reportedAt': issue['reported_at'].isoformat() if issue['reported_at'] else None,
                    'reportedBy': issue['reported_by'],
                })
        
        # Group by station
        stations_map = {}
        for row in results:
            station_id = row['station_id']
            assigned_code = row['assigned_code']
            
            if station_id not in stations_map:
                # Build OS list
                os_list = []
                if row['os_windows']:
                    os_list.append('Windows')
                if row['os_linux']:
                    os_list.append('Linux')
                if row['os_other']:
                    os_list.append('Other')
                
                stations_map[station_id] = {
                    'stationId': station_id,
                    'assignedCode': assigned_code,
                    'row': row['row_number'],
                    'column': row['column_number'],
                    'os': ', '.join(os_list) if os_list else 'N/A',
                    'stationQrValue': row.get('station_qr_value', ''),
                    'devices': []
                }
            
            # Add device if exists
            if row['device_id']:
                device_id = row['device_id']
                device_data = {
                    'deviceId': device_id,
                    'type': row['device_type'],
                    'brand': row['brand'],
                    'model': row['model'],
                    'specification': row['specification'],
                    'assetCode': row['asset_code'],
                    'prefixCode': row.get('device_assigned_code', ''),
                    'unitPrice': float(row['unit_price']) if row['unit_price'] else 0,
                    'warrantyYears': row['warranty_years'],
                    'purchaseDate': row['purchase_date'].strftime('%Y-%m-%d') if row['purchase_date'] else None,
                    'invoiceNumber': row['invoice_number'],
                    'isLinked': row['is_linked'],
                    'linkedGroupId': row['linked_group_id'],
                    'isActive': row['is_active'],
                    'qrValue': row['qr_value'],
                    'issues': issues_map.get(device_id, [])
                }
                stations_map[station_id]['devices'].append(device_data)
        
        # Build station QR on-the-fly for stations missing stored value
        for sid, sdata in stations_map.items():
            if not sdata.get('stationQrValue') and sdata['devices']:
                codes = [d.get('prefixCode') or d.get('assetCode', '') for d in sdata['devices'] if d.get('prefixCode') or d.get('assetCode')]
                if codes:
                    sdata['stationQrValue'] = f"STATION|{sdata['assignedCode']}|{','.join(codes)}"

        # Convert to list
        stations_list = list(stations_map.values())
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "labName": lab['lab_name'],
            "labId": lab['lab_id'],
            "stations": stations_list
        })
    
    except Exception as e:
        print(f"Error fetching lab station list: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# -----------------------------
# Export Lab Station List to PDF
# -----------------------------
@app.route("/export_lab_station_pdf/<lab_id>", methods=["GET"])
def export_lab_station_pdf(lab_id):
    """
    Generate PDF with lab station details including header image
    """
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # Get lab info
        cursor.execute(
            """SELECT lab_id, lab_name FROM labs WHERE lab_id = %s""",
            (lab_id,)
        )
        lab = cursor.fetchone()
        
        if not lab:
            return jsonify({"success": False, "error": "Lab not found"}), 404
        
        # Get all stations with their devices
        cursor.execute(
            """SELECT 
                ls.station_id,
                ls.assigned_code,
                lgc.row_number,
                lgc.column_number,
                lgc.os_windows,
                lgc.os_linux,
                lgc.os_other,
                lsd.device_id,
                lsd.device_type,
                lsd.brand,
                lsd.model,
                lsd.specification,
                lsd.invoice_number,
                lsd.is_linked,
                lsd.linked_group_id,
                d.asset_code,
                d.unit_price,
                d.warranty_years,
                d.purchase_date,
                d.is_active,
                d.assigned_code AS device_assigned_code
            FROM lab_stations ls
            LEFT JOIN lab_grid_cells lgc ON ls.station_id = lgc.station_id
            LEFT JOIN lab_station_devices lsd ON ls.station_id = lsd.station_id
            LEFT JOIN devices d ON lsd.device_id = d.device_id
            WHERE ls.lab_id = %s
            ORDER BY ls.assigned_code, lsd.device_type""",
            (lab_id,)
        )
        results = cursor.fetchall()
        
        # Get all device IDs for issue lookup
        device_ids = [row['device_id'] for row in results if row['device_id']]
        
        # Fetch issues for all devices
        issues_map = {}
        if device_ids:
            cursor.execute(
                """SELECT di.issue_id, di.device_id, di.issue_title, di.description,
                          LOWER(di.status) AS status, di.reported_at,
                          COALESCE(di.severity, 'medium') AS severity,
                          COALESCE(di.reported_by, 'System') AS reported_by
                   FROM device_issues di
                   WHERE di.device_id = ANY(%s)
                     AND LOWER(di.status) != 'resolved'
                   ORDER BY di.reported_at DESC""",
                (device_ids,)
            )
            issues = cursor.fetchall()
            for issue in issues:
                dev_id = issue['device_id']
                if dev_id not in issues_map:
                    issues_map[dev_id] = []
                issues_map[dev_id].append({
                    'issueId': issue['issue_id'],
                    'title': issue['issue_title'],
                    'description': issue['description'],
                    'severity': issue['severity'],
                    'status': issue['status'],
                    'reportedAt': issue['reported_at'].isoformat() if issue['reported_at'] else None,
                    'reportedBy': issue['reported_by'],
                })
        
        # Group by station
        stations_map = {}
        for row in results:
            station_id = row['station_id']
            assigned_code = row['assigned_code']
            
            if station_id not in stations_map:
                # Build OS list
                os_list = []
                if row['os_windows']:
                    os_list.append('Windows')
                if row['os_linux']:
                    os_list.append('Linux')
                if row['os_other']:
                    os_list.append('Other')
                
                stations_map[station_id] = {
                    'stationId': station_id,
                    'assignedCode': assigned_code,
                    'row': row['row_number'],
                    'column': row['column_number'],
                    'os': ', '.join(os_list) if os_list else 'N/A',
                    'devices': []
                }
            
            # Add device if exists
            if row['device_id']:
                device_id = row['device_id']
                device_data = {
                    'deviceId': device_id,
                    'type': row['device_type'],
                    'brand': row['brand'],
                    'model': row['model'],
                    'specification': row['specification'],
                    'assetCode': row['asset_code'],
                    'unitPrice': float(row['unit_price']) if row['unit_price'] else 0,
                    'warrantyYears': row['warranty_years'],
                    'purchaseDate': row['purchase_date'].strftime('%Y-%m-%d') if row['purchase_date'] else None,
                    'invoiceNumber': row['invoice_number'],
                    'isLinked': row['is_linked'],
                    'linkedGroupId': row['linked_group_id'],
                    'isActive': row['is_active'],
                    'issues': issues_map.get(device_id, [])
                }
                stations_map[station_id]['devices'].append(device_data)
        
        # Convert to list
        stations_list = list(stations_map.values())
        
        cursor.close()
        conn.close()
        
        # Generate PDF
        pdf_buffer = BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=A4, topMargin=0.5*inch)
        elements = []
        styles = getSampleStyleSheet()
        
        # Add header image if exists
        header_path = os.path.join(os.path.dirname(__file__), 'header.png')
        if os.path.exists(header_path):
            img = RLImage(header_path, width=7*inch, height=1*inch)
            elements.append(img)
            elements.append(Spacer(1, 0.3*inch))
        
        # Add title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=20,
            alignment=TA_CENTER
        )
        title = Paragraph(f"<b>{lab['lab_name']} - Station Details</b>", title_style)
        elements.append(title)
        elements.append(Spacer(1, 0.2*inch))
        
        # Create table data — skip empty stations
        for station in stations_list:
            if not station['devices'] or len(station['devices']) == 0:
                continue

            # Station header
            station_header = Paragraph(
                f"<b>Station: {station['assignedCode']}</b> | OS: {station['os']}",
                styles['Heading3']
            )
            elements.append(station_header)
            elements.append(Spacer(1, 0.1*inch))
            
            # Device table with more columns
            table_data = [['Device', 'Brand/Model', 'Prefix Code', 'Asset Code', 'Spec', 'Price', 'Warranty']]
            
            for device in station['devices']:
                table_data.append([
                    device['type'],
                    f"{device['brand']} {device['model']}",
                    device.get('assetCode') or 'N/A',
                    device.get('assetCode') or 'N/A',
                    (device['specification'] or 'N/A')[:30],
                    f"Rs.{device['unitPrice']:.0f}" if device.get('unitPrice') else 'N/A',
                    f"{device['warrantyYears']}y" if device.get('warrantyYears') else 'N/A'
                ])
            
            device_table = Table(table_data, colWidths=[0.9*inch, 1.5*inch, 1.1*inch, 1.1*inch, 1.0*inch, 0.7*inch, 0.5*inch])
            device_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('FONTSIZE', (0, 1), (-1, -1), 7),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            elements.append(device_table)
            elements.append(Spacer(1, 0.3*inch))
        
        # Build PDF
        doc.build(elements)
        pdf_buffer.seek(0)
        
        # Return PDF file
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"{lab['lab_name']}_station_details.pdf"
        )
    
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
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
        reported_by = (data.get("reportedBy") or "System").strip()

        if not device_id:
            return jsonify({"success": False, "error": "deviceId is required"}), 400
        if not title:
            return jsonify({"success": False, "error": "title is required"}), 400

        conn = db.get_connection()
        cursor = conn.cursor()

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

        # Insert issue with severity and reported_by
        cursor.execute(
            """INSERT INTO device_issues (device_id, issue_title, description, status, severity, reported_by)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   RETURNING issue_id, reported_at""",
            (device_id, title, description, "open", severity, reported_by)
        )
        issue_row = cursor.fetchone()
        issue_id = issue_row['issue_id']
        reported_at = issue_row['reported_at']

        # History log
        cursor.execute(
            """INSERT INTO device_issue_history (issue_id, action, old_status, new_status, note, changed_by)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
            (issue_id, "created", None, "open", f"severity={severity}", reported_by)
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
                "reportedBy": reported_by,
                "deactivated": deactivate
            }
        })

    except Exception as e:
        print(f"Error raising issue: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------------
# Update Issue Status
# -----------------------------
@app.route("/update_issue_status", methods=["POST"])
def update_issue_status():
    """
    Update the status of a device issue.
    Expects JSON: { issueId, status }
    """
    try:
        data = request.get_json(force=True)
        issue_id = data.get("issueId")
        new_status = (data.get("status") or "").strip().lower()
        changed_by = (data.get("changedBy") or "").strip() or None

        if not issue_id:
            return jsonify({"success": False, "error": "issueId is required"}), 400
        
        if new_status not in ["open", "in-progress", "resolved"]:
            return jsonify({"success": False, "error": "Invalid status. Must be: open, in-progress, or resolved"}), 400

        conn = db.get_connection()
        cursor = conn.cursor()

        # Check if issue exists
        cursor.execute(
            "SELECT issue_id, status FROM device_issues WHERE issue_id = %s",
            (issue_id,)
        )
        issue_row = cursor.fetchone()
        if not issue_row:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "error": "Issue not found"}), 404

        old_status = issue_row['status']

        # Update status (+ resolved_at timestamp when resolving)
        if new_status == "resolved":
            cursor.execute(
                "UPDATE device_issues SET status = %s, resolved_at = NOW() WHERE issue_id = %s",
                (new_status, issue_id)
            )
        else:
            cursor.execute(
                "UPDATE device_issues SET status = %s, resolved_at = NULL WHERE issue_id = %s",
                (new_status, issue_id)
            )

        # Log history with who changed it
        cursor.execute(
            """INSERT INTO device_issue_history (issue_id, action, old_status, new_status, note, changed_by)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
            (issue_id, "status_updated", old_status, new_status,
             f"Status changed from {old_status} to {new_status}", changed_by)
        )

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "message": f"Issue status updated to {new_status}",
            "issueId": issue_id,
            "oldStatus": old_status,
            "newStatus": new_status
        })

    except Exception as e:
        print(f"Error updating issue status: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------------
# Reactivate Device
# -----------------------------
@app.route("/reactivate_device", methods=["POST"])
def reactivate_device():
    """
    Reactivate a device by setting is_active to TRUE.
    Expects JSON: { deviceId }
    """
    try:
        data = request.get_json(force=True)
        device_id = data.get("deviceId")

        if not device_id:
            return jsonify({"success": False, "error": "deviceId is required"}), 400

        conn = db.get_connection()
        cursor = conn.cursor()

        # Check if device exists
        cursor.execute(
            "SELECT device_id, is_active FROM devices WHERE device_id = %s",
            (device_id,)
        )
        device_row = cursor.fetchone()
        if not device_row:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "error": "Device not found"}), 404

        # Reactivate device
        cursor.execute(
            "UPDATE devices SET is_active = TRUE WHERE device_id = %s",
            (device_id,)
        )

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "message": "Device reactivated successfully",
            "deviceId": device_id
        })

    except Exception as e:
        print(f"Error reactivating device: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------------
# Update Device Type
# -----------------------------
@app.route("/update_device_type", methods=["POST"])
def update_device_type():
    """
    Update the type_id of a device.
    Expects JSON: { deviceId, newTypeId }
    """
    try:
        data = request.get_json(force=True)
        device_id = data.get("deviceId")
        new_type_id = data.get("newTypeId")

        if not device_id or new_type_id is None:
            return jsonify({"success": False, "error": "deviceId and newTypeId are required"}), 400

        new_type_id = int(new_type_id)
        if new_type_id < 1 or new_type_id > 17:
            return jsonify({"success": False, "error": "Invalid type_id"}), 400

        conn = db.get_connection()
        if not conn:
            return jsonify({"success": False, "error": "Database connection failed"}), 500

        cursor = conn.cursor()

        # Verify device exists
        cursor.execute("SELECT device_id, type_id FROM devices WHERE device_id = %s", (device_id,))
        device_row = cursor.fetchone()
        if not device_row:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "error": "Device not found"}), 404

        old_type_id = device_row['type_id']

        # Update type_id
        cursor.execute("UPDATE devices SET type_id = %s WHERE device_id = %s", (new_type_id, device_id))
        conn.commit()

        # Get new type name
        cursor.execute("SELECT name FROM equipment_types WHERE type_id = %s", (new_type_id,))
        type_row = cursor.fetchone()
        new_type_name = type_row['name'] if type_row else 'Unknown'

        cursor.close()
        conn.close()

        print(f"Device {device_id} type changed from {old_type_id} to {new_type_id} ({new_type_name})")

        return jsonify({
            "success": True,
            "message": f"Device type updated to {new_type_name}",
            "deviceId": device_id,
            "oldTypeId": old_type_id,
            "newTypeId": new_type_id,
            "newTypeName": new_type_name
        })

    except Exception as e:
        print(f"Error updating device type: {str(e)}")
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
                # This includes devices with matching lab_id OR matching assigned_code pattern
                cursor.execute(
                    """UPDATE devices
                       SET lab_id = NULL,
                           assigned_code = NULL,
                           qr_value = NULL,
                           is_active = FALSE
                       WHERE lab_id = %s 
                          OR assigned_code LIKE %s""",
                    (lab_number, f"{lab_number}/%")
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
                d.warranty_years,
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
# Get All Bills
# -----------------------------
@app.route("/get_all_bills", methods=["GET"])
def get_all_bills():
    """Get all bills from the database"""
    try:
        conn = db.get_connection()
        if not conn:
            return jsonify({"success": False, "error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        
        # Get all bills with device count
        query = """
            SELECT 
                b.*,
                COUNT(d.device_id) as items_count
            FROM bills b
            LEFT JOIN devices d ON b.bill_id = d.bill_id
            GROUP BY b.bill_id
            ORDER BY b.bill_date DESC
        """
        
        cursor.execute(query)
        bills = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Format the response
        formatted_bills = []
        for bill in bills:
            formatted_bills.append({
                "id": bill['bill_id'],
                "billNo": bill['invoice_number'],
                "supplier": bill['vendor_name'],
                "date": bill['bill_date'].strftime("%Y-%m-%d") if bill['bill_date'] else None,
                "amount": float(bill['total_amount']) if bill['total_amount'] else 0,
                "taxAmount": float(bill['tax_amount']) if bill['tax_amount'] else 0,
                "gstin": bill['gstin'],
                "stockEntry": bill['stock_entry'],
                "items": bill['items_count'],
                "path": bill.get("path")
            })
        
        return jsonify({
            "success": True,
            "bills": formatted_bills
        })
    
    except Exception as e:
        print(f"Error fetching bills: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# -----------------------------
# Get Dead Stock Register Data
# -----------------------------
@app.route("/get_deadstock_register", methods=["GET"])
def get_deadstock_register():
    """Get dead stock register data grouped by lab stations with linked devices"""
    try:
        conn = db.get_connection()
        if not conn:
            return jsonify({"success": False, "error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        
        # Get all stations with their devices and lab information
        query = """
            SELECT 
                ls.station_id,
                ls.assigned_code,
                ls.lab_id,
                l.lab_name,
                lsd.device_id,
                lsd.device_type,
                lsd.brand,
                lsd.model,
                lsd.specification,
                lsd.invoice_number,
                lsd.bill_id,
                lsd.is_linked,
                lsd.linked_group_id,
                d.asset_code,
                d.assigned_code AS device_assigned_code,
                d.unit_price,
                d.warranty_years,
                d.purchase_date,
                d.dept,
                b.vendor_name,
                b.gstin,
                b.bill_date,
                b.stock_entry
            FROM lab_stations ls
            JOIN labs l ON ls.lab_id = l.lab_id
            LEFT JOIN lab_station_devices lsd ON ls.station_id = lsd.station_id
            LEFT JOIN devices d ON lsd.device_id = d.device_id
            LEFT JOIN bills b ON lsd.bill_id = b.bill_id
            WHERE lsd.device_id IS NOT NULL
            ORDER BY l.lab_name, ls.assigned_code, lsd.device_type
        """
        
        cursor.execute(query)
        results = cursor.fetchall()
        
        deadstock_entries = []
        sr_no = 1

        for row in results:
            if not row['device_id']:
                continue

            device_type = row['device_type'] or "Unknown"
            desc_parts = [device_type]
            if row['brand']:
                desc_parts.append(row['brand'])
            if row['model']:
                desc_parts.append(row['model'])
            item_description = " ".join(desc_parts)

            unit_price = float(row['unit_price']) if row['unit_price'] else 0
            purchase_date = row['purchase_date'].strftime("%d/%m/%Y") if row['purchase_date'] else ""

            deadstock_entries.append({
                "srNo": str(sr_no),
                "labName": row['lab_name'],
                "stationCode": row['assigned_code'],
                "itemDescription": item_description,
                "deviceCount": 1,
                "devices": [],
                "supplierInfo": row['vendor_name'] or "",
                "orderNo": row['gstin'] or "",
                "billNo": row['invoice_number'] or "",
                "billDate": row['bill_date'].strftime("%d/%m/%Y") if row['bill_date'] else "",
                "centralStore": row['stock_entry'] or "",
                "quantity": "01",
                "ratePerUnit": f"{unit_price:.2f}/-",
                "cost": f"{unit_price:.2f}/-",
                "dateOfDelivery": purchase_date,
                "dateOfInstallation": purchase_date,
                "identityNo": row['asset_code'] or "",
                "assignedCode": row['device_assigned_code'] or "",
                "remark": row['dept'] or "",
                "signOfLabInCharge": "",
                "warrantyYears": row['warranty_years'] or 0,
                "deviceType": device_type,
                "brand": row['brand'] or "",
                "model": row['model'] or "",
                "specification": row['specification'] or "",
                "assetCode": row['asset_code'] or "",
                "unitPrice": unit_price
            })
            sr_no += 1

        # Also include unassigned devices (not in any station and not pooled)
        unassigned_query = """
            SELECT
                d.device_id,
                d.type_id,
                et.name AS device_type,
                d.brand,
                d.model,
                d.specification,
                d.unit_price,
                d.warranty_years,
                d.purchase_date,
                d.dept,
                d.asset_code,
            d.assigned_code,
                d.bill_id,
                d.invoice_number,
                b.vendor_name,
                b.gstin,
                b.bill_date,
                b.stock_entry
            FROM devices d
            LEFT JOIN bills b ON d.bill_id = b.bill_id
            LEFT JOIN equipment_types et ON d.type_id = et.type_id
            LEFT JOIN lab_station_devices lsd ON d.device_id = lsd.device_id
            WHERE lsd.device_id IS NULL
              AND (d.assigned_code IS NULL OR d.assigned_code = '')
              AND d.lab_id IS NULL
            ORDER BY b.bill_date DESC, d.device_id
        """

        cursor.execute(unassigned_query)
        unassigned_rows = cursor.fetchall()
        cursor.close()
        conn.close()

        for row in unassigned_rows:
            device_type = row['device_type'] or "Unknown"
            desc_parts = [device_type]
            if row['brand']:
                desc_parts.append(row['brand'])
            if row['model']:
                desc_parts.append(row['model'])
            item_description = " ".join(desc_parts)

            unit_price = float(row['unit_price']) if row['unit_price'] else 0
            purchase_date = row['purchase_date'].strftime("%d/%m/%Y") if row['purchase_date'] else ""

            deadstock_entries.append({
                "srNo": str(sr_no),
                "labName": "Unassigned",
                "stationCode": "UNASSIGNED",
                "itemDescription": item_description,
                "deviceCount": 1,
                "devices": [],
                "supplierInfo": row['vendor_name'] or "",
                "orderNo": row['gstin'] or "",
                "billNo": row['invoice_number'] or "",
                "billDate": row['bill_date'].strftime("%d/%m/%Y") if row['bill_date'] else "",
                "centralStore": row['stock_entry'] or "",
                "quantity": "01",
                "ratePerUnit": f"{unit_price:.2f}/-",
                "cost": f"{unit_price:.2f}/-",
                "dateOfDelivery": purchase_date,
                "dateOfInstallation": purchase_date,
                "identityNo": row['asset_code'] or "",
                "assignedCode": row['assigned_code'] or "",
                "remark": row['dept'] or "",
                "signOfLabInCharge": "",
                "warrantyYears": row['warranty_years'] or 0,
                "deviceType": device_type,
                "brand": row['brand'] or "",
                "model": row['model'] or "",
                "specification": row['specification'] or "",
                "assetCode": row['asset_code'] or "",
                "unitPrice": unit_price
            })
            sr_no += 1
        
        return jsonify({
            "success": True,
            "deadstock": deadstock_entries
        })
    
    except Exception as e:
        print(f"Error fetching deadstock register: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# -----------------------------
# Transfer Management Endpoints
# -----------------------------

@app.route('/get_lab_devices/<lab_id>', methods=['GET'])
def get_lab_devices(lab_id):
    """Get all devices assigned to a specific lab via lab_station_devices"""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        
        print(f"Fetching devices for lab_id: {lab_id}")
        
        # Query devices through lab_station_devices (same as Labplan.tsx)
        # Include ALL devices in lab regardless of active status or issues - they can still be transferred
        cursor.execute("""
            SELECT DISTINCT
                d.device_id,
                lsd.device_type as type_name,
                lsd.brand,
                lsd.model,
                lsd.specification,
                d.asset_code as asset_id,
                ls.assigned_code,
                d.lab_id,
                l.lab_name
            FROM lab_station_devices lsd
            INNER JOIN lab_stations ls ON lsd.station_id = ls.station_id
            INNER JOIN devices d ON lsd.device_id = d.device_id
            LEFT JOIN labs l ON ls.lab_id = l.lab_id
            WHERE ls.lab_id = %s
            ORDER BY lsd.device_type, lsd.brand, lsd.model
        """, (lab_id,))
        
        devices = []
        rows = cursor.fetchall()
        print(f"Found {len(rows)} devices in lab {lab_id}")
        
        for row in rows:
            devices.append({
                'device_id': row['device_id'],
                'type_name': row['type_name'],
                'brand': row['brand'],
                'model': row['model'],
                'specification': row['specification'],
                'asset_id': row['asset_id'],
                'assigned_code': row['assigned_code'],
                'lab_id': row['lab_id'],
                'lab_name': row['lab_name']
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'devices': devices
        })
        
    except Exception as e:
        print(f"Error fetching lab devices: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

def getDeviceEmojiPy(type_name: str) -> str:
    t = (type_name or '').lower()
    if t == 'laptop': return '💻'
    if t in ('pc', 'monitor'): return '🖥️'
    if t == 'ac': return '❄️'
    if 'smart board' in t: return '📺'
    if 'projector' in t: return '📽️'
    if 'printer' in t: return '🖨️'
    if 'scanner' in t: return '📠'
    if 'ups' in t: return '🔋'
    if 'router' in t: return '📡'
    if 'switch' in t: return '🔌'
    if 'server' in t: return '🗄️'
    if 'passage' in t or 'walkway' in t: return '🚶'
    if 'door' in t: return '🚪'
    if 'network' in t: return '🌐'
    if 'window' in t: return '🪟'
    if 'wall' in t: return '🧱'
    if not t or t == 'empty': return '⬜'
    return '🔧'

@app.route('/get_dest_lab_layout/<lab_id>', methods=['GET'])
def get_dest_lab_layout(lab_id):
    """Get destination lab's blueprint grid with station types, allowed device types, and current occupancy.
    
    Primary source: lab_layout_cells (blueprint template linked to the lab).
    Fallback source: lab_grid_cells + lab_stations (runtime grid from lab configuration).
    """
    try:
        conn = db.get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT lab_id, lab_name, rows, columns, layout_id FROM labs WHERE lab_id = %s", (lab_id,))
        lab = cursor.fetchone()
        if not lab:
            return jsonify({'success': False, 'error': 'Lab not found'}), 404

        layout_id = lab['layout_id']

        # ── PRIMARY: Query lab_layout_cells blueprint ──────────────────────
        cells = []
        use_blueprint = False
        if layout_id:
            cursor.execute("""
                SELECT lc.cell_id, lc.row_number, lc.column_number,
                       lc.station_type_id, lc.label AS station_label,
                       lc.os_windows, lc.os_linux, lc.os_other,
                       st.name AS station_type_name, st.name AS station_type_label,
                       st.icon, st.color,
                       st.allowed_device_types
                FROM lab_layout_cells lc
                LEFT JOIN station_types st ON lc.station_type_id = st.station_type_id
                WHERE lc.layout_id = %s
                ORDER BY lc.row_number, lc.column_number
            """, (layout_id,))
            cells = cursor.fetchall()
            if cells:
                use_blueprint = True

        if use_blueprint:
            # ── allowed_device_types is already TEXT[] of device type names ──
            # No additional lookup needed

            # ── Current device occupancy via lab_stations / lab_grid_cells ──
            cursor.execute("""
                SELECT lgc.row_number, lgc.column_number,
                       lsd.device_type, lsd.device_id, lsd.brand, lsd.model,
                       d.assigned_code AS device_prefix_code, d.asset_code
                FROM lab_stations ls
                JOIN lab_grid_cells lgc ON ls.station_id = lgc.station_id
                JOIN lab_station_devices lsd ON ls.station_id = lsd.station_id
                LEFT JOIN devices d ON lsd.device_id = d.device_id
                WHERE ls.lab_id = %s
            """, (lab_id,))
            occupancy_map = {}
            for orow in cursor.fetchall():
                key = f"{orow['row_number']}-{orow['column_number']}"
                occupancy_map.setdefault(key, []).append({
                    'deviceType': orow['device_type'],
                    'deviceId': orow['device_id'],
                    'brand': orow['brand'],
                    'model': orow['model'],
                    'prefixCode': orow['device_prefix_code'] or '',
                    'assetCode': orow['asset_code'] or '',
                })

            grid = []
            for cell in cells:
                r, c = cell['row_number'], cell['column_number']
                allowed_names = cell['allowed_device_types'] or []
                key = f"{r}-{c}"
                current_devices = occupancy_map.get(key, [])
                current_type_names = [d['deviceType'] for d in current_devices]

                os_list = []
                if cell.get('os_windows'): os_list.append('Windows')
                if cell.get('os_linux'): os_list.append('Linux')
                if cell.get('os_other'): os_list.append('Other')

                grid.append({
                    'row': r,
                    'column': c,
                    'cellId': cell['cell_id'],
                    'stationTypeId': cell['station_type_id'],
                    'stationTypeName': cell['station_type_name'] or 'empty',
                    'stationTypeLabel': cell['station_type_label'] or 'Empty',
                    'icon': cell['icon'] or '⬜',
                    'color': cell['color'] or '#6b7280',
                    'stationLabel': cell['station_label'],
                    'os': os_list,
                    'allowedDeviceTypes': allowed_names,
                    'currentDevices': current_devices,
                    'currentDeviceTypes': current_type_names,
                    'freeForTypes': [t for t in allowed_names if t not in current_type_names],
                })

        else:
            # ── FALLBACK: Query lab_grid_cells (runtime grid from lab config) ──
            # Use cell_id = station_id as proxy (lab_layout_cells may not exist)
            cursor.execute("""
                SELECT lgc.cell_id AS grid_cell_id,
                       lgc.station_id,
                       lgc.row_number, lgc.column_number,
                       lgc.assigned_code, lgc.equipment_type,
                       lgc.os_windows, lgc.os_linux, lgc.os_other,
                       lgc.is_empty,
                       ls.station_id AS ls_station_id
                FROM lab_grid_cells lgc
                LEFT JOIN lab_stations ls ON lgc.station_id = ls.station_id
                WHERE lgc.lab_id = %s
                ORDER BY lgc.row_number, lgc.column_number
            """, (lab_id,))
            grid_cells = cursor.fetchall()

            # Fetch all occupancy for this lab
            cursor.execute("""
                SELECT lgc.row_number, lgc.column_number,
                       lsd.device_type, lsd.device_id, lsd.brand, lsd.model,
                       d.assigned_code AS device_prefix_code, d.asset_code
                FROM lab_stations ls
                JOIN lab_grid_cells lgc ON ls.station_id = lgc.station_id
                JOIN lab_station_devices lsd ON ls.station_id = lsd.station_id
                LEFT JOIN devices d ON lsd.device_id = d.device_id
                WHERE ls.lab_id = %s
            """, (lab_id,))
            occupancy_map = {}
            for orow in cursor.fetchall():
                key = f"{orow['row_number']}-{orow['column_number']}"
                occupancy_map.setdefault(key, []).append({
                    'deviceType': orow['device_type'],
                    'deviceId': orow['device_id'],
                    'brand': orow['brand'],
                    'model': orow['model'],
                    'prefixCode': orow['device_prefix_code'] or '',
                    'assetCode': orow['asset_code'] or '',
                })

            # Map equipment_type text → allowed_device_types list
            # equipment_type in lab_grid_cells is the primary type (e.g. "PC", "Laptop")
            # We'll treat it as: this station allows devices of that type
            def infer_allowed(eq_type: str):
                if not eq_type:
                    return []
                t = eq_type.lower()
                # Compound types (e.g. teacher station allows both PC and Laptop)
                type_map = {
                    'pc': ['PC'],
                    'laptop': ['Laptop'],
                    'ac': ['AC'],
                    'projector': ['Projector', 'Smart Board'],
                    'printer': ['Printer'],
                    'scanner': ['Scanner'],
                    'ups': ['UPS'],
                    'server': ['Server'],
                    'router': ['Router'],
                    'switch': ['Network Switch'],
                    'network': ['Router', 'Network Switch'],
                    'teacher': ['PC', 'Laptop'],
                }
                for key, val in type_map.items():
                    if key in t:
                        return val
                return [eq_type]  # return as-is if no match

            grid = []
            for gc in grid_cells:
                r, c = gc['row_number'], gc['column_number']
                eq_type = gc['equipment_type'] or ''
                key = f"{r}-{c}"
                current_devices = occupancy_map.get(key, [])
                current_type_names = [d['deviceType'] for d in current_devices]
                is_empty_type = not eq_type or gc['is_empty']
                allowed_names = [] if is_empty_type else infer_allowed(eq_type)

                os_list = []
                if gc.get('os_windows'): os_list.append('Windows')
                if gc.get('os_linux'): os_list.append('Linux')
                if gc.get('os_other'): os_list.append('Other')

                # Use station_id as a stand-in for cellId so the frontend can pass it back
                # The approve endpoint will handle finding/creating the station
                grid.append({
                    'row': r,
                    'column': c,
                    'cellId': gc['station_id'] or gc['grid_cell_id'],  # used as dest_cell_id reference
                    'stationTypeId': 0,
                    'stationTypeName': eq_type.lower() if eq_type else 'empty',
                    'stationTypeLabel': eq_type or 'Empty',
                    'icon': getDeviceEmojiPy(eq_type),
                    'color': '#6b7280',
                    'stationLabel': gc['assigned_code'],
                    'os': os_list,
                    'allowedDeviceTypes': allowed_names,
                    'currentDevices': current_devices,
                    'currentDeviceTypes': current_type_names,
                    'freeForTypes': [t for t in allowed_names if t not in current_type_names],
                })

        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'lab': {
                'labId': lab['lab_id'],
                'labName': lab['lab_name'],
                'rows': lab.get('rows') or 6,
                'columns': lab.get('columns') or 6,
            },
            'grid': grid,
            'source': 'blueprint' if use_blueprint else 'runtime'
        })

    except Exception as e:
        print(f"Error fetching dest lab layout: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/check_destination_capacity', methods=['POST'])
def check_destination_capacity():
    """Check if destination lab has free station slots for the device types being transferred."""
    try:
        data = request.json
        to_lab_id = data.get('to_lab_id')
        device_types = data.get('device_types', [])  # list of type names e.g. ['PC', 'Monitor']
        transfer_type = data.get('transfer_type', 'individual')  # 'station' or 'individual'

        if not to_lab_id or not device_types:
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400

        conn = db.get_connection()
        cursor = conn.cursor()

        # Find all stations in the destination lab and their currently assigned device types
        cursor.execute("""
            SELECT ls.station_id, ls.assigned_code,
                   lgc.equipment_type,
                   COALESCE(
                       (SELECT st.allowed_device_types
                        FROM lab_layout_cells lc
                        JOIN station_types st ON lc.station_type_id = st.station_type_id
                        WHERE lc.layout_id = l.layout_id
                          AND lc.row_number = lgc.row_number
                          AND lc.column_number = lgc.column_number
                        LIMIT 1),
                       ARRAY[]::text[]
                   ) AS allowed_device_types
            FROM lab_stations ls
            JOIN lab_grid_cells lgc ON ls.station_id = lgc.station_id
            JOIN labs l ON ls.lab_id = l.lab_id
            WHERE ls.lab_id = %s
        """, (to_lab_id,))
        dest_stations = cursor.fetchall()

        # Get devices currently assigned to each station
        for station in dest_stations:
            cursor.execute("""
                SELECT device_type FROM lab_station_devices
                WHERE station_id = %s
            """, (station['station_id'],))
            station['current_devices'] = [r['device_type'] for r in cursor.fetchall()]

        # Check capacity for each device type being transferred
        type_counts_needed = {}
        for dt in device_types:
            type_counts_needed[dt] = type_counts_needed.get(dt, 0) + 1

        capacity_result = {}
        for dtype, count_needed in type_counts_needed.items():
            # Find stations that allow this device type and don't already have one
            free_slots = 0
            for station in dest_stations:
                allowed = station.get('allowed_device_types') or []
                current = station.get('current_devices') or []
                # Station accepts this type and doesn't already have one
                if dtype in allowed and dtype not in current:
                    free_slots += 1
            capacity_result[dtype] = {
                'needed': count_needed,
                'available': free_slots,
                'sufficient': free_slots >= count_needed
            }

        all_sufficient = all(v['sufficient'] for v in capacity_result.values())

        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'has_capacity': all_sufficient,
            'details': capacity_result
        })

    except Exception as e:
        print(f"Error checking destination capacity: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/create_transfer_request', methods=['POST'])
def create_transfer_request():
    """Create a new transfer request"""
    try:
        data = request.json
        from_lab_id = data.get('from_lab_id')
        to_lab_id = data.get('to_lab_id')
        device_ids = data.get('device_ids', [])
        remark = data.get('remark', '')
        transfer_type = data.get('transfer_type', 'individual')  # 'station' or 'individual'
        station_ids = data.get('station_ids', [])  # source station_ids when transfer_type is 'station'
        dest_cell_id = data.get('dest_cell_id')  # selected destination layout cell or station_id (legacy single-dest)
        device_dest_map = data.get('device_dest_map') or {}  # { device_id: dest_cell_id }
        
        if not from_lab_id or not to_lab_id or not device_ids:
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        if not isinstance(device_dest_map, dict):
            return jsonify({'success': False, 'error': 'device_dest_map must be an object'}), 400

        # Backward compatibility: if frontend still sends only one destination, map all devices to it.
        if not device_dest_map and dest_cell_id:
            device_dest_map = {str(did): int(dest_cell_id) for did in device_ids}

        if not device_dest_map:
            return jsonify({'success': False, 'error': 'Please assign destination station for all selected devices'}), 400
        
        if from_lab_id == to_lab_id:
            return jsonify({'success': False, 'error': 'Source and destination labs cannot be the same'}), 400
        
        # Get current user
        user_info = get_current_user()
        user_email = user_info.email if user_info else 'Unknown'
        
        conn = db.get_connection()
        cursor = conn.cursor()

        # Check for devices already in pending transfers
        cursor.execute("""
            SELECT device_ids FROM transfer_requests WHERE status = 'pending'
        """)
        pending_rows = cursor.fetchall()
        for prow in pending_rows:
            existing_ids = json.loads(prow['device_ids']) if isinstance(prow['device_ids'], str) else (prow['device_ids'] or [])
            existing_set = set(int(x) for x in existing_ids)
            incoming_set = set(int(x) for x in device_ids)
            overlap = incoming_set & existing_set
            if overlap:
                cursor.close(); conn.close()
                return jsonify({
                    'success': False,
                    'error': f'Some selected devices already have pending transfer requests. Please remove them and try again.'
                }), 400

        # Get device type names for the devices being transferred
        cursor.execute("""
            SELECT d.device_id, et.name AS device_type
            FROM devices d
            JOIN equipment_types et ON d.type_id = et.type_id
            WHERE d.device_id = ANY(%s)
        """, (device_ids,))
        device_rows = cursor.fetchall()
        if len(device_rows) != len(device_ids):
            cursor.close(); conn.close()
            return jsonify({'success': False, 'error': 'One or more selected devices are invalid'}), 400

        device_type_by_id = {int(r['device_id']): (r['device_type'] or '') for r in device_rows}

        # Normalize and validate destination map keys/values
        normalized_map = {}
        for did_raw, cell_raw in device_dest_map.items():
            try:
                did = int(did_raw)
                dcid = int(cell_raw)
            except Exception:
                cursor.close(); conn.close()
                return jsonify({'success': False, 'error': 'device_dest_map contains invalid ids'}), 400
            normalized_map[did] = dcid

        missing_dest = [did for did in device_ids if int(did) not in normalized_map]
        if missing_dest:
            cursor.close(); conn.close()
            return jsonify({'success': False, 'error': 'Please assign destination station for all selected devices'}), 400

        extra_dest = [did for did in normalized_map.keys() if did not in [int(x) for x in device_ids]]
        if extra_dest:
            cursor.close(); conn.close()
            return jsonify({'success': False, 'error': 'device_dest_map contains devices not present in device_ids'}), 400

        def infer_allowed_names(t):
            tl = (t or '').lower()
            if tl == 'pc': return ['PC']
            if tl == 'laptop': return ['Laptop']
            if 'teacher' in tl: return ['PC', 'Laptop']
            if tl == 'ac': return ['AC']
            if tl == 'projector': return ['Projector', 'Smart Board']
            if tl == 'printer': return ['Printer']
            if tl == 'scanner': return ['Scanner']
            if tl == 'ups': return ['UPS']
            if tl == 'server': return ['Server']
            if 'router' in tl: return ['Router']
            if 'switch' in tl: return ['Network Switch']
            return [t] if t else []

        # Group selected devices by destination cell and validate each target cell.
        grouped_by_dest = {}
        for did in device_ids:
            grouped_by_dest.setdefault(normalized_map[int(did)], []).append(int(did))

        validation_errors = []
        for mapped_dest_cell_id, mapped_device_ids in grouped_by_dest.items():
            cursor.execute("""
                SELECT lc.cell_id, lc.row_number, lc.column_number,
                       st.allowed_device_types, st.name AS station_type_name
                FROM lab_layout_cells lc
                JOIN station_types st ON lc.station_type_id = st.station_type_id
                JOIN labs l ON lc.layout_id = l.layout_id
                WHERE lc.cell_id = %s AND l.lab_id = %s
            """, (mapped_dest_cell_id, to_lab_id))
            dest_cell = cursor.fetchone()

            allowed_names = []
            current_device_types = []
            station_name = 'station'

            if dest_cell:
                dest_row = dest_cell['row_number']
                dest_col = dest_cell['column_number']
                station_name = dest_cell['station_type_name'] or 'station'
                allowed_names = dest_cell['allowed_device_types'] or []

                cursor.execute("""
                    SELECT lsd.device_type
                    FROM lab_stations ls
                    JOIN lab_grid_cells lgc ON ls.station_id = lgc.station_id
                    JOIN lab_station_devices lsd ON ls.station_id = lsd.station_id
                    WHERE ls.lab_id = %s AND lgc.row_number = %s AND lgc.column_number = %s
                """, (to_lab_id, dest_row, dest_col))
                current_device_types = [r['device_type'] for r in cursor.fetchall()]
            else:
                cursor.execute("""
                    SELECT ls.station_id, lgc.equipment_type
                    FROM lab_stations ls
                    LEFT JOIN lab_grid_cells lgc ON ls.station_id = lgc.station_id
                    WHERE ls.station_id = %s AND ls.lab_id = %s
                """, (mapped_dest_cell_id, to_lab_id))
                rt_station = cursor.fetchone()

                if not rt_station:
                    validation_errors.append(f"Destination station {mapped_dest_cell_id} is invalid")
                    continue

                eq_type = rt_station['equipment_type'] or ''
                station_name = eq_type or 'station'
                allowed_names = infer_allowed_names(eq_type)

                cursor.execute("""
                    SELECT lsd.device_type
                    FROM lab_station_devices lsd
                    WHERE lsd.station_id = %s
                """, (mapped_dest_cell_id,))
                current_device_types = [r['device_type'] for r in cursor.fetchall()]

            # Prevent duplicate same-type placements into one station in a single request.
            planned_types = set(current_device_types)
            for did in mapped_device_ids:
                dtype = device_type_by_id.get(int(did), '')
                if dtype not in allowed_names:
                    validation_errors.append(f"{dtype} is not allowed at {station_name} station")
                    continue
                if dtype in planned_types:
                    validation_errors.append(f"{dtype} slot is already occupied at {station_name} station")
                    continue
                planned_types.add(dtype)

        if validation_errors:
            cursor.close(); conn.close()
            return jsonify({'success': False, 'error': f"Cannot place devices: {', '.join(validation_errors)}"}), 400
        
        # Create transfer request
        # Persist map when column exists; otherwise fall back to legacy insert.
        cursor.execute("""
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'transfer_requests' AND column_name = 'device_dest_map'
        """)
        has_device_dest_map = cursor.fetchone() is not None

        if not has_device_dest_map and len(grouped_by_dest.keys()) > 1:
            cursor.close(); conn.close()
            return jsonify({
                'success': False,
                'error': 'Multiple destination cells selected, but the transfer_requests.device_dest_map column is missing. Run backend/migrations/transfer_dest_cell.sql and retry.'
            }), 400

        primary_dest_cell = int(dest_cell_id) if dest_cell_id else next(iter(grouped_by_dest.keys()))

        if has_device_dest_map:
            cursor.execute("""
                INSERT INTO transfer_requests 
                (from_lab_id, to_lab_id, device_ids, remark, status, requested_by, requested_at,
                 transfer_type, station_ids, dest_cell_id, device_dest_map)
                VALUES (%s, %s, %s, %s, 'pending', %s, NOW(), %s, %s, %s, %s)
                RETURNING transfer_id
            """, (from_lab_id, to_lab_id, json.dumps(device_ids), remark, user_email,
                  transfer_type, json.dumps(station_ids), primary_dest_cell, json.dumps(normalized_map)))
        else:
            cursor.execute("""
                INSERT INTO transfer_requests 
                (from_lab_id, to_lab_id, device_ids, remark, status, requested_by, requested_at,
                 transfer_type, station_ids, dest_cell_id)
                VALUES (%s, %s, %s, %s, 'pending', %s, NOW(), %s, %s, %s)
                RETURNING transfer_id
            """, (from_lab_id, to_lab_id, json.dumps(device_ids), remark, user_email,
                  transfer_type, json.dumps(station_ids), primary_dest_cell))
        
        transfer_id = cursor.fetchone()['transfer_id']
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'transfer_id': transfer_id,
            'message': 'Transfer request created successfully'
        })
        
    except Exception as e:
        print(f"Error creating transfer request: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/get_pending_transfers', methods=['GET'])
def get_pending_transfers():
    """Get all pending transfer requests (for HOD)"""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'transfer_requests' AND column_name = 'device_dest_map'
        """)
        has_device_dest_map = cursor.fetchone() is not None

        if has_device_dest_map:
            cursor.execute("""
                SELECT 
                    tr.transfer_id,
                    tr.from_lab_id,
                    l1.lab_name as from_lab_name,
                    tr.to_lab_id,
                    l2.lab_name as to_lab_name,
                    tr.device_ids,
                    tr.remark,
                    tr.status,
                    tr.requested_by,
                    TRIM(CONCAT_WS(' ', u_req.first_name, u_req.last_name)) as requested_by_name,
                    tr.requested_at,
                    tr.transfer_type,
                    tr.station_ids,
                    tr.device_dest_map
                FROM transfer_requests tr
                LEFT JOIN labs l1 ON tr.from_lab_id = l1.lab_id
                LEFT JOIN labs l2 ON tr.to_lab_id = l2.lab_id
                LEFT JOIN users u_req ON tr.requested_by = u_req.email
                WHERE tr.status = 'pending'
                ORDER BY tr.requested_at DESC
            """)
        else:
            cursor.execute("""
                SELECT 
                    tr.transfer_id,
                    tr.from_lab_id,
                    l1.lab_name as from_lab_name,
                    tr.to_lab_id,
                    l2.lab_name as to_lab_name,
                    tr.device_ids,
                    tr.remark,
                    tr.status,
                    tr.requested_by,
                    TRIM(CONCAT_WS(' ', u_req.first_name, u_req.last_name)) as requested_by_name,
                    tr.requested_at,
                    tr.transfer_type,
                    tr.station_ids
                FROM transfer_requests tr
                LEFT JOIN labs l1 ON tr.from_lab_id = l1.lab_id
                LEFT JOIN labs l2 ON tr.to_lab_id = l2.lab_id
                LEFT JOIN users u_req ON tr.requested_by = u_req.email
                WHERE tr.status = 'pending'
                ORDER BY tr.requested_at DESC
            """)
        
        transfers = []
        for row in cursor.fetchall():
            device_ids = json.loads(row['device_ids']) if isinstance(row['device_ids'], str) else row['device_ids']
            
            # Fetch device details with station info
            cursor.execute("""
                SELECT 
                    d.device_id,
                    et.name as type_name,
                    d.brand,
                    d.model,
                    d.asset_code as asset_id,
                    d.assigned_code,
                    ls.assigned_code as station_code
                FROM devices d
                LEFT JOIN equipment_types et ON d.type_id = et.type_id
                LEFT JOIN lab_station_devices lsd ON d.device_id = lsd.device_id
                LEFT JOIN lab_stations ls ON lsd.station_id = ls.station_id
                WHERE d.device_id = ANY(%s)
            """, (device_ids,))
            
            devices = []
            for dev_row in cursor.fetchall():
                devices.append({
                    'device_id': dev_row['device_id'],
                    'type_name': dev_row['type_name'],
                    'brand': dev_row['brand'],
                    'model': dev_row['model'],
                    'asset_id': dev_row['asset_id'],
                    'assigned_code': dev_row['assigned_code'],
                    'station_code': dev_row['station_code']
                })
            
            station_ids_raw = row.get('station_ids')
            station_ids = json.loads(station_ids_raw) if isinstance(station_ids_raw, str) and station_ids_raw else (station_ids_raw or [])
            device_dest_map_raw = row.get('device_dest_map')
            device_dest_map = json.loads(device_dest_map_raw) if isinstance(device_dest_map_raw, str) and device_dest_map_raw else (device_dest_map_raw or {})
            
            transfers.append({
                'transfer_id': row['transfer_id'],
                'from_lab_id': row['from_lab_id'],
                'from_lab_name': row['from_lab_name'],
                'to_lab_id': row['to_lab_id'],
                'to_lab_name': row['to_lab_name'],
                'device_ids': device_ids,
                'devices': devices,
                'remark': row['remark'],
                'status': row['status'],
                'requested_by': row['requested_by'],
                'requested_by_name': row.get('requested_by_name'),
                'requested_at': row['requested_at'].isoformat() if row['requested_at'] else None,
                'transfer_type': row.get('transfer_type', 'individual'),
                'station_ids': station_ids,
                'device_dest_map': device_dest_map
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'transfers': transfers
        })
        
    except Exception as e:
        print(f"Error fetching pending transfers: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/get_transfer_history', methods=['GET'])
def get_transfer_history():
    """Get transfer history (approved/rejected) with device details."""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'transfer_requests' AND column_name = 'device_dest_map'
        """)
        has_device_dest_map = cursor.fetchone() is not None

        if has_device_dest_map:
            cursor.execute("""
                SELECT
                    tr.transfer_id,
                    tr.from_lab_id,
                    l1.lab_name as from_lab_name,
                    tr.to_lab_id,
                    l2.lab_name as to_lab_name,
                    tr.device_ids,
                    tr.remark,
                    tr.status,
                    tr.requested_by,
                    TRIM(CONCAT_WS(' ', u_req.first_name, u_req.last_name)) as requested_by_name,
                    tr.requested_at,
                    tr.approved_by,
                    TRIM(CONCAT_WS(' ', u_app.first_name, u_app.last_name)) as approved_by_name,
                    tr.approved_at,
                    tr.transfer_type,
                    tr.station_ids,
                    tr.dest_cell_id,
                    tr.device_dest_map
                FROM transfer_requests tr
                LEFT JOIN labs l1 ON tr.from_lab_id = l1.lab_id
                LEFT JOIN labs l2 ON tr.to_lab_id = l2.lab_id
                LEFT JOIN users u_req ON tr.requested_by = u_req.email
                LEFT JOIN users u_app ON tr.approved_by = u_app.email
                WHERE tr.status <> 'pending'
                ORDER BY COALESCE(tr.approved_at, tr.requested_at) DESC
            """)
        else:
            cursor.execute("""
                SELECT
                    tr.transfer_id,
                    tr.from_lab_id,
                    l1.lab_name as from_lab_name,
                    tr.to_lab_id,
                    l2.lab_name as to_lab_name,
                    tr.device_ids,
                    tr.remark,
                    tr.status,
                    tr.requested_by,
                    TRIM(CONCAT_WS(' ', u_req.first_name, u_req.last_name)) as requested_by_name,
                    tr.requested_at,
                    tr.approved_by,
                    TRIM(CONCAT_WS(' ', u_app.first_name, u_app.last_name)) as approved_by_name,
                    tr.approved_at,
                    tr.transfer_type,
                    tr.station_ids,
                    tr.dest_cell_id
                FROM transfer_requests tr
                LEFT JOIN labs l1 ON tr.from_lab_id = l1.lab_id
                LEFT JOIN labs l2 ON tr.to_lab_id = l2.lab_id
                LEFT JOIN users u_req ON tr.requested_by = u_req.email
                LEFT JOIN users u_app ON tr.approved_by = u_app.email
                WHERE tr.status <> 'pending'
                ORDER BY COALESCE(tr.approved_at, tr.requested_at) DESC
            """)

        transfers = []
        for row in cursor.fetchall():
            device_ids = json.loads(row['device_ids']) if isinstance(row['device_ids'], str) else row['device_ids']

            cursor.execute("""
                SELECT
                    d.device_id,
                    et.name as type_name,
                    d.brand,
                    d.model,
                    d.asset_code as asset_id,
                    d.assigned_code,
                    ls.assigned_code as station_code
                FROM devices d
                LEFT JOIN equipment_types et ON d.type_id = et.type_id
                LEFT JOIN lab_station_devices lsd ON d.device_id = lsd.device_id
                LEFT JOIN lab_stations ls ON lsd.station_id = ls.station_id
                WHERE d.device_id = ANY(%s)
            """, (device_ids,))

            devices = []
            for dev_row in cursor.fetchall():
                devices.append({
                    'device_id': dev_row['device_id'],
                    'type_name': dev_row['type_name'],
                    'brand': dev_row['brand'],
                    'model': dev_row['model'],
                    'asset_id': dev_row['asset_id'],
                    'assigned_code': dev_row['assigned_code'],
                    'station_code': dev_row['station_code']
                })

            station_ids_raw = row.get('station_ids')
            station_ids = json.loads(station_ids_raw) if isinstance(station_ids_raw, str) and station_ids_raw else (station_ids_raw or [])
            device_dest_map_raw = row.get('device_dest_map')
            device_dest_map = json.loads(device_dest_map_raw) if isinstance(device_dest_map_raw, str) and device_dest_map_raw else (device_dest_map_raw or {})

            if not device_dest_map and row.get('dest_cell_id'):
                device_dest_map = {str(did): int(row['dest_cell_id']) for did in device_ids}

            transfers.append({
                'transfer_id': row['transfer_id'],
                'from_lab_id': row['from_lab_id'],
                'from_lab_name': row['from_lab_name'],
                'to_lab_id': row['to_lab_id'],
                'to_lab_name': row['to_lab_name'],
                'device_ids': device_ids,
                'devices': devices,
                'remark': row['remark'],
                'status': row['status'],
                'requested_by': row['requested_by'],
                'requested_by_name': row.get('requested_by_name'),
                'requested_at': row['requested_at'].isoformat() if row['requested_at'] else None,
                'approved_by': row['approved_by'],
                'approved_by_name': row.get('approved_by_name'),
                'approved_at': row['approved_at'].isoformat() if row['approved_at'] else None,
                'transfer_type': row.get('transfer_type', 'individual'),
                'station_ids': station_ids,
                'device_dest_map': device_dest_map
            })

        cursor.close()
        conn.close()

        return jsonify({'success': True, 'transfers': transfers})

    except Exception as e:
        print(f"Error fetching transfer history: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


def resolve_transfer_dest_cell(cursor, lab_id, cell_id):
    """Resolve destination cell to row/column and label."""
    if not cell_id:
        return None, None, None

    cursor.execute("""
        SELECT lc.row_number, lc.column_number,
               COALESCE(lc.station_label, st.name, 'Station') AS label
        FROM lab_layout_cells lc
        JOIN station_types st ON lc.station_type_id = st.station_type_id
        JOIN labs l ON lc.layout_id = l.layout_id
        WHERE lc.cell_id = %s AND l.lab_id = %s
    """, (cell_id, lab_id))
    bp = cursor.fetchone()
    if bp:
        return bp['row_number'], bp['column_number'], bp['label']

    cursor.execute("""
        SELECT ls.row_number, ls.column_number,
               COALESCE(lgc.equipment_type, 'Station') AS label
        FROM lab_stations ls
        LEFT JOIN lab_grid_cells lgc ON ls.station_id = lgc.station_id
        WHERE ls.station_id = %s AND ls.lab_id = %s
    """, (cell_id, lab_id))
    rt = cursor.fetchone()
    if rt:
        return rt['row_number'], rt['column_number'], rt['label']

    return None, None, None


@app.route('/export_transfer_history_excel', methods=['GET'])
def export_transfer_history_excel():
    """Export transfer history to CSV (Excel compatible)."""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'transfer_requests' AND column_name = 'device_dest_map'
        """)
        has_device_dest_map = cursor.fetchone() is not None

        if has_device_dest_map:
            cursor.execute("""
                SELECT
                    tr.transfer_id,
                    tr.from_lab_id,
                    l1.lab_name as from_lab_name,
                    tr.to_lab_id,
                    l2.lab_name as to_lab_name,
                    tr.device_ids,
                    tr.remark,
                    tr.status,
                    tr.requested_by,
                    tr.requested_at,
                    tr.approved_by,
                    tr.approved_at,
                    tr.transfer_type,
                    tr.station_ids,
                    tr.dest_cell_id,
                    tr.device_dest_map
                FROM transfer_requests tr
                LEFT JOIN labs l1 ON tr.from_lab_id = l1.lab_id
                LEFT JOIN labs l2 ON tr.to_lab_id = l2.lab_id
                WHERE tr.status <> 'pending'
                ORDER BY COALESCE(tr.approved_at, tr.requested_at) DESC
            """)
        else:
            cursor.execute("""
                SELECT
                    tr.transfer_id,
                    tr.from_lab_id,
                    l1.lab_name as from_lab_name,
                    tr.to_lab_id,
                    l2.lab_name as to_lab_name,
                    tr.device_ids,
                    tr.remark,
                    tr.status,
                    tr.requested_by,
                    tr.requested_at,
                    tr.approved_by,
                    tr.approved_at,
                    tr.transfer_type,
                    tr.station_ids,
                    tr.dest_cell_id
                FROM transfer_requests tr
                LEFT JOIN labs l1 ON tr.from_lab_id = l1.lab_id
                LEFT JOIN labs l2 ON tr.to_lab_id = l2.lab_id
                WHERE tr.status <> 'pending'
                ORDER BY COALESCE(tr.approved_at, tr.requested_at) DESC
            """)

        rows = cursor.fetchall()
        lines = []
        header = [
            "Transfer ID", "Status", "From Lab", "To Lab", "Requested By", "Requested At",
            "Approved By", "Approved At", "Transfer Type", "Device Type", "Brand", "Model",
            "Asset Code", "Assigned Code", "Station Code", "Dest Cell", "Dest Position", "Remark"
        ]
        lines.append(",".join(header))

        for row in rows:
            device_ids = json.loads(row['device_ids']) if isinstance(row['device_ids'], str) else row['device_ids']

            cursor.execute("""
                SELECT
                    d.device_id,
                    et.name as type_name,
                    d.brand,
                    d.model,
                    d.asset_code as asset_id,
                    d.assigned_code,
                    ls.assigned_code as station_code
                FROM devices d
                LEFT JOIN equipment_types et ON d.type_id = et.type_id
                LEFT JOIN lab_station_devices lsd ON d.device_id = lsd.device_id
                LEFT JOIN lab_stations ls ON lsd.station_id = ls.station_id
                WHERE d.device_id = ANY(%s)
            """, (device_ids,))
            devices = cursor.fetchall()

            device_dest_map_raw = row.get('device_dest_map')
            device_dest_map = json.loads(device_dest_map_raw) if isinstance(device_dest_map_raw, str) and device_dest_map_raw else (device_dest_map_raw or {})
            if not device_dest_map and row.get('dest_cell_id'):
                device_dest_map = {str(did): int(row['dest_cell_id']) for did in device_ids}

            for dev in devices:
                dest_cell_id = device_dest_map.get(str(dev['device_id']))
                drow, dcol, dlabel = resolve_transfer_dest_cell(cursor, row['to_lab_id'], dest_cell_id) if dest_cell_id else (None, None, None)
                pos = f"R{drow},C{dcol}" if drow is not None and dcol is not None else ""
                dest_label = dlabel or ""

                line = [
                    str(row['transfer_id']),
                    row['status'] or "",
                    row['from_lab_name'] or row['from_lab_id'] or "",
                    row['to_lab_name'] or row['to_lab_id'] or "",
                    row['requested_by'] or "",
                    row['requested_at'].isoformat() if row['requested_at'] else "",
                    row['approved_by'] or "",
                    row['approved_at'].isoformat() if row['approved_at'] else "",
                    row.get('transfer_type', 'individual') or "",
                    dev['type_name'] or "",
                    dev['brand'] or "",
                    dev['model'] or "",
                    dev['asset_id'] or "",
                    dev['assigned_code'] or "",
                    dev['station_code'] or "",
                    str(dest_cell_id) if dest_cell_id else "",
                    pos or dest_label,
                    (row['remark'] or "").replace("\n", " ").replace("\r", " ")
                ]
                safe_line = [str(v).replace('"', '""') for v in line]
                lines.append(",".join([f'"{v}"' for v in safe_line]))

        csv_data = "\n".join(lines)
        output = BytesIO()
        output.write(csv_data.encode('utf-8'))
        output.seek(0)

        cursor.close()
        conn.close()

        return send_file(
            output,
            mimetype='text/csv',
            as_attachment=True,
            download_name='transfer_history.csv'
        )

    except Exception as e:
        print(f"Error exporting transfer history CSV: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/export_transfer_history_pdf', methods=['GET'])
def export_transfer_history_pdf():
    """Export transfer history to PDF."""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'transfer_requests' AND column_name = 'device_dest_map'
        """)
        has_device_dest_map = cursor.fetchone() is not None

        if has_device_dest_map:
            cursor.execute("""
                SELECT
                    tr.transfer_id,
                    tr.from_lab_id,
                    l1.lab_name as from_lab_name,
                    tr.to_lab_id,
                    l2.lab_name as to_lab_name,
                    tr.device_ids,
                    tr.remark,
                    tr.status,
                    tr.requested_by,
                    tr.requested_at,
                    tr.approved_by,
                    tr.approved_at,
                    tr.transfer_type,
                    tr.station_ids,
                    tr.dest_cell_id,
                    tr.device_dest_map
                FROM transfer_requests tr
                LEFT JOIN labs l1 ON tr.from_lab_id = l1.lab_id
                LEFT JOIN labs l2 ON tr.to_lab_id = l2.lab_id
                WHERE tr.status <> 'pending'
                ORDER BY COALESCE(tr.approved_at, tr.requested_at) DESC
            """)
        else:
            cursor.execute("""
                SELECT
                    tr.transfer_id,
                    tr.from_lab_id,
                    l1.lab_name as from_lab_name,
                    tr.to_lab_id,
                    l2.lab_name as to_lab_name,
                    tr.device_ids,
                    tr.remark,
                    tr.status,
                    tr.requested_by,
                    tr.requested_at,
                    tr.approved_by,
                    tr.approved_at,
                    tr.transfer_type,
                    tr.station_ids,
                    tr.dest_cell_id
                FROM transfer_requests tr
                LEFT JOIN labs l1 ON tr.from_lab_id = l1.lab_id
                LEFT JOIN labs l2 ON tr.to_lab_id = l2.lab_id
                WHERE tr.status <> 'pending'
                ORDER BY COALESCE(tr.approved_at, tr.requested_at) DESC
            """)

        rows = cursor.fetchall()

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        elems = []

        elems.append(Paragraph("Transfer History", styles['Title']))
        elems.append(Spacer(1, 0.2 * inch))

        table_data = [[
            "Transfer", "From", "To", "Status", "Requested", "Approved", "Device", "Destination"
        ]]

        for row in rows:
            device_ids = json.loads(row['device_ids']) if isinstance(row['device_ids'], str) else row['device_ids']
            cursor.execute("""
                SELECT
                    d.device_id,
                    et.name as type_name,
                    d.brand,
                    d.model,
                    d.assigned_code
                FROM devices d
                LEFT JOIN equipment_types et ON d.type_id = et.type_id
                WHERE d.device_id = ANY(%s)
            """, (device_ids,))
            devices = cursor.fetchall()

            device_dest_map_raw = row.get('device_dest_map')
            device_dest_map = json.loads(device_dest_map_raw) if isinstance(device_dest_map_raw, str) and device_dest_map_raw else (device_dest_map_raw or {})
            if not device_dest_map and row.get('dest_cell_id'):
                device_dest_map = {str(did): int(row['dest_cell_id']) for did in device_ids}

            for dev in devices:
                dest_cell_id = device_dest_map.get(str(dev['device_id']))
                drow, dcol, dlabel = resolve_transfer_dest_cell(cursor, row['to_lab_id'], dest_cell_id) if dest_cell_id else (None, None, None)
                pos = f"R{drow},C{dcol}" if drow is not None and dcol is not None else ""
                dest_text = f"{dlabel or 'Cell'} {pos}" if dest_cell_id else ""

                device_text = f"{dev['type_name']} {dev['brand'] or ''} {dev['model'] or ''}"
                table_data.append([
                    f"#{row['transfer_id']}",
                    row['from_lab_name'] or row['from_lab_id'],
                    row['to_lab_name'] or row['to_lab_id'],
                    row['status'],
                    row['requested_at'].strftime('%Y-%m-%d') if row['requested_at'] else '',
                    row['approved_at'].strftime('%Y-%m-%d') if row['approved_at'] else '',
                    device_text.strip(),
                    dest_text.strip()
                ])

        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))

        elems.append(table)
        doc.build(elems)

        buffer.seek(0)
        cursor.close()
        conn.close()

        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name='transfer_history.pdf'
        )

    except Exception as e:
        print(f"Error exporting transfer history PDF: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/approve_transfer/<int:transfer_id>', methods=['POST'])
def approve_transfer(transfer_id):
    """Approve transfer request and move devices between labs"""
    conn = None
    try:
        # Get current user (should be HOD)
        user_info = get_current_user()
        user_email = user_info.email if user_info else 'Unknown'
        
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # Get transfer details (read device_dest_map if available)
        cursor.execute("""
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'transfer_requests' AND column_name = 'device_dest_map'
        """)
        has_device_dest_map = cursor.fetchone() is not None

        if has_device_dest_map:
            cursor.execute("""
                SELECT from_lab_id, to_lab_id, device_ids, transfer_type, station_ids, dest_cell_id, device_dest_map
                FROM transfer_requests
                WHERE transfer_id = %s AND status = 'pending'
            """, (transfer_id,))
        else:
            cursor.execute("""
                SELECT from_lab_id, to_lab_id, device_ids, transfer_type, station_ids, dest_cell_id
                FROM transfer_requests
                WHERE transfer_id = %s AND status = 'pending'
            """, (transfer_id,))
        
        result = cursor.fetchone()
        if not result:
            return jsonify({'success': False, 'error': 'Transfer request not found or already processed'}), 404
        
        from_lab_id = result['from_lab_id']
        to_lab_id = result['to_lab_id']
        device_ids_json = result['device_ids']
        transfer_type = result.get('transfer_type', 'individual')
        station_ids_json = result.get('station_ids')
        dest_cell_id = result.get('dest_cell_id')
        device_dest_map_json = result.get('device_dest_map') if has_device_dest_map else None
        
        device_ids = json.loads(device_ids_json) if isinstance(device_ids_json, str) else device_ids_json
        station_ids = json.loads(station_ids_json) if isinstance(station_ids_json, str) and station_ids_json else (station_ids_json or [])
        device_dest_map = json.loads(device_dest_map_json) if isinstance(device_dest_map_json, str) and device_dest_map_json else (device_dest_map_json or {})

        # Build per-device destination map; if absent, use legacy single destination for all devices.
        if not device_dest_map and dest_cell_id:
            device_dest_map = {str(did): int(dest_cell_id) for did in device_ids}

        normalized_dest_by_device = {}
        for did in device_ids:
            key = str(did)
            if key not in device_dest_map:
                cursor.close(); conn.close()
                return jsonify({'success': False, 'error': 'Transfer request has missing destination assignments'}), 400
            normalized_dest_by_device[int(did)] = int(device_dest_map[key])

        # Resolve every destination cell/station to a concrete destination station_id.
        dest_station_id_cache = {}

        def resolve_dest_to_position(cell_id):
            cursor.execute("""
                SELECT lc.cell_id, lc.row_number, lc.column_number,
                       st.name AS station_type_name
                FROM lab_layout_cells lc
                JOIN station_types st ON lc.station_type_id = st.station_type_id
                JOIN labs l ON lc.layout_id = l.layout_id
                WHERE lc.cell_id = %s AND l.lab_id = %s
            """, (cell_id, to_lab_id))
            dest_cell_bp = cursor.fetchone()

            if dest_cell_bp:
                return dest_cell_bp['row_number'], dest_cell_bp['column_number'], (dest_cell_bp['station_type_name'] or 'Unknown')

            cursor.execute("""
                SELECT ls.station_id, ls.row_number, ls.column_number,
                       COALESCE(lgc.equipment_type, 'Unknown') AS station_type_name
                FROM lab_stations ls
                LEFT JOIN lab_grid_cells lgc ON ls.station_id = lgc.station_id
                WHERE ls.station_id = %s AND ls.lab_id = %s
            """, (cell_id, to_lab_id))
            rt_station = cursor.fetchone()
            if not rt_station:
                return None, None, None
            return rt_station['row_number'], rt_station['column_number'], (rt_station['station_type_name'] or 'Unknown')

        def get_or_create_dest_station(row_num, col_num, station_type_name):
            cursor.execute("""
                SELECT lgc.station_id
                FROM lab_grid_cells lgc
                WHERE lgc.lab_id = %s AND lgc.row_number = %s AND lgc.column_number = %s
                  AND lgc.station_id IS NOT NULL
            """, (to_lab_id, row_num, col_num))
            existing_cell = cursor.fetchone()
            if existing_cell:
                return existing_cell['station_id']

            station_code = f"{to_lab_id}/T-{row_num}-{col_num}"
            cursor.execute("""
                INSERT INTO lab_stations (lab_id, assigned_code, row_number, column_number)
                VALUES (%s, %s, %s, %s) RETURNING station_id
            """, (to_lab_id, station_code, row_num, col_num))
            new_station_id = cursor.fetchone()['station_id']

            cursor.execute("""
                SELECT cell_id FROM lab_grid_cells
                WHERE lab_id = %s AND row_number = %s AND column_number = %s
            """, (to_lab_id, row_num, col_num))
            existing_grid = cursor.fetchone()

            if existing_grid:
                cursor.execute("""
                    UPDATE lab_grid_cells
                    SET station_id = %s, is_empty = FALSE
                    WHERE lab_id = %s AND row_number = %s AND column_number = %s
                """, (new_station_id, to_lab_id, row_num, col_num))
            else:
                cursor.execute("""
                    INSERT INTO lab_grid_cells
                    (lab_id, row_number, column_number, assigned_code, equipment_type, is_empty, station_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (to_lab_id, row_num, col_num, station_code, station_type_name, False, new_station_id))

            return new_station_id

        for _, mapped_cell_id in normalized_dest_by_device.items():
            if mapped_cell_id in dest_station_id_cache:
                continue

            dest_row, dest_col, dest_station_type_name = resolve_dest_to_position(mapped_cell_id)
            if dest_row is None:
                cursor.close(); conn.close()
                return jsonify({'success': False, 'error': f'Destination station {mapped_cell_id} not found'}), 400

            dest_station_id_cache[mapped_cell_id] = get_or_create_dest_station(dest_row, dest_col, dest_station_type_name)

        # --- Execute the transfer ---
        for device_id in device_ids:
            mapped_cell_id = normalized_dest_by_device.get(int(device_id))
            dest_station_id = dest_station_id_cache.get(mapped_cell_id)
            if not dest_station_id:
                cursor.close(); conn.close()
                return jsonify({'success': False, 'error': f'Unable to resolve destination for device {device_id}'}), 400

            # 1. Get the device's current station and details from source lab
            cursor.execute("""
                SELECT lsd.station_id, lsd.device_type, lsd.brand, lsd.model,
                       lsd.specification, lsd.invoice_number, lsd.bill_id,
                       lsd.is_linked, lsd.linked_group_id,
                       d.assigned_code, d.asset_code
                FROM lab_station_devices lsd
                JOIN devices d ON lsd.device_id = d.device_id
                WHERE lsd.device_id = %s
            """, (device_id,))
            src_record = cursor.fetchone()

            if not src_record:
                print(f"Warning: device {device_id} not found in lab_station_devices, skipping")
                continue

            # 2. Remove device from source lab station
            cursor.execute("""
                DELETE FROM lab_station_devices
                WHERE device_id = %s AND station_id = %s
            """, (device_id, src_record['station_id']))

            # 3. Insert device into destination station
            cursor.execute("""
                INSERT INTO lab_station_devices
                (station_id, device_id, device_type, brand, model, specification,
                 invoice_number, bill_id, is_linked, linked_group_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (dest_station_id, device_id, src_record['device_type'],
                  src_record['brand'], src_record['model'], src_record['specification'],
                  src_record['invoice_number'], src_record['bill_id'],
                  src_record['is_linked'], src_record['linked_group_id']))

            # 4. Update devices table — keep assigned_code the same, update lab_id
            cursor.execute("""
                UPDATE devices SET lab_id = %s WHERE device_id = %s
            """, (to_lab_id, device_id))

        # Check if entire source stations are now empty and clean up
        if station_ids:
            for sid in station_ids:
                cursor.execute("""
                    SELECT COUNT(*) as cnt FROM lab_station_devices WHERE station_id = %s
                """, (sid,))
                remaining = cursor.fetchone()['cnt']
                if remaining == 0:
                    cursor.execute("""
                        UPDATE lab_grid_cells
                        SET is_empty = TRUE, assigned_code = NULL
                        WHERE station_id = %s
                    """, (sid,))
        
        # Update transfer request status
        cursor.execute("""
            UPDATE transfer_requests
            SET status = 'approved',
                approved_by = %s,
                approved_at = NOW()
            WHERE transfer_id = %s
        """, (user_email, transfer_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Transfer approved and {len(device_ids)} devices moved successfully'
        })
        
    except Exception as e:
        print(f"Error approving transfer: {str(e)}")
        traceback.print_exc()
        if conn:
            conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/reject_transfer/<int:transfer_id>', methods=['POST'])
def reject_transfer(transfer_id):
    """Reject transfer request"""
    try:
        # Get current user (should be HOD)
        user_info = get_current_user()
        user_email = user_info.email if user_info else 'Unknown'
        
        conn = db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE transfer_requests
            SET status = 'rejected',
                approved_by = %s,
                approved_at = NOW()
            WHERE transfer_id = %s AND status = 'pending'
        """, (user_email, transfer_id))
        
        if cursor.rowcount == 0:
            return jsonify({'success': False, 'error': 'Transfer request not found or already processed'}), 404
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Transfer request rejected'
        })
        
    except Exception as e:
        print(f"Error rejecting transfer: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/get_lab_pending_transfer_info/<lab_id>', methods=['GET'])
def get_lab_pending_transfer_info(lab_id):
    """Get pending transfer information for a specific lab.
    Returns:
      - outgoing_device_ids: list of device_ids in this lab that have pending outgoing transfers
      - incoming_cells: dict of dest_cell_id -> list of { device_id, device_type, transfer_id } for pending incoming transfers
    """
    try:
        conn = db.get_connection()
        cursor = conn.cursor()

        # Check if device_dest_map column exists
        cursor.execute("""
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'transfer_requests' AND column_name = 'device_dest_map'
        """)
        has_device_dest_map = cursor.fetchone() is not None

        # --- Outgoing: devices in this lab that are part of pending transfers ---
        cursor.execute("""
            SELECT transfer_id, device_ids, to_lab_id
            FROM transfer_requests
            WHERE from_lab_id = %s AND status = 'pending'
        """, (lab_id,))
        outgoing_device_ids = set()
        outgoing_details = []  # [{transfer_id, to_lab_id, device_ids}]
        for row in cursor.fetchall():
            dids = json.loads(row['device_ids']) if isinstance(row['device_ids'], str) else (row['device_ids'] or [])
            int_dids = [int(x) for x in dids]
            outgoing_device_ids.update(int_dids)
            outgoing_details.append({
                'transfer_id': row['transfer_id'],
                'to_lab_id': row['to_lab_id'],
                'device_ids': int_dids
            })

        # --- Incoming: pending transfers TO this lab with dest cell mapping ---
        if has_device_dest_map:
            cursor.execute("""
                SELECT transfer_id, device_ids, device_dest_map, from_lab_id
                FROM transfer_requests
                WHERE to_lab_id = %s AND status = 'pending'
            """, (lab_id,))
        else:
            cursor.execute("""
                SELECT transfer_id, device_ids, dest_cell_id, from_lab_id
                FROM transfer_requests
                WHERE to_lab_id = %s AND status = 'pending'
            """, (lab_id,))

        incoming_cells = {}  # cell_id -> [{ device_id, device_type, transfer_id }]
        incoming_device_ids_all = []
        for row in cursor.fetchall():
            tid = row['transfer_id']
            dids = json.loads(row['device_ids']) if isinstance(row['device_ids'], str) else (row['device_ids'] or [])
            int_dids = [int(x) for x in dids]
            incoming_device_ids_all.extend(int_dids)

            dest_map = {}
            if has_device_dest_map and row.get('device_dest_map'):
                raw = row['device_dest_map']
                dest_map = json.loads(raw) if isinstance(raw, str) else (raw or {})
            elif row.get('dest_cell_id'):
                dest_map = {str(did): int(row['dest_cell_id']) for did in int_dids}

            for did_str, cell_id in dest_map.items():
                cell_key = str(cell_id)
                if cell_key not in incoming_cells:
                    incoming_cells[cell_key] = []
                incoming_cells[cell_key].append({
                    'device_id': int(did_str),
                    'transfer_id': tid,
                    'from_lab_id': row['from_lab_id']
                })

        # Lookup device types for incoming devices
        if incoming_device_ids_all:
            cursor.execute("""
                SELECT d.device_id, et.name AS device_type
                FROM devices d
                JOIN equipment_types et ON d.type_id = et.type_id
                WHERE d.device_id = ANY(%s)
            """, (incoming_device_ids_all,))
            type_map = {r['device_id']: r['device_type'] for r in cursor.fetchall()}
            for cell_key, entries in incoming_cells.items():
                for entry in entries:
                    entry['device_type'] = type_map.get(entry['device_id'], 'Unknown')

        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'outgoing_device_ids': list(outgoing_device_ids),
            'outgoing_details': outgoing_details,
            'incoming_cells': incoming_cells
        })

    except Exception as e:
        print(f"Error fetching lab pending transfer info: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# -----------------------------
# Get Open Issues Count
# -----------------------------
@app.route("/get_open_issues_count", methods=["GET"])
def get_open_issues_count():
    """
    Get count of devices with open issues (status = 'open')
    """
    try:
        conn = db.get_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        
        # Count distinct devices with open issues
        cursor.execute("""
            SELECT COUNT(DISTINCT device_id) as open_issues_count
            FROM device_issues
            WHERE LOWER(status) = 'open'
        """)
        
        result = cursor.fetchone()
        count = result['open_issues_count'] if result else 0
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "count": count
        })
    
    except Exception as e:
        print(f"Error fetching open issues count: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Get Inactive Devices Count (excluding devices with only resolved issues)
# -----------------------------
@app.route("/get_inactive_devices_count", methods=["GET"])
def get_inactive_devices_count():
    """
    Get count of inactive devices that are assigned to labs and have open issues
    Only counts devices that are actually deployed, not unassigned inventory
    """
    try:
        conn = db.get_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        
        # Count devices that are:
        # 1. Assigned to a lab (not in unassigned inventory)
        # 2. AND have is_active = FALSE
        # 3. AND have at least one non-resolved issue
        cursor.execute("""
            SELECT COUNT(DISTINCT d.device_id) as inactive_count
            FROM devices d
            WHERE d.is_active = FALSE
            AND d.assigned_code IS NOT NULL
            AND d.assigned_code != ''
            AND EXISTS (
                SELECT 1 FROM device_issues di 
                WHERE di.device_id = d.device_id 
                AND LOWER(di.status) != 'resolved'
            )
        """)
        
        result = cursor.fetchone()
        count = result['inactive_count'] if result else 0
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "count": count
        })
    
    except Exception as e:
        print(f"Error fetching inactive devices count: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# =============================
# LAB LAYOUT BLUEPRINT APIs
# =============================

# -----------------------------
# Get Station Types
# -----------------------------
@app.route("/get_station_types", methods=["GET"])
def get_station_types():
    """Return all available station types for the layout designer."""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT station_type_id, name, name AS label, icon, color, description, allowed_device_types
               FROM station_types ORDER BY station_type_id"""
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({"success": True, "stationTypes": rows})
    except Exception as e:
        print(f"Error fetching station types: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# -----------------------------
# Get Labs For Layout Editor
# -----------------------------
@app.route("/get_labs_for_layout", methods=["GET"])
def get_labs_for_layout():
    """Return list of labs with layout station counts."""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT l.lab_id, l.lab_name, l.rows, l.columns, l.layout_id,
                      COALESCE((
                          SELECT COUNT(*) FROM lab_layout_cells lc
                          WHERE lc.layout_id = l.layout_id
                            AND lc.station_type_id IS NOT NULL
                      ), 0) AS station_count
               FROM labs l
               ORDER BY l.lab_id"""
        )
        labs = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({"success": True, "labs": labs})
    except Exception as e:
        print(f"Error fetching labs for layout: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# -----------------------------
# Get Lab Layout (by lab_id)
# -----------------------------
@app.route("/get_lab_layout/<lab_id>", methods=["GET"])
def get_lab_layout(lab_id):
    """Return a lab with its layout grid cells."""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """SELECT lab_id, lab_name, rows, columns, layout_id
               FROM labs WHERE lab_id = %s""",
            (lab_id,)
        )
        lab = cursor.fetchone()
        if not lab:
            return jsonify({"error": "Lab not found", "success": False}), 404

        layout_id = lab['layout_id']
        rows_count = lab['rows'] or 6
        cols_count = lab['columns'] or 6

        # Build empty grid
        grid = [[None for _ in range(cols_count)] for _ in range(rows_count)]

        if layout_id:
            cursor.execute(
                """SELECT lc.cell_id, lc.row_number, lc.column_number,
                          lc.station_type_id, lc.label AS station_label,
                          lc.is_empty, lc.os_windows, lc.os_linux, lc.os_other, lc.notes,
                          st.name AS station_type_name, st.name AS station_type_label,
                          st.icon, st.color
                   FROM lab_layout_cells lc
                   LEFT JOIN station_types st ON lc.station_type_id = st.station_type_id
                   WHERE lc.layout_id = %s
                   ORDER BY lc.row_number, lc.column_number""",
                (layout_id,)
            )
            cells = cursor.fetchall()

            for cell in cells:
                r, c = cell['row_number'], cell['column_number']
                if 0 <= r < rows_count and 0 <= c < cols_count:
                    os_list = []
                    if cell['os_windows']:
                        os_list.append("Windows")
                    if cell['os_linux']:
                        os_list.append("Linux")
                    if cell['os_other']:
                        os_list.append("Other")
                    grid[r][c] = {
                        "cellId": cell['cell_id'],
                        "stationTypeId": cell['station_type_id'],
                        "stationTypeName": cell['station_type_name'] or 'empty',
                        "stationTypeLabel": cell['station_type_label'] or 'Empty',
                        "icon": cell['icon'] or '⬜',
                        "color": cell['color'] or '#6b7280',
                        "stationLabel": cell['station_label'],
                        "os": os_list,
                        "notes": cell['notes']
                    }

        # Fill gaps with empty
        for r in range(rows_count):
            for c_idx in range(cols_count):
                if grid[r][c_idx] is None:
                    grid[r][c_idx] = {
                        "cellId": None,
                        "stationTypeId": None,
                        "stationTypeName": "empty",
                        "stationTypeLabel": "Empty",
                        "icon": "⬜",
                        "color": "#6b7280",
                        "stationLabel": None,
                        "os": [],
                        "notes": None
                    }

        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "layout": {
                "labId": lab['lab_id'],
                "labName": lab['lab_name'],
                "rows": rows_count,
                "columns": cols_count,
                "layoutId": layout_id,
                "grid": grid
            }
        })
    except Exception as e:
        print(f"Error fetching lab layout: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# -----------------------------
# Save Lab Layout
# -----------------------------
@app.route("/save_lab_layout", methods=["POST"])
def save_lab_layout():
    """Create or update a lab and its layout blueprint."""
    try:
        data = request.json
        lab_number = data.get("labNumber", "").strip()
        lab_name = data.get("labName", "").strip()
        rows = data.get("rows", 6)
        columns = data.get("columns", 6)
        grid = data.get("grid", [])

        if not lab_number:
            return jsonify({"error": "Lab number is required"}), 400
        if not lab_name:
            return jsonify({"error": "Lab name is required"}), 400

        conn = db.get_connection()
        cursor = conn.cursor()

        try:
            # Check if lab exists
            cursor.execute("SELECT id, layout_id FROM labs WHERE lab_id = %s", (lab_number,))
            existing_lab = cursor.fetchone()

            if existing_lab:
                layout_id = existing_lab['layout_id']
                # Update lab dimensions and name
                cursor.execute(
                    "UPDATE labs SET lab_name = %s, rows = %s, columns = %s WHERE lab_id = %s",
                    (lab_name, rows, columns, lab_number)
                )

                if layout_id:
                    # Update existing layout template
                    cursor.execute(
                        """UPDATE lab_layout_templates
                           SET layout_name = %s, rows = %s, columns = %s, updated_at = now()
                           WHERE layout_id = %s""",
                        (f"{lab_number} - {lab_name}", rows, columns, layout_id)
                    )
                    cursor.execute("DELETE FROM lab_layout_cells WHERE layout_id = %s", (layout_id,))
                else:
                    # Create new layout template for existing lab
                    cursor.execute(
                        """INSERT INTO lab_layout_templates (layout_name, rows, columns)
                           VALUES (%s, %s, %s) RETURNING layout_id""",
                        (f"{lab_number} - {lab_name}", rows, columns)
                    )
                    layout_id = cursor.fetchone()['layout_id']
                    cursor.execute("UPDATE labs SET layout_id = %s WHERE lab_id = %s", (layout_id, lab_number))
            else:
                # Create new layout template
                cursor.execute(
                    """INSERT INTO lab_layout_templates (layout_name, rows, columns)
                       VALUES (%s, %s, %s) RETURNING layout_id""",
                    (f"{lab_number} - {lab_name}", rows, columns)
                )
                layout_id = cursor.fetchone()['layout_id']

                # Create new lab
                cursor.execute(
                    """INSERT INTO labs (lab_id, lab_name, rows, columns, layout_id)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (lab_number, lab_name, rows, columns, layout_id)
                )

            # Insert layout cells
            station_count = 0
            for row_idx, row_data in enumerate(grid):
                for col_idx, cell in enumerate(row_data):
                    if cell is None:
                        continue
                    station_type_id = cell.get("stationTypeId")
                    station_label = cell.get("stationLabel")
                    os_list = cell.get("os", [])
                    notes = cell.get("notes")
                    is_empty = station_type_id is None

                    cursor.execute(
                        """INSERT INTO lab_layout_cells
                           (layout_id, row_number, column_number, station_type_id,
                            label, is_empty, os_windows, os_linux, os_other, notes)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                        (layout_id, row_idx, col_idx, station_type_id,
                         station_label, is_empty,
                         "Windows" in os_list, "Linux" in os_list, "Other" in os_list,
                         notes)
                    )
                    if station_type_id is not None:
                        station_count += 1

            conn.commit()
            return jsonify({
                "success": True,
                "message": f"Lab '{lab_name}' (Lab {lab_number}) layout saved successfully",
                "labId": lab_number,
                "stationCount": station_count
            })
        except Exception as db_err:
            conn.rollback()
            raise db_err
        finally:
            cursor.close()
            conn.close()

    except Exception as e:
        print(f"Error saving lab layout: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Delete Lab Layout (clears layout cells, keeps lab)
# -----------------------------
@app.route("/delete_lab_layout/<lab_id>", methods=["DELETE"])
def delete_lab_layout(lab_id):
    """Delete the layout cells for a lab (keeps the lab itself)."""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT layout_id FROM labs WHERE lab_id = %s", (lab_id,))
        lab = cursor.fetchone()
        if not lab or not lab['layout_id']:
            cursor.close()
            conn.close()
            return jsonify({"error": "No layout found for this lab", "success": False}), 404

        layout_id = lab['layout_id']
        cursor.execute("DELETE FROM lab_layout_cells WHERE layout_id = %s", (layout_id,))
        cursor.execute("DELETE FROM lab_layout_templates WHERE layout_id = %s", (layout_id,))
        cursor.execute("UPDATE labs SET layout_id = NULL WHERE lab_id = %s", (lab_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True, "message": "Layout cleared successfully"})
    except Exception as e:
        print(f"Error deleting lab layout: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


# -----------------------------
# Auto-Assign Devices Based on Layout
# -----------------------------
@app.route("/auto_assign_devices", methods=["POST"])
def auto_assign_devices():
    """
    Auto-assign devices to a lab based on its layout blueprint.
    - Each station type defines which device types it accepts.
    - One station may hold at most ONE device of each type.
    - Each device gets a unique code: {prefix}/{number}.
    - Numbers are per (lab, device_type) and NEVER go backwards.
    - Assignment order: row-by-row, left to right (top-to-bottom).
    """
    try:
        data = request.json
        lab_number = data.get("labNumber", "").strip()
        code_prefixes = data.get("codePrefixes", {})  # {device_type_name: prefix}
        linked_groups = data.get("linkedDeviceGroups", [])
        os_selection = data.get("osSelection", {})  # {device_type_name: {windows, linux, other}}

        if not lab_number:
            return jsonify({"error": "Lab number is required"}), 400

        conn = db.get_connection()
        cursor = conn.cursor()

        try:
            # ── Validate lab & layout ───────────────────────────────
            cursor.execute(
                "SELECT lab_id, lab_name, rows, columns, layout_id FROM labs WHERE lab_id = %s",
                (lab_number,)
            )
            lab = cursor.fetchone()
            if not lab:
                return jsonify({"error": "Lab not found"}), 404
            if not lab['layout_id']:
                return jsonify({"error": "Lab has no layout blueprint. Design one first."}), 400

            layout_id = lab['layout_id']
            lab_name = lab['lab_name']

            # ── Equipment-type id ↔ name maps ──────────────────────
            cursor.execute("SELECT type_id, name FROM equipment_types")
            type_rows = cursor.fetchall()
            type_id_to_name = {r['type_id']: r['name'] for r in type_rows}
            type_name_to_id = {r['name']: r['type_id'] for r in type_rows}

            # ── Fetch layout cells ordered L→R, T→B ────────────────
            cursor.execute("""
                SELECT lc.row_number, lc.column_number, lc.station_type_id,
                       lc.is_empty,
                       st.name AS station_type_name,
                       st.allowed_device_types
                FROM lab_layout_cells lc
                LEFT JOIN station_types st
                       ON lc.station_type_id = st.station_type_id
                WHERE lc.layout_id = %s
                ORDER BY lc.row_number, lc.column_number
            """, (layout_id,))
            layout_cells = cursor.fetchall()

            if not layout_cells:
                return jsonify({"error": "Layout has no cells. Design the layout first."}), 400

            # ── Save existing device→code mapping ────────────────
            cursor.execute(
                """SELECT device_id, assigned_code FROM devices
                   WHERE lab_id = %s AND assigned_code IS NOT NULL
                         AND assigned_code != ''""",
                (lab_number,)
            )
            previous_codes = {r['device_id']: r['assigned_code']
                              for r in cursor.fetchall()}

            # ── Load current grid + station occupancy ─────────────
            cursor.execute(
                """SELECT row_number, column_number, station_id, assigned_code,
                          equipment_type, is_empty, os_windows, os_linux, os_other
                   FROM lab_grid_cells
                   WHERE lab_id = %s""",
                (lab_number,)
            )
            grid_rows = cursor.fetchall()
            grid_map = {(r['row_number'], r['column_number']): r for r in grid_rows}

            cursor.execute(
                """SELECT ls.station_id, ls.assigned_code, lsd.device_type
                   FROM lab_stations ls
                   LEFT JOIN lab_station_devices lsd ON lsd.station_id = ls.station_id
                   WHERE ls.lab_id = %s""",
                (lab_number,)
            )
            station_rows = cursor.fetchall()
            station_device_types = {}
            station_codes = {}
            max_station_num = 0
            for row in station_rows:
                sid = row['station_id']
                station_codes[sid] = row['assigned_code']
                if sid not in station_device_types:
                    station_device_types[sid] = set()
                if row.get('device_type'):
                    station_device_types[sid].add(row['device_type'])
                code = row.get('assigned_code') or ''
                if code.startswith(f"{lab_number}/ST-"):
                    try:
                        num = int(code.split("/ST-")[-1])
                        if num > max_station_num:
                            max_station_num = num
                    except ValueError:
                        pass

            cursor.execute(
                """SELECT lsd.station_id, d.assigned_code
                   FROM lab_station_devices lsd
                   JOIN devices d ON d.device_id = lsd.device_id
                   JOIN lab_stations ls ON ls.station_id = lsd.station_id
                   WHERE ls.lab_id = %s
                     AND d.assigned_code IS NOT NULL AND d.assigned_code != ''""",
                (lab_number,)
            )
            station_device_codes = {}
            for row in cursor.fetchall():
                station_device_codes.setdefault(row['station_id'], []).append(row['assigned_code'])

            # ── Build equipment list from pooled devices in DB ──────
            cursor.execute("""
                SELECT et.name AS type, d.brand, d.model, d.bill_id,
                       d.invoice_number, d.specification,
                       COUNT(*) AS quantity
                FROM devices d
                JOIN equipment_types et ON d.type_id = et.type_id
                WHERE d.lab_id = %s
                  AND (d.assigned_code IS NULL OR d.assigned_code = '')
                GROUP BY et.name, d.brand, d.model, d.bill_id,
                         d.invoice_number, d.specification
            """, (lab_number,))
            pool_rows = cursor.fetchall()
            equipment_list = [dict(r) for r in pool_rows]

            if not equipment_list:
                return jsonify({"error": "No devices pooled for this lab. Add equipment first."}), 400

            # ── Sync lab_equipment_pool from actual device pool ──────
            cursor.execute("DELETE FROM lab_equipment_pool WHERE lab_id = %s", (lab_number,))
            for eq in equipment_list:
                cursor.execute(
                    """INSERT INTO lab_equipment_pool
                       (lab_id, equipment_type, brand, model, specification,
                        quantity_added, invoice_number, bill_id)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (lab_number, eq.get('type'), eq.get('brand'),
                     eq.get('model'), eq.get('specification'),
                     eq.get('quantity'), eq.get('invoice_number'),
                     eq.get('bill_id'))
                )

            # ── Remaining-quantity tracker ───────────────────────────
            remaining = {}
            for eq in equipment_list:
                key = (eq.get('type', ''), eq.get('brand', ''),
                       eq.get('model', ''), eq.get('bill_id'))
                remaining[key] = remaining.get(key, 0) + eq.get('quantity', 0)

            used_device_ids = set()
            station_counter = max_station_num
            devices_assigned = 0

            # ── Device code counters (persisted per lab + device type) ──
            cursor.execute(
                "SELECT device_type, last_number FROM device_code_counters WHERE lab_id = %s",
                (lab_number,)
            )
            _type_counters = {r['device_type']: r['last_number'] for r in cursor.fetchall()}

            # Ensure counters are at least the max suffix seen in previous codes
            for dtype, prefix in code_prefixes.items():
                max_seen = _type_counters.get(dtype, 0)
                if prefix:
                    for code in previous_codes.values():
                        if code and code.startswith(prefix + "/"):
                            try:
                                suffix = int(code[len(prefix) + 1:])
                                if suffix > max_seen:
                                    max_seen = suffix
                            except ValueError:
                                continue
                _type_counters[dtype] = max_seen

            def get_next_number(device_type):
                _type_counters[device_type] = _type_counters.get(device_type, 0) + 1
                return _type_counters[device_type]

            # ── Helper: find an unassigned device row from lab pool ──
            def find_device(dtype, brand, model, bill_id, inv_no):
                not_in_clause = ""
                params = [lab_number, dtype, brand, model, bill_id, inv_no]
                if used_device_ids:
                    ph = ','.join(['%s'] * len(used_device_ids))
                    not_in_clause = f" AND device_id NOT IN ({ph})"
                    params.extend(list(used_device_ids))
                cursor.execute(f"""
                    SELECT device_id, specification FROM devices
                    WHERE lab_id = %s
                      AND type_id = (SELECT type_id FROM equipment_types
                                     WHERE name = %s LIMIT 1)
                      AND brand IS NOT DISTINCT FROM %s
                      AND model IS NOT DISTINCT FROM %s
                      AND bill_id IS NOT DISTINCT FROM %s
                      AND invoice_number IS NOT DISTINCT FROM %s
                      AND (assigned_code IS NULL OR assigned_code = '')
                      {not_in_clause}
                    ORDER BY device_id ASC LIMIT 1
                """, params)
                return cursor.fetchone()

            # ── Helper: assign one device to a station ──────────────
            def assign_device(device_rec, dtype, brand, model,
                              inv_no, bill_id, station_id):
                nonlocal devices_assigned
                did = device_rec['device_id']

                # Reuse old code if this exact device was already
                # assigned in this lab — avoids bumping the counter
                if did in previous_codes:
                    device_code = previous_codes[did]
                    prefix = code_prefixes.get(dtype, '')
                    if prefix and device_code.startswith(prefix + "/"):
                        try:
                            suffix = int(device_code[len(prefix) + 1:])
                            if suffix > _type_counters.get(dtype, 0):
                                _type_counters[dtype] = suffix
                        except ValueError:
                            pass
                else:
                    next_num = get_next_number(dtype)
                    prefix = code_prefixes.get(dtype, '')
                    device_code = (f"{prefix}/{next_num}" if prefix
                                   else f"{dtype}/{next_num}")

                cursor.execute(
                    """UPDATE devices
                       SET lab_id=%s, is_active=TRUE,
                           qr_value=%s, assigned_code=%s
                       WHERE device_id=%s""",
                    (lab_number, device_code, device_code, did)
                )
                cursor.execute(
                    """INSERT INTO lab_station_devices
                       (station_id, device_id, device_type, brand, model,
                        specification, invoice_number, bill_id,
                        is_linked, linked_group_id)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (station_id, did, dtype, brand, model,
                     device_rec.get('specification'), inv_no, bill_id,
                     False, None)
                )
                devices_assigned += 1
                used_device_ids.add(did)
                station_device_codes.setdefault(station_id, []).append(device_code)
                return device_code

            # ── Helper: try to place one device of a given type ─────
            def try_assign_type(type_name, station_id):
                """Pick the first available equipment row of *type_name*,
                   find a matching DB device, and assign it."""
                for eq in equipment_list:
                    if eq.get('type') != type_name:
                        continue
                    ek = (eq.get('type', ''), eq.get('brand', ''),
                          eq.get('model', ''), eq.get('bill_id'))
                    if remaining.get(ek, 0) <= 0:
                        continue
                    rec = find_device(
                        eq.get('type'), eq.get('brand'),
                        eq.get('model'), eq.get('bill_id'),
                        eq.get('invoice_number'))
                    if rec:
                        remaining[ek] -= 1
                        assign_device(rec, type_name,
                                      eq.get('brand'), eq.get('model'),
                                      eq.get('invoice_number'),
                                      eq.get('bill_id'), station_id)
                        return True
                return False

            # ── Walk every layout cell ──────────────────────────────
            for cell in layout_cells:
                row_idx = cell['row_number']
                col_idx = cell['column_number']
                st_id   = cell['station_type_id']
                is_empty = cell.get('is_empty', True)
                station_name = cell.get('station_type_name') or ''

                # Empty / passage → ensure grid cell exists and skip
                if is_empty or st_id is None or station_name in ('passage', 'empty'):
                    if (row_idx, col_idx) not in grid_map:
                        cursor.execute(
                            """INSERT INTO lab_grid_cells
                               (lab_id, row_number, column_number,
                                assigned_code, equipment_type,
                                os_windows, os_linux, os_other,
                                is_empty, station_id)
                               VALUES (%s,%s,%s,NULL,%s,
                                       FALSE,FALSE,FALSE,TRUE,NULL)""",
                            (lab_number, row_idx, col_idx,
                             station_name or 'Empty')
                        )
                    continue

                # Resolve allowed device-type names for this station
                raw_allowed = cell.get('allowed_device_types') or []
                # allowed_device_types is already TEXT[] of type names
                allowed_names = [t for t in raw_allowed if t]

                # Get or create station row for this cell
                station_id = None
                station_code = None
                grid_row = grid_map.get((row_idx, col_idx))
                if grid_row and grid_row.get('station_id'):
                    station_id = grid_row['station_id']
                    station_code = grid_row.get('assigned_code')
                else:
                    station_counter += 1
                    station_code = f"{lab_number}/ST-{station_counter}"
                    cursor.execute(
                        """INSERT INTO lab_stations
                           (lab_id, assigned_code, row_number, column_number)
                           VALUES (%s,%s,%s,%s) RETURNING station_id""",
                        (lab_number, station_code, row_idx, col_idx)
                    )
                    station_id = cursor.fetchone()['station_id']
                    if grid_row:
                        cursor.execute(
                            """UPDATE lab_grid_cells
                               SET assigned_code = %s,
                                   station_id = %s,
                                   equipment_type = %s,
                                   is_empty = FALSE
                               WHERE lab_id = %s AND row_number = %s AND column_number = %s""",
                            (station_code, station_id, station_name,
                             lab_number, row_idx, col_idx)
                        )
                    else:
                        cursor.execute(
                            """INSERT INTO lab_grid_cells
                               (lab_id, row_number, column_number,
                                assigned_code, equipment_type,
                                os_windows, os_linux, os_other,
                                is_empty, station_id)
                               VALUES (%s,%s,%s,%s,%s,
                                       FALSE,FALSE,FALSE,TRUE,%s)""",
                            (lab_number, row_idx, col_idx,
                             station_code, station_name, station_id)
                        )

                # For each allowed device type → assign if missing
                existing_types = station_device_types.get(station_id, set())
                for type_name in allowed_names:
                    if type_name in existing_types:
                        continue
                    if try_assign_type(type_name, station_id):
                        existing_types.add(type_name)
                        station_device_types[station_id] = existing_types
                        print(f"  ✅ Assigned {type_name} to station {station_code}")

                has_devices = len(existing_types) > 0

                # Generate station-level QR value encoding all devices at this station
                if station_id in station_device_codes:
                    device_codes_str = ",".join(station_device_codes[station_id])
                    station_qr_val = f"STATION|{station_code}|{device_codes_str}"
                    try:
                        cursor.execute(
                            """UPDATE lab_stations
                               SET station_qr_value = %s
                               WHERE station_id = %s""",
                            (station_qr_val, station_id)
                        )
                    except Exception:
                        # station_qr_value column may not exist yet
                        pass

                # Update grid cell — resolve OS flags from osSelection for allowed types
                primary_type = allowed_names[0] if allowed_names else station_name
                os_win = False
                os_lin = False
                os_oth = False
                for tn in allowed_names:
                    os_data = os_selection.get(tn, {})
                    if os_data.get('windows'):
                        os_win = True
                    if os_data.get('linux'):
                        os_lin = True
                    if os_data.get('other'):
                        os_oth = True
                cursor.execute(
                    """UPDATE lab_grid_cells
                       SET assigned_code = %s,
                           equipment_type = %s,
                           os_windows = %s,
                           os_linux = %s,
                           os_other = %s,
                           is_empty = %s,
                           station_id = %s
                       WHERE lab_id = %s AND row_number = %s AND column_number = %s""",
                    (station_code, primary_type,
                     os_win, os_lin, os_oth,
                     not has_devices, station_id,
                     lab_number, row_idx, col_idx)
                )

            # ── Persist code counters ───────────────────────────────
            for dtype, last_num in _type_counters.items():
                cursor.execute(
                    """INSERT INTO device_code_counters (lab_id, device_type, last_number)
                       VALUES (%s, %s, %s)
                       ON CONFLICT (lab_id, device_type)
                       DO UPDATE SET last_number = GREATEST(device_code_counters.last_number, EXCLUDED.last_number),
                                     updated_at = now()""",
                    (lab_number, dtype, last_num)
                )

            # ── Update quantity_assigned in pool ────────────────────
            cursor.execute("""
                UPDATE lab_equipment_pool lep
                SET quantity_assigned = (
                    SELECT COUNT(*)
                    FROM lab_station_devices lsd
                    JOIN lab_stations ls ON lsd.station_id = ls.station_id
                    WHERE ls.lab_id = lep.lab_id
                      AND lsd.device_type = lep.equipment_type
                      AND COALESCE(lsd.brand,'') = COALESCE(lep.brand,'')
                      AND COALESCE(lsd.model,'') = COALESCE(lep.model,'')
                      AND lsd.bill_id IS NOT DISTINCT FROM lep.bill_id
                )
                WHERE lab_id = %s
            """, (lab_number,))

            # ── Compute leftover (unassigned) devices ─────────────
            unassigned_summary = []
            for (dtype, brand, model, bill_id), qty_left in remaining.items():
                if qty_left > 0:
                    unassigned_summary.append({
                        "type": dtype,
                        "brand": brand,
                        "model": model,
                        "quantity": qty_left
                    })
            total_unassigned = sum(r["quantity"] for r in unassigned_summary)

            conn.commit()
            return jsonify({
                "success": True,
                "message": f"Devices assigned to lab '{lab_name}' ({lab_number})",
                "stations_created": station_counter,
                "devices_assigned": devices_assigned,
                "devices_unassigned": total_unassigned,
                "unassigned_summary": unassigned_summary
            })

        except Exception as db_err:
            conn.rollback()
            raise db_err
        finally:
            cursor.close()
            conn.close()

    except Exception as e:
        print(f"Error auto-assigning devices: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Get Device Code Counters for a Lab
# -----------------------------
@app.route("/get_device_counters/<lab_id>", methods=["GET"])
def get_device_counters(lab_id):
    """Return the current numbering counters for each device type in a lab."""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT device_type, last_number FROM device_code_counters WHERE lab_id = %s",
            (lab_id,)
        )
        rows = cursor.fetchall()
        counters = {r['device_type']: r['last_number'] for r in rows}
        cursor.close()
        conn.close()
        return jsonify({"success": True, "counters": counters})
    except Exception as e:
        print(f"Error fetching counters: {e}")
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Reset Device Code Counters
# -----------------------------
@app.route("/reset_device_counters/<lab_id>", methods=["POST"])
def reset_device_counters(lab_id):
    """Reset device code counters for a lab."""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "DELETE FROM device_code_counters WHERE lab_id = %s",
                (lab_id,)
            )
            conn.commit()
            return jsonify({"success": True, "message": f"Device code counters reset for lab {lab_id}"})
        except Exception as db_err:
            conn.rollback()
            raise db_err
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        print(f"Error resetting device code counters: {e}")
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Reset Lab Assignments
# -----------------------------
@app.route("/reset_lab_assignments/<lab_id>", methods=["POST"])
def reset_lab_assignments(lab_id):
    """Clear all device assignments from a lab without touching counters."""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        try:
            # Remove open issues for devices currently assigned to this lab
            cursor.execute(
                """DELETE FROM device_issues
                   WHERE device_id IN (
                       SELECT device_id FROM devices WHERE lab_id = %s
                   )""",
                (lab_id,)
            )
            cursor.execute(
                """UPDATE devices
                   SET lab_id = NULL, assigned_code = NULL,
                       qr_value = NULL, is_active = FALSE
                   WHERE lab_id = %s""",
                (lab_id,)
            )
            cursor.execute("DELETE FROM lab_grid_cells WHERE lab_id = %s", (lab_id,))
            cursor.execute(
                """DELETE FROM lab_station_devices
                   WHERE station_id IN
                         (SELECT station_id FROM lab_stations WHERE lab_id = %s)""",
                (lab_id,)
            )
            cursor.execute("DELETE FROM lab_stations WHERE lab_id = %s", (lab_id,))
            cursor.execute("DELETE FROM lab_equipment_pool WHERE lab_id = %s", (lab_id,))
            conn.commit()
            return jsonify({"success": True, "message": f"All assignments cleared for lab {lab_id}"})
        except Exception as db_err:
            conn.rollback()
            raise db_err
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        print(f"Error resetting lab assignments: {e}")
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Save Lab Configuration (equipment pool, prefixes, linked groups — no auto-assign)
# -----------------------------
@app.route("/save_lab_config", methods=["POST"])
def save_lab_config():
    """Sync the lab_equipment_pool table from the actual device pool and persist settings."""
    try:
        data = request.json
        lab_id = data.get("labNumber", "").strip()

        if not lab_id:
            return jsonify({"error": "Lab number is required"}), 400

        conn = db.get_connection()
        cursor = conn.cursor()
        try:
            # Sync lab_equipment_pool from actual devices table (source of truth)
            cursor.execute("DELETE FROM lab_equipment_pool WHERE lab_id = %s", (lab_id,))
            cursor.execute("""
                INSERT INTO lab_equipment_pool
                (lab_id, equipment_type, brand, model, specification,
                 quantity_added, invoice_number, bill_id)
                SELECT %s, et.name, d.brand, d.model, d.specification,
                       COUNT(*), d.invoice_number, d.bill_id
                FROM devices d
                JOIN equipment_types et ON d.type_id = et.type_id
                WHERE d.lab_id = %s
                GROUP BY et.name, d.brand, d.model, d.specification,
                         d.invoice_number, d.bill_id
            """, (lab_id, lab_id))
            conn.commit()
            return jsonify({
                "success": True,
                "message": f"Configuration saved for lab {lab_id}"
            })
        except Exception as db_err:
            conn.rollback()
            raise db_err
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        print(f"Error saving lab config: {e}")
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Issue Trends Analytics
# -----------------------------
@app.route("/get_issue_trends", methods=["GET"])
def get_issue_trends():
    """
    Comprehensive issue analytics for the Issue Trends report page.
    Returns: timeline, severity breakdown, per-bill batch analysis,
    repeat-offender devices, per-lab stats, per-device-type stats.
    """
    try:
        conn = db.get_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor()

        # 1. Monthly issue timeline (last 12 months)
        cursor.execute("""
            SELECT TO_CHAR(reported_at, 'YYYY-MM') AS month,
                   COUNT(*) AS total,
                   SUM(CASE WHEN LOWER(severity) = 'critical' THEN 1 ELSE 0 END) AS critical,
                   SUM(CASE WHEN LOWER(severity) = 'high' THEN 1 ELSE 0 END) AS high,
                   SUM(CASE WHEN LOWER(severity) = 'medium' THEN 1 ELSE 0 END) AS medium,
                   SUM(CASE WHEN LOWER(severity) = 'low' THEN 1 ELSE 0 END) AS low
            FROM device_issues
            WHERE reported_at >= NOW() - INTERVAL '12 months'
            GROUP BY TO_CHAR(reported_at, 'YYYY-MM')
            ORDER BY month
        """)
        timeline = cursor.fetchall()

        # 2. Issues by severity (overall)
        cursor.execute("""
            SELECT COALESCE(LOWER(severity), 'unknown') AS severity,
                   COUNT(*) AS count
            FROM device_issues
            GROUP BY COALESCE(LOWER(severity), 'unknown')
        """)
        severity_breakdown = cursor.fetchall()

        # 3. Issues by status
        cursor.execute("""
            SELECT LOWER(status) AS status, COUNT(*) AS count
            FROM device_issues
            GROUP BY LOWER(status)
        """)
        status_breakdown = cursor.fetchall()

        # 4. Problematic batches – bills whose devices raise the most issues
        cursor.execute("""
            SELECT b.bill_id, b.invoice_number, b.vendor_name,
                   b.bill_date,
                   COUNT(di.issue_id) AS issue_count,
                   COUNT(DISTINCT di.device_id) AS affected_devices,
                   COUNT(DISTINCT d.device_id) AS total_devices_in_bill,
                   SUM(CASE WHEN LOWER(di.severity) IN ('critical','high') THEN 1 ELSE 0 END) AS severe_issues
            FROM device_issues di
            JOIN devices d ON di.device_id = d.device_id
            JOIN bills b ON d.bill_id = b.bill_id
            GROUP BY b.bill_id, b.invoice_number, b.vendor_name, b.bill_date
            ORDER BY issue_count DESC
            LIMIT 15
        """)
        problematic_batches = cursor.fetchall()

        # 5. Repeat-offender devices (most issues)
        cursor.execute("""
            SELECT d.device_id, d.asset_code AS asset_id,
                   et.name AS type_name, d.brand, d.model,
                   l.lab_name, d.assigned_code,
                   d.is_active,
                   COUNT(di.issue_id) AS issue_count,
                   SUM(CASE WHEN LOWER(di.status) = 'open' THEN 1 ELSE 0 END) AS open_issues,
                   SUM(CASE WHEN LOWER(di.severity) IN ('critical','high') THEN 1 ELSE 0 END) AS severe_issues,
                   MIN(di.reported_at) AS first_issue,
                   MAX(di.reported_at) AS last_issue
            FROM device_issues di
            JOIN devices d ON di.device_id = d.device_id
            LEFT JOIN equipment_types et ON d.type_id = et.type_id
            LEFT JOIN labs l ON d.lab_id = l.lab_id
            GROUP BY d.device_id, d.asset_code, et.name, d.brand, d.model,
                     l.lab_name, d.assigned_code, d.is_active
            HAVING COUNT(di.issue_id) >= 2
            ORDER BY issue_count DESC
            LIMIT 20
        """)
        repeat_offenders = cursor.fetchall()

        # 6. Issues per lab
        cursor.execute("""
            SELECT COALESCE(l.lab_name, 'Unassigned') AS lab_name,
                   COUNT(di.issue_id) AS issue_count,
                   SUM(CASE WHEN LOWER(di.status) = 'open' THEN 1 ELSE 0 END) AS open_issues,
                   SUM(CASE WHEN LOWER(di.severity) IN ('critical','high') THEN 1 ELSE 0 END) AS severe_issues
            FROM device_issues di
            JOIN devices d ON di.device_id = d.device_id
            LEFT JOIN labs l ON d.lab_id = l.lab_id
            GROUP BY COALESCE(l.lab_name, 'Unassigned')
            ORDER BY issue_count DESC
        """)
        issues_by_lab = cursor.fetchall()

        # 7. Issues per device type
        cursor.execute("""
            SELECT COALESCE(et.name, 'Unknown') AS type_name,
                   COUNT(di.issue_id) AS issue_count,
                   COUNT(DISTINCT di.device_id) AS affected_devices,
                   SUM(CASE WHEN LOWER(di.status) = 'open' THEN 1 ELSE 0 END) AS open_issues
            FROM device_issues di
            JOIN devices d ON di.device_id = d.device_id
            LEFT JOIN equipment_types et ON d.type_id = et.type_id
            GROUP BY COALESCE(et.name, 'Unknown')
            ORDER BY issue_count DESC
        """)
        issues_by_type = cursor.fetchall()

        # 8. Most common issue titles
        cursor.execute("""
            SELECT issue_title, COUNT(*) AS count,
                   ROUND(AVG(CASE
                       WHEN LOWER(severity) = 'critical' THEN 4
                       WHEN LOWER(severity) = 'high' THEN 3
                       WHEN LOWER(severity) = 'medium' THEN 2
                       WHEN LOWER(severity) = 'low' THEN 1
                       ELSE 2 END), 1) AS avg_severity_score
            FROM device_issues
            GROUP BY issue_title
            ORDER BY count DESC
            LIMIT 10
        """)
        common_issues = cursor.fetchall()

        # 9. Average resolution time (for resolved issues with resolved_at)
        cursor.execute("""
            SELECT COALESCE(et.name, 'Unknown') AS type_name,
                   ROUND(AVG(EXTRACT(EPOCH FROM (di.resolved_at - di.reported_at)) / 3600)::numeric, 1) AS avg_hours
            FROM device_issues di
            JOIN devices d ON di.device_id = d.device_id
            LEFT JOIN equipment_types et ON d.type_id = et.type_id
            WHERE di.resolved_at IS NOT NULL
            GROUP BY COALESCE(et.name, 'Unknown')
            ORDER BY avg_hours DESC
        """)
        avg_resolution = cursor.fetchall()

        # 10. Summary stats
        cursor.execute("""
            SELECT COUNT(*) AS total_issues,
                   SUM(CASE WHEN LOWER(status) = 'open' THEN 1 ELSE 0 END) AS open_issues,
                   SUM(CASE WHEN LOWER(status) = 'in-progress' THEN 1 ELSE 0 END) AS in_progress,
                   SUM(CASE WHEN LOWER(status) = 'resolved' THEN 1 ELSE 0 END) AS resolved,
                   COUNT(DISTINCT device_id) AS affected_devices
            FROM device_issues
        """)
        summary = cursor.fetchone()

        cursor.close()
        conn.close()

        # Serialize dates for JSON
        for b in problematic_batches:
            if b.get('bill_date'):
                b['bill_date'] = b['bill_date'].strftime('%Y-%m-%d') if hasattr(b['bill_date'], 'strftime') else str(b['bill_date'])
        for r in repeat_offenders:
            if r.get('first_issue'):
                r['first_issue'] = r['first_issue'].isoformat() if hasattr(r['first_issue'], 'isoformat') else str(r['first_issue'])
            if r.get('last_issue'):
                r['last_issue'] = r['last_issue'].isoformat() if hasattr(r['last_issue'], 'isoformat') else str(r['last_issue'])

        return jsonify({
            "success": True,
            "timeline": timeline,
            "severity_breakdown": severity_breakdown,
            "status_breakdown": status_breakdown,
            "problematic_batches": problematic_batches,
            "repeat_offenders": repeat_offenders,
            "issues_by_lab": issues_by_lab,
            "issues_by_type": issues_by_type,
            "common_issues": common_issues,
            "avg_resolution": avg_resolution,
            "summary": summary
        })

    except Exception as e:
        print(f"Error fetching issue trends: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# -----------------------------
# AI Issue Insights
# -----------------------------
@app.route("/get_issue_insights", methods=["POST"])
def get_issue_insights():
    """
    Send issue analytics data to local LLM for AI-powered insights.
    """
    try:
        data = request.get_json(force=True)
        analytics = data.get("analytics", {})

        prompt = f"""You are an IT asset management analyst. Analyze the following issue data and provide actionable insights.

ISSUE SUMMARY:
- Total issues: {analytics.get('total_issues', 0)}
- Open: {analytics.get('open_issues', 0)}
- In Progress: {analytics.get('in_progress', 0)}
- Resolved: {analytics.get('resolved', 0)}
- Affected devices: {analytics.get('affected_devices', 0)}

PROBLEMATIC BATCHES (bills with most issues):
{json.dumps(analytics.get('problematic_batches', [])[:5], indent=2, default=str)}

REPEAT OFFENDER DEVICES (devices with recurring issues):
{json.dumps(analytics.get('repeat_offenders', [])[:5], indent=2, default=str)}

ISSUES BY DEVICE TYPE:
{json.dumps(analytics.get('issues_by_type', []), indent=2, default=str)}

COMMON ISSUE TYPES:
{json.dumps(analytics.get('common_issues', [])[:5], indent=2, default=str)}

Based on this data, provide:
1. KEY FINDINGS: 2-3 critical observations
2. BATCH ALERTS: Which purchase batches need attention and why
3. DEVICE ALERTS: Which specific devices should be replaced or need urgent maintenance
4. RECOMMENDATIONS: 3-4 actionable steps to reduce future issues
5. PATTERNS: Any concerning patterns you notice

Be concise and specific. Use device IDs and invoice numbers when referencing items."""

        try:
            resp = requests.post(
                "http://localhost:8080/v1/chat/completions",
                json={
                    "model": "local-model",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3
                },
                timeout=120
            )
            if resp.status_code == 200:
                result = resp.json()
                insight_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                return jsonify({"success": True, "insights": insight_text})
            else:
                return jsonify({"success": False, "error": f"LLM returned status {resp.status_code}"}), 502
        except requests.exceptions.ConnectionError:
            return jsonify({"success": False, "error": "Local AI model not available at port 8080"}), 503
        except requests.exceptions.Timeout:
            return jsonify({"success": False, "error": "AI model request timed out"}), 504

    except Exception as e:
        print(f"Error getting AI insights: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Scrap Devices + Scrap Register
# -----------------------------
def _ensure_scrapped_devices_table(cursor):
    # Create table if missing (fresh DB)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS scrapped_devices (
            scrap_id UUID PRIMARY KEY,
            device_id INTEGER,
            asset_code TEXT,
            device_type TEXT,
            brand TEXT,
            model TEXT,
            specification TEXT,
            lab_id TEXT,
            station_code TEXT,
            scrapped_by TEXT,
            scrapped_by_user_id INTEGER,
            scrapped_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    # Backward-compatible auto-migration for older schemas
    # (If table exists but is missing some columns, add them.)
    cursor.execute("ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS scrap_id UUID")
    cursor.execute("ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS device_id INTEGER")
    cursor.execute("ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS asset_code TEXT")
    cursor.execute("ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS device_type TEXT")
    cursor.execute("ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS brand TEXT")
    cursor.execute("ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS model TEXT")
    cursor.execute("ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS specification TEXT")
    cursor.execute("ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS lab_id TEXT")
    cursor.execute("ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS station_code TEXT")
    # Older deployments may have scrapped_by as INTEGER. Keep that column as-is and
    # store human-readable user/email in a separate text column.
    cursor.execute("ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS scrapped_by_text TEXT")
    cursor.execute("ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS scrapped_by_user_id INTEGER")
    cursor.execute(
        "ALTER TABLE scrapped_devices ADD COLUMN IF NOT EXISTS scrapped_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"
    )

    # NOTE: Do not attempt to coerce legacy columns (like scrapped_by INTEGER) here,
    # because we want to remain compatible with existing data and constraints.

    # Ensure a primary key exists (if possible)
    cursor.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = 'scrapped_devices'
                  AND constraint_type = 'PRIMARY KEY'
            ) THEN
                -- If the table existed without a PK, try to set one on scrap_id.
                -- Note: this assumes existing rows may have NULL scrap_id; PK will still be valid for new inserts.
                ALTER TABLE scrapped_devices ADD PRIMARY KEY (scrap_id);
            END IF;
        EXCEPTION WHEN others THEN
            -- Ignore if we cannot add a primary key due to existing duplicates/nulls.
            NULL;
        END $$;
        """
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_scrapped_devices_device_id ON scrapped_devices(device_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_scrapped_devices_scrapped_at ON scrapped_devices(scrapped_at DESC)"
    )


@app.route("/scrap_devices", methods=["POST"])
def scrap_devices():
    """
    Scrap (dispose) a list of devices.
    Expects JSON: { deviceIds: number[] }
    - Stores a record in scrapped_devices
    - Removes device mappings from lab_station_devices
    - Marks devices inactive and clears lab_id
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({"success": False, "error": "Unauthorized"}), 401

        data = request.get_json(force=True) or {}
        device_ids = data.get("deviceIds") or []
        if not isinstance(device_ids, list) or not device_ids:
            return jsonify({"success": False, "error": "deviceIds must be a non-empty array"}), 400

        # Normalize and keep only positive ints
        normalized_ids = []
        for x in device_ids:
            try:
                xi = int(x)
                if xi > 0:
                    normalized_ids.append(xi)
            except Exception:
                continue

        if not normalized_ids:
            return jsonify({"success": False, "error": "No valid device IDs provided"}), 400

        conn = db.get_connection()
        if not conn:
            return jsonify({"success": False, "error": "Database connection failed"}), 500
        cursor = conn.cursor()

        try:
            # Ensure schema exists and COMMIT DDL before DML.
            # If we do DDL+insert in one transaction and the insert fails,
            # Postgres rolls back the DDL, causing repeat failures.
            _ensure_scrapped_devices_table(cursor)
            conn.commit()

            # Fetch details for all devices (best-effort; some joins may be null)
            cursor.execute(
                """
                SELECT
                    d.device_id,
                    d.asset_code,
                    d.assigned_code AS device_assigned_code,
                    d.lab_id AS device_lab_id,
                    lsd.device_type,
                    lsd.brand,
                    lsd.model,
                    lsd.specification,
                    ls.lab_id AS station_lab_id,
                    ls.assigned_code AS station_code
                FROM devices d
                LEFT JOIN lab_station_devices lsd ON d.device_id = lsd.device_id
                LEFT JOIN lab_stations ls ON lsd.station_id = ls.station_id
                WHERE d.device_id = ANY(%s)
                """,
                (normalized_ids,),
            )
            rows = cursor.fetchall() or []
            by_id = {}
            for r in rows:
                by_id[r["device_id"]] = r

            scrapped_by_text = (getattr(user, "email", None) or f"user:{getattr(user, 'id', None)}")
            # Some deployments encode email into JWT user_id; keep numeric-only column best-effort.
            scrapped_by_user_id = None
            try:
                raw_uid = getattr(user, "id", None)
                if raw_uid is not None and str(raw_uid).strip() != "":
                    scrapped_by_user_id = int(raw_uid)
            except Exception:
                scrapped_by_user_id = None

            # Insert scrapped records
            inserted = 0
            for did in normalized_ids:
                info = by_id.get(did, {})
                cursor.execute(
                    """
                    INSERT INTO scrapped_devices
                      (scrap_id, device_id, asset_code, device_type, brand, model, specification,
                       lab_id, station_code, scrapped_by_text, scrapped_by_user_id)
                    VALUES
                      (%s, %s, %s, %s, %s, %s, %s,
                       %s, %s, %s, %s)
                    """,
                    (
                        str(uuid.uuid4()),
                        did,
                        info.get("asset_code"),
                        info.get("device_type"),
                        info.get("brand"),
                        info.get("model"),
                        info.get("specification"),
                        info.get("station_lab_id") or info.get("device_lab_id"),
                        info.get("station_code"),
                        scrapped_by_text,
                        scrapped_by_user_id,
                    ),
                )
                inserted += 1

            # Remove from lab mapping so they no longer appear in station lists
            cursor.execute(
                "DELETE FROM lab_station_devices WHERE device_id = ANY(%s)",
                (normalized_ids,),
            )

            # Mark devices inactive and clear lab assignment
            cursor.execute(
                "UPDATE devices SET is_active = FALSE, lab_id = NULL WHERE device_id = ANY(%s)",
                (normalized_ids,),
            )

            conn.commit()
            return jsonify(
                {
                    "success": True,
                    "message": f"Scrapped {inserted} device(s) successfully",
                    "count": inserted,
                }
            )

        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    except Exception as e:
        print(f"Error scrapping devices: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/get_scrapped_devices", methods=["GET"])
def get_scrapped_devices():
    """
    Scrap register list.
    Returns: { success: true, items: [...] }
    """
    try:
        user = get_current_user()
        if not user:
            return jsonify({"success": False, "error": "Unauthorized"}), 401

        conn = db.get_connection()
        if not conn:
            return jsonify({"success": False, "error": "Database connection failed"}), 500

        cursor = conn.cursor()
        try:
            _ensure_scrapped_devices_table(cursor)
            conn.commit()
            cursor.execute(
                """
                SELECT scrap_id, device_id, asset_code, device_type, brand, model, specification,
                       lab_id, station_code,
                       COALESCE(scrapped_by_text, scrapped_by::text) AS scrapped_by,
                       scrapped_at
                FROM scrapped_devices
                ORDER BY scrapped_at DESC
                LIMIT 500
                """
            )
            rows = cursor.fetchall() or []
            items = []
            for r in rows:
                items.append(
                    {
                        "scrap_id": str(r.get("scrap_id")) if r.get("scrap_id") is not None else None,
                        "device_id": r.get("device_id"),
                        "asset_code": r.get("asset_code"),
                        "device_type": r.get("device_type"),
                        "brand": r.get("brand"),
                        "model": r.get("model"),
                        "specification": r.get("specification"),
                        "lab_id": r.get("lab_id"),
                        "station_code": r.get("station_code"),
                        "scrapped_by": r.get("scrapped_by"),
                        "scrapped_at": r.get("scrapped_at").isoformat() if r.get("scrapped_at") else None,
                    }
                )
            return jsonify({"success": True, "items": items})
        finally:
            cursor.close()
            conn.close()

    except Exception as e:
        print(f"Error fetching scrapped devices: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------------
# Run App
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)
