#backend/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from app.models import db
from app.routes.products import products_bp
from app.routes.customers import customers_bp
from app.routes.sales import sales_bp
from app.routes.financial import financial_bp
from app.routes.reports import reports_bp
from app.routes.settings import settings_bp
import os

from app.routes.sales_payments import sales_payments_bp


def create_app():
    app = Flask(__name__)

    # Configuração do banco de dados SQLite local
    #app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///../database/app.db'

    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(BASE_DIR, '../database/app.db')}"

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Inicializa o banco de dados
    db.init_app(app)

    # Ativa CORS para permitir comunicação com frontend React
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

    # Registra os blueprints das rotas
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(customers_bp, url_prefix='/api/customers')
    app.register_blueprint(sales_bp, url_prefix='/api/sales')
    app.register_blueprint(financial_bp, url_prefix='/api/financial')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(sales_payments_bp, url_prefix='/api')
    # Cria as tabelas se não existirem
    with app.app_context():
        db.create_all()

    return app
