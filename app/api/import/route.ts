import { createServerSupabaseClient } from "@/lib/supabase-server"
import { type NextRequest, NextResponse } from "next/server"

// ─────────────── Types ───────────────

type EntityType = "clients" | "professionals" | "notes" | "checklist" | "goals"

interface ExtractedItem extends Record<string, string | boolean | number> {
    selected: boolean
    _confidence: number
    _source: string
}

// ─────────────── Constants ───────────────

const VALID_DDDS = ["11", "12", "13", "14", "15", "16", "17", "18", "19", "21", "22", "24", "27", "28", "31", "32", "33", "34", "35", "37", "38", "41", "42", "43", "44", "45", "46", "47", "48", "49", "51", "53", "54", "55", "61", "62", "63", "64", "65", "66", "67", "68", "69", "71", "73", "74", "75", "77", "79", "81", "82", "83", "84", "85", "86", "87", "88", "89", "91", "92", "93", "94", "95", "96", "97", "98", "99"]

const NON_NAME_WORDS = [
    "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo",
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    "Pagamento", "Total", "Valor", "Serviço", "Descrição", "Produto",
    // Labels que nunca devem ser nomes
    "Email", "Telefone", "Celular", "Contato", "Whatsapp", "Fone", "Tel",
    "Data", "Nascimento", "Nasc", "Hospedagem", "Mensalidade", "Vencimento", "Emissão",
    "Status", "Endereço", "Observação", "Observações", "Obs", "Notas", "Nota",
    "Fatura", "Invoice", "Codigo", "Código", "Referencia", "Referência",
    "Cliente", "Clientes", "Profissional", "Paciente",
    // Cidades/estados que aparecem soltos
    "Paulo", "Horizonte", "Alegre", "Janeiro", "Brasília", "Brasilia", "Salvador",
    "Fortaleza", "Manaus", "Belém", "Belem", "Goiânia", "Goiania", "Curitiba", "Recife",
    "Florianópolis", "Florianopolis", "Natal", "Maceió", "Maceio", "Teresina",
    // Palavras de observação
    "Comprou", "Interesse", "Renovação", "Renovacao", "Primeira", "Premium", "VIP",
    "Completo", "Completa"
]

const headerKeywords = [
    "nome", "name", "cliente", "client", "empresa", "company", "cnpj", "cpf",
    "email", "e-mail", "telefone", "phone", "tel", "cel", "celular", "contato", "whatsapp",
    "data", "nascimento", "birth", "nasc", "valor", "total", "endereço", "address", "notas", "notes",
    "referencia", "referência", "nota", "fatura", "invoice", "codigo", "código", "lista", "completo",
    "hospedagem", "serviço", "status", "vencimento", "emissão", "pagamento", "mensalidade"
]

const addressWords = [
    "rua", "avenida", "av", "alameda", "travessa", "praça", "largo", "bairro", "centro",
    "praia", "estrada", "rodovia", "via", "estr", "viela", "passagem", "quadra", "lote",
    "apto", "apt", "apart", "apartamento", "bloco", "casa", "loja", "sala", "cidade", "estado",
    "número", "nº", "n°", "cep", "completo", "horizonte", "uf", "br", "brasil",
    "flores", "jardim", "ipês", "ipes", "voluntários", "voluntarios", "pátria", "patria",
    "atlântica", "atlantica", "copacabana", "batel", "alegre", "vip",
    "sul", "norte", "leste", "oeste"
]

// Nomes de cidades brasileiras conhecidas para detectar em linhas de endereço
const KNOWN_CITIES = [
    "são paulo", "sao paulo", "rio de janeiro", "belo horizonte", "porto alegre",
    "curitiba", "recife", "salvador", "fortaleza", "manaus", "belém", "belem",
    "goiânia", "goiania", "florianópolis", "florianopolis", "natal", "maceió", "maceio",
    "teresina", "campo grande", "joão pessoa", "joao pessoa", "aracaju", "porto velho",
    "macapá", "macapa", "boa vista", "palmas", "são luís", "sao luis", "vitória", "vitoria",
    "brasília", "brasilia", "campinas", "guarulhos", "osasco", "sorocaba"
]

// Siglas de estados brasileiros
const STATES = ["SP", "RJ", "MG", "BA", "RS", "PR", "CE", "PA", "SC", "GO", "PE", "MA", "PB", "ES", "PI", "RN", "AL", "MT", "MS", "DF", "AC", "AP", "AM", "RR", "TO", "SE", "RO"]

// ─────────────── Validators ───────────────

