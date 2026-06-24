import json
from datetime import datetime

from flask import Blueprint, Response, jsonify, request, stream_with_context
from flask_login import current_user, login_required

import config
from services import ai, code_runner, problems, sessions

bp = Blueprint('sessions', __name__)


@bp.route('/api/check-key')
def check_key():
    client = ai.get_client()
    return jsonify({'has_key': client is not None})


@bp.route('/api/config')
def get_config():
    return jsonify(ai.config_info())


@bp.route('/api/sessions', methods=['GET'])
@login_required
def list_all():
    return jsonify(sessions.list_all(current_user.id))


@bp.route('/api/sessions', methods=['POST'])
@login_required
def create():
    client = ai.get_client()
    if not client:
        return jsonify({'error': ai.missing_client_message()}), 400

    data = request.json or {}
    focus = data.get('focus', 'general')
    mode = data.get('mode', 'text')
    problem_id = data.get('problem_id')
    focus_instruction = config.FOCUS_PROMPTS.get(focus, config.FOCUS_PROMPTS['general'])

    problem_block = ""
    problem_title = None
    if problem_id:
        problem = problems.get_by_id(problem_id)
        if problem:
            problem_title = problem['title']
            problem_block = problems.build_problem_block(problem)
    else:
        problem_block = (
            f"\n\nProblem selection guidance: {focus_instruction}"
            f"\nGenerate a novel, original problem in this category. Do not reuse well-known interview questions."
        )

    system_message = config.SYSTEM_PROMPT + "\n\n" + config.SESSION_CONFIG + problem_block
    session = sessions.create(focus, mode, problem_id, problem_title, system_message, current_user.id)
    session['model'] = data.get('model')
    session['effort'] = data.get('effort')
    sessions.save(session)
    return jsonify({'id': session['id']})


