
from typing import Dict, List, Optional, Any
from pydantic import BaseModel

class SecurityScheme(BaseModel):
    type: str
    name: Optional[str] = None
    scheme: Optional[str] = None  # for http: basic/bearer
    bearerFormat: Optional[str] = None
    in_: Optional[str] = None

class Endpoint(BaseModel):
    method: str
    path: str
    operation_id: Optional[str] = None
    tags: List[str] = []
    security: Optional[List[Dict[str, List[str]]]] = None # None = inherit; [] = no auth
    parameters: List[Dict[str, Any]] = []
    request_body: Optional[Dict[str, Any]] = None
    responses: Dict[str, Any] = {}

    @property
    def has_id_param(self) -> bool:
        return "{" in self.path and "}" in self.path

    def example_url(self, base: str, **kw) -> str:
        url = base.rstrip("/") + self.path
        for k, v in kw.items():
            url = url.replace("{"+k+"}", str(v))
        return url

class SpecSnapshot(BaseModel):
    title: str
    version: str
    servers: List[str]
    global_security: Optional[List[Dict[str, List[str]]]] = None
    security_schemes: Dict[str, SecurityScheme] = {}
    endpoints: List[Endpoint]

class Finding(BaseModel):
    rule: str
    title: str
    severity: str
    score: float
    endpoint: str
    method: str
    description: str
    evidence: Dict[str, Any] = {}