function validateEmail(v: string): boolean {
    return /^[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(v)
}

function validatePhone(v: string): boolean {
    const digits = v.replace(/\D/g, "")
    if (digits.length < 10) return false
    if (/^(\d)\1+$/.test(digits)) return false // All digits same
    const ddd = digits.substring(0, 2)
    if (!VALID_DDDS.includes(ddd)) return false
    return true
}

function validateCPF(v: string): boolean {
    const cpf = v.replace(/\D/g, "")
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
    let sum = 0
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i)
    let rev = 11 - (sum % 11)
    if (rev === 10 || rev === 11) rev = 0
    if (rev !== parseInt(cpf.charAt(9))) return false
    sum = 0
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i)
    rev = 11 - (sum % 11)
    if (rev === 10 || rev === 11) rev = 0
    if (rev !== parseInt(cpf.charAt(10))) return false
    return true
}

function validateCNPJ(v: string): boolean {
    const cnpj = v.replace(/\D/g, "")
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
    let length = cnpj.length - 2
    let numbers = cnpj.substring(0, length)
    let digits = cnpj.substring(length)
    let sum = 0
    let pos = length - 7
    for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--
        if (pos < 2) pos = 9
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    if (result !== parseInt(digits.charAt(0))) return false
    length = length + 1
    numbers = cnpj.substring(0, length)
    sum = 0
    pos = length - 7
    for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--
        if (pos < 2) pos = 9
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    if (result !== parseInt(digits.charAt(1))) return false
    return true
}

function validateDate(v: string): boolean {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function validateCurrency(v: string): boolean {
    return /R\$\s?[0-9\.,]+/.test(v) || /^\d+[.,]\d{2}$/.test(v)
}

// ─────────────── Confidence System ───────────────

function scoreItem(item: Record<string, any>, entity: EntityType): number {
    let score = 0
    if (entity === "clients" || entity === "professionals") {
        const nome = (item.nome || "").toString()
        if (nome === "Cliente" || nome === "Profissional" || !nome) {
            score += 0
        } else {
            const words = nome.split(/\s+/).filter((w: string) => w.length > 0)
            score += words.length >= 2 ? 0.4 : 0.2
        }
        if (item.email && validateEmail(item.email)) score += 0.3
        if (item.telefone && validatePhone(item.telefone)) score += 0.3
        if (item.cpf && validateCPF(item.cpf)) score += 0.2
        return Math.min(1, score)
    }
    if (["notes", "checklist", "goals"].includes(entity)) {
        const text = (item.conteudo || item.titulo || item.texto || item.descricao || "").toString()
        if (text.length > 20) return 0.8
        if (text.length > 5) return 0.4
        return 0.1
    }
    return 0.5
}

function getThreshold(entity: EntityType): number {
    const thresholds: Record<string, number> = {
        clients: 0.4, professionals: 0.4,
        notes: 0.1, checklist: 0.1, goals: 0.1
    }
    return thresholds[entity] || 0.3
}

// ─────────────── Data Extraction Helpers ───────────────

function extractEmail(text: string): string {
    const match = text.match(/[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/)
    return match ? match[0] : ""
}

function extractPhone(text: string): string {
    // Remove CPFs e CNPJs antes de buscar telefone para evitar falsos positivos
    const cleanText = text
        .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, "")       // Remove CPF formatado
        .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, "")  // Remove CNPJ formatado

    // Regex com vírgula opcional no início para capturar contexto completo como ",(11) 99999-9999"
    const matches = text.matchAll(/,?\s*(?:\+55\s*)?(?:\(\s*\d{2}\s*\)|\b\d{2}\b)\s*\d{4,5}[-\s]*\d{4}/g)
    for (const match of matches) {
        const phone = match[0].trim()
        const digits = phone.replace(/\D/g, "")

        // Anti-filtro: se os dígitos forem iguais a um CPF já detectado na linha
        const cpfMatch = text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
        if (cpfMatch && cpfMatch[0].replace(/\D/g, "") === digits) continue

        if (validatePhone(phone)) return phone
    }

    // Fallback dígitos — usa cleanText (sem CPF/CNPJ) para evitar pegar dígitos de documentos
    const digitsOnly = cleanText.replace(/\D/g, "")
    const numbers = digitsOnly.match(/\d{10,11}/g)
    if (numbers) {
        for (const n of numbers) {
            if (/^(\d)\1+$/.test(n)) continue
            const ddd = n.substring(0, 2)
            if (VALID_DDDS.includes(ddd)) return n
        }
    }
    return ""
}

