# 📦 EasyStock360

**EasyStock360** é um sistema web para **controle de estoque, vendas, clientes e finanças**, com **Flask (Python)** no backend, **React (JavaScript)** no frontend e **SQLite** como banco local. Focado em **micro e pequenos negócios**, oferece uma operação simples, moderna e eficiente.

---

## 🚀 Tecnologias

### 🔧 Backend
- **Python** 3.10+
- **Flask**
- **Flask-SQLAlchemy**
- **Flask-CORS**
- **SQLite** (por padrão)
- **Blueprints** por domínio (`products`, `sales`, `returns`, `customers`, `financial`, `reports`, `settings`)

### 🎨 Frontend
- **React** 18+
- **TailwindCSS**
- **Axios**
- **Componentização** por páginas (Dashboard, Vendas, Estoque, Clientes, Financeiro, Relatórios, Configurações, Devoluções)

---

## 📁 Estrutura
```
EasyStock360/
├── backend/
│ ├── app/
│ │ ├── init.py # Inicialização do Flask (db.create_all) e registro dos blueprints
│ │ ├── models.py # Modelos SQLAlchemy (Sale, Product, Return, CustomerCredit, etc.)
│ │ └── routes/ # Rotas por domínio
│ │ ├── products.py
│ │ ├── customers.py
│ │ ├── sales.py # Suporta ?status=COMPLETED|QUOTE|ALL
│ │ ├── returns.py # CRUD de devoluções
│ │ ├── financial.py
│ │ ├── reports.py
│ │ ├── settings.py
│ │ └── sales_payments.py # (separado ou dentro de sales) endpoints de parcelas
│ ├── database/
│ │ └── app.db # Banco SQLite padrão (criado automaticamente)
│ └── run.py # Ponto de entrada do servidor Flask
│
├── frontend/
│ ├── public/
│ └── src/
│ ├── api/api.js # Cliente HTTP (Axios) com todos os endpoints
│ ├── components/ # Componentes comuns (Card, Button, ModalWrapper, etc.)
│ ├── pages/
│ │ ├── ReturnsPage.jsx # Página de Devoluções
│ │ ├── ReturnForm.jsx # Formulário (modal) de Devolução
│ │ ├── SalesPage.jsx
│ │ ├── InventoryPage.jsx
│ │ ├── CustomersPage.jsx
│ │ ├── FinancialPage.jsx
│ │ ├── ReportsPage.jsx
│ │ ├── DashboardPage.jsx
│ │ └── SettingsPage.jsx
│ ├── components/CustomerDetailsModal.jsx # Modal com abas (Créditos, Compras, Devoluções, etc.)
│ ├── App.jsx # Roteamento por state (inclui 'returns')
│ └── index.js
│
└── README.md
```

---

## ⚙️ Instalação e Execução (Local)

