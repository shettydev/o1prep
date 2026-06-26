from flask import Blueprint, jsonify, request

from services import languages, problems

bp = Blueprint('problems', __name__)


@bp.route('/api/problems')
def list_problems():
    all_problems = problems.load_all()
    category = request.args.get('category')
    if category:
        all_problems = [p for p in all_problems if p['category'] == category]
    return jsonify([problems.serialize_for_list(p) for p in all_problems])


@bp.route('/api/problems/<int:problem_id>')
def get_problem(problem_id):
    language = languages.resolve(request.args.get('language'))
    available = problems.available_languages(problem_id)
    # Fall back to the default language for problems not yet translated so the
    # problem still loads; the response reports which languages actually exist.
    problem = problems.get_by_id(problem_id, language)
    if not problem:
        language = languages.DEFAULT_LANGUAGE
        problem = problems.get_by_id(problem_id, language)
    if not problem:
        return jsonify({'error': 'Problem not found'}), 404
    return jsonify(problems.serialize_full(problem, language, available))