function isAddressLine(line: string): boolean {
    const hasEmail = !!extractEmail(line)
    const hasPhone = !!extractPhone(line)
    const hasCpf = !!line.match(/\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}/)
    const hasDate = !!line.match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b|\b\d{4}[/-]\d{2}[/-]\d{2}\b/)
    if (hasEmail || hasPhone || hasCpf || hasDate) return false
    if (/^(das?|dos?|do|da|av\.?|rua|avenida|alameda)\s/i.test(line)) return true
    if (/,\s*(Copacabana|Batel|Centro|Jardim|Ipês|Ipes|Vila|Rio|Janeiro|São Paulo|Curitiba|Alegre)/i.test(line)) return true
    // "Cidade - UF" ou "Cidade, UF"
    const statesPattern = STATES.join("|")
    if (new RegExp(`[,\\-–]\\s*(${statesPattern})\\b`, "i").test(line)) return true
    // Toda a linha é nome de cidade conhecida
    const lineLower = line.trim().toLowerCase().replace(/[,\-–"']/g, "").trim()
    if (KNOWN_CITIES.some(c => lineLower === c || lineLower.startsWith(c + " ") || lineLower.endsWith(" " + c))) return true
    // Contém "Rua/Av." + número
    if (/\b(rua|av\.?|avenida|alameda|travessa|estrada|rodovia|quadra)\s+/i.test(line) && /\d{1,5}/.test(line)) return true
    return false
}

// Detecta fragmentos de endereço MESMO quando contêm dados (telefone, CPF, data)
function isAddressFragment(line: string): boolean {
    const trimmed = line.trim()
    // Começa com preposição de endereço ou direção cardinal
    if (/^(das?\s|dos?\s|do\s|da\s|av\.?\s|rua\s|avenida\s|alameda\s)/i.test(trimmed)) return true
    // Direção cardinal + vírgula ou espaço (Sul, Brasília / Norte, ...)
    if (/^(Sul|Norte|Leste|Oeste|Centro)[,\s]/i.test(trimmed)) return true
    // Palavra + vírgula + cidade conhecida (Sete de Setembro, Salvador)
    const citiesPattern = KNOWN_CITIES.map(c => c.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")).join("|")
    if (new RegExp(`^[A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\\s]+,\\s*(${citiesPattern})`, "i").test(trimmed)) return true
    // Padrão genérico: Palavra(s) + vírgula + Cidade (ambos capitalizados)
    if (/^[A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\s]{3,},\s*[A-ZÀ-Ÿ][a-zA-ZÀ-ÿ]{4,}$/.test(trimmed)) return true
    // "Cidade - UF" ou "CidadeUF" solto
    const statesPattern = STATES.join("|")
    if (new RegExp(`^[A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\\s]+\\s*[\\-–,]\\s*(${statesPattern})$`, "i").test(trimmed)) return true
    return false
}

// Detecta linhas que são apenas labels de campo (ex: "Email:", "Telefone:", "Data de Nascimento:")
function isLabelLine(line: string): boolean {
    const trimmed = line.trim()
    // Linha é só um label seguido de ":" ou vazia depois
    if (/^(email|e-mail|telefone|tel|cel|celular|contato|whatsapp|fone|cpf|cnpj|data|nascimento|nasc|endereço|address|nome|name|cliente|hospedagem|serviço|status|vencimento|emissão|pagamento|mensalidade|observação|observações|obs|nota|notas|referência|referencia|código|codigo)[:\s]*$/i.test(trimmed)) return true
    // "Data de" seguido de nada significativo
    if (/^data\s+de\s*$/i.test(trimmed)) return true
    // Label com colon no meio e nada de dados
    if (/^[A-Za-zÀ-ÿ\s]{2,20}:\s*$/i.test(trimmed)) return true
    return false
}

// Detecta linhas que são observações/notas, não nomes de pessoas
function isNoteLine(line: string): boolean {
    const trimmed = line.trim().toLowerCase()
    // Frases comuns de observação
    if (/^(cliente desde|tem interesse|primeira compra|comprou|observ|obs[:\s]|nota[:\s]|prefere|interesse em)/i.test(trimmed)) return true
    // Texto longo demais para ser um nome (> 60 chars sem dados estruturados)
    if (trimmed.length > 60 && !extractEmail(line) && !extractPhone(line) && !line.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)) return true
    // Linha que contém "serviço" ou "premium" ou "VIP" sem ser nome
    if (/\b(serviço|premium|vip|renovação|renovacao|compra)\b/i.test(trimmed) && !/^[A-ZÀ-Ÿ][a-z]+\s+[A-ZÀ-Ÿ]/.test(line.trim())) return true
    return false
}

function isHeaderLike(text: string): boolean {
    if (!text) return false
    const t = text.trim().toLowerCase()
    if (t.includes("lista de") || t.includes("documento de") || t.includes("relação de") || t.includes("clientes")) return true
    if (headerKeywords.includes(t)) return true
    const words = t.split(/[\s,;|]+/).map(w => w.replace(/[:\-]$/, "").trim()).filter(w => w.length >= 2)
    if (words.length >= 2 && words.every(w => headerKeywords.some(k => k === w || k.includes(w)))) return true
    return false
}

function extractName(line: string, knownData: string[]): string {
    let nameSection = line

    // Se a linha inteira é um label, retorna vazio
    if (isLabelLine(line)) return ""

    // Se a linha é uma nota/observação, retorna vazio
    if (isNoteLine(line)) return ""

    // Se a linha é endereço, retorna vazio
    if (isAddressLine(line) || isAddressFragment(line)) return ""

    // Remove dados conhecidos (email, telefone, cpf, data)
    for (const data of knownData) if (data) nameSection = nameSection.replace(data, "")

    // Remove numeração no início ("1," "2." "3-")
    nameSection = nameSection.replace(/^\d+[\.,\-\s]+/, "")

    // Remove siglas de estado isoladas
    const statesPattern = STATES.join("|")
    nameSection = nameSection.replace(new RegExp(`[,\\-–\\s]*(${statesPattern})\\b`, "gi"), " ")

    // Remove pontuação final e aspas
    nameSection = nameSection.replace(/[|;:]+$/, "").replace(/["'|]/g, "").trim()

    // Remove labels inline ("Email:", "Nome:", etc.)
    nameSection = nameSection.replace(/\b(email|e-mail|telefone|tel|cel|celular|contato|whatsapp|fone|cpf|cnpj|data|nascimento|nasc|endereço|hospedagem|serviço|status|observação|obs|nota)[:\s]*/gi, "")

    // Remove valores monetários
    nameSection = nameSection.replace(/R\$\s?[0-9\.,]+/g, "")

    // Remove datas que sobram
    nameSection = nameSection.replace(/\b\d{2}[\/-]\d{2}[\/-]\d{4}\b/g, "")
    nameSection = nameSection.replace(/\b\d{4}[\/-]\d{2}[\/-]\d{2}\b/g, "")

    // Remove números de telefone que sobram
    nameSection = nameSection.replace(/\(?\d{2}\)?\s*\d{4,5}[\-\s]*\d{4}/g, "")

    // Remove CPFs que sobram
    nameSection = nameSection.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, "")
    nameSection = nameSection.replace(/\b\d{11}\b/g, "")

    // Limpeza agressiva de DDD colado ao nome: ",,(11)" ou ", (11)" ou ",(11)" ou " (11)"
    nameSection = nameSection.replace(/\s*,+\s*\(?\d{2}\)?\s*$/, "")
    nameSection = nameSection.replace(/\s+\(?\d{2}\)?\s*$/, "")
    nameSection = nameSection.replace(/[\s,]+$/, "").trim()

    // Remove nomes de cidades conhecidas (que não são nomes de pessoas)
    for (const city of KNOWN_CITIES) {
        const cityParts = city.split(" ")
        if (cityParts.length > 1) {
            // Cidades compostas: "São Paulo", "Rio de Janeiro", "Belo Horizonte"
            const escaped = cityParts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("\\s+")
            nameSection = nameSection.replace(new RegExp(escaped, "gi"), " ")
        }
    }

    // Remove palavras de endereço e observação isoladas
    nameSection = nameSection.replace(/\b(copacabana|batel|jardim|centro|ipês|ipes|atlântica|atlantica|voluntários|voluntarios|pátria|patria)\b/gi, " ")
    nameSection = nameSection.replace(/\b(cliente|comprou|interesse|renovação|renovacao|premium|vip|primeira|compra|desde|prefere)\b/gi, " ")

    // Quebra em palavras e filtra
    const nameParts = nameSection.split(/[\s,]+/).filter(w => {
        const wl = w.toLowerCase().replace(/[:\-.,;!?()]/g, "")
        if (wl.length < 2) return false
        if (/^\d+$/.test(w)) return false
        if (/\d/.test(w) && !/^\d+(st|nd|rd|th)$/i.test(w)) return false
        if (addressWords.includes(wl)) return false
        if (headerKeywords.includes(wl)) return false
        if (NON_NAME_WORDS.some(nn => nn.toLowerCase() === wl)) return false
        if (STATES.includes(w.toUpperCase()) && w.length <= 2) return false

        // Relaxado: Aceita palavras capitalizadas OU palavras com mais de 3 letras que não são ruído
        // Isso ajuda se o OCR falhar na capitalização de alguma letra
        return /^[A-ZÀ-Ÿ]/.test(w) || /^(de|do|da|dos|das|e)$/i.test(w) || w.length > 3
    })

    // Remove preposições soltas no início ou fim
    while (nameParts.length > 0 && /^(de|do|da|dos|das|e)$/i.test(nameParts[0])) nameParts.shift()
    while (nameParts.length > 0 && /^(de|do|da|dos|das|e)$/i.test(nameParts[nameParts.length - 1])) nameParts.pop()

    // Aumentado para 20 palavras para evitar truncamento de e.g. nomes de profissionais muito longos
    let finalName = nameParts.slice(0, 20).join(" ").trim().replace(/[,\s\-:|]+$/, "").trim()
    if (finalName.length < 2 || isHeaderLike(finalName)) return ""

    // Filtro agressivo para ruído comum de OCR colado ao nome (ex: "fismemaDO", "fssasMARNAZENA")
    // Se a primeira palavra começar com 3+ letras minúsculas seguidas de maiúsculas, remove esse prefixo
    const prefixMatch = finalName.match(/^([a-z]{3,})([A-ZÀ-Ÿ].*)/)
    if (prefixMatch) {
        finalName = prefixMatch[2].trim()
    }

    // Filtra ruído de OCR residual no final (ex: ": isR", " isR", "- is")
    finalName = finalName.replace(/[:\-\s]+\b[a-z]{1,4}[A-Z]{0,2}\b$/, "").trim()
    finalName = finalName.replace(/[\|:;]+$/, "").trim()

    // Verifica se o "nome" final é na verdade uma cidade
    const finalLower = finalName.toLowerCase()
    if (KNOWN_CITIES.includes(finalLower)) return ""

    // Se não tiver dados fortes (como telefone/email), exige pelo menos algum critério de nome
    const hasStrongData = knownData.some(d => d && d.length > 5)
    if (!hasStrongData && nameParts.length < 2) {
        // Se for só uma palavra, aceita se for razoável (3+ letras e capitalizada)
        if (nameParts.length === 1 && /^[A-ZÀ-Ÿ]/.test(nameParts[0]) && nameParts[0].length >= 3) {
            return finalName
        }
        return ""
    }

    return finalName
}

// ─────────────── Specialized Extractors ───────────────

// ─────────────── Specialized Extractors ───────────────

function mergeVerticalBlocks(items: ExtractedItem[], entity: EntityType): ExtractedItem[] {
    if (entity !== "clients" && entity !== "professionals") return items
    const merged: ExtractedItem[] = []
    for (let i = 0; i < items.length; i++) {
        const current = items[i]
        const next = items[i + 1]
        // Se o próximo tem baixa confiança ou é visivelmente continuação de nome, e o atual tem campos vazios
        if (next && next._confidence < 0.45) {
            const canFill = (current.email === "" && !!next.email) || (current.telefone === "" && !!next.telefone) || (current.cpf === "" && !!next.cpf)
            if (canFill) {
                if (next.email) current.email = next.email
                if (next.telefone) current.telefone = next.telefone
                if (next.cpf) current.cpf = next.cpf
                current._confidence = Math.min(1.0, (current._confidence as number) + 0.1)
                i++
            }
        }
        merged.push(current)
    }
    return merged
}

function deduplicateItems(items: ExtractedItem[], entity: EntityType): ExtractedItem[] {
    const map = new Map<string, ExtractedItem>()
    for (const item of items) {
        let key = ""
        if (entity === "clients" || entity === "professionals") {
            const email = (item.email || "").toString().toLowerCase().trim()
            const nome = (item.nome || "").toString().toLowerCase().trim()
            const tel = (item.telefone || "").toString().replace(/\D/g, "")
            if (email) key = `email:${email}`
            else key = `name:${nome}|tel:${tel}`
        } else {
            key = JSON.stringify(item)
        }

        const existing = map.get(key)
        if (!existing || item._confidence > existing._confidence) {
            map.set(key, item)
        }
    }
    return Array.from(map.values())
}

function extractClients(lines: string[]): ExtractedItem[] {
    let items: ExtractedItem[] = []
    for (const line of lines) {
        if (isLabelLine(line)) continue
        if (isNoteLine(line)) continue
        if (isAddressLine(line)) continue

        const email = extractEmail(line)
        const phone = extractPhone(line)
        const cpfMatch = line.match(/\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}/)
        const dobMatch = line.match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b|\b\d{4}[/-]\d{2}[/-]\d{2}\b/)
        const cpf = cpfMatch ? cpfMatch[0] : ""
        const dob = dobMatch ? dobMatch[0] : ""

        if (isAddressFragment(line)) {
            if (items.length > 0 && (email || phone || cpf || dob)) {
                const lastItem = items[items.length - 1]
                if (email && !lastItem.email) lastItem.email = email
                if (phone && !lastItem.telefone) lastItem.telefone = phone
                if (cpf && !lastItem.cpf) lastItem.cpf = cpf
                if (dob && !lastItem.data_nascimento) lastItem.data_nascimento = dob
                lastItem._confidence = scoreItem(lastItem, "clients")
                lastItem.selected = (lastItem._confidence as number) >= 0.6
            }
            continue
        }

        const nome = extractName(line, [email, phone, cpf, dob])
        if (!nome && !email && !phone && !cpf && !dob) continue

        if (!nome && items.length > 0) {
            const lastItem = items[items.length - 1]
            if (email && !lastItem.email) lastItem.email = email
            if (phone && !lastItem.telefone) lastItem.telefone = phone
            if (cpf && !lastItem.cpf) lastItem.cpf = cpf
            if (dob && !lastItem.data_nascimento) lastItem.data_nascimento = dob
            lastItem._confidence = scoreItem(lastItem, "clients")
            lastItem.selected = (lastItem._confidence as number) >= 0.6
            continue
        }

        const nomeFinal = nome || (email ? email.split("@")[0] : "")
        if (!nomeFinal) continue

        const item = { nome: nomeFinal, email, telefone: phone, cpf, data_nascimento: dob, _source: line }
        const confidence = scoreItem(item, "clients")
        if (confidence < getThreshold("clients") && !cpf && !dob) continue
        items.push({ ...item, _confidence: confidence, selected: confidence >= 0.6 })
    }

    // Backfill órfãos
    const backfilled: ExtractedItem[] = []
    for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const nameStartsWithPrep = /^(das?|dos?|do|da|av\.?)\s/i.test(it.nome as string)
        if (nameStartsWithPrep && backfilled.length > 0) {
            const prev = backfilled[backfilled.length - 1]
            if (it.email && !prev.email) prev.email = it.email
            if (it.telefone && !prev.telefone) prev.telefone = it.telefone
            prev._confidence = scoreItem(prev, "clients")
            continue
        }
        backfilled.push(it)
    }

    return deduplicateItems(backfilled, "clients")
}

