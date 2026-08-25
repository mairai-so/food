# Manual de fabrica e manuseio da IA MIAR

## 1. Finalidade

A MIAR e uma plataforma para facilitar a vida de clientes e estabelecimentos de alimentacao: mercado, acougue, padaria, hortifruti, restaurante, pizzaria, comida japonesa, lanchonete e negocios semelhantes.

O objetivo principal e reduzir filas, atrasos, desencontros e estresse. A plataforma conecta cliente, gestor, cozinha, caixa, atendente, garcom e entregador, mantendo cada pessoa com o acesso necessario para cumprir seu trabalho.

Este manual registra a visao do produto e as regras que devem orientar a implementacao. Ele deve ser atualizado quando uma decisao for confirmada no produto, mas nao deve substituir testes, contratos legais ou validacao de seguranca.

## 2. Principios obrigatorios

- Facilitar a rotina sem retirar a autonomia do cliente ou do estabelecimento.
- Pedir consentimento claro para dados de saude, localizacao, memoria pessoal, notificacoes e uso de imagem.
- Mostrar quando uma resposta da IA e estimativa, sugestao ou informacao confirmada.
- Nunca prometer prazo, disponibilidade, calorias, seguranca ou resultado que o sistema nao possa comprovar.
- Registrar pagamentos, cancelamentos, estornos, reclamacoes e alteracoes importantes para auditoria.
- Aplicar isolamento entre lojas, estabelecimentos, funcionarios e clientes.
- Permitir desativar recursos opcionais sem impedir o uso basico do aplicativo.
- Usar linguagem simples, acessivel, com suporte a fonte grande e leitura em telas com pouca luz.

## 3. Papeis do ecossistema

### 3.1 Cliente

Busca estabelecimentos e produtos, conversa com a MIAR, faz pedidos, escolhe preferencias, acompanha a entrega, paga, avalia e pode registrar reclamacao.

### 3.2 Gestor

E o centro operacional de um estabelecimento ou grupo de lojas. Gerencia catalogo, precos, promocoes, pedidos, equipe, cozinha, caixa, entregas, pagamentos, reclamacoes, permissoes e relatorios.

### 3.3 Cozinha e atendentes

Recebem somente os pedidos e alertas necessarios para preparar e atender. Dados pessoais e de saude devem aparecer de forma minima, conforme o consentimento e a necessidade operacional.

### 3.4 Caixa

Confirma recebimentos, acompanha a conta, trata cancelamentos autorizados e pode validar o QR Code de saida.

### 3.5 Garcom

Recebe pedidos de mesa, chamadas e observacoes traduzidas para o idioma escolhido pelo estabelecimento.

### 3.6 Entregador

Recebe o necessario para realizar a entrega, acompanha o status, registra observacoes de endereco e atualiza ocorrencias. A localizacao deve ser usada somente durante a finalidade autorizada.

## 4. MIAR no aplicativo do cliente

### 4.1 Busca inteligente

A IA pode ajudar o cliente a encontrar uma opcao por:

- tempo disponivel ou urgencia;
- distancia e localizacao autorizada;
- preco e orcamento;
- tipo de alimento;
- horario de funcionamento;
- disponibilidade do produto;
- restricoes e preferencias informadas pelo cliente;
- retirada, consumo no local ou entrega.

Exemplo: “Onde encontro pizza para duas pessoas por ate R$ 50 com refrigerante e entrega mais rapida?”

A resposta deve mostrar os criterios usados, o horario da consulta e os limites da informacao. A MIAR nao deve inventar estoque, prazo ou preco.

### 4.2 Personal Food

O cliente pode ativar uma assistente pessoal de alimentacao, chamada Personal Food. Ela pode lembrar preferencias e ajudar no dia a dia, mas a memoria deve ser:

- opt-in, nunca obrigatoria;
- visivel para o cliente;
- editavel e apagavel;
- separada por cliente e protegida;
- limitada ao objetivo autorizado;
- exportavel ou excluivel quando solicitado.

A Personal Food pode registrar preferencias como “pouco sal”, “nao gosto de cebola” ou “prefiro opcoes vegetarianas”. Informacoes de saude sao dados sensiveis: devem ter consentimento especifico, finalidade clara, protecao reforcada e acesso minimo.

O estabelecimento deve receber apenas o alerta operacional necessario, por exemplo: “cliente solicitou pouco sal”. Nao deve receber diagnostico ou historico medico completo.

### 4.3 Nutricao e imagem

O cliente pode fazer perguntas nutricionais e enviar foto de um prato para obter uma estimativa. A MIAR deve informar claramente que a estimativa pode variar e nao substitui medico, nutricionista ou atendimento de emergencia.

Nao e permitido transformar a estimativa em diagnostico, prescricao ou garantia de seguranca alimentar.

### 4.4 Reclamações

O cliente pode enviar uma reclamacao detalhada em ate tres dias uteis, conforme a politica definida pelo produto. O registro deve conter contexto, pedido ou atendimento relacionado, data, descricao e anexos opcionais.

O gestor deve auditar a ocorrencia antes de qualquer veredito. A plataforma deve evitar acusacao automatica, permitir resposta do estabelecimento, controlar acesso aos dados e registrar a decisao e o motivo.

Devem existir protecoes contra abuso, spam, discriminacao, retaliacao e reclamacoes falsas, sempre com revisao humana nos casos relevantes.

### 4.5 Pedido antecipado, mesa e retirada

O cliente pode pedir antes de sair de casa, escolher retirada ou consumo no local e pagar antecipadamente quando o estabelecimento oferecer essa opcao.

Na chegada, um QR Code pode avisar a cozinha e o caixa. A opcao de prioridade somente vale quando:

