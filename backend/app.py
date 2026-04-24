from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
import logging

db = SQLAlchemy()


def _get_cors_origins():
    raw = os.environ.get('CORS_ORIGINS', 'http://localhost,http://localhost:5000')
    return [origin.strip() for origin in raw.split(',') if origin.strip()]


def _validate_security_config(app):
    is_production = os.environ.get('FLASK_ENV', '').lower() == 'production'
    if not is_production:
        return

    secret_key = app.config.get('SECRET_KEY', '')
    external_api_key = os.environ.get('API_KEY', '')
    internal_api_key = os.environ.get('INTERNAL_API_KEY', '')
    forbidden = {'dev-secret-key', 'change-this-in-production', ''}

    if secret_key in forbidden:
        raise RuntimeError('SECRET_KEY must be set to a non-default value in production')
    if external_api_key in forbidden:
        raise RuntimeError('API_KEY must be set to a non-default value in production')
    if internal_api_key in forbidden:
        raise RuntimeError('INTERNAL_API_KEY must be set to a non-default value in production')

def create_app():
    app = Flask(__name__, static_folder='/app/static', static_url_path='')
    CORS(app, resources={r"/api/*": {"origins": _get_cors_origins()}})
    
    # Configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///tel_system.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['UPLOAD_FOLDER'] = '/app/uploads'
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    
    # Initialize extensions
    db.init_app(app)
    logging.basicConfig(level=logging.INFO)
    _validate_security_config(app)
    
    # Register blueprints
    from routes import operations, locations, vehicles, assignments, journal, settings, api_external
    app.register_blueprint(operations.bp)
    app.register_blueprint(locations.bp)
    app.register_blueprint(vehicles.bp)
    app.register_blueprint(assignments.bp)
    app.register_blueprint(journal.bp)
    app.register_blueprint(settings.bp)
    app.register_blueprint(api_external.bp)
    # Versioned aliases for forward-compatible API evolution.
    app.register_blueprint(operations.bp, name='operations_v1', url_prefix='/api/v1/operations')
    app.register_blueprint(locations.bp, name='locations_v1', url_prefix='/api/v1/locations')
    app.register_blueprint(vehicles.bp, name='vehicles_v1', url_prefix='/api/v1/vehicles')
    app.register_blueprint(assignments.bp, name='assignments_v1', url_prefix='/api/v1/assignments')
    app.register_blueprint(journal.bp, name='journal_v1', url_prefix='/api/v1/journal')
    app.register_blueprint(settings.bp, name='settings_v1', url_prefix='/api/v1/settings')
    app.register_blueprint(api_external.bp, name='api_external_v1', url_prefix='/api/v1/external')
    
    # Serve static files
    @app.route('/')
    def index():
        return send_from_directory('/app/static', 'index.html')
    
    @app.route('/<path:path>')
    def serve_static(path):
        if os.path.exists(os.path.join('/app/static', path)):
            return send_from_directory('/app/static', path)
        # If file doesn't exist, return index.html for client-side routing
        return send_from_directory('/app/static', 'index.html')
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    return app

if __name__ == '__main__':
    app = create_app()
    # Debug mode is controlled by FLASK_ENV environment variable
    app.run(host='0.0.0.0', port=5000, debug=False)
