#!/usr/bin/env python3
"""
Stage A (deterministic): map screenshots -> route files, collect the per-screen
code slice, and emit a review plan. No LLM required.

Run from the repo root:  python3 scripts/build_review_packs.py

Outputs under ./review/ :
  core.md                      shared design-system core (built once)
  packs/<route-slug>.md        per-route code slice (route file + siblings + custom children)
  plan.json                    review units: one per (platform, theme, distinct screen)
  out/                         empty dir for reviewer JSON results
"""
import json, re, sys
from pathlib import Path

ROOT = Path.cwd()
REVIEW = ROOT / "review"
PACKS = REVIEW / "packs"

PLATFORM_LABEL = {"iphone": "iPhone", "ipad": "iPad", "android-tablet": "Android Tablet"}

# Files that are identical for every screen; collected once into core.md.
CORE_FILES = [
    "package.json", "tamagui.config.ts", "themes.ts",
    "lib/design-system.ts", "lib/responsive-layout.ts",
    "lib/responsive-layout-tokens.ts", "lib/system-bars.ts",
    "components/Provider.tsx", "app/_layout.tsx", "app/(tabs)/_layout.tsx",
]
CORE_GLOBS = ["components/ui/*.tsx", "components/navigation/*"]

# Suffixes that mark scroll/section/list variants of the SAME screen (filename fallback).
VARIANT_SUFFIXES = [
    "-top", "-early", "-end", "-sections", "-list", "-questions",
    "-detail", "-assigned-places",
]

IMPORT_RE = re.compile(
    r'import\s+(?:([\w*]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*[\'"]([^\'"]+)[\'"]'
)


def resolve_route_file(url: str):
    """Map an Expo Router URL (may include a (group) segment) to a file in app/."""
    path = url.split("?", 1)[0]
    segs = [s for s in path.split("/") if s]
    core = [s for s in segs if not (s.startswith("(") and s.endswith(")"))]  # drop groups
    if not core:
        return "app/(tabs)/index.tsx"                       # "/" or "/(tabs)"
    head = core[0]
    if head == "places":   return "app/(tabs)/places.tsx"
    if head == "execute":  return "app/(tabs)/execute.tsx"
    if head == "settings": return "app/settings.tsx"
    if head == "login":    return "app/(auth)/login.tsx"
    if head == "signup":   return "app/(auth)/signup.tsx"
    if head == "reports":
        return "app/reports/[submissionId].tsx" if len(core) >= 2 else "app/(tabs)/reports.tsx"
    if head == "audit" and len(core) >= 3:
        last = core[2]
        if last == "review":    return "app/audit/[placeId]/review.tsx"
        if last == "submitted": return "app/audit/[placeId]/submitted.tsx"
        return "app/audit/[placeId]/[step].tsx"             # numeric or other step
    return None


STEM_TABLE = {
    "home": "app/(tabs)/index.tsx", "places": "app/(tabs)/places.tsx",
    "execute": "app/(tabs)/execute.tsx", "reports": "app/(tabs)/reports.tsx",
    "report-detail": "app/reports/[submissionId].tsx", "settings": "app/settings.tsx",
    "audit-review": "app/audit/[placeId]/review.tsx",
    "audit-context": "app/audit/[placeId]/[step].tsx",
    "audit-weighting": "app/audit/[placeId]/[step].tsx",
    "audit-domain": "app/audit/[placeId]/[step].tsx",
    "login": "app/(auth)/login.tsx", "signup": "app/(auth)/signup.tsx",
}


def normalize_stem(filename: str) -> str:
    stem = re.sub(r"^\d+-", "", Path(filename).stem)      # strip "04-"
    for suf in VARIANT_SUFFIXES:
        if stem.endswith(suf):
            stem = stem[: -len(suf)]
            break
    return stem


def route_slug(route_file: str) -> str:
    return re.sub(r"[^\w]+", "-", route_file[len("app/"):].rsplit(".", 1)[0]).strip("-")


def screen_id_for(route_file: str, route_url):
    if route_file.endswith("[step].tsx"):
        step = "?"
        if route_url:
            segs = [s for s in route_url.split("?")[0].split("/") if s]
            core = [s for s in segs if not s.startswith("(")]
            if len(core) >= 3:
                step = core[2]
        return f"audit-step-{step}", f"Audit · step {step}"
    slug = route_slug(route_file)
    return slug, slug.replace("-", " ").title()


def read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        return f"<<could not read: {e}>>"


def fence(path: str, body: str) -> str:
    lang = "json" if path.endswith(".json") else "tsx" if path.endswith((".tsx", ".ts")) else ""
    return f"### {path}\n```{lang}\n{body}\n```\n"


