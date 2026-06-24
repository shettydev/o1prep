"""SQLAlchemy models (PostgreSQL).

Problems keep the agnostic / per-language split from the YAML schema so more
programming languages can be added without a migration:

* ``Problem``           — language-agnostic fields as JSONB plus indexed columns.
* ``ProblemLanguage``   — per-language fields, keyed by ``(problem_id, language)``.

Sessions and users back the hosted, multi-user app: each interview ``Session``
belongs to a ``User`` and stores its mutable document as JSONB.
"""

from datetime import datetime, timezone

from flask_login import UserMixin
from sqlalchemy.dialects.postgresql import JSONB
from werkzeug.security import check_password_hash, generate_password_hash

from services.extensions import db


def _utcnow():
    return datetime.now(timezone.utc)


class Problem(db.Model):
    __tablename__ = 'problems'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.Text, nullable=False)
    category = db.Column(db.Text, nullable=False, index=True)
    difficulty = db.Column(db.Text, nullable=False)
    data = db.Column(JSONB, nullable=False)

    languages = db.relationship(
        'ProblemLanguage',
        backref='problem',
        cascade='all, delete-orphan',
        lazy='selectin',
    )


class ProblemLanguage(db.Model):
    __tablename__ = 'problem_languages'

    problem_id = db.Column(
        db.Integer, db.ForeignKey('problems.id', ondelete='CASCADE'), primary_key=True
    )
    language = db.Column(db.Text, primary_key=True)
    data = db.Column(JSONB, nullable=False)


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.Text, unique=True, nullable=False, index=True)
    password_hash = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)

    sessions = db.relationship(
        'Session',
        backref='user',
        cascade='all, delete-orphan',
        lazy='selectin',
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Session(db.Model):
    __tablename__ = 'sessions'

    id = db.Column(db.String(8), primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True
    )
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False, index=True)
    data = db.Column(JSONB, nullable=False)
