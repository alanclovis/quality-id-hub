#!/usr/bin/env python3
"""Merge semana 15–19 jun 2026 em priorities.weeks no Gist (não apaga outras semanas)."""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

GIST_ID = "a82a82743ae0bc3d8887a69fb685d612"
FILENAME = "quality-hub-data.json"
WEEK_KEY = "2026-06-15"

WEEK_SNAPSHOT = {
    "updatedAt": "2026-06-19T01:00:00.000Z",
    "slots": {
        "seg-manha": "data-labeling-hsp-id-fraudadoresearquivados",
        "seg-tarde": "data-labeling-hsp-id-fraudadoresearquivados",
        "ter-manha": "data-labeling-hsp-id-fraudadoresearquivados",
        "ter-tarde": "data-labeling-hsp-id-fraudadoresearquivados",
        "qua-manha": "data-labeling-hsp-id-catchandrelease",
        "qua-tarde": "data-labeling-hsp-id-catchandrelease",
        "qui-manha": "data-labeling-id-catch-and-release",
        "qui-tarde": "data-labeling-id-catch-and-release",
        "sex-manha": "data-labeling-id-amostra-decision",
        "sex-tarde": "data-labeling-id-amostra-decision",
    },
    "counts": {"q1": 93, "q2": 376, "q3": 213, "q4": 27, "q5": 41},
}

INSTRUCTIONS = (
    "- A fila de reversed tem poucos casos, então se zerarem podem seguir para a de decision interna.\n"
    "- Planejem a semana pensando em quantos slots vcs precisam para projeto e deixem organizado no dimensionado de cada um.\n"
    "- No começo, talvez sempre teremos casos nas filas para fazermos (como já conversamos sobre). A expectativa é que vocês tenham sim suas pausas normais, como sempre foi. Façam essa divisão como preferirem."
)

QUEUES = [
    {"id": "q1", "name": "data-labeling-hsp-id-catchandrelease"},
    {"id": "q2", "name": "data-labeling-hsp-id-fraudadoresearquivados"},
    {"id": "q3", "name": "data-labeling-id-amostra-decision"},
    {"id": "q4", "name": "data-labeling-id-deep-dive-reversed-cases"},
    {"id": "q5", "name": "data-labeling-id-catch-and-release"},
]


def token() -> str:
    t = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if t:
        return t.strip()
    return subprocess.check_output(["gh", "auth", "token"], text=True).strip()


def api(method: str, url: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token()}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "quality-id-hub-restore-priorities-week",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def main() -> int:
    gist = api("GET", f"https://api.github.com/gists/{GIST_ID}")
    if FILENAME not in gist.get("files", {}):
        print(f"FAIL: {FILENAME} not in gist", file=sys.stderr)
        return 1
    data = json.loads(gist["files"][FILENAME]["content"])
    pri = data.setdefault("priorities", {})
    pri.setdefault("instructions", INSTRUCTIONS)
    if not pri.get("queues"):
        pri["queues"] = QUEUES
    weeks = pri.setdefault("weeks", {})
    weeks[WEEK_KEY] = WEEK_SNAPSHOT
    pri.pop("weekStart", None)
    pri.pop("slots", None)
    for q in pri.get("queues", []):
        q.pop("count", None)
    patch = {"files": {FILENAME: {"content": json.dumps(data, ensure_ascii=False, indent=2) + "\n"}}}
    result = api("PATCH", f"https://api.github.com/gists/{GIST_ID}", patch)
    print(f"SUCCESS updated_at={result.get('updated_at')}")
    print(f"restored week={WEEK_KEY}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.HTTPError as e:
        print(f"FAIL HTTP {e.code}: {e.read().decode()}", file=sys.stderr)
        raise SystemExit(1)
    except Exception as e:
        print(f"FAIL: {e}", file=sys.stderr)
        raise SystemExit(1)
