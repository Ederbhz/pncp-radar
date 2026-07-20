export const PNCP_CONSULTA = 'https://pncp.gov.br/api/consulta/v1'
export const PNCP_APP = 'https://pncp.gov.br/app'

export const MODALIDADES = [
  [4, 'Concorrência — Eletrônica'],
  [6, 'Pregão — Eletrônico'],
  [8, 'Dispensa de Licitação'],
  [9, 'Inexigibilidade'],
  [12, 'Credenciamento'],
  [7, 'Pregão — Presencial'],
  [5, 'Concorrência — Presencial'],
  [1, 'Leilão — Eletrônico'],
  [10, 'Manifestação de Interesse'],
  [11, 'Pré-qualificação'],
  [13, 'Leilão — Presencial'],
  [3, 'Concurso'],
  [2, 'Diálogo Competitivo'],
]

export const TOPIC_CATEGORIES = [
  { id: 'saude', name: 'Saúde', terms: ['medicamento', 'hospital', 'medico', 'medica', 'enfermagem', 'laboratorio', 'odontologico', 'odontologia', 'ambulancia', 'saude', 'farmaceutico', 'vacina', 'exame clinico'] },
  { id: 'software', name: 'Software e TI', terms: ['software', 'sistema informatizado', 'licenca de uso', 'saas', 'computacao em nuvem', 'desenvolvimento de sistema', 'tecnologia da informacao', 'suporte tecnico', 'banco de dados', 'servidor de rede', 'seguranca da informacao'] },
  { id: 'educacao', name: 'Educação', terms: ['material escolar', 'escola', 'ensino', 'educacao', 'aluno', 'professor', 'livro didatico', 'merenda escolar', 'uniforme escolar'] },
  { id: 'obras', name: 'Obras e Engenharia', terms: ['obra', 'engenharia', 'construcao', 'reforma', 'pavimentacao', 'manutencao predial', 'infraestrutura', 'drenagem', 'arquitetura'] },
  { id: 'alimentacao', name: 'Alimentação', terms: ['alimento', 'alimentacao', 'genero alimenticio', 'refeicao', 'cesta basica', 'hortifruti', 'carne', 'cozinha'] },
  { id: 'veiculos', name: 'Veículos', terms: ['veiculo', 'automovel', 'caminhao', 'onibus', 'motocicleta', 'combustivel', 'frota', 'locacao de veiculos'] },
  { id: 'limpeza', name: 'Limpeza', terms: ['limpeza', 'higienizacao', 'material de higiene', 'saneante', 'coleta de residuos', 'conservacao predial'] },
  { id: 'seguranca', name: 'Segurança', terms: ['vigilancia', 'seguranca patrimonial', 'monitoramento', 'camera de seguranca', 'controle de acesso', 'alarme', 'equipamento de protecao'] },
]

export function normalizeText(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function classifyObject(value = '') {
  const normalized = normalizeText(value)
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean)
  const padded = ` ${words.join(' ')} `
  const matchesTerm = (term) => {
    const normalizedTerm = normalizeText(term)
    if (normalizedTerm.includes(' ')) return padded.includes(` ${normalizedTerm} `)
    if (normalizedTerm.length <= 4) return words.includes(normalizedTerm)
    return words.some((word) => word.startsWith(normalizedTerm))
  }
  return TOPIC_CATEGORIES.map((category) => ({
    ...category,
    matches: category.terms.filter(matchesTerm),
  })).filter((category) => category.matches.length > 0)
}

const compactDate = (date) => date.replaceAll('-', '')

export function rollingYearRange(now = new Date()) {
  const format = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  return { from: format(fromDate), to: format(now) }
}

export function onlyDigits(value = '') {
  return value.replace(/\D/g, '')
}

export function isValidCnpj(value) {
  const digits = onlyDigits(value)
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false
  const calc = (length) => {
    let factor = length - 7
    let total = 0
    for (let i = 0; i < length; i += 1) {
      total += Number(digits[i]) * factor--
      if (factor < 2) factor = 9
    }
    const result = 11 - (total % 11)
    return result > 9 ? 0 : result
  }
  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13])
}

