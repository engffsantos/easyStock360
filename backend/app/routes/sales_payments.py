# sales_payments.py
from flask import Blueprint, jsonify
from app.models import db
from datetime import datetime

# Ajuste este import conforme o nome real do seu modelo de parcela.
# Em muitas bases ele se chama SalePayment ou Payment.
from app.models import SalePayment as Payment  # <- se o nome for Payment, troque aqui

sales_payments_bp = Blueprint('sales_payments', __name__)

@sales_payments_bp.route('/sales/payments/<payment_id>/pay', methods=['POST'])
def mark_sale_payment_as_paid(payment_id):
    """
    Marca uma PARCELA de VENDA como PAGO.
    """
    payment = Payment.query.get(payment_id)
    if not payment:
        return jsonify({'error': 'Parcela não encontrada'}), 404

    if getattr(payment, 'status', None) == 'PAGO':
        return jsonify({'error': 'Parcela já está paga'}), 400

    # Campos comuns em modelos de parcela
    payment.status = 'PAGO'
    if hasattr(payment, 'paid_at'):
        payment.paid_at = datetime.utcnow()

    db.session.commit()
    return jsonify({'message': 'Parcela marcada como paga', 'id': payment_id})
