
from typing import List
from jinja2 import Environment, FileSystemLoader, select_autoescape
from ..core.models import Finding, SpecSnapshot
import json, os

def render(findings: List[Finding], spec: SpecSnapshot, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)
    env = Environment(loader=FileSystemLoader("templates"), autoescape=select_autoescape())
    tpl = env.get_template("report.html.j2")
    html = tpl.render(spec=spec.model_dump(), findings=[f.model_dump() for f in findings])
    with open(os.path.join(out_dir, "report.html"), "w", encoding="utf-8") as f:
        f.write(html)
    with open(os.path.join(out_dir, "findings.json"), "w", encoding="utf-8") as f:
        json.dump([f.model_dump() for f in findings], f, indent=2)
