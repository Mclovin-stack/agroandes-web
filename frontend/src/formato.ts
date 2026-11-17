const f0 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const f1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f2 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const conGuion = (f: Intl.NumberFormat) => (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? '–' : f.format(n).replace('-', '−')

export const n0 = conGuion(f0)
export const n1 = conGuion(f1)
export const n2 = conGuion(f2)
