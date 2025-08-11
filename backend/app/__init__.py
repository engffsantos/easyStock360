# backend/app/__init__.py
import os
from flask import Flask
from flask_cors import CORS

from .models import db

# Rotas já existentes
from .routes.products import products_bp
from .routes.customers import customers_bp
from .routes.sales import sales_bp
from .routes.financial import financial_bp
from .routes.reports import reports_bp
from .routes.settings import settings_bp
from .routes.sales_payments import sales_payments_bp

# NOVO: Devoluções
from .routes.returns import bp as returns_bp


def create_app():
    app = Flask(__name__)

    # --- Config do banco (sem Flask-Migrate) ---
    # Permite sobrescrever via env:
    #   - DATABASE_URL (ex.: postgres://... ou sqlite:////abs/path/app.db)
    #   - EASYSTOCK_DB_FILE (apenas o caminho do arquivo sqlite)
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))  # .../backend/app -> .../backend
    default_db_file = os.path.join(base_dir, 'database', 'app.db')
    db_file = os.getenv('EASYSTOCK_DB_FILE', default_db_file)
    database_url = os.getenv('DATABASE_URL', f"sqlite:///{db_file}")

    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Inicializa o SQLAlchemy
    db.init_app(app)

    # CORS para o frontend (React)
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

    # --- Blueprints ---
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(customers_bp, url_prefix='/api/customers')
    app.register_blueprint(sales_bp, url_prefix='/api/sales')
    app.register_blueprint(financial_bp, url_prefix='/api/financial')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(sales_payments_bp, url_prefix='/api')

    # returns_bp já define url_prefix="/api/returns" dentro do arquivo returns.py
    app.register_blueprint(returns_bp)

    # Cria as tabelas (somente dev; em produção prefira migrações gerenciadas fora do app)
    with app.app_context():
        os.makedirs(os.path.dirname(db_file), exist_ok=True)
        db.create_all()

    return app
