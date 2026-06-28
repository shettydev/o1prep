from flask import Blueprint, jsonify, request
from flask_login import login_required

from services import languages
from services.runners import get_runner

bp = Blueprint('code', __name__)


@bp.route('/api/run', methods=['POST'])
@login_required
def run_code():
    data = request.json or {}
    user_code = data.get('code', '')
    if not user_code.strip():
        return jsonify({'error': 'No code provided'}), 400

    language = languages.resolve(data.get('language'))
    return jsonify(get_runner(language).run_program(user_code))