function extractProfessionals(lines: string[]): ExtractedItem[] {
    let items: ExtractedItem[] = []
    for (const line of lines) {
        if (isLabelLine(line)) continue
        if (isNoteLine(line)) continue
        if (isAddressLine(line)) continue
        if (isAddressFragment(line)) continue

        const email = extractEmail(line)
        const phone = extractPhone(line)
        const nome = extractName(line, [email, phone])

        if (!nome && !email && !phone) continue

        if (!nome && items.length > 0) {
            const lastItem = items[items.length - 1]
            if (email && !lastItem.email) lastItem.email = email
            if (phone && !lastItem.telefone) lastItem.telefone = phone
            lastItem._confidence = scoreItem(lastItem, "professionals")
            lastItem.selected = (lastItem._confidence as number) >= 0.6
            continue
        }

        const nomeFinal = nome || (email ? email.split("@")[0] : "")
        if (!nomeFinal) continue

        const item = { nome: nomeFinal, email, telefone: phone, _source: line }
        const confidence = scoreItem(item, "professionals")
        if (confidence < getThreshold("professionals")) continue
        items.push({ ...item, _confidence: confidence, selected: confidence >= 0.6 })
    }
    return deduplicateItems(items, "professionals")
}



function extractTextItems(lines: string[], entity: EntityType): ExtractedItem[] {
    if (lines.length === 0) return []
    const isNotes = entity === "notes" || entity === "checklist" || entity === "goals"
    const validLines = lines.filter(l => l.length >= 2 && (isNotes || !isHeaderLike(l)))
    if (validLines.length === 0) {
        console.warn("No valid lines found after filtering. Entity:", entity)
        return []
    }

    if (entity === "notes") {
        return [{
            titulo: validLines[0],
            conteudo: validLines.slice(1).join("\n") || validLines[0],
            _source: validLines.join("\n"),
            _confidence: 1.0,
            selected: true
        }]
    }

    if (entity === "checklist") {
        return validLines.map(line => {
            const dateMatch = line.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/)
            let titulo = line
            let data = ""
            if (dateMatch) {
                data = dateMatch[1]
                titulo = line.replace(dateMatch[0], "").trim().replace(/[\-\|]$/, "").trim()
            }
            return {
                titulo,
                data,
                _source: line,
                _confidence: 0.8,
                selected: true
            }
        })
    }

    if (entity === "goals") {
        return validLines.map(line => ({
            titulo: line,
            descricao: "",
            _source: line,
            _confidence: 0.8,
            selected: true
        }))
    }

    return []
}

