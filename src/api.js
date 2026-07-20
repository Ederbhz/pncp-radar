export const PNCP_CONSULTA = 'https://pncp.gov.br/api/consulta/v1'
export const PNCP_APP = 'https://pncp.gov.br/app'

export const MODALIDADES = [
  [1, 'Leilão — Eletrônico'],
  [2, 'Diálogo Competitivo'],
  [3, 'Concurso'],
  [4, 'Concorrência — Eletrônica'],
  [5, 'Concorrência — Presencial'],
  [6, 'Pregão — Eletrônico'],
  [7, 'Pregão — Presencial'],
  [8, 'Dispensa de Licitação'],
  [9, 'Inexigibilidade'],
  [10, 'Manifestação de Interesse'],
  [11, 'Pré-qualificação'],
  [12, 'Credenciamento'],
  [13, 'Leilão — Presencial'],
]

const compactDate = (date) => date.replaceAll('-', '')

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
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) {
    let detail = ''
    try { detail = (await response.json())?.message || '' } catch { /* resposta não JSON */ }
    throw new Error(detail || `A fonte de dados respondeu com o código ${response.status}.`)
  }
  return response.json()
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
    tamanhoPagina: '20',
  })
  return getJson(`${PNCP_CONSULTA}/contratacoes/publicacao?${query}`, signal)
}

export async function fetchContractPage({ from, to, page, signal }) {
  const query = new URLSearchParams({
    dataInicial: compactDate(from),
    dataFinal: compactDate(to),
    pagina: String(page),
    tamanhoPagina: '50',
  })
  return getJson(`${PNCP_CONSULTA}/contratos?${query}`, signal)
}

export function contractStatus(item, now = new Date()) {
  const start = item.dataVigenciaInicio ? new Date(`${item.dataVigenciaInicio}T00:00:00`) : null
  const end = item.dataVigenciaFim ? new Date(`${item.dataVigenciaFim}T23:59:59`) : null
  if (start && start > now) return 'futuro'
  if (end && end < now) return 'inativo'
  return 'ativo'
}

export function pncpUrl(item, kind) {
  const cnpj = item.orgaoEntidade?.cnpj
  if (kind === 'contrato') return `${PNCP_APP}/contratos/${cnpj}/${item.anoContrato}/${String(item.sequencialContrato).padStart(6, '0')}`
  return `${PNCP_APP}/editais/${cnpj}/${item.anoCompra}/${item.sequencialCompra}`
}