def collect_slice(route_file: str):
    """Return (slice_markdown, primitives_used, collected_paths)."""
    rf = ROOT / route_file
    md, primitives, collected = [], set(), []
    if not rf.exists():
        return f"### {route_file}\n<<route file not found on disk>>\n", [], []
    md.append(fence(route_file, read(rf)))
    collected.append(route_file)

    # platform siblings (e.g. places.ios.tsx)
    base = rf.with_suffix("")
    for plat in (".ios", ".android"):
        sib = Path(str(base) + plat + ".tsx")
        if sib.exists():
            rel = str(sib.relative_to(ROOT))
            md.append(fence(rel, read(sib)))
            collected.append(rel)

    # one-level imports
    for default, named, module in IMPORT_RE.findall(rf.read_text(encoding="utf-8", errors="replace")):
        names = [n.strip().split(" as ")[0].strip()
                 for n in (named or "").split(",") if n.strip()]
        if default:
            names.append(default.strip())
        if "components/ui" in module:
            primitives.update(names)                       # in core; just record the names
        elif "components/" in module:
            child = resolve_module(module, rf.parent)      # custom child -> collect
            if child:
                rel = str(child.relative_to(ROOT))
                if rel not in collected:
                    md.append(fence(rel, read(child)))
                    collected.append(rel)
    return "\n".join(md), sorted(primitives), collected


def resolve_module(module: str, importer_dir: Path):
    m = module.replace("@/", "")
    cand = (importer_dir / module) if module.startswith(".") else (ROOT / m)
    for suffix in ("", ".tsx", ".ts", "/index.tsx", "/index.ts"):
        p = Path(str(cand) + suffix)
        if p.exists() and p.is_file():
            return p
    hits = list(ROOT.glob(f"components/**/{Path(m).name}.tsx"))   # fallback by basename
    return hits[0] if hits else None


def build_core():
    parts = ["# SHARED DESIGN-SYSTEM CORE  (identical for every screen)\n"]
    paths = list(CORE_FILES)
    for g in CORE_GLOBS:
        paths += [str(p.relative_to(ROOT)) for p in sorted(ROOT.glob(g)) if p.is_file()]
    for rel in paths:
        p = ROOT / rel
        if p.exists():
            parts.append(fence(rel, read(p)))
    REVIEW.mkdir(exist_ok=True)
    (REVIEW / "core.md").write_text("\n".join(parts), encoding="utf-8")
    return len(paths)


def main():
    if not (ROOT / "app").exists() or not (ROOT / "screenshots").exists():
        sys.exit("Run this from the yee-mobile repo root (needs app/ and screenshots/).")

    PACKS.mkdir(parents=True, exist_ok=True)
    (REVIEW / "out").mkdir(exist_ok=True)
    n_core = build_core()

    units = {}     # (platform_dir, theme, group_key) -> unit dict
    slices = {}    # route_file -> (md, primitives, collected)

    for manifest in sorted(ROOT.glob("screenshots/*/*/manifest.json")):
        folder = manifest.parent
        platform_dir = folder.parent.name          # iphone / ipad / android-tablet
        theme = folder.name                         # light / dark
        m = json.loads(read(manifest))
        by_file = {s["file"]: s.get("route") for s in m.get("successes", [])}

        for png in sorted(folder.glob("*.png")):
            fname = png.name
            route_url = by_file.get(fname)          # may be None (partial manifest)
            if route_url:
                route_file = resolve_route_file(route_url)
                group_key = route_url.split("?")[0]
                source = "manifest"
            else:
                stem = normalize_stem(fname)
                route_file = STEM_TABLE.get(stem)
                group_key = stem
                source = "filename"
            if not route_file:
                units.setdefault(("UNRESOLVED", theme, group_key),
                                 {"platform_label": platform_dir, "theme": theme,
                                  "screen_id": group_key, "screen_key": group_key,
                                  "route_file": None, "pack": None, "primitives": [],
                                  "mapping_source": source, "images": []})
                units[("UNRESOLVED", theme, group_key)]["images"].append(str(png.relative_to(ROOT)))
                continue

            if route_file not in slices:
                slices[route_file] = collect_slice(route_file)
            screen_key, screen_id = screen_id_for(route_file, route_url)
            key = (platform_dir, theme, group_key)
            u = units.setdefault(key, {
                "platform_label": PLATFORM_LABEL.get(platform_dir, platform_dir),
                "theme": theme, "screen_id": screen_id, "screen_key": screen_key,
                "route_file": route_file, "pack": f"review/packs/{route_slug(route_file)}.md",
                "primitives": slices[route_file][1], "mapping_source": source, "images": [],
            })
            u["images"].append(str(png.relative_to(ROOT)))

    # write packs (one per distinct route file)
    for route_file, (md, primitives, collected) in slices.items():
        slug = route_slug(route_file)
        header = (f"# CODE CONTEXT PACK - {route_file}\n"
                  f"_Read `review/core.md` alongside this file._\n\n"
                  f"design_system_components_used: {', '.join(primitives) or '(none)'}\n\n"
                  f"## Screen slice\n")
        (PACKS / f"{slug}.md").write_text(header + md, encoding="utf-8")

    plan = sorted(units.values(), key=lambda u: (u["platform_label"], u["screen_id"], u["theme"]))
    (REVIEW / "plan.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")

    print(f"core.md: {n_core} files")
    print(f"packs:   {len(slices)}")
    print(f"units:   {len(plan)} (one review per platform+theme+screen)")
    unresolved = [u for u in plan if u["route_file"] is None]
    if unresolved:
        print(f"UNRESOLVED ({len(unresolved)}): " +
              ", ".join(sorted({i for u in unresolved for i in u['images']})))


if __name__ == "__main__":
    main()