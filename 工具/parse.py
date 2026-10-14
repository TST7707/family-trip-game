#!/usr/bin/env python3
"""Turn the exported script markdown into docs/content.json for the web app."""
import json, re, sys, html
from pathlib import Path

SRC = Path(sys.argv[1])   # .../family-trip-game/腳本
OUT = Path(sys.argv[2])   # .../docs/content.json

CITIES = [
    ("barcelona", "01-巴塞隆納.md", "巴塞隆納", "spain"),
    ("cruise", "02-地中海郵輪.md", "地中海郵輪", "cruise"),
    ("sevilla", "03-塞維亞.md", "塞維亞", "spain"),
    ("guadix", "04-瓜迪斯與格拉那達.md", "瓜迪斯與格拉那達", "spain"),
    ("cordoba", "05-哥多華.md", "哥多華", "spain"),
    ("madrid", "06-馬德里.md", "馬德里", "spain"),
]

# date -> (city id, city-card index 1-based)
UNLOCK = {}
def _seq(city, dates):
    for i, d in enumerate(dates, 1):
        UNLOCK[d] = (city, i)
_seq("barcelona", ["2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12",
                   "2026-12-19", "2026-12-20", "2026-12-21"])
_seq("cruise", ["2026-12-13", "2026-12-14", "2026-12-15", "2026-12-16",
                "2026-12-17", "2026-12-18"])
_seq("sevilla", ["2026-12-22", "2026-12-23", "2026-12-24", "2026-12-25"])
_seq("guadix", ["2026-12-26", "2026-12-27", "2026-12-28"])
_seq("cordoba", ["2026-12-29", "2026-12-30"])
_seq("madrid", ["2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
                "2027-01-04", "2027-01-05", "2027-01-06"])

def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    return s

OPT_RE = re.compile(r"(?<![A-Za-z0-9])([A-D])\.\s")

def parse_quiz(raw):
    raw = raw.strip()
    tags = []
    m = re.match(r"^【([^】]+)】\s*", raw)
    if m:
        tags = [t.strip() for t in re.split(r"[・·]", m.group(1)) if t.strip()]
        raw = raw[m.end():]
    if " — 答案" in raw:
        left, right = raw.split(" — 答案", 1)
    elif "— 答案" in raw:
        left, right = raw.split("— 答案", 1)
    else:
        return None
    # locate options: the last "A. " that is followed by "B. "
    a_positions = [mm.start(1) for mm in OPT_RE.finditer(left) if mm.group(1) == "A"]
    start = None
    for p in reversed(a_positions):
        if re.search(r"(?<![A-Za-z0-9])B\.\s", left[p+2:]):
            start = p
            break
    if start is None:
        return None
    question = left[:start].strip()
    opt_text = left[start:]
    parts = re.split(r"(?<![A-Za-z0-9])([A-D])\.\s", opt_text)
    options = []
    for i in range(1, len(parts), 2):
        options.append({"key": parts[i], "text": parts[i + 1].strip()})
    right = right.strip()
    am = re.match(r"^\s*([A-D])", right)
    if not am:
        return None
    answer = am.group(1)
    rest = right[am.end():].lstrip("（(").strip()
    explain = ""
    proof = ""
    if "解說：" in rest:
        pre, explain = rest.split("解說：", 1)
        proof = pre.strip(" ，,。")
    else:
        proof = rest.strip(" ，,。")
    level = "basic" if "初階" in tags else "challenge"
    kind = "long" if any("長題" in t for t in tags) else ("onsite" if any("現場" in t for t in tags) else "normal")
    return {
        "tags": tags, "level": level, "kind": kind,
        "q": question, "options": options, "answer": answer,
        "proof": proof, "explain": explain.strip(),
    }

def parse_themes(text):
    # text after the colon: "A. xx——yy。B. ..."
    parts = re.split(r"(?:^|(?<=[。；;\s？?！!]))([A-C])\.\s*", text)
    themes = []
    for i in range(1, len(parts), 2):
        body = parts[i + 1].strip()
        if "——" in body:
            title, desc = body.split("——", 1)
        else:
            title, desc = body, ""
        themes.append({"key": parts[i], "title": title.strip(" 。"), "desc": desc.strip()})
    if not themes:
        themes = [{"key": "A", "title": text.split("——")[0][:30], "desc": text}]
    return themes

