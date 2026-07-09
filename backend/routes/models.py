"""Model catalog search.

Backs the settings-modal model picker. The OpenRouter catalog is ~300+ models,
so the client never receives the whole list: it renders the curated 'popular
few' from /api/config and calls this endpoint (debounced) to search the rest.
Filtering happens server-side against the in-process catalog cache; results are
bounded by `limit`.
"""

from flask import Blueprint, jsonify, request
from flask_login import login_required

from services import ai

bp = Blueprint("models", __name__)


@bp.route("/api/models/search", methods=["GET"])
@login_required
def search():
    query = request.args.get("q", "")
    try:
        limit = int(request.args.get("limit", 25))
    except (TypeError, ValueError):
        limit = 25
    limit = max(1, min(limit, 50))
    return jsonify({"models": ai.search_models(query, limit)})
