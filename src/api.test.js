import { describe, expect, it } from 'vitest'
import { classifyObject, contractStatus, isValidCnpj, onlyDigits, rollingYearRange } from './api.js'

describe('utilitários de consulta', () => {
  it('normaliza e valida CNPJ', () => {
    expect(onlyDigits('11.768.319/0001-88')).toBe('11768319000188')
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
})
