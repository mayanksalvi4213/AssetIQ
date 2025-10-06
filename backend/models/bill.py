import json
import uuid
from datetime import datetime
from config.database import db
from typing import List, Dict, Optional, Any

class Bill:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id")
        self.bill_number = kwargs.get("bill_number")
        self.vendor_name = kwargs.get("vendor_name")
        self.vendor_gstin = kwargs.get("vendor_gstin")
        self.vendor_address = kwargs.get("vendor_address")
        self.vendor_phone = kwargs.get("vendor_phone")
        self.vendor_email = kwargs.get("vendor_email")
        self.bill_date = kwargs.get("bill_date")
        self.due_date = kwargs.get("due_date")
        self.total_amount = kwargs.get("total_amount")
        self.tax_amount = kwargs.get("tax_amount")
        self.discount = kwargs.get("discount")
        self.warranty_info = kwargs.get("warranty_info")
        self.raw_text = kwargs.get("raw_text")
        self.created_at = kwargs.get("created_at")
        self.updated_at = kwargs.get("updated_at")
        self.user_id = kwargs.get("user_id")

    def to_dict(self):
        return {
            "id": self.id,
            "bill_number": self.bill_number,
            "vendor_name": self.vendor_name,
            "vendor_gstin": self.vendor_gstin,
            "vendor_address": self.vendor_address,
            "vendor_phone": self.vendor_phone,
            "vendor_email": self.vendor_email,
            "bill_date": self.bill_date,
            "due_date": self.due_date,
            "total_amount": self.total_amount,
            "tax_amount": self.tax_amount,
            "discount": self.discount,
            "warranty_info": self.warranty_info,
            "raw_text": self.raw_text,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user_id": self.user_id
        }

    @classmethod
    def create_bill(cls, bill_data: Dict[str, Any], user_id: Optional[int]) -> 'Bill':
        """Create a new bill record in the database"""
        conn = db.get_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cursor = conn.cursor()
            
            # Generate unique ID if not provided
            bill_id = str(uuid.uuid4())
            
            insert_query = """
                INSERT INTO bills 
                (id, bill_number, vendor_name, vendor_gstin, vendor_address, 
                 vendor_phone, vendor_email, bill_date, due_date, total_amount, 
                 tax_amount, discount, warranty_info, raw_text, user_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """
            
            cursor.execute(insert_query, (
                bill_id,
                bill_data.get('bill_number'),
                bill_data.get('vendor_name'),
                bill_data.get('vendor_gstin'),
                bill_data.get('vendor_address'),
                bill_data.get('vendor_phone'),
                bill_data.get('vendor_email'),
                bill_data.get('bill_date'),
                bill_data.get('due_date'),
                bill_data.get('total_amount'),
                bill_data.get('tax_amount'),
                bill_data.get('discount'),
                bill_data.get('warranty_info'),
                bill_data.get('raw_text'),
                user_id
            ))
            
            bill_record = cursor.fetchone()
            conn.commit()
            
            return cls(**bill_record)
            
        except Exception as e:
            conn.rollback()
            raise Exception(f"Error creating bill: {str(e)}")
        finally:
            cursor.close()
            conn.close()

    @classmethod
    def find_by_id(cls, bill_id: str) -> Optional['Bill']:
        """Find a bill by its ID"""
        conn = db.get_connection()
        if not conn:
            return None
            
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM bills WHERE id = %s", (bill_id,))
            data = cursor.fetchone()
            
            if not data:
                return None
                
            return cls(**data)
            
        finally:
            cursor.close()
            conn.close()

    @classmethod
    def find_by_user(cls, user_id: int) -> List['Bill']:
        """Find all bills for a specific user"""
        conn = db.get_connection()
        if not conn:
            return []
            
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM bills WHERE user_id = %s ORDER BY created_at DESC", 
                (user_id,)
            )
            records = cursor.fetchall()
            
            return [cls(**record) for record in records]
            
        finally:
            cursor.close()
            conn.close()

