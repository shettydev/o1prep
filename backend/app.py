from flask import Flask, jsonify, render_template, request

import config
from services.extensions import db, login_manager, migrate


def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = config.SECRET_KEY
    app.config['SQLALCHEMY_DATABASE_URI'] = config.DATABASE_URL
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    login_manager.init_app(app)

    # Import models so they register with SQLAlchemy / Flask-Migrate.
    from services import models  # noqa: F401
    from services.models import User

    migrate.init_app(app, db)

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        # The frontend is a fetch/SSE SPA, so return JSON 401 rather than a redirect.
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Authentication required'}), 401
        return render_template('index.html')

    @app.route('/')
    def index():
        return render_template('index.html')

    from routes import all_blueprints
    for bp in all_blueprints:
        app.register_blueprint(bp)

    return app


app = create_app()


if __name__ == '__main__':
    app.run(debug=config.FLASK_DEBUG, port=config.FLASK_PORT)
