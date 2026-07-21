import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Building2, CalendarDays, CheckCircle2, Clock3,
  CircleDollarSign, ExternalLink, FileSearch, Landmark, LoaderCircle, MapPin,
  Radar, Search, ShieldCheck, Target, X, Zap,
} from 'lucide-react'
import {
  TOPIC_CATEGORIES, classifyObject, contractStatus, fetchCnpj,
  fetchMunicipalContracts, fetchProcessAwardees, fetchSupplierContracts, findSimilarContracts, isValidCnpj, loadMunicipios,
  mapSearchContract, normalizeText, onlyDigits, pncpUrl, rollingYearRange, summarizeSuppliers,
} from './api.js'

const today = new Date()
const period = rollingYearRange(today)
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })

function formatDate(value) {
  if (!value) return 'Não informado'
  return dateFmt.format(new Date(`${value.slice(0, 10)}T12:00:00Z`))
}

function formatCnpj(value) {
  const d = onlyDigits(value)
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : value
}

function Status({ value }) {
  const labels = { ativo: 'Ativo', inativo: 'Encerrado', futuro: 'Vigência futura', aberto: 'Em andamento' }
  return <span className={`status status--${value}`}><span />{labels[value] || value}</span>
}

function EmptyState({ searchType }) {
  return (
    <section className="empty-state">
      <div className="empty-state__art" aria-hidden="true">
        <Radar size={42} strokeWidth={1.35} />
        <i /><i /><i />
      </div>
      <div>
        <p className="eyebrow">Pronto para investigar</p>
        <h2>{searchType === 'municipio' ? 'Encontre processos e contratos do seu município' : 'Mapeie contratos de uma empresa'}</h2>
        <p>Escolha categorias, refine por palavras e consulte os registros publicados nos últimos 12 meses.</p>
      </div>
      <div className="empty-state__steps">
        <span><b>01</b> Informe a busca</span>
        <span><b>02</b> Refine o período</span>
        <span><b>03</b> Abra o processo</span>
      </div>
    </section>
  )
}

function contractDeadline(item) {
  if (!item.dataVigenciaFim) return 'Término não informado'
  const days = Math.ceil((new Date(`${item.dataVigenciaFim}T23:59:59`) - new Date()) / 86400000)
  if (days >= 0) return `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}`
  return `Encerrado há ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'}`
}

