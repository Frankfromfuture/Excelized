import { useRef, useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react'
import { parseExcelFile } from '../../lib/excel/parseXlsx'
import { buildFlowGraph } from '../../lib/formula/buildGraph'
import { applyDagreLayout } from '../../lib/layout/autoLayout'
import { useFlowStore } from '../../store/flowStore'

export function FileUpload() {
  const [isDragging, setIsDragging] = useState(false)
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 })
  const inputRef = useRef<HTMLInputElement>(null)
  const { isLoading, error, setLoading, setError, setFlowData } = useFlowStore()

  const gridW = 84
  const gridH = 28

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }, [])
  const handleMouseLeave = useCallback(() => {
    setMousePos({ x: -1000, y: -1000 })
  }, [])

  const cellX = Math.floor(mousePos.x / gridW) * gridW
  const cellY = Math.floor(mousePos.y / gridH) * gridH

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setError('请上传 .xlsx 或 .xls 格式的 Excel 文件')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await parseExcelFile(file, '')
      const { nodes: rawNodes, edges } = buildFlowGraph(result.cells)
      const nodes = applyDagreLayout(rawNodes, edges)
      setFlowData(file.name, nodes, edges)
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败，请检查文件格式')
    }
  }, [setLoading, setError, setFlowData])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  return (
    <div 
      className="relative flex items-center justify-center w-full h-screen bg-white overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      
      {/* ── Fluid Background (Antigravity Style) ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* We use darker silver/gray subtle blobs so they are very visible on white background */}
        <div 
          className="absolute top-[0%] left-[0%] w-[40vw] h-[40vw] bg-slate-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60" 
          style={{ animation: 'fluid-blob 10s infinite linear' }} 
        />
        <div 
          className="absolute top-[20%] right-[0%] w-[50vw] h-[50vw] bg-gray-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-60" 
          style={{ animation: 'fluid-blob 14s infinite linear reverse', animationDelay: '-2s' }} 
        />
        <div 
          className="absolute -bottom-[10%] left-[20%] w-[60vw] h-[60vw] bg-zinc-200 rounded-full mix-blend-multiply filter blur-[140px] opacity-70" 
          style={{ animation: 'fluid-blob 18s infinite linear', animationDelay: '-5s' }} 
        />
      </div>

      {/* ── Interactive Spotlight Excel Grid ── */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-0"
        style={{
          opacity: mousePos.x < 0 ? 0 : 0.4,
          maskImage: `radial-gradient(circle 180px at ${mousePos.x}px ${mousePos.y}px, black 10%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(circle 180px at ${mousePos.x}px ${mousePos.y}px, black 10%, transparent 100%)`,
        }}
      >
        <div 
          className="absolute inset-0" 
          style={{ 
            backgroundImage: `
              linear-gradient(to right, #a3a3a3 1px, transparent 1px),
              linear-gradient(to bottom, #a3a3a3 1px, transparent 1px)
            `,
            backgroundSize: `${gridW}px ${gridH}px`
          }} 
        />
      </div>

      {/* ── Quantized Fake Excel Selection Cell ── */}
      <div 
        className="absolute pointer-events-none z-0 border border-[rgba(180,160,210,0.5)] transition-all duration-75 backdrop-blur-[1px]"
        style={{
          width: gridW,
          height: gridH,
          background: 'rgba(224, 206, 239, 0.45)',
          transform: `translate(${cellX}px, ${cellY}px)`,
          top: 0,
          left: 0,
          opacity: mousePos.x < 0 ? 0 : 1,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-10 max-w-3xl w-full px-6">
        
        {/* Title Section */}
        <div className="text-center flex flex-col items-center" style={{ gap: '1.5rem' }}>
          <h1 
            className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-neutral-900"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            Exceling
          </h1>
          <p
            className="text-sm md:text-base text-neutral-400 font-light tracking-[0.18em] italic"
            style={{ fontFamily: "'Space Grotesk', sans-serif", marginTop: '-0.75rem' }}
          >
            Your spreadsheet that flows
          </p>
          <p 
            className="text-xl md:text-2xl text-neutral-500 font-medium tracking-widest"
            style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
          >
            洞察数据脉搏，重现灵感流动
          </p>
        </div>

        {/* Upload Zone CTA */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => !isLoading && inputRef.current?.click()}
          className={[
            'relative w-full max-w-md border rounded-[2.5rem] p-12 cursor-pointer mt-4',
            'transition-all duration-500 text-center select-none backdrop-blur-3xl bg-white/40',
            isDragging
              ? 'border-purple-300 bg-purple-50/60 scale-[1.02] shadow-[0_0_60px_rgba(168,85,247,0.15)]'
              : 'border-neutral-200/80 hover:border-purple-300/60 hover:bg-white/60 hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)]',
            isLoading ? 'pointer-events-none opacity-50 relative overflow-hidden' : '',
          ].join(' ')}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onInputChange} />
          
          <div className="flex flex-col items-center gap-5 relative z-10">
            {isLoading ? (
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
            ) : (
              <div className={[
                'w-16 h-16 rounded-2xl border flex items-center justify-center transition-all duration-500 shadow-sm',
                isDragging ? 'border-purple-200 bg-purple-100' : 'border-neutral-200 bg-white shadow-inner shadow-black/5',
              ].join(' ')}>
                {isDragging
                  ? <FileSpreadsheet className="w-8 h-8 text-purple-600" />
                  : <Upload className="w-8 h-8 text-neutral-600" />}
              </div>
            )}
            <div>
              <p className="text-neutral-800 font-bold text-lg tracking-wide">
                {isLoading ? '正在重塑数据拓扑...' : isDragging ? '释放以注入灵感' : '拖拽或点击上传文件'}
              </p>
              <p className="text-neutral-500 text-sm mt-1.5 font-mono group-hover:text-neutral-600 transition-colors">
                Support .xlsx / .xls
              </p>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="flex gap-3 items-center bg-red-50 border border-red-200 rounded-full px-5 py-2.5 text-sm backdrop-blur-md shadow-sm">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Minimal Instructions */}
        <div className="flex flex-col items-center gap-3 mt-2">
          <p className="text-neutral-500 text-sm tracking-wide text-center">
            提示：在 Excel 中将计算的起始与终点单元格均填充为<span className="text-purple-600 font-semibold px-1">淡紫色</span>，即可自动构建数据的起点与终点拓扑关系
          </p>
          <img 
            src="/color-palette-hint.png" 
            alt="Excel 颜色填充说明" 
            className="w-64 rounded-xl border border-neutral-200/70 shadow-sm opacity-80 hover:opacity-100 transition-opacity duration-300"
          />
        </div>

      </div>
    </div>
  )
}
