from cryptography.fernet import Fernet
from django.conf import settings
import base64
import os

def get_cipher():
    # Use the key from settings.py
    # FIX 5: Use a static key from env or settings to prevent decryption failure
    # Generate a dummy key for testing ONLY if none exists, but log an error
    key = getattr(settings, 'SETTINGS_ENCRYPTION_KEY', None)
    if not key:
        import logging
        logger = logging.getLogger(__name__)
        logger.error("CRITICAL: SETTINGS_ENCRYPTION_KEY NOT SET. DATA CORRUPTION LIKELY.")
        # Static fallback for development if env is missing
        key = b'p-v9uc-fJ6R9rYvX-2NfJ-v9uc-fJ6R9rYvX-2NfJ-c='
    
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)

def encrypt_value(plain_text: str) -> str:
    if not plain_text:
        return ''
    cipher = get_cipher()
    return cipher.encrypt(plain_text.encode()).decode()

def decrypt_value(encrypted_text: str) -> str:
    if not encrypted_text:
        return ''
    try:
        cipher = get_cipher()
        return cipher.decrypt(encrypted_text.encode()).decode()
    except Exception:
        # If decryption fails (e.g. wrong key or not encrypted), return as is or empty
        return encrypted_text

def get_setting(key: str, default=None):
    try:
        from apps.models import SecureSettings
        from django.core.cache import cache
        
        # Try cache first
        cache_key = f"secure_setting_{key}"
        cached_val = cache.get(cache_key)
        if cached_val is not None:
            return cached_val
            
        obj = SecureSettings.objects.get(key=key)
        val = decrypt_value(obj.encrypted_value)
        
        # Cache for 5 minutes
        cache.set(cache_key, val, 300)
        return val
    except Exception:
        # Fallback to environment variable if provided as default or directly
        return os.getenv(key.upper(), default)
