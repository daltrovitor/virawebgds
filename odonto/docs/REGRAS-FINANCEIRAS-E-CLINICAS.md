# Regras financeiras e clínicas

Cálculos centralizados em `src/domain/` (puros, testados em `tests/unit`) e aplicados pelos serviços em `src/server/services/` (testados contra Postgres real em `tests/integration`). A interface nunca é a fonte do valor: o servidor recalcula tudo.

## 1. Dinheiro

- Valores em **centavos inteiros**. Nenhum cálculo monetário usa ponto flutuante.
- Percentuais em pontos-base: 10% = 1000. Desconto percentual = `round_half_up(subtotal × bp / 10000)`.
- **Parcelamento** (`splitEvenly`): divide em partes iguais e distribui os centavos restantes **nas primeiras parcelas**. R$ 100,00 em 3 = 33,34 + 33,33 + 33,33.
- **Rateio proporcional** (`prorate`): método dos maiores restos, com desempate pela ordem original — determinístico e sempre fecha o total. Usado para ratear o desconto global entre os itens aprovados (`agreement_item_allocations`).

## 2. Catálogo e preços

- Hierarquia: especialidade → procedimento → preço em uma ou mais tabelas (padrão “Particular”).
- Procedimento define **unidade de cobrança** (por dente, arcada, hemiarcada, sessão, global) e **localizações permitidas** (dentes, arcadas, hemiarcadas, sem região), que são conceitos separados.
- Ausência de preço (`NULL`) ≠ preço zero. Sem preço, o item exige valor informado; zero é gratuidade deliberada.
- Preço da tabela só preenche a referência. O valor do item é editável e **não altera a tabela**. Atualizar a tabela **não recalcula** itens salvos.
- Inativar procedimento/especialidade não apaga registros antigos.

## 3. Orçamento

### Quantidade e localização

| Unidade | Seleção | Itens gerados | Total |
|---|---|---|---|
| Por dente | N dentes | N itens rastreáveis (um por dente) | N × preço |
| Por arcada | superior + inferior | 2 itens | 2 × preço |
| Por hemiarcada | K hemiarcadas | K itens | K × preço |
| Por sessão | quantidade Q | 1 item | Q × preço |
| Global | qualquer região (inclusive ambas as arcadas) ou nenhuma | 1 item | preço × quantidade (não multiplica por dentes) |

- Mesmo dente aceita procedimentos diferentes (ex.: Prótese e Dentística no 11).
- Duplicata idêntica (mesmo procedimento + mesma localização, item não recusado) é recusada com aviso; pode ser incluída deliberadamente com **justificativa** registrada no item.
- Odontograma FDI: permanentes 11–48, decíduos 51–85, alternância explícita e rótulo acessível em cada dente. Serve para selecionar região, não representa diagnóstico.
- Trocar a especialidade no formulário limpa o procedimento incompatível.

### Estados

Orçamento: Rascunho → Em negociação → Aprovado / Parcialmente aprovado / Recusado / Cancelado. Item: Pendente, Aprovado, Recusado. Aceitação comercial, situação clínica e quitação são campos independentes.

### Negociação

```
subtotal          = soma dos itens aprovados
desconto          = valor em reais OU percentual sobre o subtotal (nunca ambos)
total negociado   = subtotal − desconto           (desconto ≤ subtotal)
saldo parcelado   = total − entrada               (entrada ≤ total)
entrada + Σ parcelas = total negociado            (condição para salvar/aprovar)
```

- Cada parcela tem vencimento, valor e forma próprios (Pix, dinheiro, débito, crédito, boleto, transferência, outra identificada).
- Simulação (rascunho do plano) não cria dívida nem receita.
- Total zero aprova sem gerar títulos vazios.

### Aprovação (transação única e idempotente)

Em uma transação, com chave de idempotência e checagem da `version` do orçamento:

1. Marca itens aprovados/recusados e a versão como aprovada.
2. Cria o acordo de pagamento e o rateio do desconto por item.
3. Cria os títulos a receber (entrada + parcelas) **uma única vez** por versão.
4. Cria itens de tratamento para os itens aprovados, preservando a linhagem.
5. Registra auditoria.

Repetir a requisição (duplo clique, reenvio) devolve o mesmo resultado sem duplicar nada.

