from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    # Configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///tel_system.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['UPLOAD_FOLDER'] = '/app/uploads'
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    
    # Initialize extensions
    db.init_app(app)
    
    # Register blueprints
    from routes import operations, locations, vehicles, assignments, journal, settings, api_external
    app.register_blueprint(operations.bp)
    app.register_blueprint(locations.bp)
    app.register_blueprint(vehicles.bp)
    app.register_blueprint(assignments.bp)
    app.register_blueprint(journal.bp)
    app.register_blueprint(settings.bp)
    app.register_blueprint(api_external.bp)
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    return app

if __name__ == '__main__':
    app = create_app()
    # Debug mode is controlled by FLASK_ENV environment variable
    app.run(host='0.0.0.0', port=5000, debug=False)