def parse_card(title, lines, port):
    card = {"title": title, "port": port, "sections": [], "facts": [], "story": [],
            "pre": [], "post": [], "bonus": [], "tasks": [], "game": None, "themes": []}
    mode = None
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        if s.startswith("不想讀"):
            continue
        if s.startswith("準備好挑戰"):
            continue
        bm = re.match(r"^\*\*(.+?)\*\*\s*(.*)$", s)
        if bm and not re.match(r"^\d+\.", s):
            label, rest = bm.group(1), bm.group(2)
            if label.startswith("出發前"):
                mode = "pre"; continue
            if label.startswith("收尾"):
                mode = "post"; continue
            if label.startswith("加分題"):
                mode = "bonus"; continue
            if label.startswith("現場任務"):
                mode = "tasks"; continue
            if label.startswith("景點小遊戲"):
                name = label.split("：", 1)[1] if "：" in label else label
                card["game"] = {"name": name.strip(), "rules": inline(rest.lstrip("：:").strip())}
                mode = None; continue
            if label.startswith("今日九宮格"):
                body = rest
                if "：" in body:
                    body = body.split("：", 1)[1]
                card["themes"] = parse_themes(body)
                mode = None; continue
            card["sections"].append({"label": label, "html": inline(rest.lstrip("：:").strip())})
            mode = None
            continue
        nm = re.match(r"^\d+\.\s+(.*)$", s)
        if nm and mode in ("pre", "post", "bonus"):
            q = parse_quiz(nm.group(1))
            if q:
                card[mode].append(q)
            else:
                print("  !! could not parse quiz in", title, ":", nm.group(1)[:60], file=sys.stderr)
            continue
        if s.startswith("- "):
            if mode == "tasks":
                card["tasks"].append(inline(s[2:]))
            else:
                card["facts"].append(inline(s[2:]))
            continue
        if mode == "tasks":
            card["tasks"].append(inline(s))
            continue
        card["story"].append(inline(s))
    return card

def parse_city(cid, fname, name, kind):
    text = (SRC / fname).read_text(encoding="utf-8")
    lines = text.splitlines()
    intro = []
    cards = []
    port = None
    cur = None
    for ln in lines:
        if ln.startswith("# "):
            continue
        if ln.startswith("## "):
            if cur:
                cards.append(cur); cur = None
            h = ln[3:].strip()
            if kind == "cruise":
                port = h
            continue
        if ln.startswith("### "):
            if cur:
                cards.append(cur)
            cur = {"title": ln[4:].strip(), "port": port, "lines": []}
            continue
        if cur is None:
            if ln.strip():
                intro.append(inline(ln.strip()))
        else:
            cur["lines"].append(ln)
    if cur:
        cards.append(cur)
    city_cards, spots = [], []
    for c in cards:
        card = parse_card(c["title"], c["lines"], c["port"])
        if card["title"].startswith("城市卡"):
            card["type"] = "city"
            card["index"] = len(city_cards) + 1
            card["id"] = f"{cid}-c{card['index']}"
            city_cards.append(card)
        else:
            card["type"] = "spot"
            card["id"] = f"{cid}-s{len(spots) + 1}"
            card["hasGame"] = kind == "spain"
            spots.append(card)
    return {"id": cid, "name": name, "kind": kind, "intro": intro,
            "cityCards": city_cards, "spots": spots}

def main():
    data = {"version": "1.1", "cities": [], "unlock": UNLOCK}
    for cid, fname, name, kind in CITIES:
        city = parse_city(cid, fname, name, kind)
        nq = sum(len(c["bonus"]) for c in city["cityCards"]) + sum(len(c["pre"]) + len(c["post"]) for c in city["spots"])
        print(f"{name}: {len(city['cityCards'])} city cards, {len(city['spots'])} spots, {nq} questions", file=sys.stderr)
        for c in city["cityCards"]:
            if len(c["bonus"]) != 3 or not c["themes"]:
                print(f"  ! {c['title']}: bonus={len(c['bonus'])} themes={len(c['themes'])}", file=sys.stderr)
        for c in city["spots"]:
            if len(c["pre"]) != 5 or len(c["post"]) != 3:
                print(f"  ! {c['title']}: pre={len(c['pre'])} post={len(c['post'])}", file=sys.stderr)
            if kind == "spain" and not c["game"]:
                print(f"  ! {c['title']}: no game", file=sys.stderr)
        data["cities"].append(city)
    OUT.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print("wrote", OUT, OUT.stat().st_size, "bytes", file=sys.stderr)

main()
