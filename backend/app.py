import logging
import os

from dotenv import load_dotenv
from flask import Flask, abort, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect
from werkzeug.exceptions import RequestEntityTooLarge

from api_utils import api_error


db = SQLAlchemy()


def _get_cors_origins():
    raw = os.environ.get('CORS_ORIGINS', 'http://localhost,http://localhost:5000,http://localhost:8080')
    return [origin.strip() for origin in raw.split(',') if origin.strip()]



def _validate_security_config(app):
    is_production = os.environ.get('FLASK_ENV', '').lower() == 'production'
    if not is_production:
        return

    secret_key = app.config.get('SECRET_KEY', '')
    external_api_key = os.environ.get('API_KEY', '')
    internal_api_key = os.environ.get('INTERNAL_API_KEY', '')
    forbidden = {'dev-secret-key', 'change-this-in-production', 'tel_password', ''}

    if secret_key in forbidden:
        raise RuntimeError('SECRET_KEY must be set to a non-default value in production')
    if external_api_key in forbidden:
        raise RuntimeError('API_KEY must be set to a non-default value in production')
    if internal_api_key in forbidden:
        raise RuntimeError('INTERNAL_API_KEY must be set to a non-default value in production')



def _ensure_database_schema():
    inspector = inspect(db.engine)
    vehicle_columns = {column['name'] for column in inspector.get_columns('vehicles')}
    journal_columns = {column['name'] for column in inspector.get_columns('journal_entries')}

    alter_statements = []
    if 'status' not in vehicle_columns:
        alter_statements.append("ALTER TABLE vehicles ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'")
    if 'source' not in journal_columns:
        alter_statements.append("ALTER TABLE journal_entries ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'USER'")

    for statement in alter_statements:
        db.session.execute(db.text(statement))

    statements = [
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_operations_single_active_runtime ON operations (status) WHERE status = 'ACTIVE'",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_assignment_pair_runtime ON vehicle_assignments (vehicle_id, assignment_id)",
        "CREATE INDEX IF NOT EXISTS ix_assignments_operation_status_runtime ON assignments (operation_id, status)",
        "CREATE INDEX IF NOT EXISTS ix_journal_entries_operation_timestamp_runtime ON journal_entries (operation_id, timestamp)",
        "CREATE INDEX IF NOT EXISTS ix_vehicles_status_runtime ON vehicles (status)",
    ]
    for statement in statements:
        db.session.execute(db.text(statement))
    db.session.commit()



def create_app():
    load_dotenv()
    app = Flask(__name__, static_folder='/app/static', static_url_path='')
    CORS(app, resources={r"/api/*": {"origins": _get_cors_origins()}})

    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///tel_system.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['UPLOAD_FOLDER'] = os.environ.get('UPLOAD_FOLDER', '/app/uploads')
    app.config['MAX_CONTENT_LENGTH'] = int(os.environ.get('MAX_CONTENT_LENGTH', str(16 * 1024 * 1024)))
    app.config['MAX_PDF_UPLOAD_SIZE'] = int(os.environ.get('MAX_PDF_UPLOAD_SIZE', str(8 * 1024 * 1024)))

    db.init_app(app)
    logging.basicConfig(level=logging.INFO)
    _validate_security_config(app)

    from routes import api_external, assignments, journal, locations, operations, settings, vehicles

    app.register_blueprint(operations.bp)
    app.register_blueprint(locations.bp)
    app.register_blueprint(vehicles.bp)
    app.register_blueprint(assignments.bp)
    app.register_blueprint(journal.bp)
    app.register_blueprint(settings.bp)
    app.register_blueprint(api_external.bp)
    app.register_blueprint(operations.bp, name='operations_v1', url_prefix='/api/v1/operations')
    app.register_blueprint(locations.bp, name='locations_v1', url_prefix='/api/v1/locations')
    app.register_blueprint(vehicles.bp, name='vehicles_v1', url_prefix='/api/v1/vehicles')
    app.register_blueprint(assignments.bp, name='assignments_v1', url_prefix='/api/v1/assignments')
    app.register_blueprint(journal.bp, name='journal_v1', url_prefix='/api/v1/journal')
    app.register_blueprint(settings.bp, name='settings_v1', url_prefix='/api/v1/settings')
    app.register_blueprint(api_external.bp, name='api_external_v1', url_prefix='/api/v1/external')

    @app.errorhandler(RequestEntityTooLarge)
    def handle_too_large(_error):
        return api_error('Uploaded file exceeds the maximum allowed size', 413, 'file_too_large')

    @app.route('/')
    def index():
        return send_from_directory('/app/static', 'index.html')

    @app.route('/<path:path>')
    def serve_static(path):
        if path.startswith('api/'):
            abort(404)
        if os.path.exists(os.path.join('/app/static', path)):
            return send_from_directory('/app/static', path)
        return send_from_directory('/app/static', 'index.html')

    @app.errorhandler(404)
    def not_found(_error):
        if request.path.startswith('/api/'):
            return api_error('Endpoint not found', 404, 'not_found')
        return send_from_directory('/app/static', 'index.html'), 200

    with app.app_context():
        db.create_all()
        _ensure_database_schema()

    return app


if __name__ == '__main__':
    application = create_app()
    application.run(host='0.0.0.0', port=5000, debug=False)
