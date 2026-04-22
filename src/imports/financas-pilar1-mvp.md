Pilar 1 • Finanças - O Coração
Requisitos Funcionais e Arquitetura do Pilar 1 (Finanças - Versão MVP-Lite)
Filosofia de Arquitetura (O "Porquê")
O Pilar 1 (Finanças) na versão MVP-Lite NÃO É um ERP completo. Ele não se preocupa (nesta fase) com fluxo de caixa complexo, emissão NFe, DRE ou conciliação bancária.
O objetivo único desta versão é dar ao dono da clínica a clareza absoluta sobre três coisas:
Quanto eu preciso faturar para sobreviver? (Ponto de Equilíbrio)
Meu preço está correto e me dá lucro? (Precificação Estratégica)
Qual é a minha meta exata (diária/semanal/mensal/anual) para crescer? (Método de metas P.R.O. do Outro Mundo e Desdobramento)
Este pilar é a fonte da verdade que alimenta a "IA Preditiva" (IA 2) e dá aos Pilares 4 e 5 (Marketing/Vendas) seu objetivo. Sem o Pilar 1, os Pilares 4 e 5 operam no "achismo".
Módulos Funcionais do Pilar 1 (MVP-Lite)
Módulo 1.1: O "Diagnóstico Rápido" (Cálculo do Ponto de Equilíbrio)
Objetivo: Permitir que o usuário, em menos de 5 minutos, saiba o valor mínimo que sua clínica precisa faturar para "empatar".
Requisito Funcional (Input):
O sistema deve ter campos de soma simples (não um extrato de banco) onde o usuário insere seus totais mensais de:
Despesas Fixas (Ex: Aluguel, salários, internet).
Custos Fixos (Ex: Pró-labore).
Despesas Variáveis (Ex: Impostos, comissões - como %).
Custos Variáveis (Ex: Produtos usados no procedimento - como %).
Requisito Funcional (Output):
Com base nesses inputs, o sistema deve automaticamente calcular e exibir em um dashboard claro o Ponto de Equilíbrio Operacional do negócio.
Toque de IA: A IA deve analisar esses números e dar um insight simples (Ex: "Seu Ponto de Equilíbrio é R$ 50.000. Isso significa que todo faturamento acima deste valor começa a se tornar lucro real.")
Módulo 1.2: Cadastro Central de Produtos e Serviços
Objetivo: Criar o "catálogo" mestre que alimentará os Módulos 1.3 (Precificação), 4 (Propostas) e 6 (Pagamentos).
Requisito Funcional:
Uma seção de "Catálogo" onde o Admin (Nível 2) pode cadastrar cada produto ou serviço que a clínica vende.
Campos Obrigatórios por Item:
Nome do Serviço (Ex: "Aplicação de Botox - 1 Região").
Categoria (Ex: "Faciais", "Corporais").
Preço de Vitrine (Preço Cheio): (Ex: R$ 1.000).
Preço Mínimo (Oferta, promoção): (Ex: R$ 750).
Tempo médio gasto: (Ex: 30 min).
Custo Variável Direto (R$ ou %): (Ex: O custo do produto/material usado).
Este cadastro é a fonte única da verdade para preços. Se o preço mudar aqui, ele muda automaticamente nas Propostas e Links de Pagamento.
Módulo 1.3: A "Precificação Estratégica"
Objetivo: Garantir que o dono nunca venda sem lucro e entenda exatamente quanto ele pode gastar para adquirir um cliente.
Requisito Funcional (O Diferencial):
Ao cadastrar/editar um Serviço (Módulo 1.2), o sistema deve ter um campo chamado: "Percentual (%) de Marketing / CPA".
Contexto: Geralmente no Outro Mundo, estabelecemos uma média mínima inicial de 10%. O usuário deve poder definir isso (ex: 12%).
Cálculo da IA: O sistema automaticamente calcula: "Preço de Vitrine: R$ 1.000. Custo de Marketing Alocado (10%): R$ 100."
O "Simulador de Ofertas":
O sistema deve permitir ao usuário simular cenários sobre esse preço de R$ 1.000.
(Ex: "Simular desconto de 20%", "Simular parcelamento em 12x [com taxa X]", "Simular combo").
O sistema deve mostrar visualmente a nova margem de lucro em cada cenário, alertando o usuário se a oferta o fizer ter prejuízo.
Output: O "CPA Alocado" (R$ 100, no exemplo) é a informação que o Pilar 4 (Marketing) usará para definir o orçamento ideal para investimento em mídia, assim como, para calcular o ROAS.
Módulo 1.4: O "Sistema P.R.O. de Metas"
Objetivo: Definir as metas oficiais do negócio, com base na metodologia do Outro Mundo.
Requisito Funcional:
O sistema deve ter 3 (três) campos de input principais para a meta de faturamento mensal (método P.R.O. do Outro Mundo):
Meta Pessimista (P): A meta "sobrevivência" (acima do Ponto de Equilíbrio).
Meta Realista (R): A meta principal e oficial do negócio.
Meta Otimista (O): A meta "dos sonhos" / "superação total".
Referência: O sistema deve exibir o Ponto de Equilíbrio (do Módulo 1.1) ao lado para ajudar o dono a definir estas metas.
Módulo 1.5: O "Motor de Desdobramento" (A Conexão com Vendas)
Objetivo: Transformar a "Meta Realista" (P1) em metas de ação (P4/P5). Esta é a integração mais crítica do MVP.
Requisito Funcional (Cálculo Automático):
O sistema lê a "Meta Realista" (Ex: R$ 100.000/mês).
O sistema automaticamente desdobra e exibe essa meta em Metas Semanais (Ex: R$ 25.000/semana) e Metas Diárias (Ex: R$ 5.000/dia, baseado em dias úteis configuráveis).
Requisito Funcional (Engenharia Reversa do Funil):
O sistema lê a "Meta Diária" (R$ 5.000) e o "Ticket Médio" (calculado a partir do Módulo 1.2).
Ele calcula a Meta de Vendas/Dia (Ex: 5 vendas de R$ 1.000).
O sistema deve ter uma área de "Configurações de Funil" onde o Admin (Nível 2) insere suas taxas de conversão médias (Ex: % de Leads que viram Conversa, % de Conversa que vira Agendamento, etc.).
Com base nessas taxas, o sistema lê a "Meta de Vendas/Dia" (5) e calcula toda a engenharia reversa do funil, exatamente como eu detalho abaixo de forma inversa:
Meta de Vendas Validadas: 5
Meta de Consultas Realizadas: 10
Meta de Agendamentos: 12
Meta de Conversas: 24
Meta de Leads: 48
Requisito Funcional (Exibição):
Estes números (Metas Diárias de R$, Vendas, Leads) devem ser os números principais exibidos nos Dashboards dos Pilares 1, 4 e 5.
Módulo 1.6: O "Dashboard de Metas" (O Feedback Loop)
Objetivo: Mostrar o "Realizado vs. Meta" em tempo real, eliminando o lançamento manual.
Requisito Funcional:
Um dashboard proeminente que mostra a "Meta Realista" do dia/semana/mês.
Uma barra de progresso que é automaticamente preenchida.
Integração Crítica: O "Realizado" deve ser alimentado automaticamente pela API do Motor de Pagamento (Pagar.me/MP) detalhado nos Pilares 4/5 (Parte 5 do Briefing).
Contexto: Quando uma venda é aprovada (seja por Link, Checkout ou Maquininha sincronizada com o painel do Gateway), o faturamento instantaneamente atualiza esta barra de progresso.
Conexão com IA: É esta barra de progresso que a "IA Preditiva" (IA 2, Parte 1 do Briefing) lê para gerar o relatório EOD (End-of-Day) para o dono.