class Asset:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id")
        self.asset_id = kwargs.get("asset_id")  # Custom asset ID (e.g., COMP001, LAP001)
        self.bill_id = kwargs.get("bill_id")
        self.name = kwargs.get("name")
        self.description = kwargs.get("description")
        self.category = kwargs.get("category")
        self.brand = kwargs.get("brand")
        self.model = kwargs.get("model")
        self.serial_number = kwargs.get("serial_number")
        self.quantity = kwargs.get("quantity")
        self.unit_price = kwargs.get("unit_price")
        self.total_price = kwargs.get("total_price")
        self.warranty_period = kwargs.get("warranty_period")
        self.qr_code_data = kwargs.get("qr_code_data")
        self.status = kwargs.get("status", "active")  # active, disposed, damaged
        self.location = kwargs.get("location")
        self.assigned_to = kwargs.get("assigned_to")
        self.created_at = kwargs.get("created_at")
        self.updated_at = kwargs.get("updated_at")

    def to_dict(self):
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "bill_id": self.bill_id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "brand": self.brand,
            "model": self.model,
            "serial_number": self.serial_number,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "total_price": self.total_price,
            "warranty_period": self.warranty_period,
            "qr_code_data": self.qr_code_data,
            "status": self.status,
            "location": self.location,
            "assigned_to": self.assigned_to,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    @classmethod
    def create_asset(cls, asset_data: Dict[str, Any]) -> 'Asset':
        """Create a new asset record in the database"""
        conn = db.get_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cursor = conn.cursor()
            
            insert_query = """
                INSERT INTO assets 
                (asset_id, bill_id, name, description, category, brand, model, 
                 serial_number, quantity, unit_price, total_price, warranty_period, 
                 qr_code_data, status, location, assigned_to)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """
            
            cursor.execute(insert_query, (
                asset_data.get('asset_id'),
                asset_data.get('bill_id'),
                asset_data.get('name'),
                asset_data.get('description'),
                asset_data.get('category'),
                asset_data.get('brand'),
                asset_data.get('model'),
                asset_data.get('serial_number'),
                asset_data.get('quantity', 1),
                asset_data.get('unit_price'),
                asset_data.get('total_price'),
                asset_data.get('warranty_period'),
                asset_data.get('qr_code_data'),
                asset_data.get('status', 'active'),
                asset_data.get('location'),
                asset_data.get('assigned_to')
            ))
            
            asset_record = cursor.fetchone()
            conn.commit()
            
            return cls(**asset_record)
            
        except Exception as e:
            conn.rollback()
            raise Exception(f"Error creating asset: {str(e)}")
        finally:
            cursor.close()
            conn.close()

    @classmethod
    def find_by_bill(cls, bill_id: str) -> List['Asset']:
        """Find all assets for a specific bill"""
        conn = db.get_connection()
        if not conn:
            return []
            
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM assets WHERE bill_id = %s ORDER BY asset_id", 
                (bill_id,)
            )
            records = cursor.fetchall()
            
            return [cls(**record) for record in records]
            
        finally:
            cursor.close()
            conn.close()

    @classmethod
    def find_by_asset_id(cls, asset_id: str) -> Optional['Asset']:
        """Find an asset by its custom asset ID"""
        conn = db.get_connection()
        if not conn:
            return None
            
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM assets WHERE asset_id = %s", (asset_id,))
            data = cursor.fetchone()
            
            if not data:
                return None
                
            return cls(**data)
            
        finally:
            cursor.close()
            conn.close()

    @classmethod
    def get_next_asset_id(cls, category: str) -> str:
        """Generate next asset ID for a category (e.g., COMP001, LAP001)"""
        conn = db.get_connection()
        if not conn:
            raise Exception("Database connection failed")
            
        try:
            cursor = conn.cursor()
            
            # Get category prefix mapping
            category_prefixes = {
                'computer': 'COMP',
                'laptop': 'LAP',
                'printer': 'PRT',
                'monitor': 'MON',
                'keyboard': 'KEY',
                'mouse': 'MOU',
                'tablet': 'TAB',
                'phone': 'PHN',
                'camera': 'CAM',
                'projector': 'PROJ',
                'scanner': 'SCN',
                'server': 'SRV',
                'router': 'RTR',
                'switch': 'SWT',
                'ups': 'UPS',
                'other': 'OTH'
            }
            
            # Get prefix for category (default to first 3 chars if not found)
            prefix = category_prefixes.get(category.lower(), category[:3].upper())
            
            # Find highest existing number for this prefix
            cursor.execute(
                "SELECT asset_id FROM assets WHERE asset_id LIKE %s ORDER BY asset_id DESC LIMIT 1",
                (f"{prefix}%",)
            )
            
            result = cursor.fetchone()
            
            if result:
                # Extract number and increment
                existing_id = result['asset_id']
                try:
                    number = int(existing_id[len(prefix):]) + 1
                except:
                    number = 1
            else:
                number = 1
                
            return f"{prefix}{number:03d}"  # e.g., COMP001
            
        finally:
            cursor.close()
            conn.close()