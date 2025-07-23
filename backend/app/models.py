from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid

db = SQLAlchemy()

def generate_uuid():
    return str(uuid.uuid4())

# -----------------------------
# Customer
# -----------------------------
class Customer(db.Model):
    __tablename__ = 'customers'
    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    name = db.Column(db.String, nullable=False)
    cpf_cnpj = db.Column(db.String, nullable=False, unique=True)
    phone = db.Column(db.String, nullable=False)
    address = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    interactions = db.relationship('CustomerInteraction', backref='customer', lazy=True)
    sales = db.relationship('Sale', backref='customer', lazy=True)


# -----------------------------
# Customer Interaction
# -----------------------------
class CustomerInteraction(db.Model):
    __tablename__ = 'customer_interactions'
    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    customer_id = db.Column(db.String, db.ForeignKey('customers.id'), nullable=False)
    type = db.Column(db.String, nullable=False)  # e.g., 'CHAMADA', 'EMAIL', etc.
    notes = db.Column(db.Text, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)


# -----------------------------
# Product
# -----------------------------
class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    name = db.Column(db.String, nullable=False)
    sku = db.Column(db.String, nullable=False, unique=True)
    price = db.Column(db.Float, nullable=False)
    cost = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    min_stock = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# -----------------------------
# Sale
# -----------------------------
class Sale(db.Model):
    __tablename__ = 'sales'
    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    customer_id = db.Column(db.String, db.ForeignKey('customers.id'), nullable=True)
    customer_name = db.Column(db.String, nullable=False)
    status = db.Column(db.String, nullable=False)  # 'QUOTE' ou 'COMPLETED'
    total = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship('SaleItem', backref='sale', lazy=True)


# -----------------------------
# SaleItem
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
# FinancialEntry
# -----------------------------
class FinancialEntry(db.Model):
    __tablename__ = 'financial_entries'
    id = db.Column(db.String, primary_key=True, default=generate_uuid)
    type = db.Column(db.String, nullable=False)  # 'RECEITA' ou 'DESPESA'
    description = db.Column(db.String, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    payment_method = db.Column(db.String, nullable=False)
    status = db.Column(db.String, nullable=False, default='PENDENTE')  # 'PAGO', 'VENCIDO', etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# -----------------------------
# ReportGoals
# -----------------------------
class ReportGoals(db.Model):
    __tablename__ = 'report_goals'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    monthly_revenue = db.Column(db.Float, nullable=False, default=0.0)
    monthly_profit = db.Column(db.Float, nullable=False, default=0.0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
