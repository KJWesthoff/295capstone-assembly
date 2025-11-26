"""
SQLAlchemy ORM support for VentiAPI scan history.

This module provides SQLAlchemy declarative base and utilities
for the models.py ORM definitions, separate from the async 
database.py module.

Week 2: Scan History & Trending
"""

import hashlib
from sqlalchemy.ext.declarative import declarative_base

# SQLAlchemy declarative base for ORM models
Base = declarative_base()


def generate_fingerprint(rule: str, endpoint: str, method: str) -> str:
    """
    Generate a fingerprint hash for a finding based on rule, endpoint, and method.
    
    Used for deduplication and comparison between scans.
    
    Args:
        rule: OWASP API rule (e.g., 'API1', 'API2')
        endpoint: API endpoint path
        method: HTTP method
        
    Returns:
        str: MD5 hash fingerprint
    """
    raw = f"{rule}:{endpoint}:{method}".lower()
    return hashlib.md5(raw.encode()).hexdigest()
