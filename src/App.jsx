import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Building2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  CircleDollarSign, ExternalLink, FileSearch, Landmark, LoaderCircle, MapPin,
  Radar, Search, ShieldCheck, SlidersHorizontal, X, Zap,
} from 'lucide-react'
import {
  MODALIDADES, contractStatus, fetchCnpj, fetchContratacoes, fetchContractPage,
  isValidCnpj, loadMunicipios, onlyDigits, pncpUrl,
} from './api.js'

const today = new Date()
const iso = (date) => date.toISOString().slice(0, 10)
const initialFrom = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
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
        <h2>{searchType === 'municipio' ? 'Encontre processos publicados no seu município' : 'Mapeie contratos de uma empresa'}</h2>
        <p>Defina os filtros acima. Os resultados vêm das fontes públicas oficiais e incluem links de auditoria no PNCP.</p>
      </div>
      <div className="empty-state__steps">
        <span><b>01</b> Informe a busca</span>
        <span><b>02</b> Refine o período</span>
        <span><b>03</b> Abra o processo</span>
      </div>
    </section>
  )
}

function ResultCard({ item, kind }) {
  const isContract = kind === 'contrato'
  const status = isContract
    ? contractStatus(item)
    : new Date(item.dataEncerramentoProposta || 0) >= new Date() ? 'aberto' : 'inativo'
  const value = isContract ? (item.valorGlobal ?? item.valorInicial) : (item.valorTotalHomologado ?? item.valorTotalEstimado)
  const title = isContract ? item.objetoContrato : item.objetoCompra
  const org = item.orgaoEntidade?.razaoSocial || 'Órgão não informado'

  return (
    <article className="result-card">
      <div className="result-card__top">
        <Status value={status} />
        <span className="result-card__id">{item.numeroControlePNCP || 'Identificador indisponível'}</span>
      </div>
      <h3>{title || 'Objeto não informado pelo órgão'}</h3>
      <div className="result-card__org">
        <Landmark size={16} />
        <span><strong>{org}</strong><small>{item.unidadeOrgao?.municipioNome} · {item.unidadeOrgao?.ufSigla}</small></span>
      </div>
      <dl className="result-card__facts">
        <div><dt>Valor</dt><dd>{value == null ? 'Não informado' : money.format(value)}</dd></div>
        <div><dt>{isContract ? 'Vigência' : 'Publicação'}</dt><dd>{isContract ? `${formatDate(item.dataVigenciaInicio)} — ${formatDate(item.dataVigenciaFim)}` : formatDate(item.dataPublicacaoPncp)}</dd></div>
        <div><dt>{isContract ? 'Fornecedor' : 'Modalidade'}</dt><dd>{isContract ? (item.nomeRazaoSocialFornecedor || 'Não informado') : item.modalidadeNome}</dd></div>
      </dl>
      <div className="result-card__bottom">
        <span>Processo {item.processo || 'não informado'}</span>
        <a href={pncpUrl(item, kind)} target="_blank" rel="noreferrer">Ver no PNCP <ExternalLink size={14} /></a>
      </div>
    </article>
  )
}

