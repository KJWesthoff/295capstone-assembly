#!/usr/bin/env python3
"""
Simple VentiAPI Scanner Wrapper
Just adds dangerous and fuzz_auth options to the original scanner.
"""

import sys
import argparse
import asyncio
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import scanner modules (original, unmodified)
from scanner.core.spec_loader import load_spec
from scanner.runtime.http import HttpClient
from scanner.runtime.auth import AuthContext
from scanner.report.render import render

# Import probes
from scanner.probes import (
    bola as p_bola,
    auth_matrix as p_auth,
    ratelimit as p_rl,
    exposure as p_expo,
    mass_assign as p_mass,
    bfla as p_bfla,
    misconfig as p_misc,
    injection as p_inj,
    inventory as p_inv,
    logging as p_log
)

async def run_scan(spec_path: str, server: str, out_dir: str, rps: float, 
                  max_requests: int, dangerous: bool, fuzz_auth: bool):
    """Run scan with dangerous and fuzz_auth options"""
    
    try:
        # Load spec
        logger.info(f"Loading spec: {spec_path}")
        spec = load_spec(spec_path)
        
        # Initialize HTTP client and auth context
        logger.info(f"Initializing scanner with server: {server}")
        client = HttpClient(server, rps=rps, timeout=12.0, max_requests=max_requests)
        authctx = AuthContext(spec.security_schemes, fuzz_auth=fuzz_auth)
        
        # Run security probes
        logger.info("Starting security scanning...")
        findings = []
        
        # Core OWASP API Security Top 10 probes (API1-API6)
        findings += await p_auth.run(spec, client, authctx, server, fuzz_auth=fuzz_auth)
        findings += await p_bola.run(spec, client, authctx, server)
        findings += await p_bfla.run(spec, client, authctx, server)
        findings += await p_rl.run(spec, client, authctx, server)
        findings += await p_expo.run(spec, client, authctx, server)
        findings += await p_mass.run(spec, client, authctx, server, dangerous=dangerous)
        
        # Extended probes (API7-API10)
        findings += await p_misc.check_misconfiguration(client, spec, server)
        findings += await p_inj.check_injection(client, spec, dangerous=dangerous)
        findings += await p_inv.check_inventory(client, spec, server)
        findings += await p_log.check_logging(client, spec, server)
        
        # Close HTTP client
        await client.aclose()
        
        # Generate report
        logger.info(f"Generating report with {len(findings)} findings...")
        render(findings, spec, out_dir)
        
        logger.info(f"Scan completed successfully. Results saved to: {out_dir}")
        return findings
        
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        raise


def create_parser():
    """Create argument parser"""
    parser = argparse.ArgumentParser(description="VentiAPI Scanner with dangerous and fuzz-auth options")
    
    # Required arguments
    parser.add_argument("--spec", required=True, help="Path to OpenAPI/Swagger specification file")
    parser.add_argument("--server", required=True, help="Target server URL")
    
    # Output options
    parser.add_argument("--out", default="out", help="Output directory (default: out)")
    
    # Performance options
    parser.add_argument("--rps", type=float, default=1.0, help="Requests per second (default: 1.0)")
    parser.add_argument("--max-requests", type=int, default=400, help="Maximum requests (default: 400)")
    
    # Security testing options
    parser.add_argument("--dangerous", action="store_true", help="Enable dangerous tests")
    parser.add_argument("--fuzz-auth", action="store_true", help="Enable authentication fuzzing")
    
    return parser


def main():
    """Main entry point"""
    parser = create_parser()
    args = parser.parse_args()
    
    try:
        # Run the scan
        asyncio.run(run_scan(
            spec_path=args.spec,
            server=args.server,
            out_dir=args.out,
            rps=args.rps,
            max_requests=args.max_requests,
            dangerous=args.dangerous,
            fuzz_auth=args.fuzz_auth
        ))
        
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        # Check if this is a normal completion due to request limit
        if "request budget exhausted" in str(e):
            logger.info("Scan completed normally - request budget exhausted")
            sys.exit(0)
        else:
            sys.exit(1)


if __name__ == "__main__":
    main()