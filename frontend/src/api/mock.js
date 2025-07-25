export const getCompanyInfo = async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    name: "EasyData360 LTDA",
    cnpj: "12.345.678/0001-99",
    address: "Rua das Startups, 123 - São Paulo, SP",
    phone: "(11) 98765-4321",
    email: "contato@easydata360.com",
    logoBase64: ""
  };
};

export const saveCompanyInfo = async (companyData) => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log("Informações salvas:", companyData);
  return true;
};

// ✅ Adicionado para uso no ReceiptPage
export const getTransactionById = async (id) => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    id,
    status: "SALE", // ou "QUOTE"
    createdAt: new Date().toISOString(),
    customerName: "João da Silva",
    customerId: "123",
    total: 150.0,
    items: [
      { productId: "p1", productName: "Produto A", quantity: 2, price: 30.0 },
      { productId: "p2", productName: "Produto B", quantity: 3, price: 30.0 }
    ]
  };
};