@bp.route('/api/sessions/<session_id>')
@login_required
def get(session_id):
    session = sessions.load(session_id, current_user.id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    visible = [m for m in session['messages'] if m['role'] != 'system']
    return jsonify({
        'id': session['id'],
        'focus': session.get('focus', 'general'),
        'problem_id': session.get('problem_id'),
        'problem_title': session.get('problem_title'),
        'started_at': session['started_at'],
        'status': session.get('status', 'active'),
        'messages': visible,
        'rating': session.get('rating'),
        'code': session.get('code', ''),
    })


@bp.route('/api/sessions/<session_id>/chat', methods=['POST'])
@login_required
def chat(session_id):
    client = ai.get_client()
    if not client:
        return jsonify({'error': ai.missing_client_message()}), 400

    session = sessions.load(session_id, current_user.id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    client = ai.get_client(model=session.get('model'), effort=session.get('effort'))

    data = request.json
    user_message = data.get('message', '')
    code = data.get('code', '')

    if code.strip():
        session['code'] = code

    content = user_message
    if code.strip():
        content += f"\n\n[CODE]\n```python\n{code}\n```"

    test_results_data = None

    if code.strip():
        test_results_data = _run_tests_for_session(session, code, client)
        if test_results_data:
            test_context = code_runner.format_results_for_context(
                {
                    'success': test_results_data['success'],
                    'results': test_results_data['results'],
                    'error': test_results_data['error'],
                },
                test_results_data['display_name'],
            )
            content += f"\n\n{test_context}"

    session['messages'].append({'role': 'user', 'content': content})
    sessions.save(session)

    def generate():
        try:
            if test_results_data is not None:
                yield f"data: {json.dumps({'test_results': test_results_data})}\n\n"

            full_response = ''
            for text in ai.stream_chat(client, session['messages'], max_tokens=config.CHAT_MAX_TOKENS):
                full_response += text
                yield f"data: {json.dumps({'content': text})}\n\n"

            session['messages'].append({'role': 'assistant', 'content': full_response})

            lower = full_response.lower()
            if any(term in lower for term in ['interview outcome', 'strong hire', 'no hire', 'lean hire']):
                rating_checks = [
                    ('strong hire', 'Strong Hire'),
                    ('lean no hire', 'No Hire'),
                    ('no hire', 'No Hire'),
                    ('lean hire', 'Lean Hire'),
                    ('mixed', 'Mixed'),
                    ('hire', 'Hire'),
                ]
                for key, label in rating_checks:
                    if key in lower:
                        session['rating'] = label
                        break

            sessions.save(session)
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers=config.SSE_HEADERS,
    )


@bp.route('/api/sessions/<session_id>/start', methods=['POST'])
@login_required
def start_interview(session_id):
    client = ai.get_client()
    if not client:
        return jsonify({'error': ai.missing_client_message()}), 400

    session = sessions.load(session_id, current_user.id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    client = ai.get_client(model=session.get('model'), effort=session.get('effort'))

    intro = "Hi, I'm ready for the interview. Let's get started."
    session['messages'].append({'role': 'user', 'content': intro})
    sessions.save(session)

    def generate():
        try:
            full_response = ''
            for text in ai.stream_chat(client, session['messages'], max_tokens=config.START_MAX_TOKENS):
                full_response += text
                yield f"data: {json.dumps({'content': text})}\n\n"

            session['messages'].append({'role': 'assistant', 'content': full_response})
            sessions.save(session)
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers=config.SSE_HEADERS,
    )


@bp.route('/api/sessions/<session_id>/run-tests', methods=['POST'])
@login_required
def run_tests(session_id):
    session = sessions.load(session_id, current_user.id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    data = request.json or {}
    user_code = data.get('code', '')
    if not user_code.strip():
        return jsonify({'error': 'No code provided'}), 400

    session['code'] = user_code
    sessions.save(session)

    client = ai.get_client(model=session.get('model'), effort=session.get('effort'))
    test_results = _run_tests_for_session(session, user_code, client)
    if not test_results:
        if not client:
            return jsonify({'error': ai.missing_client_message()}), 400
        return jsonify({'error': 'Could not auto-generate test cases. Make sure the interviewer has presented a problem first.'}), 400

    return jsonify(test_results)


@bp.route('/api/sessions/<session_id>/code', methods=['PUT'])
@login_required
def save_code(session_id):
    session = sessions.load(session_id, current_user.id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    data = request.json or {}
    session['code'] = data.get('code', '')
    sessions.save(session)
    return jsonify({'success': True})


@bp.route('/api/sessions/<session_id>/end', methods=['POST'])
@login_required
def end_session(session_id):
    session = sessions.load(session_id, current_user.id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    session['status'] = 'completed'
    session['ended_at'] = datetime.now().isoformat()
    sessions.save(session)
    return jsonify({'success': True})


@bp.route('/api/sessions/<session_id>', methods=['DELETE'])
@login_required
def delete_session(session_id):
    sessions.delete(session_id, current_user.id)
    return jsonify({'success': True})


@bp.route('/api/sessions/<session_id>/transcript', methods=['POST'])
@login_required
def save_transcript(session_id):
    session = sessions.load(session_id, current_user.id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    data = request.json
    messages = data.get('messages', [])
    for msg in messages:
        session['messages'].append({
            'role': msg.get('role', 'user'),
            'content': msg.get('content', ''),
        })
    session['mode'] = 'voice'
    sessions.save(session)
    return jsonify({'success': True})


def _run_pre_canned_tests(user_code, problem):
    test_cases = problem.get('test_cases') or []
    if not test_cases:
        return None

    test_type = problem.get('test_type', 'function')
    if test_type == 'class':
        class_name = problem.get('class_name')
        if not class_name:
            return None
        run_result = code_runner.run_class(user_code, class_name, test_cases)
        return {
            'test_type': 'class',
            'display_name': class_name,
            'success': run_result['success'],
            'results': run_result['results'],
            'error': run_result['error'],
        }

    function_name = problem.get('function_name')
    if not function_name:
        return None

    run_result = code_runner.run(user_code, function_name, test_cases)
    return {
        'test_type': 'function',
        'display_name': function_name,
        'success': run_result['success'],
        'results': run_result['results'],
        'error': run_result['error'],
    }


def _run_tests_for_session(session, user_code, client):
    problem = problems.get_by_id(session.get('problem_id'))
    if problem:
        pre_canned = _run_pre_canned_tests(user_code, problem)
        if pre_canned is not None:
            return pre_canned

    fn_name, test_cases = ai.generate_test_cases(client, session['messages'])
    if not fn_name or not test_cases:
        return None

    run_result = code_runner.run(user_code, fn_name, test_cases)
    return {
        'test_type': 'function',
        'display_name': fn_name,
        'success': run_result['success'],
        'results': run_result['results'],
        'error': run_result['error'],
    }
