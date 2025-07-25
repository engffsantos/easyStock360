from datetime import datetime, timedelta

from app.models import db, Sale, Product, FinancialEntry, ReportGoals
from flask import Blueprint, request, jsonify

reports_bp = Blueprint('reports', __name__)


# Função auxiliar para obter (ou criar) as metas do mês
def get_or_create_goals():
    goals = ReportGoals.query.first()
    if not goals:
        goals = ReportGoals(monthly_revenue=0.0, monthly_profit=0.0)
        db.session.add(goals)
        db.session.commit()
    return goals


# GET /api/reports/?start=YYYY-MM-DD&end=YYYY-MM-DD
@reports_bp.route('/', methods=['GET'])
def generate_report():
    start_date = request.args.get('start')
    end_date = request.args.get('end')

    try:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)  # incluir fim do dia
    except Exception:
        return jsonify({'error': 'Datas inválidas'}), 400

    # Dados de vendas
    sales = Sale.query.filter(
        Sale.status == 'COMPLETED',
        Sale.created_at >= start_dt,
        Sale.created_at < end_dt
    ).all()

    # Resumo financeiro
    total_revenue = sum(s.total for s in sales)
    all_items = [item for sale in sales for item in sale.items]
    total_cost = sum(Product.query.filter_by(id=item.product_id).first().cost * item.quantity for item in all_items)
    total_profit = total_revenue - total_cost
    average_ticket = total_revenue / len(sales) if sales else 0

    summary = {
        'totalRevenue': total_revenue,
        'totalProfit': total_profit,
        'totalCost': total_cost,
        'salesCount': len(sales),
        'averageTicket': average_ticket
    }

    # Lucratividade por produto
    profit_by_product = {}
    for item in all_items:
        product = Product.query.get(item.product_id)
        if not product:
            continue
        if item.product_id not in profit_by_product:
            profit_by_product[item.product_id] = {
                'productId': item.product_id,
                'productName': item.product_name,
                'quantitySold': 0,
                'totalRevenue': 0,
                'totalProfit': 0
            }
        entry = profit_by_product[item.product_id]
        entry['quantitySold'] += item.quantity
        entry['totalRevenue'] += item.price * item.quantity
        entry['totalProfit'] += (item.price - product.cost) * item.quantity

    # Mais vendidos por valor e por quantidade
    best_sellers_by_value = sorted(profit_by_product.values(), key=lambda p: p['totalRevenue'], reverse=True)
    best_sellers_by_quantity = sorted(profit_by_product.values(), key=lambda p: p['quantitySold'], reverse=True)

    # Clientes inadimplentes
    overdue_entries = FinancialEntry.query.filter(
        FinancialEntry.status == 'VENCIDO'
    ).order_by(FinancialEntry.due_date).all()

    defaulting_customers = [{
        'customerName': entry.description,
        'amountDue': entry.amount,
        'dueDate': entry.due_date.isoformat(),
        'saleId': entry.id
    } for entry in overdue_entries]

    # Estoque de baixa rotatividade: produtos não vendidos no período
    sold_product_ids = {item.product_id for item in all_items}
    unsold_products = Product.query.filter(~Product.id.in_(sold_product_ids)).all()

    stock_efficiency = [{
        'productId': p.id,
        'productName': p.name,
        'sku': p.sku,
        'quantityInStock': p.quantity
    } for p in unsold_products if p.quantity > 0]

    # Metas atuais
    goals = get_or_create_goals()

    return jsonify({
        'summary': summary,
        'profitByProduct': list(profit_by_product.values()),
        'bestSellersByValue': best_sellers_by_value,
        'bestSellersByQuantity': best_sellers_by_quantity,
        'defaultingCustomers': defaulting_customers,
        'stockEfficiency': stock_efficiency,
        'goals': {
            'monthlyRevenue': goals.monthly_revenue,
            'monthlyProfit': goals.monthly_profit
        }
    })


# POST /api/reports/goals - Salva metas mensais
@reports_bp.route('/goals', methods=['POST'])
def set_goals():
    data = request.get_json()
    goals = get_or_create_goals()
    goals.monthly_revenue = data.get('monthlyRevenue', goals.monthly_revenue)
    goals.monthly_profit = data.get('monthlyProfit', goals.monthly_profit)
    goals.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Metas atualizadas com sucesso'})
