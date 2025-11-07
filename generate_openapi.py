#!/usr/bin/env python3
"""
Generate OpenAPI spec from FastAPI app without starting the server
"""
import os
import sys
import json

# Set required environment variables
os.environ['ADMIN_USERNAME'] = 'MICS295'
os.environ['ADMIN_PASSWORD'] = 'MaryMcHale'
os.environ['JWT_SECRET'] = 'testsecret123'
os.environ['REDIS_URL'] = 'redis://localhost:6379'

# Create temporary shared directories
os.makedirs('/tmp/shared/results', exist_ok=True)
os.makedirs('/tmp/shared/specs', exist_ok=True)

# Monkey-patch pathlib.Path before importing main
from pathlib import Path
original_path = Path

def custom_path(*args, **kwargs):
    p = original_path(*args, **kwargs)
    if str(p) == '/shared/results':
        return original_path('/tmp/shared/results')
    elif str(p) == '/shared/specs':
        return original_path('/tmp/shared/specs')
    return p

Path.__new__ = lambda cls, *args, **kwargs: custom_path(*args, **kwargs)

# Add scanner-service/web-api to path
sys.path.insert(0, '/Users/jesse/x/295capstone-assembly/scanner-service/web-api')

# Import the FastAPI app
from main import app

# Generate OpenAPI spec
openapi_spec = app.openapi()

# Write to file
output_file = '/Users/jesse/x/295capstone-assembly/scanner-openapi.json'
with open(output_file, 'w') as f:
    json.dump(openapi_spec, f, indent=2)

print(f"✅ OpenAPI spec generated: {output_file}")
print(f"   Title: {openapi_spec['info']['title']}")
print(f"   Version: {openapi_spec['info']['version']}")
print(f"   Endpoints: {len(openapi_spec['paths'])}")