function extractEntitiesFromText(text: string, entity: EntityType): ExtractedItem[] {
    const cleanedText = text
        .replace(/([a-zA-ZÀ-Ÿ])\s+([ãõçêéáíóú])(\s+|$)/g, '$1$2$3')
        .replace(/([ãõçêéáíóú])\s+([a-zA-ZÀ-Ÿ])/g, '$1$2')
        .replace(/[|]/g, " ")

    const rawLines = cleanedText.split("\n").map(l => l.trim()).filter(l => l.length > 0)

    switch (entity) {
        case "clients": return extractClients(rawLines)
        case "professionals": return extractProfessionals(rawLines)
        case "notes": case "checklist": case "goals": return extractTextItems(rawLines, entity)
        default: return []
    }
}

// ─────────────── CSV-in-PDF Detection ───────────────

const CSV_HEADER_KEYWORDS = ["nome", "email", "telefone", "cpf", "data", "endereço", "endereco", "notas", "notes", "name", "phone", "cliente"]

/** Finds the CSV header line index within the first few lines of text. Returns -1 if not found. */
function findCSVHeaderIndex(lines: string[]): number {
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].toLowerCase()
        const commas = (line.match(/,/g) || []).length
        const matches = CSV_HEADER_KEYWORDS.filter(h => line.includes(h)).length
        if (commas >= 2 && matches >= 2) return i
    }
    return -1
}

