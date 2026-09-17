const PDF_TYPE = 'application/pdf'

export function isSupportedDecalFile(file: Pick<File, 'name' | 'type'>) {
  return file.type.startsWith('image/') || file.type === PDF_TYPE || file.name.toLowerCase().endsWith('.pdf')
}

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

export async function decalFileToDataUrl(file: File) {
  if (!isSupportedDecalFile(file)) throw new Error('不支持的贴图文件')
  if (file.type !== PDF_TYPE && !file.name.toLowerCase().endsWith('.pdf')) return readAsDataUrl(file)

  const [{ GlobalWorkerOptions, getDocument }, { default: pdfWorkerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const pdfDocument = await task.promise
  try {
    const page = await pdfDocument.getPage(1)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.min(4, 2048 / Math.max(baseViewport.width, baseViewport.height))
    const viewport = page.getViewport({ scale })
    const canvas = window.document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(viewport.width))
    canvas.height = Math.max(1, Math.ceil(viewport.height))
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('浏览器无法转换 PDF 贴图')
    await page.render({ canvas, canvasContext: context, viewport }).promise
    return canvas.toDataURL('image/png')
  } finally {
    await task.destroy()
  }
}
