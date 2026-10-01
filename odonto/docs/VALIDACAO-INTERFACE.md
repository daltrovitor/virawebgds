# Validação de interface

Versão resumida. Ambiente: local, Chrome, dados sintéticos da “Clínica Demonstração”, 01/10/2026.

## Jornada automatizada (`npm run test:e2e`)

`tests/e2e/journey.spec.ts` — aprovada: cadastro rápido → orçamento com odontograma (Prótese nos dentes 11 e 21 com preço editado, Dentística no 11), troca de especialidade limpa o procedimento → 10% de desconto, entrada R$ 1.000 + 3 parcelas fechando o total → aprovação → consulta 09h15–10h00 (45 min) persistida e arrastada para 09h45–10h30 → recebimento da entrada em Pix → importação OFX e conciliação com o recebimento existente.

## Conferências manuais (Playwright)

- Redimensionar consulta até 10h45; pagamento em cartão com bruto/taxa/líquido e recebível D+30; lançamento de tarifa criado a partir do extrato e conciliado; saldo banco × interno “Sem divergência”; empates de sugestão não escolhidos automaticamente.
- 23 páginas e 10 abas da ficha carregaram sem erro de console.
- 375 px de largura sem rolagem horizontal.

Lighthouse ainda não executado.
