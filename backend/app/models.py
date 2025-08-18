from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid
from sqlalchemy import text  # para server_default

db = SQLAlchemy()

def generate_uuid():
    return str(uuid.uuid4())

def generate_sku():
    # Gerador de SKU simplificado com base na data/hora atual
    return f"SKU-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"

# -----------------------------
# Customer (mantido)
# -----------------------------
class Customer(db.Model):
    __tablename__ = 'customers'

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(100), nullable=False)
    cpf_cnpj = db.Column(db.String(20), nullable=False, unique=True)
    phone = db.Column(db.String(20), nullable=False)
    address = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'cpfCnpj': self.cpf_cnpj,
            'phone': self.phone,
            'address': self.address,
            'createdAt': self.created_at.isoformat()
        }

# -----------------------------
# CustomerInteraction (mantido)
# -----------------------------
class CustomerInteraction(db.Model):
    __tablename__ = 'customer_interactions'

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    customer_id = db.Column(db.String, db.ForeignKey('customers.id'), nullable=False)
    type = db.Column(db.String, nullable=False)
    notes = db.Column(db.Text, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)

# -----------------------------
# Product (ATUALIZADO)
# -----------------------------
class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    name = db.Column(db.String, nullable=False)
    sku = db.Column(db.String, nullable=False, unique=True, default=generate_sku)
    marca = db.Column(db.String, nullable=False)  # obrigatório
    tipo = db.Column(db.String, nullable=True)    # opcional
    price = db.Column(db.Float, nullable=False)
    cost = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    min_stock = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # NOVO: status lógico (ativo/inativo)
    is_active = db.Column(db.Boolean, nullable=False, default=True, server_default=text('1'))

    history = db.relationship('ProductHistory', backref='product', lazy=True)

# -----------------------------
# ProductHistory (mantido)
# -----------------------------
class ProductHistory(db.Model):
    __tablename__ = 'product_history'

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    product_id = db.Column(db.String, db.ForeignKey('products.id'), nullable=False)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    changed_field = db.Column(db.String, nullable=False)
    old_value = db.Column(db.String, nullable=True)
    new_value = db.Column(db.String, nullable=True)

# -----------------------------
# Sale (ATUALIZADO)
# -----------------------------
class Sale(db.Model):
    __tablename__ = 'sales'

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    customer_id = db.Column(db.String, db.ForeignKey('customers.id'), nullable=True)
    customer_name = db.Column(db.String, nullable=False)
    status = db.Column(db.String, nullable=False)  # QUOTE | COMPLETED | CANCELLED

    # Novos campos financeiros
    subtotal = db.Column(db.Float, nullable=False, default=0.0)
    discount_type = db.Column(db.String, nullable=True)   # 'PERCENT' | 'VALUE' | None
    discount_value = db.Column(db.Float, nullable=False, default=0.0)  # percentual ou valor
    freight = db.Column(db.Float, nullable=False, default=0.0)
    total = db.Column(db.Float, nullable=False, default=0.0)

    # Pagamento (NOVO)
    payment_method = db.Column(db.String, nullable=True)  # PIX|DINHEIRO|CARTAO_CREDITO|CARTAO_DEBITO|BOLETO
    installments = db.Column(db.Integer, nullable=True)   # número de parcelas

    # Validade (apenas para QUOTE)
    valid_until = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship('SaleItem', backref='sale', lazy=True)
    payments = db.relationship('SalePayment', backref='sale', lazy=True, order_by='SalePayment.due_date')

# -----------------------------
# SaleItem (mantido)
# -----------------------------
class SaleItem(db.Model):
    __tablename__ = 'sale_items'

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    sale_id = db.Column(db.String, db.ForeignKey('sales.id'), nullable=False)
    product_id = db.Column(db.String, nullable=False)
    product_name = db.Column(db.String, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)

# -----------------------------
# SalePayment (NOVO)
# -----------------------------
class SalePayment(db.Model):
    __tablename__ = 'sale_payments'

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    sale_id = db.Column(db.String, db.ForeignKey('sales.id'), nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String, nullable=False)   # mesma enum textual usada em Sale.payment_method
    status = db.Column(db.String, nullable=False, default='PENDENTE')  # PENDENTE|PAGO|CANCELADO
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# -----------------------------
# FinancialEntry (mantido)
# -----------------------------
class FinancialEntry(db.Model):
    __tablename__ = 'financial_entries'

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    type = db.Column(db.String, nullable=False)
    description = db.Column(db.String, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    payment_method = db.Column(db.String, nullable=False)
    status = db.Column(db.String, nullable=False, default='PENDENTE')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# -----------------------------
# ReportGoals (mantido)
# -----------------------------
class ReportGoals(db.Model):
    __tablename__ = 'report_goals'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    monthly_revenue = db.Column(db.Float, nullable=False, default=0.0)
    monthly_profit = db.Column(db.Float, nullable=False, default=0.0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# -----------------------------
# CompanySettings (mantido)
# -----------------------------
class CompanySettings(db.Model):
    __tablename__ = 'company_settings'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    cnpj = db.Column(db.String(20), nullable=False)
    address = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(100), nullable=False)

    logo_base64 = db.Column(db.Text, nullable=True)
    theme_color = db.Column(db.String(20), nullable=True)
    font_size = db.Column(db.String(10), nullable=True)

    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'cnpj': self.cnpj,
            'address': self.address,
            'phone': self.phone,
            'email': self.email,
            'logoBase64': self.logo_base64,
            'themeColor': self.theme_color,
            'fontSize': self.font_size,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }

# =====================================================================
# Devoluções (Return / ReturnItem) e (Opcional) CustomerCredit
# =====================================================================

class Return(db.Model):
    __tablename__ = 'returns'

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    sale_id = db.Column(db.String, db.ForeignKey('sales.id'), nullable=False)
    customer_id = db.Column(db.String, db.ForeignKey('customers.id'), nullable=False)

    reason = db.Column(db.Text, nullable=False)
    resolution = db.Column(db.String, nullable=False, default='REEMBOLSO')  # REEMBOLSO|CREDITO
    status = db.Column(db.String, nullable=False, default='ABERTA')         # ABERTA|CONCLUIDA|CANCELADA

    total = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Relacionamentos
    sale = db.relationship('Sale', backref='returns')
    customer = db.relationship('Customer', backref='returns')
    items = db.relationship('ReturnItem', backref='return_parent', cascade='all, delete-orphan', lazy=True)

class ReturnItem(db.Model):
    __tablename__ = 'return_items'

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    return_id = db.Column(db.String, db.ForeignKey('returns.id'), nullable=False)

    product_id = db.Column(db.String, db.ForeignKey('products.id'), nullable=False)
    product_name = db.Column(db.String, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)

    product = db.relationship('Product')

class CustomerCredit(db.Model):
    __tablename__ = 'customer_credits'

    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    customer_id = db.Column(db.String, db.ForeignKey('customers.id'), nullable=False)
    return_id = db.Column(db.String, db.ForeignKey('returns.id'), nullable=True)

    amount = db.Column(db.Float, nullable=False)   # valor original concedido
    balance = db.Column(db.Float, nullable=False)  # saldo disponível
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    customer = db.relationship('Customer')
    ret = db.relationship('Return')
