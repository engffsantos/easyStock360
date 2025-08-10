#backend/app/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from .models import db
from .routes.products import products_bp
from .routes.customers import customers_bp
from .routes.sales import sales_bp
from .routes.financial import financial_bp
from .routes.reports import reports_bp
from .routes.settings import settings_bp
from .routes.sales_payments import sales_payments_bp


def create_app():
    app = Flask(__name__)

    # Caminho do banco de dados SQLite
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///../database/app.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Inicialização do banco de dados com o app Flask
    db.init_app(app)

    # Configuração do CORS para permitir acesso do frontend (React)
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

    # Registro dos blueprints
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(customers_bp, url_prefix='/api/customers')
    app.register_blueprint(sales_bp, url_prefix='/api/sales')
    app.register_blueprint(financial_bp, url_prefix='/api/financial')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(sales_payments_bp, url_prefix='/api')

    # Criação automática das tabelas
    with app.app_context():
        db.create_all()

    return app
