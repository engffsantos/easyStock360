from flask import Blueprint, request, jsonify
from app.models import db, CompanySettings

settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')

@settings_bp.route('/company', methods=['GET', 'POST'])
def company_settings():
    if request.method == 'GET':
        settings = CompanySettings.query.first()
        if not settings:
            return jsonify({}), 200

        return jsonify(settings.to_dict()), 200

    if request.method == 'POST':
        data = request.get_json()

        settings = CompanySettings.query.first()
        if not settings:
            settings = CompanySettings()

        settings.name = data.get('name', '')
        settings.cnpj = data.get('cnpj', '')
        settings.address = data.get('address', '')
        settings.phone = data.get('phone', '')
        settings.email = data.get('email', '')
        settings.logo_base64 = data.get('logoBase64', '')
        settings.theme_color = data.get('themeColor', 'petroleo')
        settings.font_size = data.get('fontSize', 'base')

        db.session.add(settings)
        db.session.commit()

        return jsonify({'message': 'Configurações salvas com sucesso'}), 200
