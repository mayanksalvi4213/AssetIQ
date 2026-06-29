import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load .env variables
load_dotenv()


class Database:
    def __init__(self):
        self.host = os.getenv('DB_HOST') or 'localhost'
        self.port = os.getenv('DB_PORT') or '5433'
        self.database = os.getenv('DB_NAME') or 'postgres'
        self.user = os.getenv('DB_USER') or 'postgres'
        self.password = os.getenv('DB_PASSWORD') or ''

    def get_connection(self):
        """Return a new database connection"""
        connection_kwargs = {
            'host': self.host,
            'port': self.port,
            'database': self.database,
            'user': self.user,
            'cursor_factory': RealDictCursor,
        }
        if self.password:
            connection_kwargs['password'] = self.password

        try:
            connection = psycopg2.connect(**connection_kwargs)
            return connection
        except Exception as e:
            print(f"Database connection error: {e}")
            print(f"Using DB config -> host={self.host}, port={self.port}, db={self.database}, user={self.user}")
            return None
    
    def test_connection(self):
        """Test database connection"""
        conn = self.get_connection()
        if conn:
            print("✅ Database connection successful!")
            conn.close()
            return True
        else:
            print("❌ Database connection failed!")
            return False

# Create a database instance
db = Database()
