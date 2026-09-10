import type { GlassStudioProjectV1 } from '../types'
import { projectWithoutSecrets, validateProject } from './project'

const DB_NAME = 'glass-studio'
const STORE_NAME = 'drafts'
const DRAFT_KEY = 'latest'

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开本地工程库'))
  })
}

export async function saveDraft(project: GlassStudioProjectV1) {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(projectWithoutSecrets(project), DRAFT_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('自动保存失败'))
    })
  } finally {
    database.close()
  }
}

export async function loadDraft() {
  const database = await openDatabase()
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(DRAFT_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('草稿读取失败'))
    })
    return value ? validateProject(value) : null
  } finally {
    database.close()
  }
}
