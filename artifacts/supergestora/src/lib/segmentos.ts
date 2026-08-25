export type Categoria = { nome: string; itens: string[] };

export type Segmento = {
  id: string;
  nome: string;
  descricao: string;
  categorias: Categoria[];
};

const BEBIDAS: Categoria = {
  nome: 'Bebidas',
  itens: [
    'Refrigerante lata', 'Refrigerante 600ml', 'Refrigerante 2L', 'Água sem gás',
    'Água com gás', 'Suco natural', 'Cerveja long neck', 'Cerveja 600ml',
    'Chopp', 'Caipirinha', 'Dose de destilado', 'Café expresso',
  ],
};

const SOBREMESAS: Categoria = {
  nome: 'Sobremesas',
  itens: ['Pudim', 'Petit gateau', 'Mousse de chocolate', 'Sorvete', 'Açaí na tigela', 'Brownie'],
};

export const SEGMENTOS: Segmento[] = [
  {
    id: 'pizzaria', nome: 'Pizzaria', descricao: 'Pizzas, calzones e massas',
    categorias: [
      { nome: 'Pizzas salgadas', itens: ['Mussarela', 'Calabresa', 'Portuguesa', 'Frango com catupiry', 'Quatro queijos', 'Marguerita', 'Bacon', 'Toscana', 'Vegetariana', 'À moda da casa'] },
      { nome: 'Pizzas doces', itens: ['Chocolate', 'Romeu e Julieta', 'Banana com canela', 'Prestígio'] },
      { nome: 'Calzones e massas', itens: ['Calzone de calabresa', 'Calzone de frango', 'Lasanha', 'Espaguete'] },
      { nome: 'Bordas e adicionais', itens: ['Borda de catupiry', 'Borda de cheddar', 'Adicional de queijo'] },
      BEBIDAS, SOBREMESAS,
    ],
  },
  {
    id: 'churrascaria', nome: 'Churrascaria', descricao: 'Rodízio, cortes e buffet',
    categorias: [
      { nome: 'Cortes bovinos', itens: ['Picanha', 'Maminha', 'Alcatra', 'Fraldinha', 'Costela', 'Contrafilé', 'Cupim'] },
      { nome: 'Suínos e aves', itens: ['Linguiça', 'Costelinha suína', 'Lombo', 'Coração de frango', 'Coxinha da asa', 'Frango com bacon'] },
      { nome: 'Acompanhamentos', itens: ['Arroz branco', 'Feijão tropeiro', 'Farofa', 'Vinagrete', 'Pão de alho', 'Mandioca frita', 'Polenta'] },
      { nome: 'Buffet e saladas', itens: ['Buffet de saladas', 'Buffet quente', 'Sushi no buffet'] },
      BEBIDAS, SOBREMESAS,
    ],
  },
  {
    id: 'restaurante', nome: 'Restaurante', descricao: 'À la carte, executivo e self-service',
    categorias: [
      { nome: 'Entradas', itens: ['Caldinho', 'Bolinho de bacalhau', 'Isca de peixe', 'Salada da casa'] },
      { nome: 'Pratos principais', itens: ['Prato executivo', 'Filé à parmegiana', 'Strogonoff de frango', 'Peixe grelhado', 'Feijoada', 'Parmegiana de frango', 'Prato do dia'] },
      { nome: 'Self-service', itens: ['Buffet por quilo', 'Marmita pequena', 'Marmita média', 'Marmita grande'] },
      { nome: 'Porções', itens: ['Batata frita', 'Frango a passarinho', 'Calabresa acebolada', 'Mandioca frita'] },
      BEBIDAS, SOBREMESAS,
    ],
  },
  {
    id: 'bar', nome: 'Bar', descricao: 'Petiscos, drinks e chopp',
    categorias: [
      { nome: 'Porções', itens: ['Batata frita', 'Frango a passarinho', 'Calabresa acebolada', 'Torresmo', 'Isca de tilápia', 'Mandioca com bacon', 'Tábua de frios'] },
      { nome: 'Drinks', itens: ['Caipirinha', 'Caipiroska', 'Gin tônica', 'Mojito', 'Whisky dose', 'Combo balde'] },
      { nome: 'Cervejas', itens: ['Chopp claro', 'Chopp escuro', 'Long neck', 'Garrafa 600ml', 'Lata'] },
      { nome: 'Lanches', itens: ['X-salada', 'Misto quente', 'Pastel'] },
      BEBIDAS,
    ],
  },
  {
    id: 'japones', nome: 'Japonês', descricao: 'Sushi, sashimi e pratos quentes',
    categorias: [
      { nome: 'Sushi e sashimi', itens: ['Sashimi salmão', 'Niguiri salmão', 'Hossomaki', 'Uramaki', 'Joe salmão', 'Combinado 20 peças', 'Combinado 40 peças'] },
      { nome: 'Temaki', itens: ['Temaki salmão', 'Temaki atum', 'Temaki skin', 'Temaki califórnia'] },
      { nome: 'Pratos quentes', itens: ['Yakisoba', 'Guioza', 'Tempurá', 'Harumaki', 'Missoshiru', 'Robata'] },
      { nome: 'Rodízio', itens: ['Rodízio completo', 'Rodízio infantil'] },
      BEBIDAS, SOBREMESAS,
    ],
  },
  {
    id: 'hamburgueria', nome: 'Hamburgueria', descricao: 'Smash, artesanal e combos',
    categorias: [
      { nome: 'Hambúrgueres', itens: ['Smash simples', 'Smash duplo', 'Cheddar bacon', 'Salada completo', 'Frango crispy', 'Vegetariano', 'Da casa'] },
      { nome: 'Acompanhamentos', itens: ['Batata frita', 'Batata rústica', 'Onion rings', 'Nuggets'] },
      { nome: 'Combos', itens: ['Combo individual', 'Combo casal', 'Combo família'] },
      { nome: 'Molhos', itens: ['Barbecue', 'Cheddar', 'Maionese da casa', 'Alho'] },
      BEBIDAS, SOBREMESAS,
    ],
  },
  {
    id: 'cafeteria', nome: 'Cafeteria', descricao: 'Cafés, doces e salgados',
    categorias: [
      { nome: 'Cafés', itens: ['Expresso', 'Expresso duplo', 'Cappuccino', 'Latte', 'Mocha', 'Café coado', 'Café gelado'] },
      { nome: 'Salgados', itens: ['Coxinha', 'Pão de queijo', 'Empada', 'Croissant', 'Misto quente'] },
      { nome: 'Doces', itens: ['Bolo fatia', 'Cookie', 'Torta doce', 'Brigadeiro'] },
      BEBIDAS,
    ],
  },
  {
    id: 'padaria', nome: 'Padaria', descricao: 'Panificação, frios e balcão',
    categorias: [
      { nome: 'Panificação', itens: ['Pão francês kg', 'Pão de forma', 'Baguete', 'Pão doce', 'Sonho', 'Bolo caseiro'] },
      { nome: 'Frios e laticínios', itens: ['Presunto kg', 'Mussarela kg', 'Requeijão', 'Manteiga'] },
      { nome: 'Lanches', itens: ['Misto quente', 'Bauru', 'Sanduíche natural'] },
      BEBIDAS,
    ],
  },
  {
    id: 'sorveteria', nome: 'Sorveteria e açaí', descricao: 'Sorvetes, açaí e milkshakes',
    categorias: [
      { nome: 'Açaí', itens: ['Açaí 300ml', 'Açaí 500ml', 'Açaí 700ml', 'Açaí no quilo'] },
      { nome: 'Sorvetes', itens: ['Casquinha', 'Copo 1 bola', 'Copo 2 bolas', 'Sundae', 'Sorvete por quilo'] },
      { nome: 'Complementos', itens: ['Granola', 'Leite condensado', 'Paçoca', 'Morango', 'Banana', 'Nutella'] },
      { nome: 'Milkshakes', itens: ['Milkshake chocolate', 'Milkshake morango', 'Milkshake ovomaltine'] },
      BEBIDAS,
    ],
  },
  {
    id: 'marmitaria', nome: 'Marmitaria', descricao: 'Marmitas, quentinhas e entrega',
    categorias: [
      { nome: 'Marmitas', itens: ['Marmita P', 'Marmita M', 'Marmita G', 'Marmita fitness', 'Marmita executiva'] },
      { nome: 'Proteínas', itens: ['Bife acebolado', 'Frango grelhado', 'Carne moída', 'Peixe', 'Linguiça'] },
      { nome: 'Guarnições', itens: ['Arroz', 'Feijão', 'Purê', 'Salada', 'Farofa', 'Macarrão'] },
      BEBIDAS,
    ],
  },
  {
    id: 'pastelaria', nome: 'Pastelaria', descricao: 'Pastéis, caldo de cana e feira',
    categorias: [
      { nome: 'Pastéis salgados', itens: ['Carne', 'Queijo', 'Pizza', 'Frango com catupiry', 'Palmito', 'Camarão'] },
      { nome: 'Pastéis doces', itens: ['Chocolate', 'Banana com canela', 'Romeu e Julieta'] },
      { nome: 'Bebidas da casa', itens: ['Caldo de cana', 'Garapa com limão'] },
      BEBIDAS,
    ],
  },
  {
    id: 'food-truck', nome: 'Food truck', descricao: 'Operação móvel e evento',
    categorias: [
      { nome: 'Cardápio', itens: ['Item 1 do cardápio', 'Item 2 do cardápio', 'Item 3 do cardápio', 'Combo'] },
      BEBIDAS,
    ],
  },
  {
    id: 'adega', nome: 'Adega e distribuidora', descricao: 'Bebidas, conveniência e entrega',
    categorias: [
      { nome: 'Cervejas', itens: ['Lata 350ml', 'Long neck', 'Garrafa 600ml', 'Fardo 12un'] },
      { nome: 'Destilados', itens: ['Vodka', 'Whisky', 'Gin', 'Cachaça', 'Rum'] },
      { nome: 'Vinhos', itens: ['Tinto seco', 'Branco suave', 'Espumante'] },
      { nome: 'Conveniência', itens: ['Gelo', 'Carvão', 'Salgadinho', 'Energético'] },
    ],
  },
  {
    id: 'drive-thru-bebidas', nome: 'Drive-thru de Bebidas', descricao: 'Bebidas geladas, combos rápidos e retirada no carro',
    categorias: [
      { nome: 'Bebidas geladas', itens: ['Refrigerante lata', 'Água sem gás', 'Água com gás', 'Suco natural', 'Chá gelado', 'Energético'] },
      { nome: 'Cervejas', itens: ['Long neck', 'Lata 350ml', 'Garrafa 600ml', 'Fardo 12un'] },
      { nome: 'Destilados', itens: ['Vodka', 'Whisky', 'Gin', 'Cachaça'] },
      { nome: 'Combos', itens: ['Combo cerveja', 'Combo refrigerante', 'Combo festa'] },
      { nome: 'Conveniência', itens: ['Gelo', 'Carvão', 'Salgadinho'] },
    ],
  },
  {
    id: 'outros', nome: 'Outros', descricao: 'Monte do zero, do seu jeito',
    categorias: [{ nome: 'Meu cardápio', itens: [] }],
  },
];