### Revisão de orçamento aprovado

- Abrir revisão cria nova versão com autor e motivo; a anterior fica preservada (`superseded` após aprovar).
- Diferença = novo total − total do acordo vigente.
  - **Para mais**: o plano da revisão cobre só a diferença (novos títulos).
  - **Para menos**: reduz o saldo aberto das parcelas, das mais distantes para as mais próximas, com `receivable_adjustments` explícitos. Se o já pago exceder o novo total, o excedente vira **crédito do paciente pendente de decisão** (reembolso ou abatimento) — nada é apagado e nenhuma parcela quitada é reescrita.
- Item de tratamento já iniciado não pode ser retirado silenciosamente: a revisão é recusada até o desfecho clínico ser registrado. Itens não iniciados retirados ficam cancelados com histórico.

## 4. Datas e vencimentos

- Vencimento é **data civil** (`date`), sem fuso: não muda de dia por conversão UTC.
- Mensal preserva o dia-base: dia 30 → 28/02/2027 → 30/03/2027 (cada mês é calculado a partir do dia-base original, não da data reduzida). Nunca “+30 dias”.
- Instantes (auditoria, consultas) são gravados em UTC e exibidos no fuso da clínica (padrão `America/Sao_Paulo`).

## 5. Títulos, baixas e estornos

- Saldo do título = `original + ajustes − principal recebido − desconto concedido`. Juros e multa são registrados à parte e não reduzem o saldo.
- Baixa parcial e múltiplas baixas por título; uma liquidação pode quitar vários títulos (alocações).
- Restrições no banco impedem saldo negativo, inclusive com duas baixas simultâneas.
- **Estorno** cria movimento reverso vinculado (`reverses_movement_id`, único) e reabre o saldo; o fato original permanece.
- Datas distintas: competência, vencimento e pagamento/recebimento.
- Contas a pagar: fornecedor, categoria, centro de custo, competência, vencimento, conta prevista, parcelamento e rateio por categoria/centro de custo que deve fechar exatamente o valor.
- Recorrência de despesa: geração idempotente por período (não duplica se rodar de novo) e suspensão de ocorrências futuras.
- Recibo reflete apenas o valor efetivamente recebido. Anexar documento fiscal não equivale a emitir nota.

## 6. Cartões

1. Pagamento do paciente em cartão quita o título **na conta de recebíveis de cartão** (não no banco) e cria a transação de cartão com bruto, taxa e líquido, e os recebíveis por parcela (D+N para a 1ª, +30 dias por parcela seguinte).
2. Na liquidação de cada recebível: a conta de recebíveis transfere o líquido ao banco e registra a taxa como despesa (categoria “Taxas de cartão”); antecipação tem encargo próprio (categoria “Encargos de antecipação”).
3. A receita é contada **uma vez** (na quitação do título). A conta de recebíveis zera quando tudo é liquidado.

Exemplo testado: R$ 1.000 com taxa de R$ 30 → títulos quitados em R$ 1.000; banco recebe R$ 970; despesa de taxa R$ 30; receita total R$ 1.000.

Número do cartão e código de segurança nunca são pedidos nem armazenados.

## 7. Contas, transferências e fluxo de caixa

- **Saldo realizado** = saldo inicial + movimentos efetivos até a data (inclui transferências). Títulos em aberto não entram.
- **Transferência** entre contas próprias = dois movimentos vinculados (saída e entrada); não é receita nem despesa.
- **Projetado** = realizado na data-base + saldos **em aberto** dos títulos com vencimento futuro (usa o saldo restante, então valores já pagos não são contados de novo).
- Relatório por categoria é **análise por caixa**, rotulada como tal. Não há DRE por competência (ver LIMITACOES).

## 8. Importação OFX e conciliação