async function getJson(url, signal) {
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
      if (response.status === 204) return { data: [], totalRegistros: 0, totalPaginas: 0, numeroPagina: 1 }
      if (!response.ok) {
        let detail = ''
        try { detail = (await response.json())?.message || '' } catch { /* resposta não JSON */ }
        const error = new Error(detail || `A fonte de dados respondeu com o código ${response.status}.`)
        error.status = response.status
        if (response.status < 500 && response.status !== 429) throw error
        lastError = error
      } else {
        return response.json()
      }
    } catch (error) {
      if (error.name === 'AbortError') throw error
      if (error.status && error.status < 500 && error.status !== 429) throw error
      lastError = error
    }
    if (attempt < 2) {
      const delay = lastError?.status === 429 ? 1500 * (attempt + 1) : 500 * (attempt + 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

export async function loadMunicipios(signal) {
  const data = await getJson('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome', signal)
  return data.map((item) => ({
    id: String(item.id),
    nome: item.nome,
    uf: item.microrregiao?.mesorregiao?.UF?.sigla || item['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla || '',
  }))
}

export async function fetchCnpj(cnpj, signal) {
  return getJson(`https://brasilapi.com.br/api/cnpj/v1/${onlyDigits(cnpj)}`, signal)
}

export async function fetchContratacoes({ municipioId, modalidade, from, to, page = 1, signal }) {
  const query = new URLSearchParams({
    dataInicial: compactDate(from),
    dataFinal: compactDate(to),
    codigoModalidadeContratacao: String(modalidade),
    codigoMunicipioIbge: String(municipioId),
    pagina: String(page),
    tamanhoPagina: '50',
  })
  return getJson(`${PNCP_CONSULTA}/contratacoes/publicacao?${query}`, signal)
}

export async function fetchContractPage({ from, to, page, cnpjOrgao, signal }) {
  const query = new URLSearchParams({
    dataInicial: compactDate(from),
    dataFinal: compactDate(to),
    pagina: String(page),
    tamanhoPagina: '50',
  })
  if (cnpjOrgao) query.set('cnpjOrgao', cnpjOrgao)
  return getJson(`${PNCP_CONSULTA}/contratos?${query}`, signal)
}

export async function fetchMunicipalContracts({ municipioId, from, to, signal }) {
  const processPages = []
  let discoveryComplete = true
  let consecutiveRateLimits = 0
  const maxPagesPerModality = 10

  // O endpoint oficial exige uma chamada por modalidade. As modalidades mais
  // frequentes vêm primeiro e cada uma é paginada antes da próxima, evitando
  // perder justamente Pregão, Dispensa e Concorrência quando o PNCP limita a taxa.
  for (const [modalidade] of MODALIDADES) {
    try {
      const firstPage = await fetchContratacoes({ municipioId, modalidade, from, to, page: 1, signal })
      consecutiveRateLimits = 0
      processPages.push(firstPage)
      const totalPages = firstPage.totalPaginas || 1
      if (totalPages > maxPagesPerModality) discoveryComplete = false
      for (let page = 2; page <= Math.min(totalPages, maxPagesPerModality); page += 1) {
        try {
          processPages.push(await fetchContratacoes({ municipioId, modalidade, from, to, page, signal }))
        } catch {
          discoveryComplete = false
          break
        }
      }
    } catch (error) {
      discoveryComplete = false
      if (error.status === 429) consecutiveRateLimits += 1
      if (consecutiveRateLimits >= 2) break
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  const processes = [...new Map(processPages.flatMap((page) => page.data || []).map((item) => [item.numeroControlePNCP, item])).values()]
  const cnpjs = [...new Set(processes.map((item) => item.orgaoEntidade?.cnpj).filter(Boolean))]

  const pages = []
  let contractsComplete = true
  for (let index = 0; index < cnpjs.length; index += 5) {
    const batch = cnpjs.slice(index, index + 5)
    const responses = await Promise.allSettled(
      batch.map((cnpjOrgao) => fetchContractPage({ from, to, page: 1, cnpjOrgao, signal })),
    )
    if (responses.some((result) => result.status === 'rejected')) contractsComplete = false
    pages.push(...responses.filter((result) => result.status === 'fulfilled').map((result) => result.value))
  }

  const records = pages
    .flatMap((page) => page.data || [])
    .filter((item) => String(item.unidadeOrgao?.codigoIbge || '') === String(municipioId))
  const unique = [...new Map(records.map((item) => [item.numeroControlePNCP, item])).values()]
  return {
    data: unique,
    processes,
    orgaos: cnpjs.length,
    complete: discoveryComplete && contractsComplete && pages.every((page) => (page.totalPaginas || 1) <= 1),
  }
}

export function contractStatus(item, now = new Date()) {
  const start = item.dataVigenciaInicio ? new Date(`${item.dataVigenciaInicio}T00:00:00`) : null
  const end = item.dataVigenciaFim ? new Date(`${item.dataVigenciaFim}T23:59:59`) : null
  if (start && start > now) return 'futuro'
  if (end && end < now) return 'inativo'
  return 'ativo'
}

export function summarizeSuppliers(items, now = new Date()) {
  const companies = new Map()
  for (const item of items.filter((record) => record._kind !== 'processo')) {
    const cnpj = onlyDigits(item.niFornecedor)
    const name = item.nomeRazaoSocialFornecedor?.trim()
    if (!cnpj && !name) continue
    const key = cnpj || normalizeText(name)
    const current = companies.get(key) || { cnpj, name: name || 'Empresa não informada', contracts: 0, active: 0, inactive: 0, future: 0, value: 0 }
    const status = contractStatus(item, now)
    current.contracts += 1
    current[status === 'ativo' ? 'active' : status === 'inativo' ? 'inactive' : 'future'] += 1
    current.value += Number(item.valorGlobal ?? item.valorInicial ?? 0)
    companies.set(key, current)
  }
  return [...companies.values()].sort((a, b) => b.value - a.value || b.contracts - a.contracts || a.name.localeCompare(b.name, 'pt-BR'))
}

export function pncpUrl(item, kind) {
  const cnpj = item.orgaoEntidade?.cnpj
  if (kind === 'contrato') return `${PNCP_APP}/contratos/${cnpj}/${item.anoContrato}/${String(item.sequencialContrato).padStart(6, '0')}`
  return `${PNCP_APP}/editais/${cnpj}/${item.anoCompra}/${item.sequencialCompra}`
}
