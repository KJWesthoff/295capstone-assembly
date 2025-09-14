#!/usr/bin/env python3
"""
AWS Secrets Manager Integration Utility
This module provides functions to fetch secrets from AWS Secrets Manager
and load them as environment variables.
"""

import json
import os
import sys
from typing import Dict, Optional

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
except ImportError:
    print("Error: boto3 is required for AWS Secrets Manager integration")
    print("Install it with: pip install boto3")
    sys.exit(1)


class SecretsManager:
    """AWS Secrets Manager client wrapper"""
    
    def __init__(self, region_name: str = "us-east-1"):
        """Initialize the Secrets Manager client"""
        self.region_name = region_name
        self.client = boto3.client("secretsmanager", region_name=region_name)
    
    def get_secret(self, secret_name: str) -> Optional[Dict]:
        """
        Fetch a secret from AWS Secrets Manager
        
        Args:
            secret_name: Name of the secret to fetch
            
        Returns:
            Dictionary containing the secret values, or None if failed
        """
        try:
            response = self.client.get_secret_value(SecretId=secret_name)
            secret_string = response["SecretString"]
            return json.loads(secret_string)
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "DecryptionFailureException":
                print(f"Error: Secrets Manager can't decrypt the protected secret text using the provided KMS key")
            elif error_code == "InternalServiceErrorException":
                print(f"Error: An error occurred on the server side")
            elif error_code == "InvalidParameterException":
                print(f"Error: You provided an invalid value for a parameter")
            elif error_code == "InvalidRequestException":
                print(f"Error: You provided a parameter value that is not valid for the current state of the resource")
            elif error_code == "ResourceNotFoundException":
                print(f"Error: We can't find the resource that you asked for")
            else:
                print(f"Error: {e}")
            return None
        except NoCredentialsError:
            print("Error: AWS credentials not found. Please configure AWS credentials.")
            return None
        except Exception as e:
            print(f"Unexpected error: {e}")
            return None
    
    def load_secrets_to_env(self, secret_name: str, prefix: str = "") -> bool:
        """
        Load secrets from AWS Secrets Manager into environment variables
        
        Args:
            secret_name: Name of the secret to fetch
            prefix: Optional prefix to add to environment variable names
            
        Returns:
            True if successful, False otherwise
        """
        secrets = self.get_secret(secret_name)
        if not secrets:
            return False
        
        loaded_count = 0
        for key, value in secrets.items():
            env_var_name = f"{prefix}{key}" if prefix else key
            os.environ[env_var_name] = str(value)
            loaded_count += 1
            print(f"✓ {env_var_name} loaded")
        
        print(f"✅ Successfully loaded {loaded_count} secrets into environment variables")
        return True


def main():
    """Main function for command line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Fetch secrets from AWS Secrets Manager")
    parser.add_argument("--secret-name", 
                       default=os.getenv("SECRET_NAME", "scanner-app-secrets"),
                       help="Name of the secret in AWS Secrets Manager")
    parser.add_argument("--region", 
                       default=os.getenv("AWS_REGION", "us-east-1"),
                       help="AWS region")
    parser.add_argument("--prefix", 
                       default="",
                       help="Prefix to add to environment variable names")
    parser.add_argument("--export", 
                       action="store_true",
                       help="Print export statements for shell sourcing")
    
    args = parser.parse_args()
    
    # Initialize Secrets Manager
    sm = SecretsManager(region_name=args.region)
    
    print(f"Fetching secrets from AWS Secrets Manager...")
    print(f"Secret Name: {args.secret_name}")
    print(f"AWS Region: {args.region}")
    
    # Fetch secrets
    secrets = sm.get_secret(args.secret_name)
    if not secrets:
        sys.exit(1)
    
    if args.export:
        # Print export statements for shell sourcing
        for key, value in secrets.items():
            env_var_name = f"{args.prefix}{key}" if args.prefix else key
            print(f"export {env_var_name}='{value}'")
    else:
        # Load into current environment
        sm.load_secrets_to_env(args.secret_name, args.prefix)


if __name__ == "__main__":
    main()