1. o cliente autorizar e visualizar a regra antes do pagamento;
2. o estabelecimento aderir e tiver capacidade operacional;
3. a cozinha aceitar o pedido e informar o status;
4. nao houver promessa de prioridade impossivel de cumprir.

Para pedidos de mesa, o QR Code da mesa pode abrir o cardapio, vincular a conta e enviar o pedido automaticamente. O cliente pode pagar na mesa sem retornar a uma fila.

### 4.6 Entrega

O cliente pode acompanhar o status e, quando autorizado, a localizacao da entrega. O entregador pode registrar observacoes como complemento, portao, referencia ou impossibilidade de acesso.

O sistema deve limitar a exibicao da localizacao, proteger o contato entre as partes e manter registro de ocorrencias sem expor dados desnecessarios.

## 5. Pagamentos e QR Code de saida

Meios previstos, conforme disponibilidade do estabelecimento e do provedor:

- Pix;
- cartao de debito;
- cartao de credito;
- dinheiro;
- carteiras digitais;
- vale-alimentacao e vale-refeicao;
- link de pagamento;
- pagamento dividido, quando suportado.

O aplicativo deve registrar autorizacao, confirmacao, cancelamento, estorno e comprovante. O dinheiro nao deve ficar guardado em uma carteira propria da plataforma sem parceiro e estrutura regulatoria adequada.

Quando o estabelecimento habilitar a saida por QR Code:

- o codigo fica vinculado a uma conta;
- tem validade curta;
- pode ser usado uma unica vez;
- e invalidado apos a leitura;
- exige confirmacao de pagamento no servidor;
- registra data, operador e resultado da leitura.

## 6. Promocoes e contribuicoes voluntarias

O gestor pode criar promocoes para todos os clientes, grupos, lojas, horarios ou produtos, respeitando as regras comerciais e exibindo validade, condicoes e limite de uso.

Tambem pode aderir voluntariamente a uma contribuicao de percentual configuravel, como 0,5% ou 1%, destinada a iniciativas escolhidas no produto. As categorias narradas ate aqui incluem esporte, educacao, saude e saude mental; a lista final deve ser confirmada antes da implementacao.

Regras obrigatorias:

- adesao nunca obrigatoria;
- percentual visivel antes da confirmacao;
- possibilidade de nao aderir ou sair;
- separacao contabil da contribuicao;
- comprovante e relatorio para o gestor;
- destino, beneficiario e prestacao de contas identificaveis;
- auditoria contra fraude ou uso indevido.

## 7. Feed e murais

O cliente pode encontrar um Feed local para descobrir produtos, estabelecimentos e experiencias proximas. Publicacoes devem ser filtradas contra spam, fraude, assedio, discurso de odio, conteudo sexual, golpes e mensagens codificadas para burlar a moderacao.

Ao lado do Feed existe um mural de oportunidades, separado por finalidade:

- mural de empregos e contratacoes;
- mural de empreendedorismo e oportunidades comerciais.

Cada publicacao deve ter autor, data, localidade, categoria, denuncia, bloqueio e moderacao. A IA pode auxiliar na classificacao, mas decisoes graves devem permitir revisao humana.

## 8. Idiomas e traducao simultanea

Todos os aplicativos devem compartilhar o mesmo sistema de idiomas, sem limitar a experiencia a quatro linguas quando houver traducao disponivel. A lista de idiomas deve ser configuravel, com idioma preferido, fallback e texto original acessivel.

Na conversa entre cliente e funcionario:

- o cliente digita ou fala no proprio idioma;
- o funcionario recebe a traducao em portugues ou no idioma configurado;
- a resposta retorna traduzida para o idioma do cliente;
- o sistema mostra quando a traducao e automatica;
- nomes de produtos, alergias e quantidades devem permitir conferencia no original.

O suporte deve incluir, quando disponivel, portugues, ingles, espanhol, guarani e outros idiomas relevantes. Nao se deve presumir que cliente, garcom ou gestor conhecam o idioma uns dos outros.

## 9. Regras de seguranca da IA

- A IA nao pode revelar dados de outro cliente, loja ou funcionario.
- A IA nao pode alterar dinheiro, pedido, permissao ou reclamacao sem confirmacao e autorizacao.
- A IA deve recusar instrucoes que tentem burlar isolamento, pagamento, moderacao ou privacidade.
- A IA deve pedir esclarecimento quando o pedido for ambiguo.
- A IA deve encaminhar para uma pessoa quando houver risco, conflito, saude ou decisao sensivel.
- Toda acao automatica relevante deve ter registro auditavel.
- Memorias e preferencias nao podem ser usadas para discriminacao ou tratamento desigual.

## 10. Treinamento e manutencao

A MIAR deve ser treinada e avaliada com cenarios reais anonimizados, incluindo pedido, entrega, reclamacao, traducao, restricao alimentar, pagamento, cancelamento e tentativa de fraude.

Antes de publicar uma mudanca, validar:

1. isolamento entre lojas e usuarios;
2. permissoes de cada papel;
3. pagamento e estorno;
4. consentimento e exclusao de dados;
5. mensagens em todos os idiomas configurados;
6. comportamento sem internet e apos reconexao;
7. leitura em celular, fonte grande e baixa luminosidade;
8. registro de auditoria e encaminhamento humano.

## 11. Separacao entre visao e entrega

Este manual registra o que o produto deve oferecer. Cada item ainda precisa ser classificado no projeto como “implementado”, “parcial”, “a validar” ou “futuro”. Uma ideia descrita aqui nao deve ser apresentada ao cliente como funcional antes de existir teste e fluxo completo.
