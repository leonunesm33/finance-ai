import { api } from '@/lib/api'

/**
 * Baixa um arquivo de um endpoint autenticado (axios envia o header
 * Authorization) e dispara o download no browser via Object URL.
 */
export async function downloadFile(
  url: string,
  filename: string,
  params?: Record<string, string | number | undefined>,
): Promise<void> {
  const response = await api.get<Blob>(url, { params, responseType: 'blob' })
  const blobUrl = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  link.click()
  URL.revokeObjectURL(blobUrl)
}
