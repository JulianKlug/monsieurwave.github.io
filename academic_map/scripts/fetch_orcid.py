"""Fetch public works from ORCID and write data/works.json with theme tags."""
import json
import urllib.request
from pathlib import Path

ORCID_ID = "0000-0002-4849-9811"
WORKS_URL = f"https://pub.orcid.org/v3.0/{ORCID_ID}/works"
OUTPUT = Path(__file__).resolve().parent.parent / "data" / "works.json"
UNKNOWN_YEAR = 0

# theme id -> lowercase title/journal keywords. A work may match several themes.
THEME_KEYWORDS = {
    "stroke": ["stroke", "thrombectomy", "r-tpa", "infarct", "ischemic core", "accident"],
    "networks": ["network", "intermanual", "conversion disorder", "metacognition"],
    "neurocritical": ["subarachnoid", "sub-arachnoid", "brain tissue", "pupillometry", "csf", "brain injury"],
    "prehospital": ["hems", "prehospital", "trauma", "intubation"],
    "clinical-ai": [
        "artificial intelligence", "intelligence artificielle", "language model", "machine learning",
        "deep learning", "conversational", "bayesian skip", "prediction",
    ],
}
FALLBACK_THEME = "other"


def themes_for(title: str, journal: str) -> list[str]:
    text = f"{title} {journal}".lower()
    found = [t for t, kws in THEME_KEYWORDS.items() if any(k in text for k in kws)]
    return found or [FALLBACK_THEME]


def fetch_works() -> dict:
    req = urllib.request.Request(WORKS_URL, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def main() -> None:
    works = []
    for group in fetch_works()["group"]:
        summary = group["work-summary"][0]
        title = summary["title"]["title"]["value"]
        journal = (summary.get("journal-title") or {}).get("value", "")
        date = summary.get("publication-date") or {}
        year = int((date.get("year") or {}).get("value", UNKNOWN_YEAR))
        dois = [
            e["external-id-value"]
            for e in summary["external-ids"]["external-id"]
            if e["external-id-type"] == "doi"
        ]
        works.append({
            "id": summary["put-code"],
            "title": title,
            "journal": journal,
            "year": year,
            "doi": dois[0] if dois else "",
            "themes": themes_for(title, journal),
        })

    works.sort(key=lambda w: (-w["year"], w["title"]))
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(works, indent=2, ensure_ascii=False))
    print(f"{len(works)} works -> {OUTPUT}")


if __name__ == "__main__":
    main()
