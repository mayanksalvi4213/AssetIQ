import bcrypt
import json
from config.database import db
from datetime import datetime

class User:
    def __init__(self, **kwargs):
        # Accept all DB fields and ignore unexpected ones
        self.id = kwargs.get("id")
        self.first_name = kwargs.get("first_name")
        self.last_name = kwargs.get("last_name")
        self.email = kwargs.get("email")
        self.password_hash = kwargs.get("password_hash")
        self.role = kwargs.get("role")
        self.assigned_lab = kwargs.get("assigned_lab")
        self.access_scope = kwargs.get("access_scope")
        if isinstance(self.access_scope, str):
            try:
                self.access_scope = json.loads(self.access_scope)
            except:
                self.access_scope = None
        self.is_active = kwargs.get("is_active", True)
        self.email_verified = kwargs.get("email_verified", False)
        self.email_verified_at = kwargs.get("email_verified_at")
        self.created_at = kwargs.get("created_at")
        self.updated_at = kwargs.get("updated_at")
        self.last_login = kwargs.get("last_login")

    # ------------------------------
    # Password Handling
    # ------------------------------
    @staticmethod
    def hash_password(password):
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    @staticmethod
    def verify_password(password, password_hash):
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

    # ------------------------------
    # Convert user object to dictionary
    # ------------------------------
    def to_dict(self):
        return {
            "id": self.id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.email,
            "role": self.role,
            "assigned_lab": self.assigned_lab,
            "access_scope": self.access_scope,
            "is_active": self.is_active,
            "email_verified": self.email_verified,
            "email_verified_at": self.email_verified_at.isoformat() if self.email_verified_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None
        }

    # ------------------------------
    # Create a new user
    # ------------------------------
    @classmethod
    def create_user(cls, first_name, last_name, email, password, role, assigned_lab=None):
        conn = db.get_connection()
        if not conn:
            return {"error": "Database connection failed"}

        try:
            cursor = conn.cursor()

            # Check if user already exists
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cursor.fetchone():
                return {"error": "User with this email already exists"}

            # Hash password
            password_hash = cls.hash_password(password)

            # Determine access_scope
            if role == "Lab Incharge":
                access_scope = {"type": "single", "lab": assigned_lab}
            else:
                access_scope = {"type": "all"}

            # Insert user
            insert_query = """
                INSERT INTO users 
                (first_name, last_name, email, password_hash, role, assigned_lab, access_scope)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """
            cursor.execute(insert_query, (
                first_name, last_name, email, password_hash, role,
                assigned_lab, json.dumps(access_scope)
            ))
            user_data = cursor.fetchone()
            conn.commit()

            # Return User instance
            return cls(**user_data)

        except Exception as e:
            conn.rollback()
            print(f"Error creating user: {e}")
            return {"error": str(e)}
        finally:
            cursor.close()
            conn.close()

    # ------------------------------
    # Find user by email
    # ------------------------------
    @classmethod
    def find_by_email(cls, email):
        conn = db.get_connection()
        if not conn:
            return None
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            data = cursor.fetchone()
            if not data:
                return None
            return cls(**data)
        finally:
            cursor.close()
            conn.close()

    # ------------------------------
    # Find user by ID
    # ------------------------------
    @classmethod
    def find_by_id(cls, user_id):
        conn = db.get_connection()
        if not conn:
            return None
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            data = cursor.fetchone()
            if not data:
                return None
            return cls(**data)
        finally:
            cursor.close()
            conn.close()

    # ------------------------------
    # Update last login timestamp
    # ------------------------------
    def update_last_login(self):
        conn = db.get_connection()
        if not conn:
            return False
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = %s",
                (self.id,)
            )
            conn.commit()
            return True
        finally:
            cursor.close()
            conn.close()
