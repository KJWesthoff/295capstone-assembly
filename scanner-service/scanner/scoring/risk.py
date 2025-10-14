
DEFAULT_SCORES = {
    "API1": (0.9, 0.9),
    "API2": (0.8, 0.9),
    "API3": (0.6, 0.7),
    "API4": (0.5, 0.6),
    "API5": (0.8, 0.9),
    "API6": (0.7, 0.8),
    "API7": (0.6, 0.8),
    "API8": (0.6, 0.8),
    "API9": (0.5, 0.6),
    "API10": (0.4, 0.5),
}

SEV_BUCKETS = [(9,"Critical"),(7,"High"),(4,"Medium"),(1,"Low"),(0,"Info")]

def score(rule: str, likelihood: float|None=None, impact: float|None=None):
    l,i = DEFAULT_SCORES.get(rule, (0.4,0.4))
    if likelihood is not None: l = likelihood
    if impact is not None: i = impact
    s = round(l*i*10, 1)
    for threshold, name in SEV_BUCKETS:
        if s >= threshold:
            return s, name
    return s, "Info"
