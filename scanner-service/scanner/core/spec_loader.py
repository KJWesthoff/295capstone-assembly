
from typing import Dict, List
from prance import ResolvingParser
from openapi_spec_validator import validate_spec
from .models import SpecSnapshot, Endpoint, SecurityScheme


def _normalize_security_schemes(components: Dict) -> Dict[str, SecurityScheme]:
    out = {}
    for name, raw in (components or {}).get("securitySchemes", {}).items():
        if not isinstance(raw, dict):
            continue
        typ = raw.get("type")
        scheme = raw.get("scheme")
        out[name] = SecurityScheme(
            type=typ,
            name=raw.get("name"),
            scheme=scheme,
            bearerFormat=raw.get("bearerFormat"),
            in_=raw.get("in"),
        )
    return out


def load_spec(spec_path: str) -> SpecSnapshot:
    parser = ResolvingParser(spec_path)
    spec = parser.specification
    validate_spec(spec)

    info = spec.get("info", {})
    servers = [s.get("url") for s in spec.get("servers", []) if s.get("url")]
    components = spec.get("components", {})
    sec = spec.get("security")

    security_schemes = _normalize_security_schemes(components)

    endpoints: List[Endpoint] = []
    for path, item in spec.get("paths", {}).items():
        for method in ("get","post","put","patch","delete","head","options"):
            op = item.get(method)
            if not op:
                continue
            endpoints.append(Endpoint(
                method=method.upper(),
                path=path,
                operation_id=op.get("operationId"),
                tags=op.get("tags", []) or [],
                security=op.get("security"),
                parameters=op.get("parameters", []) or [],
                request_body=op.get("requestBody"),
                responses=op.get("responses", {}) or {},
            ))

    return SpecSnapshot(
        title=info.get("title", "Unnamed API"),
        version=info.get("version", "0"),
        servers=servers,
        global_security=sec,
        security_schemes=security_schemes,
        endpoints=endpoints,
    )
