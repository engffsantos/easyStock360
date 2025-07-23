from flask import Flask
from flask_cors import CORS
from app.models import db
from app.routes import register_routes

def create_app():
    app = Flask(__name__)

    # Configuração do banco de dados SQLite (local)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///../database/app.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # CORS para permitir requisições do frontend React
    CORS(app)

    # Inicializa o banco de dados
    db.init_app(app)

    with app.app_context():
        # Cria as tabelas se não existirem
        db.create_all()

    # Registra os blueprints das rotas
    register_routes(app)

    return app