function isCSVLikeText(text: string): boolean {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length < 2) return false
    return findCSVHeaderIndex(lines) >= 0
}

function countCSVCommas(text: string): { commas: number; balanced: boolean } {
    let inQuotes = false
    let commas = 0
    for (const ch of text) {
        if (ch === '"') inQuotes = !inQuotes
        if (ch === ',' && !inQuotes) commas++
    }
    return { commas, balanced: !inQuotes }
}

function reconstructCSVFromPDFText(text: string): string {
    // Remove page break markers from pdf2json
    const cleanText = text.replace(/-{2,}Page\s*\(\d+\)\s*Break-{2,}/gi, '')
    const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length === 0) return ''

    // Find the actual CSV header (skip title lines like "Documento de Teste")
    const headerIdx = findCSVHeaderIndex(lines)
    if (headerIdx < 0) return ''

    const headerLine = lines[headerIdx]
    const { commas: headerCommas } = countCSVCommas(headerLine)

    // Detect numbered rows (e.g., "1,Ana Carolina...")
    const firstDataLine = lines.slice(headerIdx + 1).find(l => l.length > 0)
    const hasRowNumbers = !!firstDataLine && /^\d+,\s*[A-ZÀ-Ÿa-zà-ÿ"]/.test(firstDataLine)
    const expectedCommas = hasRowNumbers ? headerCommas + 1 : headerCommas

    const result: string[] = [headerLine]
    let current = ''

    for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i]
        // Skip repeated header lines (multi-page PDFs)
        if (line.toLowerCase() === headerLine.toLowerCase()) continue

        if (!current) {
            current = line
        } else {
            // Join without space if line ends with hyphen (preserves phone numbers like 98765-4321)
            // Join without space if next line starts continuing a word/email (no leading space, lowercase start)
            if (current.endsWith('-')) {
                current += line
            } else if (/^[a-zà-ÿ@._]/.test(line)) {
                // Continuation of a word or email (e.g., "yahoo.c" + "om")
                current += line
            } else {
                current += ' ' + line
            }
        }

        const { commas, balanced } = countCSVCommas(current)
        if (commas >= expectedCommas && balanced) {
            const stripped = hasRowNumbers ? current.replace(/^\d+,\s*/, '') : current
            result.push(stripped)
            current = ''
        }
    }

    if (current && current.trim().length > 0) {
        const stripped = hasRowNumbers ? current.replace(/^\d+,\s*/, '') : current
        result.push(stripped)
    }

    return result.join('\n')
}

