#!/usr/bin/env python3
"""Patch quality-hub-data.json priorities on gist a82a82743ae0bc3d8887a69fb685d612."""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

GIST_ID = "a82a82743ae0bc3d8887a69fb685d612"
FILENAME = "quality-hub-data.json"

PRIORITIES = {
    "weekStart": "2026-06-15",
    "instructions": (
        "- A fila de reversed tem poucos casos, então se zerarem podem seguir para a de decision interna.\n"
        "- Planejem a semana pensando em quantos slots vcs precisam para projeto e deixem organizado no dimensionado de cada um.\n"
        "- No começo, talvez sempre teremos casos nas filas para fazermos (como já conversamos sobre). A expectativa é que vocês tenham sim suas pausas normais, como sempre foi. Façam essa divisão como preferirem."
    ),
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
    "queues": [
        {"id": "q1", "name": "data-labeling-hsp-id-catchandrelease", "count": 93},
        {"id": "q2", "name": "data-labeling-hsp-id-fraudadoresearquivados", "count": 376},
        {"id": "q3", "name": "data-labeling-id-amostra-decision", "count": 213},
        {"id": "q4", "name": "data-labeling-id-deep-dive-reversed-cases", "count": 27},
        {"id": "q5", "name": "data-labeling-id-catch-and-release", "count": 41},
    ],
    "updatedAt": "2026-06-19T01:00:00.000Z",
}


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
            "User-Agent": "quality-id-hub-priorities-patch",
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
    data["priorities"] = PRIORITIES
    patch = {"files": {FILENAME: {"content": json.dumps(data, ensure_ascii=False, indent=2) + "\n"}}}
    result = api("PATCH", f"https://api.github.com/gists/{GIST_ID}", patch)
    print(f"SUCCESS updated_at={result.get('updated_at')}")
    print(f"weekStart={PRIORITIES['weekStart']}")
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
