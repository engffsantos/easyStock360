# backend/app/routes/customers.py
from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import asc, desc
import re

from app.models import (
    db,
    Customer,
    CustomerInteraction,
    Sale,
    SaleItem,
    CustomerCredit,   # novo: usado para endpoints de créditos
)

customers_bp = Blueprint('customers', __name__, url_prefix='/api/customers')


# -----------------------------
# Validações CPF/CNPJ
# -----------------------------
def is_valid_cpf(cpf):
    cpf = re.sub(r'[^0-9]', '', cpf)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for i in range(9, 11):
        value = sum((int(cpf[num]) * ((i+1) - num) for num in range(0, i)))
        check = ((value * 10) % 11) % 10
        if check != int(cpf[i]):
            return False
    return True

def is_valid_cnpj(cnpj):
    cnpj = re.sub(r'[^0-9]', '', cnpj)
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    weight_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    weight_2 = [6] + weight_1
    for i in range(12, 14):
        weight = weight_1 if i == 12 else weight_2
        total = sum(int(cnpj[num]) * weight[num] for num in range(i))
        check = 11 - total % 11
        if int(cnpj[i]) != (check if check < 10 else 0):
            return False
    return True

def is_valid_cpf_cnpj(value):
    value = (value or "").strip()
    return is_valid_cpf(value) or is_valid_cnpj(value)


# -----------------------------
# CRUD Clientes
# -----------------------------
@customers_bp.route('/', methods=['GET'])
def list_customers():
    try:
        customers = Customer.query.order_by(Customer.created_at.desc()).all()
        return jsonify([c.to_dict() for c in customers]), 200
    except SQLAlchemyError as e:
        return jsonify({'error': 'Erro ao buscar clientes', 'details': str(e)}), 500


@customers_bp.route('/', methods=['POST'])
def create_customer():
    data = request.get_json() or {}

    required_fields = ['name', 'cpfCnpj', 'phone', 'address']
    missing = [field for field in required_fields if field not in data or not data[field]]

    if missing:
        return jsonify({'error': f'Campos obrigatórios ausentes ou vazios: {", ".join(missing)}'}), 400

    if not is_valid_cpf_cnpj(data['cpfCnpj']):
        return jsonify({'error': 'CPF ou CNPJ inválido.'}), 400

    # 🔒 Verifica duplicidade
    existing = Customer.query.filter_by(cpf_cnpj=data['cpfCnpj']).first()
    if existing:
        return jsonify({'error': 'Já existe um cliente com este CPF/CNPJ.'}), 409

    try:
        customer = Customer(
            name=data['name'].strip(),
            cpf_cnpj=data['cpfCnpj'].strip(),
            phone=data['phone'].strip(),
            address=data['address'].strip()
        )
        db.session.add(customer)
        db.session.commit()
        return jsonify(customer.to_dict()), 201
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao criar cliente', 'details': str(e)}), 400