function ObjectRadar({ item, matches }) {
  const [awardees, setAwardees] = useState(null)
  const [awardLoading, setAwardLoading] = useState(false)
  const [awardError, setAwardError] = useState('')
  const companies = new Set(matches.map(({ contract }) => onlyDigits(contract.niFornecedor) || contract.nomeRazaoSocialFornecedor)).size

  async function loadAwardees() {
    setAwardLoading(true)
    setAwardError('')
    try { setAwardees(await fetchProcessAwardees(item)) }
    catch { setAwardError('Não foi possível consultar os resultados deste edital agora.') }
    finally { setAwardLoading(false) }
  }

  return (
    <div className="object-radar">
      <div className="object-radar__heading"><span><Target size={15} /><b>Raio-X do objeto</b></span><small>{matches.length ? `${companies} ${companies === 1 ? 'empresa relacionada' : 'empresas relacionadas'}` : 'Sem contrato semelhante no recorte'}</small></div>
      {matches.map(({ contract, score, sharedTerms }) => {
        const active = contractStatus(contract) === 'ativo'
        return (
          <div className="object-radar__match" key={contract.numeroControlePNCP}>
            <div><small>{active ? 'Possível prestador atual' : 'Fornecedor anterior'}</small><strong>{contract.nomeRazaoSocialFornecedor || 'Fornecedor não informado'}</strong><span>{formatCnpj(contract.niFornecedor)} · {score}% semelhante · termos: {sharedTerms.slice(0, 3).join(', ')}</span></div>
            <div className="object-radar__numbers"><b>{money.format(contract.valorGlobal ?? contract.valorInicial ?? 0)}</b><span><Clock3 size={11} /> {contractDeadline(contract)}</span></div>
            <a href={pncpUrl(contract, 'contrato')} target="_blank" rel="noreferrer" aria-label="Abrir contrato semelhante no PNCP"><ExternalLink size={14} /></a>
          </div>
        )
      })}
      {!matches.length && !awardees && <p>Nenhum contrato formal semelhante foi identificado. O resultado do edital pode, porém, informar empresas vencedoras.</p>}
      {awardees?.companies.map((company) => <div className="object-radar__awardee" key={company.cnpj || company.name}><div><small>Fornecedor homologado</small><strong>{company.name}</strong><span>{company.cnpj ? formatCnpj(company.cnpj) : 'Documento não informado'} · {company.items} {company.items === 1 ? 'item' : 'itens'} · {company.size || 'porte não informado'}</span></div><b>{money.format(company.value)}</b></div>)}
      {awardees && !awardees.companies.length && <p>O PNCP não informou fornecedor homologado nos itens verificados deste edital.</p>}
      {awardees && !awardees.complete && <p>Cobertura parcial: {awardees.checkedItems} de {awardees.resultItems} itens com resultado foram verificados.</p>}
      {awardError && <p className="object-radar__error">{awardError}</p>}
      {!awardees && <button type="button" className="object-radar__load" disabled={awardLoading} onClick={loadAwardees}>{awardLoading ? <LoaderCircle className="spin" size={13} /> : <Building2 size={13} />}{awardLoading ? 'Consultando empresas…' : 'Mostrar empresas vencedoras'}</button>}
      {matches.length > 0 && <p>Contratos relacionados por similaridade textual. Confirme os detalhes nos registros oficiais.</p>}
    </div>
  )
}

function ResultCard({ item, matches = [] }) {
  const isContract = item._kind !== 'processo'
  const status = isContract ? contractStatus(item) : new Date(item.dataEncerramentoProposta || 0) >= new Date() ? 'aberto' : 'inativo'
  const value = isContract ? (item.valorGlobal ?? item.valorInicial) : (item.valorTotalHomologado ?? item.valorTotalEstimado)
  const title = isContract ? item.objetoContrato : item.objetoCompra
  const org = item.orgaoEntidade?.razaoSocial || 'Órgão não informado'
  const topics = classifyObject(title)

  return (
    <article className="result-card">
      <div className="result-card__top">
        <Status value={status} />
        <span className="result-card__id">{item.numeroControlePNCP || 'Identificador indisponível'}</span>
      </div>
      <h3>{title || 'Objeto não informado pelo órgão'}</h3>
      {topics.length > 0 && <div className="result-card__topics">{topics.slice(0, 3).map((topic) => <span key={topic.id} title={`Identificado por: ${topic.matches.join(', ')}`}><b>{topic.name}</b> · {topic.matches.slice(0, 2).join(', ')}</span>)}</div>}
      <div className="result-card__org">
        <Landmark size={16} />
        <span><strong>{org}</strong><small>{item.unidadeOrgao?.municipioNome} · {item.unidadeOrgao?.ufSigla}</small></span>
      </div>
      {!isContract && <ObjectRadar item={item} matches={matches} />}
      <dl className="result-card__facts">
        <div><dt>Valor</dt><dd>{value == null ? 'Não informado' : money.format(value)}</dd></div>
        <div><dt>{isContract ? 'Vigência' : 'Publicação'}</dt><dd>{isContract ? `${formatDate(item.dataVigenciaInicio)} — ${formatDate(item.dataVigenciaFim)}` : formatDate(item.dataPublicacaoPncp)}</dd></div>
        <div><dt>{isContract ? 'Fornecedor' : 'Modalidade'}</dt><dd>{isContract ? (item.nomeRazaoSocialFornecedor || 'Não informado') : item.modalidadeNome}</dd></div>
      </dl>
      <div className="result-card__bottom">
        <span>Processo {item.processo || 'não informado'}</span>
        <a href={pncpUrl(item, isContract ? 'contrato' : 'contratacao')} target="_blank" rel="noreferrer">Ver no PNCP <ExternalLink size={14} /></a>
      </div>
    </article>
  )
}

