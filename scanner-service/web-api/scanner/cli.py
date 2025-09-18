import argparse, anyio
from scanner.core.spec_loader import load_spec
from scanner.runtime.http import HttpClient
from scanner.runtime.auth import AuthContext
from scanner.report.render import render

# Existing probes (API1–API6)
from scanner.probes import (
    bola as p_bola,
    auth_matrix as p_auth,
    ratelimit as p_rl,
    exposure as p_expo,
    mass_assign as p_mass,
    bfla as p_bfla,
)
# New probes (API7–API10)
from scanner.probes import misconfig as p_misc, injection as p_inj, inventory as p_inv, logging as p_log

async def run_all(spec_path: str, server: str, out_dir: str, rps: float, max_requests: int, dangerous: bool, fuzz_auth: bool):
    spec = load_spec(spec_path)
    client = HttpClient(server, rps=rps, timeout=12.0, max_requests=max_requests)
    authctx = AuthContext(spec.security_schemes, fuzz_auth=fuzz_auth)

    findings = []
    # API1–API6
    findings += await p_auth.run(spec, client, authctx, server, fuzz_auth=fuzz_auth)
    findings += await p_bola.run(spec, client, authctx, server)
    findings += await p_bfla.run(spec, client, authctx, server)
    findings += await p_rl.run(spec, client, authctx, server)
    findings += await p_expo.run(spec, client, authctx, server)
    findings += await p_mass.run(spec, client, authctx, server, dangerous=dangerous)
    # API7–API10
    findings += await p_misc.check_misconfiguration(client, spec, server)
    findings += await p_inj.check_injection(client, spec, dangerous=dangerous)
    findings += await p_inv.check_inventory(client, spec, server)
    findings += await p_log.check_logging(client, spec, server)

    await client.aclose()
    render(findings, spec, out_dir)

def main():
    ap = argparse.ArgumentParser(description="VentiAPI Scanner — static + active probes (API1–API10)")
    ap.add_argument("--spec", required=True)
    ap.add_argument("--server", required=True)
    ap.add_argument("--out", default="out")
    ap.add_argument("--rps", type=float, default=1.0)
    ap.add_argument("--max-requests", type=int, default=400)
    ap.add_argument("--dangerous", action="store_true")
    ap.add_argument("--fuzz-auth", action="store_true")
    args = ap.parse_args()
    anyio.run(run_all, args.spec, args.server, args.out, args.rps, args.max_requests, args.dangerous, args.fuzz_auth)

if __name__ == "__main__":
    main()
