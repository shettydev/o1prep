"""Interview session persistence (PostgreSQL, per-user).

Each session is stored as a row in the ``sessions`` table with its mutable
document in a JSONB ``data`` column. The session dict shape is unchanged from
the previous file-based store, so routes keep mutating it and calling ``save``.
All sessions are scoped to a ``user_id``; reads and deletes enforce ownership.
Requires an active Flask app context.
"""

import uuid
from datetime import datetime

from services.extensions import db
from services.models import Session


def create(focus, mode, problem_id, problem_title, system_message, user_id):
    session_id = str(uuid.uuid4())[:8]
    session = {
        'id': session_id,
        'user_id': user_id,
        'focus': focus,
        'mode': mode,
        'problem_id': problem_id,
        'problem_title': problem_title,
        'started_at': datetime.now().isoformat(),
        'status': 'active',
        'messages': [{'role': 'system', 'content': system_message}],
        'rating': None,
    }
    save(session)
    return session


def save(session):
    """Insert or update a session row from its dict (reassigns JSONB data)."""
    row = db.session.get(Session, session['id'])
    if row is None:
        row = Session(id=session['id'], user_id=session['user_id'], data=session)
        db.session.add(row)
    else:
        row.data = session
    db.session.commit()


def load(session_id, user_id):
    """Return the session dict if it exists and belongs to user_id, else None."""
    row = db.session.get(Session, session_id)
    if row is None or row.user_id != user_id:
        return None
    return row.data


def list_all(user_id):
    rows = (
        db.session.query(Session)
        .filter_by(user_id=user_id)
        .order_by(Session.created_at.desc())
        .all()
    )
    results = []
    for row in rows:
        s = row.data
        results.append({
            'id': s['id'],
            'focus': s.get('focus', 'general'),
            'problem_id': s.get('problem_id'),
            'problem_title': s.get('problem_title'),
            'started_at': s['started_at'],
            'message_count': len([m for m in s['messages'] if m['role'] != 'system']),
            'rating': s.get('rating'),
            'status': s.get('status', 'active'),
            'mode': s.get('mode', 'text'),
        })
    return results


def delete(session_id, user_id):
    row = db.session.get(Session, session_id)
    if row is not None and row.user_id == user_id:
        db.session.delete(row)
        db.session.commit()