@customers_bp.route('/<string:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    data = request.get_json() or {}
    try:
        name = data.get('name', customer.name)
        cpf_cnpj = data.get('cpfCnpj', customer.cpf_cnpj)
        phone = data.get('phone', customer.phone)
        address = data.get('address', customer.address)

        if cpf_cnpj and not is_valid_cpf_cnpj(cpf_cnpj):
            return jsonify({'error': 'CPF/CNPJ inválido.'}), 400

        customer.name = name
        customer.cpf_cnpj = cpf_cnpj
        customer.phone = phone
        customer.address = address
        db.session.commit()
        return jsonify(customer.to_dict()), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao atualizar cliente', 'details': str(e)}), 400


@customers_bp.route('/<string:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    try:
        db.session.delete(customer)
        db.session.commit()
        return jsonify({'message': 'Cliente removido com sucesso'}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao remover cliente', 'details': str(e)}), 400


# -----------------------------
# Interações do Cliente
# -----------------------------
@customers_bp.route('/<string:customer_id>/interactions/', methods=['GET'])
def list_interactions(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    interactions = (
        CustomerInteraction.query
        .filter_by(customer_id=customer.id)
        .order_by(CustomerInteraction.date.desc())
        .all()
    )
    return jsonify([
        {
            'id': i.id,
            'type': i.type,
            'notes': i.notes,
            'date': i.date.isoformat() if i.date else None
        } for i in interactions
    ]), 200


@customers_bp.route('/<string:customer_id>/interactions/', methods=['POST'])
def add_interaction(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    data = request.get_json() or {}

    required_fields = ['type', 'notes']
    missing = [f for f in required_fields if f not in data or not data[f]]
    if missing:
        return jsonify({'error': f'Campos obrigatórios ausentes: {", ".join(missing)}'}), 400

    interaction = CustomerInteraction(
        customer_id=customer.id,
        type=data['type'],
        notes=data['notes']
    )
    try:
        db.session.add(interaction)
        db.session.commit()
        return jsonify({'message': 'Interação registrada com sucesso.'}), 201
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao salvar interação.', 'details': str(e)}), 400


# -----------------------------
# Compras do Cliente
# -----------------------------
@customers_bp.route('/<string:customer_id>/purchases/', methods=['GET'])
def list_purchases(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    purchases = (
        Sale.query
        .filter_by(customer_id=customer.id)
        .order_by(Sale.created_at.desc())
        .all()
    )
    return jsonify([
        {
            'id': sale.id,
            'total': float(sale.total or 0),
            'status': sale.status,
            'createdAt': sale.created_at.isoformat() if sale.created_at else None,
            'items': [
                {
                    'productName': item.product_name,
                    'quantity': int(item.quantity),
                    'price': float(item.price),
                    'subtotal': float(item.quantity) * float(item.price),
                } for item in sale.items
            ]
        } for sale in purchases
    ]), 200


# -----------------------------
# Créditos do Cliente
# -----------------------------
@customers_bp.get("/<customer_id>/credits/")
def get_customer_credits(customer_id):
    """
    Retorna saldo total e histórico de créditos do cliente.
    """
    Customer.query.get_or_404(customer_id)

    credits = (
        CustomerCredit.query
        .filter_by(customer_id=customer_id)
        .order_by(asc(CustomerCredit.created_at))
        .all()
    )
    total_balance = float(sum((c.balance or 0.0) for c in credits))

    return jsonify({
        "customerId": customer_id,
        "balance": total_balance,
        "totalBalance": total_balance,  # alias de compatibilidade
        "entries": [{
            "id": c.id,
            "amount": float(c.amount or 0.0),
            "balance": float(c.balance or 0.0),
            "createdAt": c.created_at.isoformat() if c.created_at else None,
            "returnId": c.return_id,
        } for c in credits]
    }), 200


@customers_bp.post("/<customer_id>/credits/liquidate")
def liquidate_customer_credit(customer_id):
    """
    Liquida (abate) valor do crédito do cliente usando política FIFO.
    Espera JSON: { "amount": number }
    """
    Customer.query.get_or_404(customer_id)
    body = request.get_json(silent=True) or {}
    amount = float(body.get("amount") or 0.0)

    if amount <= 0:
        return jsonify({"error": "Valor inválido para liquidação."}), 400

    credits = (
        CustomerCredit.query
        .filter_by(customer_id=customer_id)
        .filter(CustomerCredit.balance > 0.0)
        .order_by(asc(CustomerCredit.created_at))
        .all()
    )

    current_balance = float(sum((c.balance or 0.0) for c in credits))
    if amount > current_balance + 1e-9:
        return jsonify({
            "error": "Saldo de crédito insuficiente.",
            "available": current_balance
        }), 400

    remaining = amount
    used = []
    for c in credits:
        if remaining <= 1e-9:
            break
        use_now = float(min(c.balance, remaining))
        c.balance = float(c.balance) - use_now
        used.append({"creditId": c.id, "used": use_now})
        remaining -= use_now

    db.session.commit()

    new_balance = max(0.0, current_balance - amount)
    return jsonify({
        "ok": True,
        "customerId": customer_id,
        "used": used,
        "newBalance": float(new_balance)
    }), 200
