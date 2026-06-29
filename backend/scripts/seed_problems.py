#!/usr/bin/env python3
"""Seed the database from the canonical problem YAML files.

Run this after adding, editing, or deleting problem files in ``problems/``
(the database tables must already exist — run ``flask db upgrade`` first):

    python scripts/seed_problems.py            # upsert all YAML problems
    python scripts/seed_problems.py --force    # wipe tables first, then reload
"""

import argparse
import os
import sys

# Make the project root importable when run as a script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402
from app import create_app  # noqa: E402
from services import problems  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Seed problems into the database.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Clear existing rows first (removes problems deleted from disk).",
    )
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        count = problems.seed(force=args.force)
    print(f"Seeded {count} problems into {config.DATABASE_URL}")


if __name__ == "__main__":
    main()
