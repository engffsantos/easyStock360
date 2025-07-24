from flask import Blueprint, request, jsonify
from app.models import db, Customer
from sqlalchemy.exc import SQLAlchemyError

customers_bp = Blueprint('customers', __name__, url_prefix='/api/customers')

@customers_bp.route('', methods=['GET'])
def get_customers():
    customers = Customer.query.order_by(Customer.name.asc()).all()
    return jsonify([c.to_dict() for c in customers]), 200

@customers_bp.route('', methods=['POST'])
def create_customer():
    data = request.get_json()
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

@customers_bp.route('/<int:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    data = request.get_json()
    customer = Customer.query.get_or_404(customer_id)
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

@customers_bp.route('/<int:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    try:
        db.session.delete(customer)
        db.session.commit()
        return jsonify({'message': 'Cliente removido com sucesso'}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Erro ao remover cliente', 'details': str(e)}), 400
