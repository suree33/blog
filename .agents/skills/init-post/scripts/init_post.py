#!/usr/bin/env python3
"""Initialize a blog post markdown file from template."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Create a new blog post markdown from template.")
    parser.add_argument("--slug", required=True, help="Output file slug (without .md)")
    parser.add_argument("--title", required=True, help="Post title")
    parser.add_argument("--description", required=True, help="Post description")
    parser.add_argument("--tags", required=True, help="Comma-separated tags")
    parser.add_argument("--date", default="", help="pubDate in YYYY-MM-DD format")
    parser.add_argument("--root", default=".", help="Repository root path")
    parser.add_argument("--force", action="store_true", help="Overwrite existing file")
    return parser


def normalize_slug(raw_slug: str) -> str:
    slug = raw_slug.strip().removesuffix(".md")
    if not slug:
        raise ValueError("slug is empty")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
        raise ValueError("slug must match [a-z0-9][a-z0-9-]*")
    return slug


def resolve_date(raw_date: str) -> str:
    if not raw_date:
        return dt.date.today().isoformat()
    try:
        return dt.date.fromisoformat(raw_date).isoformat()
    except ValueError as exc:
        raise ValueError("--date must be YYYY-MM-DD") from exc


def format_tags(raw_tags: str) -> str:
    tags = [tag.strip() for tag in raw_tags.split(",") if tag.strip()]
    if not tags:
        raise ValueError("--tags must contain at least one tag")
    lines = ["tags:"]
    lines.extend(f"  - {json.dumps(tag, ensure_ascii=False)}" for tag in tags)
    return "\n".join(lines)


def render_frontmatter(template: str, pub_date: str, title: str, description: str, tags: str) -> str:
    rendered = template.replace("pubDate: {{date}}", f"pubDate: {pub_date}")
    rendered = re.sub(
        r"^title:[ \t]*$",
        lambda _: f"title: {json.dumps(title, ensure_ascii=False)}",
        rendered,
        flags=re.MULTILINE,
    )
    rendered = re.sub(
        r"^description:[ \t]*$",
        lambda _: f"description: {json.dumps(description, ensure_ascii=False)}",
        rendered,
        flags=re.MULTILINE,
    )
    rendered = re.sub(r"^tags:[ \t]*$", lambda _: tags, rendered, flags=re.MULTILINE)
    return rendered


def main() -> int:
    args = build_parser().parse_args()

    try:
        slug = normalize_slug(args.slug)
        pub_date = resolve_date(args.date)
        title = args.title.strip()
        description = args.description.strip()
        if not title:
            raise ValueError("--title must not be blank")
        if not description:
            raise ValueError("--description must not be blank")
        tags = format_tags(args.tags)
    except ValueError as exc:
        print(f"[ERROR] {exc}")
        return 1

    root = Path(args.root).resolve()
    template_path = root / "src/content/posts/template/_blog-post.md"
    output_path = root / f"src/content/posts/{slug}.md"

    if not template_path.exists():
        print(f"[ERROR] Template not found: {template_path}")
        return 1
    if output_path.exists() and not args.force:
        print(f"[ERROR] Output already exists: {output_path}")
        print("Use --force to overwrite.")
        return 1

    template = template_path.read_text(encoding="utf-8")
    content = render_frontmatter(
        template=template,
        pub_date=pub_date,
        title=title,
        description=description,
        tags=tags,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content + "\n", encoding="utf-8")
    print(f"[OK] Created {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