### 1) Clonar
```bash
git clone https://github.com/engffsantos/easyStock360.git
cd easyStock360
```
2) Backend (Flask)

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
source venv/bin/activate
pip install -r requirements.txt
python run.py
API: http://localhost:5000/api
```
As tabelas são criadas automaticamente com db.create_all() na inicialização.

Config do banco (opcional):

EASYSTOCK_DB_FILE: caminho do arquivo SQLite (padrão: backend/database/app.db)

DATABASE_URL: conexão completa (ex.: sqlite:////abs/path/app.db, postgresql://...)

3) Frontend (React)
```bash
cd frontend
npm install
npm start
App: http://localhost:3000
```
🧠 Funcionalidades Principais
🔹 Devoluções (NEW)
Registro de devoluções a partir de vendas COMPLETED

Validação de itens (quantidade ≤ vendida − já devolvida)

Reentrada de estoque automática

Resoluções:

REEMBOLSO: cria DESPESA no financeiro (pendente)

CREDITO: cria Crédito do Cliente (saldo disponível)

Página Devoluções com tabela + modal ReturnForm (JSX)

🔹 Clientes
Cadastro/edição

Detalhes do cliente com abas: Resumo, Créditos, Compras, Devoluções, Interações, Histórico

Crédito disponível (badge) e tabela de créditos

Interações (telefone, e-mail, WhatsApp, etc.), com impressão do relatório

🔹 Vendas & Orçamentos
Registro de QUOTE e COMPLETED

Conversão de orçamento em venda (valida estoque)

Parcelamento e métodos de pagamento (PIX, dinheiro, cartão débito/crédito, boleto)

Status de compras no modal do cliente alinhado ao Financeiro (PENDENTE/VENCIDO/PAGO), calculado pelas parcelas

🔹 Financeiro
Lançamentos de Receitas/Despesas

Contas a receber (parcelas de vendas) com status PENDENTE/VENCIDO/PAGO

Marcação de parcela como PAGA

Devolução com REEMBOLSO gera DESPESA automaticamente

🔹 Estoque
Produtos com custo, preço, SKU, marca, tipo, quantidade, estoque mínimo

Histórico de alterações

Alerta de estoque baixo

🔹 Dashboard & Relatórios
Vendas do dia, contas a pagar/receber, produtos com baixo estoque

Relatórios (período, metas, ranking de produtos)

🔌 Endpoints Principais
Vendas
GET /api/sales/ — aceita ?status=COMPLETED|QUOTE|ALL (também lista múltiplos: COMPLETED,QUOTE)

GET /api/sales/<id>/ — detalhe com items e payments

POST /api/sales/ — cria venda/orçamento

POST /api/sales/<id>/convert/ — converte QUOTE em COMPLETED

POST /api/sales/payments/<payment_id>/pay — marca parcela como PAGA

PUT /api/sales/payments/<payment_id> — atualiza parcela (status, valor, vencimento)

Devoluções
GET /api/returns — lista

GET /api/returns/<id> — detalhe com itens

POST /api/returns — cria devolução (valida itens, ajusta estoque, integra financeiro/crédito)

PATCH /api/returns/<id>/status — atualiza status (ABERTA/CONCLUIDA/CANCELADA)

Clientes
GET /api/customers/ — lista

POST /api/customers/ — cria

PUT /api/customers/<id> — atualiza

DELETE /api/customers/<id> — remove

GET /api/customers/<id>/interactions/ — interações

POST /api/customers/<id>/interactions/ — nova interação

GET /api/customers/<id>/purchases/ — compras do cliente

GET /api/customers/<id>/credits/ — saldo total + entradas de crédito (se CustomerCredit habilitado)

Financeiro
GET /api/financial — lançamentos

POST /api/financial — novo lançamento

POST /api/financial/<id>/pay — marcar como PAGO

PUT|PATCH /api/financial/<id> — atualizar

Configurações & Relatórios
GET|POST /api/settings/company — dados da empresa (logo, cores, fontes)

GET /api/reports?start=YYYY-MM-DD&end=YYYY-MM-DD

GET|POST /api/reports/goals/ — metas

🧩 Notas de Implementação
Timezone: datas da UI formatadas com America/Sao_Paulo.

Criação de tabelas: sem Flask-Migrate; o app cria as tabelas na inicialização (db.create_all()).

Banco: por padrão em backend/database/app.db (diretório criado automaticamente).

Status financeiro: PENDENTE/VENCIDO/PAGO calculado por parcelas; esse status também é exibido nas Compras do modal do cliente.

Segurança: sem autenticação por enquanto (uso recomendado em ambiente local ou rede interna).

🧭 Roadmap
🔒 Autenticação (JWT) e perfis de acesso

📤 Exportação de relatórios (PDF/Excel)

📈 Gráficos/BI avançados no dashboard

🔄 Backup automático

🧾 Integração fiscal (NFC-e)

🧮 Liquidação de Créditos do Cliente em novas vendas

👨‍💻 Créditos
EasyData360 — Soluções em dados, IA e sistemas para PMEs.
🌐 https://www.easydata360.com.br

📝 Licença
Licenciado sob MIT. Consulte LICENSE.
