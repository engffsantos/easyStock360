#backend/app/routes/customers.py
from flask import Blueprint, request, jsonify
from app.models import db, Customer, CustomerInteraction,  Sale, SaleItem
from sqlalchemy.exc import SQLAlchemyError
import re

customers_bp = Blueprint('customers', __name__, url_prefix='/api/customers')

# -----------------------------
# Funções de validação CPF/CNPJ
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
    return is_valid_cpf(value) or is_valid_cnpj(value)

# -----------------------------
# Listar todos os clientes
# -----------------------------
@customers_bp.route('/', methods=['GET'])
def list_customers():
    try:
        customers = Customer.query.order_by(Customer.created_at.desc()).all()
        return jsonify([c.to_dict() for c in customers]), 200
    except SQLAlchemyError as e:
        return jsonify({'error': 'Erro ao buscar clientes', 'details': str(e)}), 500

# -----------------------------
# Criar novo cliente
# -----------------------------
@customers_bp.route('/', methods=['POST'])
def create_customer():
    data = request.get_json()

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
            name=data['name'],
            cpf_cnpj=data['cpfCnpj'],
            phone=data['phone'],
            address=data['address']
        )
        db.session.add(customer)
        db.session.commit()
        return jsonify(customer.to_dict()), 201
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao criar cliente', 'details': str(e)}), 400

# -----------------------------
# Atualizar cliente existente
# -----------------------------
@customers_bp.route('/<string:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    data = request.get_json()
    try:
        customer.name = data.get('name', customer.name)
        customer.cpf_cnpj = data.get('cpfCnpj', customer.cpf_cnpj)
        customer.phone = data.get('phone', customer.phone)
        customer.address = data.get('address', customer.address)
        db.session.commit()
        return jsonify(customer.to_dict()), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao atualizar cliente', 'details': str(e)}), 400

# -----------------------------
# Remover cliente
# -----------------------------
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
# Listar interações de um cliente
# -----------------------------
@customers_bp.route('/<string:customer_id>/interactions/', methods=['GET'])
def list_interactions(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    interactions = CustomerInteraction.query.filter_by(customer_id=customer.id).order_by(CustomerInteraction.date.desc()).all()

    return jsonify([
        {
            'id': i.id,
            'type': i.type,
            'notes': i.notes,
            'date': i.date.isoformat()
        } for i in interactions
    ]), 200

# -----------------------------
# Adicionar nova interação
# -----------------------------
@customers_bp.route('/<string:customer_id>/interactions/', methods=['POST'])
def add_interaction(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    data = request.get_json()

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
# Listar compras de um cliente
# -----------------------------
@customers_bp.route('/<string:customer_id>/purchases/', methods=['GET'])
def list_purchases(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    purchases = Sale.query.filter_by(customer_id=customer.id).order_by(Sale.created_at.desc()).all()

    return jsonify([
        {
            'id': sale.id,
            'total': sale.total,
            'status': sale.status,
            'createdAt': sale.created_at.isoformat(),
            'items': [
                {
                    'productName': item.product_name,
                    'quantity': item.quantity,
                    'price': item.price,
                    'subtotal': item.quantity * item.price
                } for item in sale.items
            ]
        } for sale in purchases
    ]), 200

# -----------------------------
# Listar créditos do cliente
# -----------------------------
@customers_bp.route('/<string:customer_id>/credits/', methods=['GET'])
def get_customer_credits(customer_id):
    """
    Retorna o saldo total de créditos e as entradas de crédito do cliente.
    Caso o modelo CustomerCredit não exista no projeto, retorna saldo 0.
    """
    # Garante que o cliente existe
    Customer.query.get_or_404(customer_id)

    # Tenta importar o modelo opcional
    try:
        from app.models import CustomerCredit
    except Exception:
        return jsonify({"totalBalance": 0.0, "entries": []}), 200

    credits = (
        CustomerCredit.query
        .filter_by(customer_id=customer_id)
        .order_by(CustomerCredit.created_at.desc())
        .all()
    )
    total = sum(float(c.balance or 0) for c in credits)

    return jsonify({
        "totalBalance": total,
        "entries": [{
            "id": c.id,
            "amount": float(c.amount or 0),
            "balance": float(c.balance or 0),
            "createdAt": c.created_at.isoformat() if c.created_at else None,
            "returnId": c.return_id,
        } for c in credits]
    }), 200
