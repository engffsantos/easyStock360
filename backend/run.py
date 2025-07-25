from app import create_app


app = create_app()

if __name__ == '__main__':
    # Executa localmente na porta 5000 e escuta em todas as interfaces
    app.run(host='0.0.0.0', port=5000, debug=True)
