export type TokenType = 'CELL_REF' | 'EXTERNAL_REF' | 'NUMBER' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'UNKNOWN'

export interface Token {
  type: TokenType
  value: string
}

const CELL_RE = /^[A-Z]+\d+$/
const EXTERNAL_REF_RE = /^(?:\[[^\]]+\])?(?:'[^']+'|[^'!]+)!\$?[A-Z]+\$?\d+$/

/**
 * Tokenize an Excel formula string (with or without leading '=').
 * Supports: cell references, numbers (int/float), arithmetic operators, parentheses.
 */
export function tokenize(formula: string): Token[] {
  const src = formula.startsWith('=') ? formula.slice(1) : formula
  const tokens: Token[] = []
  let i = 0

  while (i < src.length) {
    const ch = src[i]

    // Whitespace
    if (/\s/.test(ch)) { i++; continue }

    // External reference like Sheet2!A1 or [Book.xlsx]Sheet2!A1
    const externalMatch = src.slice(i).match(/^(?:\[[^\]]+\])?(?:'[^']+'|[^'!]+)!\$?[A-Za-z]+\$?\d+/)
    if (externalMatch?.[0]) {
      const rawRef = externalMatch[0]
      tokens.push({
        type: EXTERNAL_REF_RE.test(rawRef) ? 'EXTERNAL_REF' : 'UNKNOWN',
        value: rawRef,
      })
      i += rawRef.length
      continue
    }

    // Cell reference (starts with letter)
    if (/[A-Za-z]/.test(ch)) {
      let ref = ''
      while (i < src.length && /[A-Za-z]/.test(src[i])) ref += src[i++].toUpperCase()
      if (/\d/.test(src[i] ?? '')) {
        while (i < src.length && /\d/.test(src[i])) ref += src[i++]
        if (CELL_RE.test(ref)) {
          tokens.push({ type: 'CELL_REF', value: ref })
          continue
        }
      }
      continue
    }

    // Number (may start with digit; unary minus handled in parser)
    if (/\d/.test(ch) || ch === '.') {
      let num = ''
      while (i < src.length && /[\d.]/.test(src[i])) num += src[i++]
      tokens.push({ type: 'NUMBER', value: num })
      continue
    }

    // Operators
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'OPERATOR', value: ch })
      i++
      continue
    }

    // Parentheses
    if (ch === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue }

    // Dollar signs (absolute refs like $A$1) – strip silently
    if (ch === '$') { i++; continue }

    // Exclamation mark (cross-sheet refs like Sheet2!A1) – skip
    if (ch === '!') { i++; continue }

    // Comma, semicolon (function args) – skip for v0.1
    if (ch === ',' || ch === ';') { i++; continue }

    // Unknown
    tokens.push({ type: 'UNKNOWN', value: ch })
    i++
  }

  return tokens
}