// ─────────────── Processors ───────────────

async function processCSV(buffer: Buffer, entity: EntityType): Promise<ExtractedItem[]> {
    const Papa = await import("papaparse")
    const csvString = buffer.toString("utf-8")
    return new Promise((resolve, reject) => { Papa.default.parse(csvString, { header: true, skipEmptyLines: true, complete(results) { const records = results.data as Record<string, string>[]; const items = records.map(row => { const mapped = mapRowToEntity(row, entity); const confidence = scoreItem(mapped, entity); return { ...mapped, _confidence: confidence, selected: confidence >= 0.6, _source: "csv" } as ExtractedItem }).filter(it => it._confidence >= getThreshold(entity)); resolve(items) }, error: (err: Error) => reject(err) }) })
}

async function processXLSX(buffer: Buffer, entity: EntityType): Promise<ExtractedItem[]> {
    const XLSX = await import("xlsx")
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" })
    return jsonData.map(row => { const mapped = mapRowToEntity(row, entity); const confidence = scoreItem(mapped, entity); return { ...mapped, _confidence: confidence, selected: confidence >= 0.6, _source: "xlsx" } as ExtractedItem }).filter(it => it._confidence >= getThreshold(entity))
}

async function processPDF(buffer: Buffer, entity: EntityType): Promise<ExtractedItem[]> {
    const PDFParser = (await import("pdf2json")).default
    const pdfParser = new (PDFParser as any)(null, 1)
    return new Promise((resolve, reject) => {
        pdfParser.on("pdfParser_dataError", (err: any) => reject(err))
        pdfParser.on("pdfParser_dataReady", async () => {
            try {
                const text = (pdfParser as any).getRawTextContent()

                // If PDF contains CSV-structured data, parse it as CSV for accurate extraction
                if (isCSVLikeText(text)) {
                    try {
                        const csvText = reconstructCSVFromPDFText(text)
                        const Papa = await import("papaparse")
                        const parseResult = Papa.default.parse(csvText, { header: true, skipEmptyLines: true })
                        const records = parseResult.data as Record<string, string>[]
                        const items = records
                            .map((row: Record<string, string>) => {
                                const mapped = mapRowToEntity(row, entity)
                                const confidence = scoreItem(mapped, entity)
                                return { ...mapped, _confidence: confidence, selected: confidence >= 0.6, _source: "pdf-csv" } as ExtractedItem
                            })
                            .filter((it: ExtractedItem) => it._confidence >= getThreshold(entity))
                        resolve(items)
                        return
                    } catch (csvErr) {
                        console.warn("CSV-in-PDF parsing failed, falling back to text extraction:", csvErr)
                    }
                }

                const items = extractEntitiesFromText(text, entity)
                resolve(mergeVerticalBlocks(items, entity))
            } catch (err) {
                reject(err as Error)
            }
        })
        pdfParser.parseBuffer(buffer)
    })
}

