"""Flask extension singletons.

Kept in their own module so models, the app factory, and scripts can all import
them without circular imports.
"""

from flask_login import LoginManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
login_manager = LoginManager()
migrate = Migrate()
