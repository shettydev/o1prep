from routes.auth import bp as auth_bp
from routes.code import bp as code_bp
from routes.models import bp as models_bp
from routes.problems import bp as problems_bp
from routes.realtime import bp as realtime_bp
from routes.research import bp as research_bp
from routes.sessions import bp as sessions_bp

all_blueprints = [
    auth_bp,
    problems_bp,
    sessions_bp,
    code_bp,
    models_bp,
    realtime_bp,
    research_bp,
]
