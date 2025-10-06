import os
import jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 24))

# ------------------------------
# Generate JWT token
# ------------------------------
def generate_token(user_id, role, access_scope):
    payload = {
        "user_id": user_id,
        "role": role,
        "access_scope": access_scope,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")
    return token

# ------------------------------
# Decode / Verify JWT token
# ------------------------------
def decode_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return {"error": "Token has expired"}
    except jwt.InvalidTokenError:
        return {"error": "Invalid token"}