export default function App() {
  const [searchType, setSearchType] = useState('municipio')
  const [municipios, setMunicipios] = useState([])
  const [municipioQuery, setMunicipioQuery] = useState('')
  const [selectedMunicipio, setSelectedMunicipio] = useState(null)
  const [cnpj, setCnpj] = useState('')
  const [company, setCompany] = useState(null)
  const [from, setFrom] = useState(iso(initialFrom))
  const [to, setTo] = useState(iso(today))
  const [modalidade, setModalidade] = useState('8')
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

  function validate() {
    if (from > to) return 'A data inicial precisa ser anterior à data final.'
    if ((new Date(to) - new Date(from)) / 86400000 > 365) return 'O PNCP aceita períodos de até 365 dias por consulta.'
    if (searchType === 'municipio' && !selectedMunicipio) return 'Selecione um município na lista de sugestões.'
    if (searchType === 'cnpj' && !isValidCnpj(cnpj)) return 'Digite um CNPJ válido com 14 dígitos.'
    return ''
  }

  async function searchMunicipio(targetPage = 1) {
    const data = await fetchContratacoes({ municipioId: selectedMunicipio.id, modalidade, from, to, page: targetPage, signal: abortRef.current.signal })
    setResults(data.data || [])
    setPage(targetPage)
    setMeta({ kind: 'municipio', total: data.totalRegistros || 0, totalPages: data.totalPaginas || 1, scanned: 1 })
  }

  async function searchCompany(startPage = 1, append = false) {
    const digits = onlyDigits(cnpj)
    let companyData = company
    if (!companyData) {
      try { companyData = await fetchCnpj(digits, abortRef.current.signal); setCompany(companyData) } catch { setCompany({ razao_social: 'CNPJ consultado', cnpj: digits }) }
    }

    const BATCH = 20
    const found = []
    let current = startPage
    let lastScanned = startPage - 1
    let totalPages = 1
    let totalRecords = 0
    for (let count = 0; count < BATCH; count += 1) {
      const data = await fetchContractPage({ from, to, page: current, signal: abortRef.current.signal })
      totalPages = data.totalPaginas || 1
      totalRecords = data.totalRegistros || 0
      found.push(...(data.data || []).filter((item) => [item.niFornecedor, item.niFornecedorSubContratado].some((value) => onlyDigits(value) === digits)))
      lastScanned = current
      if (current >= totalPages) break
      current += 1
    }
    setResults((previous) => append ? [...previous, ...found] : found)
    setMeta({ kind: 'cnpj', total: totalRecords, totalPages, scanned: lastScanned, complete: lastScanned >= totalPages })
    setPage(lastScanned)
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
      if (searchType === 'municipio') await searchMunicipio(nextPage || 1)
      else await searchCompany(nextPage || 1, Boolean(nextPage))
    } catch (err) {
      if (err.name !== 'AbortError') setError(`${err.message} Tente novamente em instantes.`)
    } finally { setLoading(false) }
  }

  const totalValue = results.reduce((sum, item) => sum + Number(item.valorGlobal ?? item.valorInicial ?? item.valorTotalHomologado ?? item.valorTotalEstimado ?? 0), 0)

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
            <p className="hero__lead">Consulte processos por município e investigue a presença de empresas nos contratos publicados no PNCP.</p>
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
            {searchType === 'municipio' && (
              <div className="field">
                <label>Modalidade</label>
                <div className="input-wrap"><SlidersHorizontal size={18} /><select value={modalidade} onChange={(e) => setModalidade(e.target.value)}>{MODALIDADES.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></div>
              </div>
            )}
            <div className="field-group">
              <div className="field"><label>De</label><div className="input-wrap"><CalendarDays size={18} /><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div></div>
              <div className="field"><label>Até</label><div className="input-wrap"><CalendarDays size={18} /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} max={iso(today)} /></div></div>
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
                <div><p className="eyebrow">Resultado da consulta</p><h2>{searchType === 'municipio' ? selectedMunicipio?.nome : company?.razao_social}</h2><p>{searchType === 'municipio' ? `${selectedMunicipio?.uf} · ${MODALIDADES.find(([id]) => String(id) === String(modalidade))?.[1]}` : formatCnpj(cnpj)}</p></div>
                <div className="coverage"><i className={meta.complete || meta.kind === 'municipio' ? 'done' : ''} /><span><strong>{meta.kind === 'municipio' ? `${meta.total} registros no PNCP` : `${meta.scanned} de ${meta.totalPages.toLocaleString('pt-BR')} páginas verificadas`}</strong><small>{meta.kind === 'cnpj' && !meta.complete ? 'Varredura parcial — continue para ampliar' : 'Cobertura do filtro concluída'}</small></span></div>
              </div>
              <div className="metrics">
                <div><FileSearch /><span><small>Encontrados nesta tela</small><strong>{results.length}</strong></span></div>
                <div><CircleDollarSign /><span><small>Valor somado</small><strong>{money.format(totalValue)}</strong></span></div>
                <div><CalendarDays /><span><small>Período consultado</small><strong>{formatDate(from)} — {formatDate(to)}</strong></span></div>
              </div>
              {results.length ? <div className="results__grid">{results.map((item, index) => <ResultCard key={`${item.numeroControlePNCP}-${index}`} item={item} kind={searchType === 'cnpj' ? 'contrato' : 'contratacao'} />)}</div> : <div className="no-results"><FileSearch size={30} /><h3>Nenhum registro correspondente nesta etapa</h3><p>{meta.kind === 'cnpj' && !meta.complete ? 'A empresa pode aparecer em páginas ainda não verificadas. Continue a varredura.' : 'Tente ampliar o período ou escolher outra modalidade.'}</p></div>}
              <div className="pagination">
                {meta.kind === 'municipio' ? (
                  <><button disabled={page <= 1 || loading} onClick={(e) => submit(e, page - 1)}><ChevronLeft /> Anterior</button><span>Página <b>{page}</b> de {meta.totalPages}</span><button disabled={page >= meta.totalPages || loading} onClick={(e) => submit(e, page + 1)}>Próxima <ChevronRight /></button></>
                ) : (
                  <><span>A API não oferece filtro oficial por fornecedor; a verificação é feita registro a registro.</span><button className="continue" disabled={meta.complete || loading} onClick={(e) => submit(e, page + 1)}>{loading ? <LoaderCircle className="spin" /> : <Radar />} Verificar mais 20 páginas</button></>
                )}
              </div>
            </>
          )}
        </section>

        <section className="how" id="como-funciona">
          <p className="eyebrow">Como funciona</p><h2>Da fonte pública à resposta útil.</h2>
          <div><article><span>01</span><h3>Você define o recorte</h3><p>Município, modalidade, CNPJ e período deixam a consulta objetiva.</p></article><article><span>02</span><h3>O radar consulta</h3><p>As requisições vão às APIs públicas do PNCP, IBGE e BrasilAPI.</p></article><article><span>03</span><h3>Você audita</h3><p>Valores, vigências e links oficiais ficam organizados em uma só leitura.</p></article></div>
        </section>
      </main>
      <footer><a className="brand" href="#top"><span><Radar size={18} /></span> RADAR <b>PNCP</b></a><p>Ferramenta independente. Dados de responsabilidade dos órgãos publicadores.</p><a href="https://pncp.gov.br" target="_blank" rel="noreferrer">Fonte: Portal Nacional de Contratações Públicas <ExternalLink size={13} /></a></footer>
    </div>
  )
}