function CompaniesPanel({ companies }) {
  const [showAll, setShowAll] = useState(false)
  if (!companies.length) return null
  const visible = showAll ? companies : companies.slice(0, 12)
  return (
    <section className="companies-panel">
      <div className="companies-panel__heading">
        <div><p className="eyebrow"><Building2 size={14} /> Empresas contratadas</p><h3>{companies.length} {companies.length === 1 ? 'empresa identificada' : 'empresas identificadas'}</h3></div>
        <small>Somente contratos formalizados no período e nos filtros selecionados.</small>
      </div>
      <div className="companies-grid">
        {visible.map((company) => (
          <article className="company-card" key={company.cnpj || company.name}>
            <div className="company-card__icon"><Building2 size={18} /></div>
            <div className="company-card__body">
              <strong>{company.name}</strong>
              <span>{company.cnpj ? formatCnpj(company.cnpj) : 'CNPJ não informado'}</span>
              <div><b>{company.contracts} {company.contracts === 1 ? 'contrato' : 'contratos'}</b><span>{company.active} ativos · {company.inactive} encerrados</span></div>
            </div>
            <b className="company-card__value">{money.format(company.value)}</b>
          </article>
        ))}
      </div>
      {companies.length > 12 && <button type="button" className="companies-panel__more" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Mostrar menos' : `Ver todas as ${companies.length} empresas`}</button>}
    </section>
  )
}

export default function App() {
  const [searchType, setSearchType] = useState('municipio')
  const [municipios, setMunicipios] = useState([])
  const [municipioQuery, setMunicipioQuery] = useState('')
  const [selectedMunicipio, setSelectedMunicipio] = useState(null)
  const [cnpj, setCnpj] = useState('')
  const [company, setCompany] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [situation, setSituation] = useState('todos')
  const [selectedTopics, setSelectedTopics] = useState([])
  const [results, setResults] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const abortRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    loadMunicipios(controller.signal).then(setMunicipios).catch(() => {})
    return () => controller.abort()
  }, [])

  const suggestions = useMemo(() => {
    const q = municipioQuery.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    if (q.length < 2) return []
    return municipios.filter((m) => `${m.nome} ${m.uf}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q)).slice(0, 7)
  }, [municipioQuery, municipios])

  function resetSearch(type) {
    abortRef.current?.abort()
    setSearchType(type)
    setResults([])
    setMeta(null)
    setError('')
    setCompany(null)
    setPage(1)
  }

  function selectMunicipio(item) {
    setSelectedMunicipio(item)
    setMunicipioQuery(`${item.nome} — ${item.uf}`)
    setShowSuggestions(false)
  }

  function toggleTopic(id) {
    setSelectedTopics((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function validate() {
    if (searchType === 'municipio' && !selectedMunicipio) return 'Selecione um município na lista de sugestões.'
    if (searchType === 'cnpj' && !isValidCnpj(cnpj)) return 'Digite um CNPJ válido com 14 dígitos.'
    return ''
  }

  function filterResults(items) {
    const term = normalizeText(keyword.trim())
    return items.filter((item) => {
      const isContract = item._kind !== 'processo'
      const objectText = isContract ? item.objetoContrato : item.objetoCompra
      const object = normalizeText(objectText || '')
      if (term && !object.includes(term)) return false
      const categories = classifyObject(objectText || '').map((category) => category.id)
      if (selectedTopics.length && !selectedTopics.some((id) => categories.includes(id))) return false
      if (situation !== 'todos' && !isContract) return false
      const status = isContract ? contractStatus(item) : null
      if (situation === 'ativos' && status !== 'ativo') return false
      if (situation === 'inativos' && status !== 'inativo') return false
      return true
    })
  }

  async function searchMunicipio() {
    const data = await fetchMunicipalContracts({ municipioId: selectedMunicipio.id, from: period.from, to: period.to, signal: abortRef.current.signal })
    const contracts = (data.data || []).map((item) => ({ ...item, _kind: 'contrato' }))
    const processes = (data.processes || []).map((item) => ({ ...item, _kind: 'processo' }))
    setResults(filterResults([...contracts, ...processes]))
    setPage(1)
    setMeta({ kind: 'municipio', orgaos: data.orgaos, complete: data.complete, contracts: contracts.length, processes: processes.length })
  }

  async function searchCompany(startPage = 1, append = false) {
    const digits = onlyDigits(cnpj)
    let companyData = company
    if (!companyData) {
      try { companyData = await fetchCnpj(digits, abortRef.current.signal); setCompany(companyData) } catch { setCompany({ razao_social: 'CNPJ consultado', cnpj: digits }) }
    }

    const pageSize = 50
    const data = await fetchSupplierContracts({ cnpj: digits, page: startPage, pageSize, signal: abortRef.current.signal })
    const supplierName = companyData?.razao_social || companyData?.nome_fantasia || 'Fornecedor consultado'
    const mapped = (data.items || []).map((item) => mapSearchContract(item, { cnpj: digits, name: supplierName }))
    const inPeriod = mapped.filter((item) => {
      const published = item.dataPublicacaoPncp?.slice(0, 10)
      return published && published >= period.from && published <= period.to
    })
    const filtered = filterResults(inPeriod)
    const totalPages = Math.max(1, Math.ceil((data.total || 0) / pageSize))
    const reachedPeriodStart = mapped.some((item) => item.dataPublicacaoPncp?.slice(0, 10) < period.from)
    setResults((previous) => append ? [...previous, ...filtered] : filtered)
    setMeta({ kind: 'cnpj', total: data.total || 0, totalPages, scanned: startPage, complete: startPage >= totalPages || reachedPeriodStart })
    setPage(startPage)
  }

  async function submit(event, nextPage) {
    event?.preventDefault()
    const validation = validate()
    if (validation) { setError(validation); return }
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError('')
    if (nextPage == null) { setResults([]); setMeta(null); setPage(1); if (searchType === 'cnpj') setCompany(null) }
    try {
      if (searchType === 'municipio') await searchMunicipio()
      else await searchCompany(nextPage || 1, Boolean(nextPage))
    } catch (err) {
      if (err.name !== 'AbortError') setError(`${err.message} Tente novamente em instantes.`)
    } finally { setLoading(false) }
  }

  const totalValue = results.reduce((sum, item) => sum + Number(item.valorGlobal ?? item.valorInicial ?? item.valorTotalHomologado ?? item.valorTotalEstimado ?? 0), 0)
  const contractedCompanies = useMemo(() => searchType === 'municipio' ? summarizeSuppliers(results) : [], [results, searchType])
  const matchesByProcess = useMemo(() => {
    if (searchType !== 'municipio') return new Map()
    const contracts = results.filter((item) => item._kind !== 'processo')
    return new Map(results.filter((item) => item._kind === 'processo').map((process) => [process.numeroControlePNCP, findSimilarContracts(process, contracts)]))
  }, [results, searchType])
  const matchedProcessCount = [...matchesByProcess.values()].filter((matches) => matches.length > 0).length

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Radar PNCP — início"><span><Radar size={21} /></span> RADAR <b>PNCP</b></a>
        <nav><a href="#consulta">Consulta</a><a href="#como-funciona">Como funciona</a><a href="https://pncp.gov.br" target="_blank" rel="noreferrer">Portal oficial <ExternalLink size={13} /></a></nav>
        <span className="source-pill"><i /> Dados oficiais</span>
      </header>

      <main id="top">
        <section className="hero">
          <div>
            <p className="eyebrow"><Zap size={14} /> Inteligência pública, sem ruído</p>
            <h1>Contratos públicos,<br /><em>à vista.</em></h1>
            <p className="hero__lead">Consulte processos e contratos por município ou CNPJ nos últimos 12 meses e filtre pela vigência.</p>
          </div>
          <aside className="hero__signal" aria-label="Benefícios da plataforma">
            <div><ShieldCheck /><span><strong>Fonte primária</strong><small>Dados consultados diretamente no PNCP</small></span></div>
            <div><FileSearch /><span><strong>Rastreável</strong><small>Cada resultado leva ao processo original</small></span></div>
            <div><CheckCircle2 /><span><strong>Transparente</strong><small>Escopo e abrangência sempre visíveis</small></span></div>
          </aside>
        </section>

        <section className="search-panel" id="consulta">
          <div className="search-panel__tabs" role="tablist" aria-label="Tipo de consulta">
            <button className={searchType === 'municipio' ? 'active' : ''} onClick={() => resetSearch('municipio')} role="tab"><MapPin size={18} /> Por município</button>
            <button className={searchType === 'cnpj' ? 'active' : ''} onClick={() => resetSearch('cnpj')} role="tab"><Building2 size={18} /> Por CNPJ fornecedor</button>
          </div>

          <form onSubmit={submit}>
            <div className="topic-field">
              <div><label>Categorias inteligentes</label><small>Selecione uma ou mais. Os contratos podem aparecer em várias categorias.</small></div>
              <div className="topic-chips" role="group" aria-label="Categorias temáticas">
                {TOPIC_CATEGORIES.map((topic) => <button type="button" key={topic.id} className={selectedTopics.includes(topic.id) ? 'topic-chip active' : 'topic-chip'} aria-pressed={selectedTopics.includes(topic.id)} onClick={() => toggleTopic(topic.id)}><span>{selectedTopics.includes(topic.id) ? '✓' : '+'}</span>{topic.name}</button>)}
              </div>
            </div>
            <div className="field field--primary">
              <label>{searchType === 'municipio' ? 'Município' : 'CNPJ da empresa'}</label>
              <div className="input-wrap">
                {searchType === 'municipio' ? <MapPin size={18} /> : <Building2 size={18} />}
                {searchType === 'municipio' ? (
                  <input value={municipioQuery} onChange={(e) => { setMunicipioQuery(e.target.value); setSelectedMunicipio(null); setShowSuggestions(true) }} onFocus={() => setShowSuggestions(true)} placeholder="Ex.: São Paulo, SP" autoComplete="off" />
                ) : (
                  <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" inputMode="numeric" />
                )}
                {municipioQuery && searchType === 'municipio' && <button type="button" className="clear" onClick={() => { setMunicipioQuery(''); setSelectedMunicipio(null) }} aria-label="Limpar município"><X size={16} /></button>}
              </div>
              {searchType === 'municipio' && showSuggestions && suggestions.length > 0 && (
                <div className="suggestions">{suggestions.map((m) => <button type="button" key={m.id} onClick={() => selectMunicipio(m)}><MapPin size={15} /><span>{m.nome}<small>{m.uf} · IBGE {m.id}</small></span></button>)}</div>
              )}
            </div>
            <div className="field">
              <label>Refinar por palavras</label>
              <div className="input-wrap"><FileSearch size={18} /><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Ex.: prontuário eletrônico" /></div>
            </div>
            <div className="field">
              <label>Situação do contrato</label>
              <div className="input-wrap"><ShieldCheck size={18} /><select value={situation} onChange={(e) => setSituation(e.target.value)}><option value="todos">Todos</option><option value="ativos">Somente ativos</option><option value="inativos">Somente inativos</option></select></div>
            </div>
            <button className="search-button" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <Search />}<span>{loading ? 'Consultando…' : 'Consultar PNCP'}</span><ArrowRight size={18} /></button>
          </form>
          {error && <div className="error" role="alert">{error}</div>}
          <p className="search-panel__note"><ShieldCheck size={14} /> Nenhum dado é alterado ou armazenado. Consulta pública, direta e auditável.</p>
        </section>

        <section className="results" aria-live="polite">
          {!meta && !loading && <EmptyState searchType={searchType} />}
          {loading && !meta && <div className="loading-state"><LoaderCircle className="spin" /><strong>Consultando as bases oficiais</strong><span>Isso pode levar alguns segundos.</span></div>}
          {meta && (
            <>
              <div className="results__heading">
                <div><p className="eyebrow">Resultado da consulta</p><h2>{searchType === 'municipio' ? selectedMunicipio?.nome : company?.razao_social}</h2><p>{searchType === 'municipio' ? `${selectedMunicipio?.uf} · período móvel de 12 meses` : `${formatCnpj(cnpj)} · período móvel de 12 meses`}</p></div>
                <div className="coverage"><i className={meta.complete ? 'done' : ''} /><span><strong>{meta.kind === 'municipio' ? `${meta.processes} processos · ${meta.contracts} contratos` : `${meta.scanned} de ${meta.totalPages.toLocaleString('pt-BR')} páginas verificadas`}</strong><small>{!meta.complete ? 'Cobertura parcial — limites da API do PNCP' : 'Cobertura da fonte concluída'}</small></span></div>
              </div>
              <div className="metrics">
                <div><FileSearch /><span><small>Encontrados nesta tela</small><strong>{results.length}</strong></span></div>
                <div><CircleDollarSign /><span><small>Valor somado</small><strong>{money.format(totalValue)}</strong></span></div>
                {meta.kind === 'municipio' && <div><Target /><span><small>Editais com contrato semelhante</small><strong>{matchedProcessCount}</strong></span></div>}
                <div><CalendarDays /><span><small>Período consultado</small><strong>{formatDate(period.from)} — {formatDate(period.to)}</strong></span></div>
              </div>
              {meta.kind === 'municipio' && <CompaniesPanel companies={contractedCompanies} />}
              {results.length ? <div className="results__grid">{results.map((item, index) => <ResultCard key={`${item.numeroControlePNCP}-${index}`} item={item} matches={matchesByProcess.get(item.numeroControlePNCP) || []} />)}</div> : <div className="no-results"><FileSearch size={30} /><h3>Nenhum contrato corresponde aos filtros</h3><p>{!meta.complete ? 'Ainda há dados não verificados na fonte. Continue a varredura quando a opção estiver disponível.' : 'Tente outra palavra ou selecione Todos na situação.'}</p></div>}
              <div className="pagination">
                {meta.kind === 'municipio' ? (
                  <span>Em “Todos”, são exibidos processos e contratos. Ativos/Inativos mostram somente contratos pela vigência.</span>
                ) : (
                  <><span>Busca direta pelo CNPJ no índice público do PNCP, limitada ao período móvel de 12 meses.</span><button className="continue" disabled={meta.complete || loading} onClick={(e) => submit(e, page + 1)}>{loading ? <LoaderCircle className="spin" /> : <Radar />} Carregar próxima página</button></>
                )}
              </div>
            </>
          )}
        </section>

        <section className="how" id="como-funciona">
          <p className="eyebrow">Como funciona</p><h2>Da fonte pública à resposta útil.</h2>
          <div><article><span>01</span><h3>Você define o recorte</h3><p>Município ou CNPJ, categorias, palavras e situação do contrato.</p></article><article><span>02</span><h3>O radar consulta</h3><p>Processos e contratos publicados entre {formatDate(period.from)} e {formatDate(period.to)}.</p></article><article><span>03</span><h3>Você audita</h3><p>Valores, vigências e links oficiais ficam organizados em uma só leitura.</p></article></div>
        </section>
      </main>
      <footer><a className="brand" href="#top"><span><Radar size={18} /></span> RADAR <b>PNCP</b></a><p>Ferramenta independente. Dados de responsabilidade dos órgãos publicadores.</p><a href="https://pncp.gov.br" target="_blank" rel="noreferrer">Fonte: Portal Nacional de Contratações Públicas <ExternalLink size={13} /></a></footer>
    </div>
  )
}
