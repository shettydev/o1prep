from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required, login_user, logout_user

from services.extensions import db
from services.models import User

bp = Blueprint("auth", __name__)

MIN_PASSWORD_LENGTH = 8


def _credentials():
    data = request.json or {}
    return (data.get("email") or "").strip().lower(), data.get("password") or ""


@bp.route("/api/auth/me")
def me():
    if current_user.is_authenticated:
        return jsonify({"authenticated": True, "email": current_user.email})
    return jsonify({"authenticated": False})


@bp.route("/api/auth/register", methods=["POST"])
def register():
    email, password = _credentials()
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    if len(password) < MIN_PASSWORD_LENGTH:
        return jsonify({"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters"}), 400
    if db.session.query(User).filter_by(email=email).first():
        return jsonify({"error": "An account with that email already exists"}), 409

    user = User(email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return jsonify({"authenticated": True, "email": user.email})


@bp.route("/api/auth/login", methods=["POST"])
def login():
    email, password = _credentials()
    user = db.session.query(User).filter_by(email=email).first()
    if user is None or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401
    login_user(user)
    return jsonify({"authenticated": True, "email": user.email})


@bp.route("/api/auth/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"success": True})
