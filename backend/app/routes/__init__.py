#backend/app/routes/__init__.py
# Importa cada módulo de rotas
from .customers import customers_bp
from .financial import financial_bp
from .products import products_bp
from .reports import reports_bp
from .sales import sales_bp
from .settings import settings_bp

def register_routes(app):
    app.register_blueprint(customers_bp, url_prefix='/api/customers')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(sales_bp, url_prefix='/api/sales')
    app.register_blueprint(financial_bp, url_prefix='/api/financial')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')