- Importação em duas etapas: leitura e **prévia** (conta, período, quantidade, duplicadas, ambíguas, avisos) → confirmação. Importar cria extrato, **não** receita.
- Deduplicação por conta + FITID; sem FITID, por impressão digital (conta, data, valor, nome e memorando normalizados) + índice de ocorrência. Duas transações reais idênticas no mesmo arquivo nunca são descartadas: ficam marcadas como ambíguas para revisão.
- Sugestões por conta, sinal, valor e proximidade de data, com o **motivo** exibido. Empates não são escolhidos automaticamente.
- Conciliar vincula transação bancária a movimentos internos já existentes com alocações de valor (N↔N). Não cria nova baixa nem nova receita.
- Também é possível, com confirmação explícita: dar baixa em um título em aberto a partir do extrato, ou criar um lançamento (com categoria) quando não houver registro.
- Alocação acima do saldo de qualquer lado é recusada no serviço e no banco, inclusive sob concorrência.
- Estados da transação: Pendente, Conciliada, Ignorada (com justificativa; o extrato permanece).
- **Desfazer conciliação** remove o vínculo e preserva a trilha; **não** estorna a baixa. Estornar a baixa é outra ação.
- Saldo bancário só é exibido quando o OFX informa (`LEDGERBAL`); caso contrário aparece “não informado”.

## 9. Tratamento

- Estados clínicos do item: Não realizado, Em andamento, Concluído, Cancelado.
- Uma consulta pode programar vários itens, de orçamentos aprovados diferentes do **mesmo** paciente (validado no servidor).
- Finalizar a consulta **não** conclui itens automaticamente: o profissional registra o desfecho de cada item programado.
- Pagamento não conclui tratamento; conclusão não quita parcela.
- Cancelamento clínico preserva histórico e marca **revisão financeira pendente**, resolvida à parte.
- Evolução = itens concluídos ÷ itens ativos aprovados (cancelados fora do denominador), sem ponderar por preço; sem itens ativos mostra “Sem itens ativos”.

## 10. Agenda

- Grade padrão de 15 minutos; duração = fim − início, em múltiplos da grade, dentro do mesmo dia; fim > início.
- Estados: Agendado, Confirmado, Paciente na recepção, Em atendimento, Finalizado, Faltou, Desmarcado pelo paciente, Desmarcado pela clínica, Desmarcado e remarcado, Faltou e remarcado. Desmarcação e falta exigem motivo; autoria é registrada no histórico.
- Ocupam horário: Agendado, Confirmado, Na recepção, Em atendimento, Finalizado.
- Conflito com outra consulta do profissional ou com bloqueio é verificado **no servidor** ao salvar (bloqueio consultivo + restrição de exclusão no banco). Encaixe sobreposto exige permissão `schedule.overbook` e confirmação.
- Fora do expediente da clínica é avisado.
- **Remarcação** preserva a consulta antiga (estado “… e remarcado”), cria a nova vinculada e cancela lembretes pendentes da antiga.
- **Correção de horário** (mover/redimensionar) altera a mesma consulta e registra histórico.
- Consulta passada sem desfecho aparece em **Pendências de encerramento**; nunca é marcada como falta automaticamente.
- Lembrete enviado não confirma consulta. Confirmação é ação explícita.
- O atalho de WhatsApp apenas abre o link com o número; não envia mensagem.

## 11. Registros clínicos, anamnese e arquivos

- Anotação em rascunho pode ser editada; **finalizada** não pode (gatilho no banco). Correções entram como **adendo** com autoria e data.
- Linha do tempo reúne consultas, evoluções, anotações e anexos.
- Anamnese: modelo configurável e versionado; respostas datadas com responsável; alertas revisados pelo profissional. O sistema não produz diagnóstico.
- Arquivos: JPEG, PNG, WEBP e PDF, identificados pelo conteúdo (SVG, HTML e executáveis são recusados mesmo renomeados); limite configurável (padrão 20 MB); original preservado; miniatura gerada à parte; download só por link assinado de 10 minutos + sessão + permissão `attachments.view`.

## 12. Permissões (padrões editáveis)

| Papel | Resumo |
|---|---|
| Administrador / proprietário | Todas as permissões |
| Dentista | Pacientes, clínico, arquivos, agenda, orçamentos (sem aprovar), tratamento. Sem valores financeiros |
| Recepção | Pacientes, agenda, ver orçamentos. Sem clínico nem financeiro (configurável) |
| Financeiro | Financeiro completo, aprovar orçamentos, relatórios. Sem clínico |
| Contador | Leitura financeira, exportação e relatórios. Sem imagens nem anamnese |

Sem `finance.view`, os valores do acordo e dos títulos não são devolvidos pelo servidor (não apenas escondidos na tela). CPF completo exige `patients.view_documents`.
