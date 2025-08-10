from flask import Blueprint, request, jsonify
from app.models import db, FinancialEntry
from datetime import datetime

financial_bp = Blueprint('financial', __name__)

# Helpers
def parse_date_yyyy_mm_dd(s):
    if not s:
        return None
    # aceita 'YYYY-MM-DD' ou ISO completo 'YYYY-MM-DDTHH:MM:SSZ'
    try:
        return datetime.strptime(s[:10], '%Y-%m-%d')
    except Exception:
        return None

def serialize_entry(e: FinancialEntry):
    return {
        'id': e.id,
        'type': e.type,
        'description': e.description,
        'amount': e.amount,
        'dueDate': e.due_date.isoformat() if e.due_date else None,
        'paymentMethod': e.payment_method,
        'status': e.status,
        'createdAt': e.created_at.isoformat() if e.created_at else None
    }

# GET /api/financial  - Lista todos os lançamentos
@financial_bp.route('', methods=['GET'])
def list_entries():
    entries = FinancialEntry.query.order_by(FinancialEntry.due_date).all()
    return jsonify([serialize_entry(e) for e in entries])

# POST /api/financial/ - Adiciona novo lançamento (despesa ou receita)
@financial_bp.route('/', methods=['POST'])
def add_entry():
    data = request.get_json() or {}
    required = ('type', 'description', 'amount', 'dueDate', 'paymentMethod')
    if not all(k in data for k in required):
        return jsonify({'error': 'Dados incompletos'}), 400

    due = parse_date_yyyy_mm_dd(data.get('dueDate'))
    if not due:
        return jsonify({'error': 'Data de vencimento inválida (use YYYY-MM-DD)'}), 400

    entry = FinancialEntry(
        type=data['type'],  # 'DESPESA' ou 'RECEITA'
        description=data['description'],
        amount=data['amount'],
        due_date=due,
        payment_method=data['paymentMethod'],
        status=data.get('status') or 'PENDENTE',
        created_at=datetime.utcnow()
    )

    db.session.add(entry)
    db.session.commit()
    return jsonify({'message': 'Lançamento adicionado com sucesso', 'id': entry.id}), 201

# PATCH/PUT /api/financial/<id> - Atualiza campos do lançamento
@financial_bp.route('/<id>', methods=['PATCH', 'PUT'])
def update_entry(id):
    entry = FinancialEntry.query.get_or_404(id)
    data = request.get_json() or {}

    # Permitidos (edição parcial)
    if 'description' in data:
        entry.description = data['description']
    if 'amount' in data:
        entry.amount = data['amount']
    if 'dueDate' in data:
        due = parse_date_yyyy_mm_dd(data.get('dueDate'))
        if not due:
            return jsonify({'error': 'Data de vencimento inválida (use YYYY-MM-DD)'}), 400
        entry.due_date = due
    if 'paymentMethod' in data:
        entry.payment_method = data['paymentMethod']
    if 'status' in data:
        entry.status = data['status']
    if 'type' in data:
        # Opcional: permitir alterar tipo; comente se não quiser
        entry.type = data['type']

    db.session.commit()
    return jsonify({'message': 'Lançamento atualizado com sucesso', 'entry': serialize_entry(entry)})

# Alternativa extra: POST /api/financial/<id>/update (compatibilidade)
@financial_bp.route('/<id>/update', methods=['POST'])
def update_entry_compat(id):
    entry = FinancialEntry.query.get_or_404(id)
    data = request.get_json() or {}

    # Reaproveita a mesma lógica do update_entry
    if 'description' in data:
        entry.description = data['description']
    if 'amount' in data:
        entry.amount = data['amount']
    if 'dueDate' in data:
        due = parse_date_yyyy_mm_dd(data.get('dueDate'))
        if not due:
            return jsonify({'error': 'Data de vencimento inválida (use YYYY-MM-DD)'}), 400
        entry.due_date = due
    if 'paymentMethod' in data:
        entry.payment_method = data['paymentMethod']
    if 'status' in data:
        entry.status = data['status']
    if 'type' in data:
        entry.type = data['type']

    db.session.commit()
    return jsonify({'message': 'Lançamento atualizado com sucesso', 'entry': serialize_entry(entry)})

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