async function processWithOCR(buffer: Buffer, entity: EntityType): Promise<ExtractedItem[]> {
    const startTimeProcessed = Date.now()
    const { spawn } = await import("child_process")
    const path = await import("path")
    
    return new Promise((resolve, reject) => {
        console.log("Spawning standalone OCR processor...")
        const scriptPath = path.join(process.cwd(), "scripts", "ocr-processor.js")
        const child = spawn("node", [scriptPath])
        
        let stdout = ""
        let stderr = ""
        
        child.stdout.on("data", (data) => {
            stdout += data.toString()
        })
        
        child.stderr.on("data", (data) => {
            stderr += data.toString()
            // Optional: parse progress if reported to stderr
        })
        
        child.on("close", (code) => {
            console.log(`OCR process exited with code ${code} in ${Date.now() - startTimeProcessed}ms`)
            if (code !== 0) {
                console.error("OCR stderr:", stderr)
                return reject(new Error(`OCR process failed with code ${code}`))
            }
            
            if (!stdout || stdout.length < 10) {
                console.warn("OCR returned insufficient text.")
                return resolve([])
            }
            
            const items = extractEntitiesFromText(stdout, entity)
            resolve(mergeVerticalBlocks(items, entity))
        })
        
        child.stdin.write(buffer)
        child.stdin.end()
    })
}

function mapRowToEntity(row: Record<string, string>, entity: EntityType): Record<string, any> {
    const keys = Object.keys(row)
    const findField = (pts: string[]) => { const k = keys.find(k => pts.some(p => k.toLowerCase().includes(p.toLowerCase()))); return k ? String(row[k]).trim() : "" }
    if (entity === "professionals") return { nome: findField(["nome", "name"]), email: findField(["email"]), telefone: findField(["telefone", "phone", "tel", "cel", "celular", "whatsapp", "contato", "fone"]) }
    if (entity === "notes") return { titulo: findField(["titulo", "title", "assunto"]), conteudo: findField(["conteudo", "texto", "nota", "content", "descrição"]) || Object.values(row).join(" ") }
    if (entity === "checklist") return { titulo: findField(["titulo", "title", "item", "tarefa"]), data: findField(["data", "date", "prazo"]) }
    if (entity === "goals") return { titulo: findField(["titulo", "title", "meta"]), descricao: findField(["descricao", "description"]), categoria: findField(["categoria", "category"]), valor_alvo: findField(["alvo", "target"]), valor_atual: findField(["atual", "current"]) }
    return { nome: findField(["nome", "name"]), email: findField(["email"]), telefone: findField(["telefone", "phone", "tel", "cel", "celular", "whatsapp", "contato", "fone"]), cpf: findField(["cpf", "documento"]), data_nascimento: findField(["nascimento", "nasc", "birth", "data_nasc", "data de nasc"]) }
}

// ─────────────── Route Handler ───────────────

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        const formData = await request.formData()
        const isDemo = formData.get("isDemo") === "true"
        const entity = (formData.get("entity") || "clients") as EntityType

        if (!user && !isDemo) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
        }

        const file = formData.get("file")
        const textContent = formData.get("text") as string || ""

        let items: ExtractedItem[] = []

        if (textContent) {
            items = extractEntitiesFromText(textContent, entity)
            items = mergeVerticalBlocks(items, entity)
        } else if (file && file instanceof File) {
            const buffer = Buffer.from(await file.arrayBuffer())
            if (file.type === "text/csv" || file.name.endsWith(".csv")) items = await processCSV(buffer, entity)
            else if (file.name.match(/\.(xlsx|xls)$/)) items = await processXLSX(buffer, entity)
            else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) items = await processPDF(buffer, entity)
            else if (file.type.startsWith("image/")) items = await processWithOCR(buffer, entity)
            else return NextResponse.json({ error: "Formato não suportado" }, { status: 400 })
        } else {
            return NextResponse.json({ error: "Nenhum dado ou arquivo enviado" }, { status: 400 })
        }
        return NextResponse.json({ entity, items })
    } catch (error: any) { console.error("Import API error:", error); return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 }) }
}
