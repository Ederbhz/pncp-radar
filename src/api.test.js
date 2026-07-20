import { describe, expect, it } from 'vitest'
import { closedYearRange, contractStatus, isValidCnpj, onlyDigits } from './api.js'

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

  it('fixa a consulta no último exercício encerrado', () => {
    expect(closedYearRange(new Date('2026-07-20T12:00:00'))).toEqual({
      year: 2025,
      from: '2025-01-01',
      to: '2025-12-31',
    })
  })
})
