import re, math

TAGS=('Hook', 'Problem', 'Context', 'Explanation', 'Demonstration', 'Proof', 'Payoff', 'Objection', 'CTA', 'Other')

METRIC_KEYS=('views', 'likes', 'saves', 'shares', 'comments')

def stamp(value):
    parts = value.strip().replace(",", ".").split(":")
    if len(parts) == 3: return int(parts[0])*3600 + int(parts[1])*60 + float(parts[2])
    if len(parts) == 2: return int(parts[0])*60 + float(parts[1])
    raise ValueError("not a timestamp")

def classify(text, start, end, duration):
    t = text.lower().strip()
    if not t: return "Other", "Empty caption"
    if re.search(r"\b(follow|subscribe|comment|save this|share this|click|download|link in|try it|dm me)\b", t):
        return "CTA", "Contains an explicit request to act"
    if re.search(r"\b(but what if|you might think|you may ask|however|some people say)\b", t):
        return "Objection", "Introduces a counterpoint"
    if re.search(r"\b(here.s how|here is how|watch this|look at|i.ll show|for example|let me show)\b", t):
        return "Demonstration", "Signals a concrete example"
    if re.search(r"\b(results?|increased|decreased|data|tested|evidence|proof|before and after)\b", t):
        return "Proof", "Mentions a claim or evidence; verify independently"
    if re.search(r"\b(problem|struggling|mistake|wrong|losing|doesn.t work|stop doing)\b", t):
        return "Problem", "Frames a difficulty or mistake"
    if re.search(r"\b(that.s why|so now|finally|the answer|the result)\b", t):
        return "Payoff", "Signals a conclusion"
    if start <= min(4.5, duration * .22) and ("?" in text or re.search(r"\b(never|secret|why|how|most people|nobody)\b", t)):
        return "Hook", "Early question or curiosity framing"
    if re.search(r"\b(because|means that|first|second|step|you need to)\b", t):
        return "Explanation", "Explains a reason or step"
    if start <= min(4.5, duration * .22):
        return "Hook", "Appears in the opening interval; review manually"
    return "Context", "Additional narrative context"

def parse_captions(raw, duration):
    raw = (raw or "").replace("\ufeff", "").strip()
    if not raw: return [], False
    chunks = re.split(r"\n\s*\n", raw.replace("\r\n", "\n"))
    timed = []
    pattern = re.compile(r"(\d\d?:\d\d:\d\d[,.]\d+|\d\d?:\d\d[,.]\d+)\s*-->\s*(\d\d?:\d\d:\d\d[,.]\d+|\d\d?:\d\d[,.]\d+)")
    for chunk in chunks:
        lines = chunk.strip().splitlines()
        idx = next((i for i, x in enumerate(lines) if pattern.search(x)), -1)
        if idx < 0: continue
        mt = pattern.search(lines[idx])
        text = re.sub(r"<[^>]+>", "", " ".join(lines[idx + 1:])).strip()
        if text:
            start, end = stamp(mt[1]), stamp(mt[2])
            if start < 0 or end <= start or (duration > 0 and start >= duration):
                raise ValueError("Caption timestamps are outside the video.")
            timed.append((start, min(end, duration) if duration > 0 else end, text))
    if timed: return timed, False
    raw = re.sub(r"^WEBVTT\s*", "", raw, flags=re.I)
    pieces = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", raw) if s.strip()]
    total = duration if duration > 0 else len(pieces) * 3.0
    weights = [max(3, len(x.split())) for x in pieces]
    denom = sum(weights) or 1
    t = 0.0
    for piece, w in zip(pieces, weights):
        end = t + total * w / denom
        timed.append((round(t, 2), round(end, 2), piece))
        t = end
    return timed, True

def finite_number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Expected a finite number.")
    return float(value)

def validate_metrics(value):
    if not isinstance(value, dict):
        raise ValueError("Metrics must be an object.")
    result = {}
    for key in METRIC_KEYS:
        if key not in value:
            continue
        if value[key] is None:
            result[key] = None
            continue
        n = finite_number(value[key])
        if n < 0 or n != int(n) or n > 9_007_199_254_740_991:
            raise ValueError("Metrics must be nonnegative whole numbers.")
        result[key] = int(n)
    return result

def validate_intervals(items, duration, speech):
    if not isinstance(items, list) or len(items) > (5000 if speech else 1000):
        raise ValueError("Invalid interval list.")
    clean = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError("Invalid interval.")
        start, end = finite_number(item["start"]), finite_number(item["end"])
        if start < 0 or end < start or (duration > 0 and end > duration + .05):
            raise ValueError("Invalid timestamps.")
        out = {"index": i, "start": start, "end": end}
        if speech:
            if item["role"] not in TAGS or not isinstance(item["text"], str):
                raise ValueError("Invalid speech segment.")
            labels=item.get("roles",[item["role"]])
            if not isinstance(labels,list) or any(x not in TAGS for x in labels):
                raise ValueError("Invalid narrative labels.")
            out.update(roles=labels, text=item["text"][:4000], role=item["role"],
                       reason=str(item.get("reason", "Manually reviewed"))[:500],
                       edited=bool(item.get("edited", False)))
        else:
            if not isinstance(item.get("kind", ""), str):
                raise ValueError("Invalid shot label.")
            out.update(kind=item.get("kind", "Detected shot")[:160],
                       note=str(item.get("note", ""))[:1000], confidence="estimated")
        clean.append(out)
    return clean