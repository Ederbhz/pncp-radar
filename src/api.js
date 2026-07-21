export const PNCP_CONSULTA = 'https://pncp.gov.br/api/consulta/v1'
export const PNCP_APP = 'https://pncp.gov.br/app'
export const PNCP_SEARCH = 'https://pncp.gov.br/api/search'

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

const OBJECT_STOP_WORDS = new Set([
  'aquisicao', 'contratacao', 'empresa', 'especializada', 'fornecimento', 'prestacao',
  'servico', 'servicos', 'municipio', 'municipal', 'secretaria', 'atendimento', 'necessidade',
  'necessidades', 'conforme', 'condicoes', 'estabelecidas', 'objeto', 'presente', 'eventual',
  'futura', 'incluindo', 'diversas', 'diversos', 'para', 'pela', 'pelo', 'com', 'sem', 'das',
  'dos', 'uma', 'que', 'nos', 'nas', 'sua', 'suas', 'seu', 'seus', 'por', 'uso', 'licitanet',
  'especificacoes', 'contidas', 'termo', 'referencia', 'planilha', 'orcamentaria', 'cronograma',
  'fisico', 'financeiro', 'atraves',
])

function objectTokens(value = '') {
  return [...new Set(normalizeText(value).split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !OBJECT_STOP_WORDS.has(word)))]
}

export function objectSimilarity(left = '', right = '') {
  const leftTokens = objectTokens(left)
  const rightTokens = objectTokens(right)
  if (!leftTokens.length || !rightTokens.length) return { score: 0, sharedTerms: [], sharedCategories: [] }
  const rightSet = new Set(rightTokens)
  const sharedTerms = leftTokens.filter((token) => rightSet.has(token))
  const union = new Set([...leftTokens, ...rightTokens]).size
  const containment = sharedTerms.length / Math.min(leftTokens.length, rightTokens.length)
  const jaccard = sharedTerms.length / union
  const leftCategories = classifyObject(left).map((category) => category.id)
  const rightCategories = new Set(classifyObject(right).map((category) => category.id))
  const sharedCategories = leftCategories.filter((category) => rightCategories.has(category))
  const categoryScore = sharedCategories.length ? 1 : 0
  const score = Math.round((containment * 0.65 + jaccard * 0.25 + categoryScore * 0.10) * 100)
  return { score, sharedTerms, sharedCategories }
}

export function findSimilarContracts(process, contracts, now = new Date(), limit = 3) {
  return contracts
    .map((contract) => ({ contract, ...objectSimilarity(process.objetoCompra, contract.objetoContrato) }))
    .filter((match) => match.score >= 25 && match.sharedTerms.length >= 2)
    .sort((a, b) => {
      const activeDifference = Number(contractStatus(b.contract, now) === 'ativo') - Number(contractStatus(a.contract, now) === 'ativo')
      return activeDifference || b.score - a.score
    })
    .slice(0, limit)
}

const compactDate = (date) => date.replaceAll('-', '')

export function rollingYearRange(now = new Date()) {
  const format = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  return { from: format(fromDate), to: format(now) }
}

export function onlyDigits(value = '') {
  return String(value ?? '').replace(/\D/g, '')
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

export async function fetchSupplierContracts({ cnpj, page = 1, pageSize = 50, signal }) {
  const query = new URLSearchParams({
    q: onlyDigits(cnpj),
    tipos_documento: 'contrato',
    ordenacao: '-data',
    pagina: String(page),
    tam_pagina: String(pageSize),
    status: 'todos',
  })
  return getJson(`${PNCP_SEARCH}/?${query}`, signal)
}

export function mapSearchContract(item, supplier = {}) {
  return {
    _kind: 'contrato',
    _pncpPath: item.item_url,
    numeroControlePNCP: item.numero_controle_pncp,
    objetoContrato: item.description,
    valorGlobal: item.valor_global,
    dataVigenciaInicio: item.data_inicio_vigencia,
    dataVigenciaFim: item.data_fim_vigencia,
    dataPublicacaoPncp: item.data_publicacao_pncp,
    nomeRazaoSocialFornecedor: supplier.name || 'Fornecedor consultado',
    niFornecedor: onlyDigits(supplier.cnpj),
    anoContrato: Number(item.ano),
    sequencialContrato: Number(item.numero_sequencial),
    processo: item.title,
    modalidadeNome: item.modalidade_licitacao_nome,
    orgaoEntidade: { cnpj: item.orgao_cnpj, razaoSocial: item.orgao_nome },
    unidadeOrgao: { municipioNome: item.municipio_nome, ufSigla: item.uf },
  }
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
  if (item._pncpPath) return `${PNCP_APP}${item._pncpPath}`
  const cnpj = item.orgaoEntidade?.cnpj
  if (kind === 'contrato') return `${PNCP_APP}/contratos/${cnpj}/${item.anoContrato}/${String(item.sequencialContrato).padStart(6, '0')}`
  return `${PNCP_APP}/editais/${cnpj}/${item.anoCompra}/${item.sequencialCompra}`
}
