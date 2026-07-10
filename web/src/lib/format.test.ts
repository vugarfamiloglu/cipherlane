import { describe, expect, it } from 'vitest'
import { countdown, fmtInt, fmtRate, fmtRateParts } from './format'

describe('fmtRate', () => {
  it('formats Mbps below 1000', () => {
    expect(fmtRate(123.45)).toBe('123.5 Mbps')
  })
  it('switches to Gbps at 1000+', () => {
    expect(fmtRate(2500)).toBe('2.50 Gbps')
  })
})

describe('fmtRateParts', () => {
  it('splits value and unit', () => {
    expect(fmtRateParts(50)).toEqual({ value: '50.0', unit: 'Mbps' })
  })
  it('uses Gbps for large rates', () => {
    expect(fmtRateParts(3200)).toEqual({ value: '3.20', unit: 'Gbps' })
  })
})

describe('fmtInt', () => {
  it('rounds and groups thousands', () => {
    expect(fmtInt(12345.6)).toBe('12,346')
  })
})

describe('countdown', () => {
  it('formats minutes and seconds', () => {
    expect(countdown(75)).toBe('1m 15s')
  })
  it('formats sub-minute durations', () => {
    expect(countdown(42)).toBe('42s')
  })
  it('clamps negatives to zero', () => {
    expect(countdown(-5)).toBe('0s')
  })
})
