from flask import Blueprint, request, jsonify
from app.models import db, FinancialEntry
from datetime import datetime

financial_bp = Blueprint('financial', __name__)


# GET /api/financial/ - Lista todos os lançamentos
@financial_bp.route('/', methods=['GET'])
def list_entries():
    entries = FinancialEntry.query.order_by(FinancialEntry.due_date).all()
    return jsonify([
        {
            'id': e.id,
            'type': e.type,
            'description': e.description,
            'amount': e.amount,
            'dueDate': e.due_date.isoformat(),
            'paymentMethod': e.payment_method,
            'status': e.status,
            'createdAt': e.created_at.isoformat()
        } for e in entries
    ])


# POST /api/financial/ - Adiciona novo lançamento (despesa ou receita)
@financial_bp.route('/', methods=['POST'])
def add_entry():
    data = request.get_json()
    if not all(k in data for k in ('type', 'description', 'amount', 'dueDate', 'paymentMethod')):
        return jsonify({'error': 'Dados incompletos'}), 400

    entry = FinancialEntry(
        type=data['type'],  # 'DESPESA' ou 'RECEITA'
        description=data['description'],
        amount=data['amount'],
        due_date=datetime.strptime(data['dueDate'], '%Y-%m-%d'),
        payment_method=data['paymentMethod'],
        status='PENDENTE',
        created_at=datetime.utcnow()
    )

    db.session.add(entry)
    db.session.commit()
    return jsonify({'message': 'Lançamento adicionado com sucesso', 'id': entry.id}), 201


# POST /api/financial/<id>/pay - Marca como PAGO
@financial_bp.route('/<id>/pay', methods=['POST'])
def mark_as_paid(id):
    entry = FinancialEntry.query.get_or_404(id)
    if entry.status == 'PAGO':
        return jsonify({'error': 'Lançamento já está pago'}), 400

    entry.status = 'PAGO'
    db.session.commit()
    return jsonify({'message': 'Lançamento marcado como pago'})


# DELETE /api/financial/<id> - Remove lançamento (apenas despesas não pagas)
@financial_bp.route('/<id>', methods=['DELETE'])
def delete_entry(id):
    entry = FinancialEntry.query.get_or_404(id)
    if entry.type != 'DESPESA':
        return jsonify({'error': 'Somente despesas podem ser excluídas'}), 400
    if entry.status == 'PAGO':
        return jsonify({'error': 'Despesas pagas não podem ser excluídas'}), 400

    db.session.delete(entry)
    db.session.commit()
    return jsonify({'message': 'Lançamento excluído com sucesso'})
