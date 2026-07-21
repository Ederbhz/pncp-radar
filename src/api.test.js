import { describe, expect, it } from 'vitest'
import { classifyObject, contractStatus, isValidCnpj, mapSearchContract, onlyDigits, rollingYearRange, summarizeSuppliers } from './api.js'

describe('utilitários de consulta', () => {
  it('normaliza e valida CNPJ', () => {
    expect(onlyDigits('11.768.319/0001-88')).toBe('11768319000188')
    expect(onlyDigits(null)).toBe('')
    expect(onlyDigits(undefined)).toBe('')
    expect(isValidCnpj('11.768.319/0001-88')).toBe(true)
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false)
  })

  it('calcula a situação pela vigência', () => {
    const now = new Date('2026-07-20T12:00:00')
    expect(contractStatus({ dataVigenciaInicio: '2026-01-01', dataVigenciaFim: '2026-12-31' }, now)).toBe('ativo')
    expect(contractStatus({ dataVigenciaFim: '2025-12-31' }, now)).toBe('inativo')
    expect(contractStatus({ dataVigenciaInicio: '2027-01-01' }, now)).toBe('futuro')
  })

  it('consulta os doze meses anteriores até a data atual', () => {
    expect(rollingYearRange(new Date('2026-07-20T12:00:00'))).toEqual({
      from: '2025-07-20',
      to: '2026-07-20',
    })
  })

  it('classifica objetos em categorias temáticas e registra os termos', () => {
    const categories = classifyObject('Licença de uso de software hospitalar em nuvem')
    expect(categories.map((item) => item.id)).toEqual(['saude', 'software'])
    expect(categories.find((item) => item.id === 'software').matches).toContain('software')
    expect(classifyObject('Serviço de cobrança bancária')).toEqual([])
  })

  it('agrupa empresas contratadas e soma contratos e valores', () => {
    const companies = summarizeSuppliers([
      { _kind: 'contrato', niFornecedor: '12.345.678/0001-90', nomeRazaoSocialFornecedor: 'Empresa Teste', valorGlobal: 100, dataVigenciaFim: '2027-01-01' },
      { _kind: 'contrato', niFornecedor: '12345678000190', nomeRazaoSocialFornecedor: 'Empresa Teste', valorInicial: 50, dataVigenciaFim: '2025-01-01' },
      { _kind: 'processo', objetoCompra: 'Não deve entrar' },
    ], new Date('2026-07-20T12:00:00'))
    expect(companies).toEqual([{ cnpj: '12345678000190', name: 'Empresa Teste', contracts: 2, active: 1, inactive: 1, future: 0, value: 150 }])
  })

  it('converte o resultado do índice de pesquisa em contrato', () => {
    const contract = mapSearchContract({
      item_url: '/contratos/18558080000160/2026/30',
      numero_controle_pncp: '18558080000160-2-000030/2026',
      description: 'Licenciamento de sistema de saúde',
      valor_global: 50000,
      data_inicio_vigencia: '2026-06-12',
      data_fim_vigencia: '2027-06-12',
      data_publicacao_pncp: '2026-06-22T09:16:40',
      ano: '2026',
      numero_sequencial: '30',
      orgao_cnpj: '18558080000160',
      orgao_nome: 'MUNICIPIO DE ROCHEDO DE MINAS',
      municipio_nome: 'Rochedo de Minas',
      uf: 'MG',
    }, { cnpj: '03.381.389/0001-50', name: 'Empresa Teste' })
    expect(contract.niFornecedor).toBe('03381389000150')
    expect(contract.nomeRazaoSocialFornecedor).toBe('Empresa Teste')
    expect(contract.objetoContrato).toBe('Licenciamento de sistema de saúde')
    expect(contract._pncpPath).toBe('/contratos/18558080000160/2026/30')
  })
})
