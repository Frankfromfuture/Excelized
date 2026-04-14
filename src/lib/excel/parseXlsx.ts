import * as XLSX from 'xlsx'
import { detectPurpleFrame, detectMarkedCells } from './detectPurpleFrame'
import { extractCellData } from './extractCellData'
import type { ParsedCell, FrameRegion } from '../../types'

export interface ParseResult {
  cells: ParsedCell[]
  region: FrameRegion
  sheetName: string
}

/** Parse "A1:C5" or "A1" into a 0-indexed FrameRegion, or null if invalid. */
export function parseRangeString(range: string): FrameRegion | null {
  const clean = range.trim().toUpperCase().replace(/\$/g, '')
  // Accept "A1:C5" or just "A1" (single cell)
  const m = clean.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/)
  if (!m) return null

  const colLetterToIdx = (letters: string) => {
    let n = 0
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n - 1
  }

  const minCol = colLetterToIdx(m[1])
  const minRow = parseInt(m[2]) - 1
  const maxCol = m[3] ? colLetterToIdx(m[3]) : minCol
  const maxRow = m[4] ? parseInt(m[4]) - 1 : minRow

  if (minRow < 0 || minCol < 0) return null
  return {
    minRow: Math.min(minRow, maxRow),
    maxRow: Math.max(minRow, maxRow),
    minCol: Math.min(minCol, maxCol),
    maxCol: Math.max(minCol, maxCol),
  }
}

/**
 * Read an xlsx/xls File and extract cell data.
 * If manualRange is provided (e.g. "B2:D14"), it is used directly instead of
 * purple-frame detection. Purple-fill marked cells are always detected.
 */
export async function parseExcelFile(file: File, manualRange?: string): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()

  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellStyles: true,
    cellFormula: true,
    cellNF: true,
    cellText: true,
  })

  // If a manual range is given, validate it and use the first sheet
  if (manualRange && manualRange.trim()) {
    const region = parseRangeString(manualRange)
    if (!region) {
      throw new Error(`无效的单元格范围："${manualRange}"\n\n请使用 A1:C5 格式（起始单元格:结束单元格）`)
    }
    const sheetName = workbook.SheetNames[0]
    const markedCells = detectMarkedCells(workbook, sheetName, buffer)
    const cells = extractCellData(workbook, sheetName, region, markedCells)
    const meaningful = cells.filter(c => c.value != null || c.formula != null)
    if (meaningful.length === 0) {
      throw new Error(`指定范围 ${manualRange.trim().toUpperCase()} 内没有找到有效数据`)
    }
    return { cells: meaningful, region, sheetName }
  }

  // Otherwise auto-detect by purple frame
  for (const sheetName of workbook.SheetNames) {
    const region = detectPurpleFrame(workbook, sheetName, buffer)
    if (!region) continue

    const markedCells = detectMarkedCells(workbook, sheetName, buffer)
    const cells = extractCellData(workbook, sheetName, region, markedCells)
    const meaningful = cells.filter(c => c.value != null || c.formula != null)
    if (meaningful.length === 0) continue

    return { cells: meaningful, region, sheetName }
  }

  throw new Error(
    '未找到紫色边框区域。\n\n请手动填写单元格范围（如 B2:D14），或确认：\n• 已在 Excel 中用紫色边框圈定单元格\n• 文件已保存为 .xlsx 格式',
  )
}
