#!/usr/bin/env python3
"""
Validates data/presentations.json.

Usage: python3 scripts/validate.py
Exits 0 if everything is valid, 1 (with a list of problems) otherwise.
PDFs in presentations/ that no entry points to are reported as warnings only.
"""

import json
import os
import re
import sys
from datetime import date
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "data", "presentations.json")
PDF_DIR = os.path.join(ROOT, "presentations")

REQUIRED = ("id", "title", "date", "session", "pdf")
ALLOWED_KEYS = set(REQUIRED) | {"kaltura"}
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# Must match the check in assets/js/app.js (safePdfPath).
PDF_RE = re.compile(r"^presentations/[A-Za-z0-9._ /-]+\.pdf$", re.IGNORECASE)
URL_RE = re.compile(r"^https?://\S+$", re.IGNORECASE)

problems = []
warnings = []


def fail(msg):
    problems.append(msg)


def load_json(path, label):
    if not os.path.isfile(path):
        fail("{0}: file not found at {1}".format(label, path))
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        fail("{0}: invalid JSON ({1})".format(label, e))
        return None


def is_valid_date(s):
    if not isinstance(s, str) or not DATE_RE.fullmatch(s):
        return False
    try:
        y, m, d = (int(p) for p in s.split("-"))
        date(y, m, d)
        return True
    except ValueError:
        return False


def is_http_url(s):
    """Same rule as safeHttpUrl in assets/js/app.js: regex plus a parseable http(s) URL."""
    if not URL_RE.fullmatch(s):
        return False
    parts = urlsplit(s)
    return parts.scheme.lower() in ("http", "https") and bool(parts.netloc)


def validate_presentations(data):
    if data is None:
        return set()
    if not isinstance(data, dict) or not isinstance(data.get("presentations"), list):
        fail("presentations.json: missing top-level 'presentations' array")
        return set()

    seen_ids = set()
    used_pdfs = set()
    for idx, p in enumerate(data["presentations"]):
        where = "presentations.json: entry[{0}]".format(idx)
        if not isinstance(p, dict):
            fail("{0}: not an object".format(where))
            continue

        pid = p.get("id")
        if isinstance(pid, str) and pid:
            where = "presentations.json: entry '{0}'".format(pid)

        for field in REQUIRED:
            if field not in p or p[field] in ("", None):
                fail("{0}: missing required field '{1}'".format(where, field))

        for key in sorted(set(p) - ALLOWED_KEYS):
            fail("{0}: unknown field '{1}' (allowed: {2})".format(
                where, key, ", ".join(sorted(ALLOWED_KEYS))))

        if pid is not None:
            if not isinstance(pid, str) or not ID_RE.fullmatch(pid):
                fail("{0}: 'id' must be lowercase letters, digits and dashes, got {1!r}".format(where, pid))
            elif pid in seen_ids:
                fail("{0}: duplicate id".format(where))
            else:
                seen_ids.add(pid)

        title = p.get("title")
        if title not in (None, "") and (not isinstance(title, str) or not title.strip()):
            fail("{0}: 'title' must be a non-empty string".format(where))

        d = p.get("date")
        if d is not None and not is_valid_date(d):
            fail("{0}: 'date' must match YYYY-MM-DD and be a real date, got {1!r}".format(where, d))

        session = p.get("session")
        if session is not None:
            # bool is a subclass of int in Python, so rule it out explicitly.
            if isinstance(session, bool) or not isinstance(session, int) or session < 1:
                fail("{0}: 'session' must be a whole number >= 1 (no quotes), got {1!r}".format(where, session))

        pdf = p.get("pdf")
        if pdf is not None:
            if not isinstance(pdf, str) or not PDF_RE.fullmatch(pdf) or ".." in pdf.split("/"):
                fail("{0}: 'pdf' must look like 'presentations/<file>.pdf', got {1!r}".format(where, pdf))
            elif not os.path.isfile(os.path.join(ROOT, pdf)):
                fail("{0}: pdf file '{1}' does not exist (check spelling and case)".format(where, pdf))
            else:
                used_pdfs.add(os.path.normpath(pdf))

        kaltura = p.get("kaltura", "")
        if not isinstance(kaltura, str):
            fail("{0}: 'kaltura' must be a string (use \"\" when there is no recording yet)".format(where))
        elif kaltura and not is_http_url(kaltura):
            fail("{0}: 'kaltura' must be empty or a URL starting with http:// or https://, got {1!r}".format(
                where, kaltura))

    return used_pdfs


def find_unlisted_pdfs(used_pdfs):
    if not os.path.isdir(PDF_DIR):
        return
    for dirpath, _dirs, files in os.walk(PDF_DIR):
        for name in sorted(files):
            if not name.lower().endswith(".pdf"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), ROOT).replace(os.sep, "/")
            if os.path.normpath(rel) not in used_pdfs:
                warnings.append("{0} is not listed in data/presentations.json".format(rel))


def main():
    used = validate_presentations(load_json(DATA_PATH, "presentations.json"))
    if not problems:
        find_unlisted_pdfs(used)

    for w in warnings:
        print("warning: " + w)

    if problems:
        print("Found {0} problem(s):\n".format(len(problems)))
        for p in problems:
            print("  - " + p)
        sys.exit(1)

    print("OK: presentations.json is valid.")
    sys.exit(0)


if __name__ == "__main__":
    main()
