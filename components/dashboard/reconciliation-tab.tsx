// Hello World
"use client"

import React, { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  CreditCard,
  Building,
  RefreshCw,
  Search,
  Filter,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface BankTx {
  id: string
  date: string
  memo: string
  amount: number
  type: "credit" | "debit"
  fitId: string
  status: "reconciled" | "pending"
  matchedWith?: string
}

export default function ReconciliationTab() {
  const [activeSubTab, setActiveSubTab] = useState<"ofx" | "cards">("ofx")
  const [fileName, setFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<"all" | "credit" | "debit" | "pending">("all")

  // Sample transactions after OFX parsed
  const [transactions, setTransactions] = useState<BankTx[]>([
    {
      id: "tx-1",
      date: "2026-09-30",
      memo: "PIX RECEBIDO - MARIA SILVA (ORCAMENTO 104)",
      amount: 450.0,
      type: "credit",
      fitId: "202609300019283",
      status: "reconciled",
      matchedWith: "Orçamento #104 - Maria Silva",
    },
    {
      id: "tx-2",
      date: "2026-09-30",
      memo: "PAGTO ELETRON COBRANCA - DENTAL CREMER MATERIAIS",
      amount: -680.5,
      type: "debit",
      fitId: "202609300028812",
      status: "reconciled",
      matchedWith: "Despesa: Compra de Resinas e Anestésicos",
    },
    {
      id: "tx-3",
      date: "2026-09-29",
      memo: "PIX RECEBIDO - CARLOS MENDES (CONSULTA)",
      amount: 250.0,
      type: "credit",
      fitId: "202609290038192",
      status: "pending",
    },
    {
      id: "tx-4",
      date: "2026-09-29",
      memo: "LIQUIDACAO CIELO MASTER CREDITO",
      amount: 1164.0,
      type: "credit",
      fitId: "202609290048123",
      status: "pending",
    },
    {
      id: "tx-5",
      date: "2026-09-28",
      memo: "TARIFA BANCARIA PACOTE MENSAL",
      amount: -89.9,
      type: "debit",
      fitId: "202609280051234",
      status: "pending",
    },
  ])

  // Card fee rates state
  const [cardFees, setCardFees] = useState({
    debitFee: 1.29,
    creditSightFee: 2.79,
    creditInstallmentFee: 3.89,
    anticipationFee: 1.5,
  })

  const { toast } = useToast()

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setFileName(file.name)

    // Simulate OFX read
    const reader = new FileReader()
    reader.onload = () => {
      setTimeout(() => {
        setLoading(false)
        toast({
          title: "Extrato OFX Importado com Sucesso!",
          description: `Arquivo "${file.name}" processado. 5 novas transações bancárias encontradas.`,
        })
      }, 700)
    }
    reader.readAsText(file)
  }

  const handleReconcile = (txId: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === txId) {
          const nextStatus = t.status === "reconciled" ? "pending" : "reconciled"
          return {
            ...t,
            status: nextStatus,
            matchedWith: nextStatus === "reconciled" ? "Conciliado manualmente" : undefined,
          }
        }
        return t
      })
    )
    toast({
      title: "Status de Conciliação Alterado",
      description: "Transação sincronizada com o livro financeiro.",
    })
  }

  const totalCredits = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)
  const totalDebits = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const pendingCount = transactions.filter((t) => t.status === "pending").length

  const filteredTxs = transactions.filter((t) => {
    const matchesSearch =
      t.memo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.fitId.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false
    if (filterType === "credit") return t.type === "credit"
    if (filterType === "debit") return t.type === "debit"
    if (filterType === "pending") return t.status === "pending"
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building className="w-6 h-6 text-primary" />
            Conciliação Bancária OFX & Gestão de Cartões
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importação automática de extratos bancários .OFX, verificação de entradas/saídas e previsão de taxas de cartões.
          </p>
        </div>

        <div className="inline-flex rounded-sm border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setActiveSubTab("ofx")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xs cursor-pointer transition-colors ${
              activeSubTab === "ofx"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Extrato OFX & Conciliação
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("cards")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xs cursor-pointer transition-colors ${
              activeSubTab === "cards"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Taxas de Cartão & Recebíveis
          </button>
        </div>
      </div>

      {activeSubTab === "ofx" && (
        <div className="space-y-6">
          {/* OFX Upload Area & Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Upload Box */}
            <Card className="lg:col-span-4 p-5 border border-border bg-card flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-1">
                  Importar Extrato Bancário
                </span>
                <p className="text-xs text-muted-foreground mb-3">
                  Compatível com arquivos .OFX de qualquer banco (Itaú, Bradesco, BB, Santander, Nubank, Inter, etc.).
                </p>

                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-border rounded-sm hover:border-primary/80 transition-colors cursor-pointer bg-background">
                  <Upload className="w-8 h-8 text-primary mb-2" />
                  <span className="text-xs font-bold text-foreground">
                    {fileName ? fileName : "Clique para selecionar o arquivo .OFX"}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Extrato Bancário OFX</span>
                  <input
                    type="file"
                    accept=".ofx,.qfx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-xs text-primary font-semibold mt-3">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processando extrato bancário...
                </div>
              )}
            </Card>

            {/* Financial Metrics Cards */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 border border-border bg-card flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-bold uppercase tracking-wider">Entradas no Extrato</span>
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-emerald-600">
                    R$ {totalCredits.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Créditos conciliáveis</p>
                </div>
              </Card>

              <Card className="p-4 border border-border bg-card flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-bold uppercase tracking-wider">Saídas no Extrato</span>
                  <ArrowDownRight className="w-4 h-4 text-rose-600" />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-rose-600">
                    R$ {totalDebits.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Débitos e despesas</p>
                </div>
              </Card>

              <Card className="p-4 border border-border bg-card flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-bold uppercase tracking-wider">Pendentes</span>
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">transações sem conciliação</p>
                </div>
              </Card>
            </div>
          </div>

          {/* Transactions List */}
          <Card className="p-4 border border-border bg-card space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-border/60 pb-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrar lançamentos bancários..."
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="flex gap-1 w-full sm:w-auto">
                {(["all", "credit", "debit", "pending"] as const).map((ft) => (
                  <button
                    key={ft}
                    onClick={() => setFilterType(ft)}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold cursor-pointer transition-colors ${
                      filterType === ft
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {ft === "all"
                      ? "Todos"
                      : ft === "credit"
                      ? "Entradas"
                      : ft === "debit"
                      ? "Saídas"
                      : "A Conciliar"}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto" data-lenis-prevent>
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase tracking-wider bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Histórico / Descrição no Extrato</th>
                    <th className="p-3">Identificador (FITID)</th>
                    <th className="p-3 text-right">Valor (R$)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTxs.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-semibold text-foreground whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-foreground">{tx.memo}</p>
                        {tx.matchedWith && (
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Vinculado a: {tx.matchedWith}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-[11px]">
                        {tx.fitId}
                      </td>
                      <td className={`p-3 text-right font-bold whitespace-nowrap ${
                        tx.amount > 0 ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs ${
                            tx.status === "reconciled"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {tx.status === "reconciled" ? "Conciliado" : "Pendente"}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant={tx.status === "reconciled" ? "outline" : "default"}
                          onClick={() => handleReconcile(tx.id)}
                          className="h-7 text-xs font-semibold cursor-pointer"
                        >
                          {tx.status === "reconciled" ? "Desfazer" : "Conciliar"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeSubTab === "cards" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5 p-5 border border-border bg-card space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-1">
                Taxas da Operadora de Cartão (Maquininha)
              </span>
              <p className="text-xs text-muted-foreground">
                Defina as taxas acordadas com a Cielo, Rede, Stone, PagSeguro ou Getnet para dedução automática da receita líquida.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Taxa no Débito (%):
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={cardFees.debitFee}
                  onChange={(e) => setCardFees({ ...cardFees, debitFee: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Taxa no Crédito à Vista (%):
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={cardFees.creditSightFee}
                  onChange={(e) => setCardFees({ ...cardFees, creditSightFee: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Taxa no Crédito Parcelado 2x a 12x (%):
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={cardFees.creditInstallmentFee}
                  onChange={(e) => setCardFees({ ...cardFees, creditInstallmentFee: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Taxa de Antecipação de Recebíveis ao Mês (%):
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={cardFees.anticipationFee}
                  onChange={(e) => setCardFees({ ...cardFees, anticipationFee: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>

              <Button
                onClick={() =>
                  toast({
                    title: "Taxas Atualizadas!",
                    description: "Regras de taxas de operadora salvas com sucesso.",
                  })
                }
                className="w-full text-xs font-semibold cursor-pointer mt-2"
              >
                Salvar Configurações de Taxa
              </Button>
            </div>
          </Card>

          <Card className="lg:col-span-7 p-5 border border-border bg-card space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Simulação de Recebíveis e Cronograma de Depósitos
            </span>

            <div className="space-y-3">
              <div className="p-3 bg-muted/40 rounded-sm border border-border/60 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-foreground">Venda R$ 1.200,00 no Crédito 3x</p>
                  <p className="text-[11px] text-muted-foreground">3 parcelas de R$ 400,00 • Taxa: {cardFees.creditInstallmentFee}%</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">
                    Líquido: R$ {(1200 * (1 - cardFees.creditInstallmentFee / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Taxa da operadora: R$ {(1200 * (cardFees.creditInstallmentFee / 100)).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-sm border border-border/60 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-foreground">Venda R$ 450,00 no Débito</p>
                  <p className="text-[11px] text-muted-foreground">Depósito em 1 dia útil • Taxa: {cardFees.debitFee}%</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">
                    Líquido: R$ {(450 * (1 - cardFees.debitFee / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Taxa da operadora: R$ {(450 * (cardFees.debitFee / 100)).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
