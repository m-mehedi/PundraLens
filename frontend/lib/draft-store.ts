"use client"

import { openDB, type DBSchema, type IDBPDatabase } from "idb"

import type { EditOp, NoticeItem } from "@/components/upload-notice/types"

/**
 * The unsaved work, as it is kept in the browser.
 *
 * Only the original file and the edit instructions are stored. The rendered
 * previews are derived, and the `blob:` URLs they use are transient — they
 * cannot be written to IndexedDB and would be useless after a reload
 * anyway.
 */
export interface DraftItem {
  id: string
  label: string
  /** The key of the file in the `files` store. */
  fileKey: string
  sourceWidth: number
  sourceHeight: number
  /** The pending changes, in order. */
  ops: EditOp[]
  /** The four corners, as percentages of the image. */
  points: Array<{ x: number; y: number }>
  autoFilled: boolean[]
  edited: boolean
}

export interface DraftDocument {
  /**
   * The key: `${userId}:${draftId}`.
   *
   * IndexedDB belongs to the browser, not to the person sitting in front of
   * it, so the key has to carry who the work belongs to.
   */
  key: string
  userId: string
  draftId: string
  savedAt: number
  /**
   * True once the draft has been offered to the person it belongs to.
   *
   * The offer is asked once. A draft that has been offered is not asked
   * about again, so the question does not follow anyone around the
   * screen.
   */
  prompted?: boolean
  mode: "images" | "text"
  documentName: string | null
  text: string
  textName: string | null
  items: DraftItem[]
}

interface DraftDatabase extends DBSchema {
  drafts: {
    key: string
    value: DraftDocument
    indexes: { "by-user": string; "by-savedAt": number }
  }
  /** The original files, written once and referenced by the drafts. */
  files: {
    key: string
    value: File
  }
}

const DATABASE_NAME = "pundra-drafts"
const DATABASE_VERSION = 1

/**
 * The connection is opened lazily.
 *
 * A client component is still rendered on the server, and `indexedDB` does
 * not exist there — so the database is never touched at module scope. The
 * promise is cached so a double mount in development does not open two
 * connections.
 */
let connection: Promise<IDBPDatabase<DraftDatabase>> | null = null

function getDatabase(): Promise<IDBPDatabase<DraftDatabase>> {
  connection ??= openDB<DraftDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore("drafts", { keyPath: "key" })
      store.createIndex("by-user", "userId")
      store.createIndex("by-savedAt", "savedAt")
      db.createObjectStore("files")
    },
  })
  return connection
}

export function draftKey(userId: string, draftId: string): string {
  return `${userId}:${draftId}`
}

/** The draft id for this browser and this person. */
export function getDraftId(): string {
  if (typeof window === "undefined") return "server"
  const key = "pundra-draft-id"
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  window.localStorage.setItem(key, created)
  return created
}

/**
 * Write the draft.
 *
 * The files live in their own store so their bytes are written once, not on
 * every autosave — a browser does not always dedupe a blob it has seen
 * before, and a five megabyte PDF is not something to write every second.
 */
export async function saveDraft(
  doc: DraftDocument,
  files: Record<string, File>
): Promise<void> {
  const db = await getDatabase()
  const tx = db.transaction(["drafts", "files"], "readwrite")
  const store = tx.objectStore("files")
  for (const item of doc.items) {
    const file = files[item.fileKey]
    if (!file) continue
    const existing = await store.getKey(item.fileKey)
    if (existing === undefined) {
      await store.put(file, item.fileKey)
    }
  }
  const drafts = tx.objectStore("drafts")
  // The offer is asked once per draft, so the flag survives the autosave.
  const previous = await drafts.get(doc.key)
  await drafts.put({ ...doc, prompted: doc.prompted ?? previous?.prompted })
  await tx.done
}

/** The draft belonging to this person, if there is one. */
export async function loadDraft(
  userId: string,
  draftId: string
): Promise<DraftDocument | undefined> {
  const db = await getDatabase()
  return db.get("drafts", draftKey(userId, draftId))
}

/**
 * Note that the draft has been offered.
 *
 * The question is asked once: a draft that has been offered is not
 * offered again, whether the person answered it or walked away from it.
 */
export async function markDraftPrompted(
  userId: string,
  draftId: string
): Promise<void> {
  const db = await getDatabase()
  const key = draftKey(userId, draftId)
  const doc = await db.get("drafts", key)
  if (!doc || doc.prompted) return
  await db.put("drafts", { ...doc, prompted: true })
}

/** The draft items, with their files put back together. */
export async function readDraftItems(
  doc: DraftDocument
): Promise<Array<DraftItem & { sourceFile: File }>> {
  const db = await getDatabase()
  const tx = db.transaction("files", "readonly")
  const store = tx.store
  const items: Array<DraftItem & { sourceFile: File }> = []
  for (const item of doc.items) {
    const file = await store.get(item.fileKey)
    if (file) items.push({ ...item, sourceFile: file })
  }
  await tx.done
  return items
}

/** Throw the draft away, files and all. */
export async function deleteDraft(
  userId: string,
  draftId: string
): Promise<void> {
  const db = await getDatabase()
  const doc = await db.get("drafts", draftKey(userId, draftId))
  const tx = db.transaction(["drafts", "files"], "readwrite")
  for (const item of doc?.items ?? []) {
    await tx.objectStore("files").delete(item.fileKey)
  }
  await tx.objectStore("drafts").delete(draftKey(userId, draftId))
  await tx.done
}

/**
 * Ask the browser to keep the draft.
 *
 * Chrome grants this silently when the site has been used a lot; Firefox
 * asks. It is called from the file picker, which is a real user gesture —
 * a request on first paint is refused.
 */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false
  }
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Build the record that is written to the database. */
export function toDraft(
  userId: string,
  draftId: string,
  state: {
    mode: "images" | "text"
    documentName: string | null
    text: string
    textName: string | null
    items: NoticeItem[]
  }
): { doc: DraftDocument; files: Record<string, File> } {
  const files: Record<string, File> = {}
  const items: DraftItem[] = state.items.map((item) => {
    files[item.id] = item.sourceFile
    return {
      id: item.id,
      label: item.label,
      fileKey: item.id,
      sourceWidth: item.sourceWidth,
      sourceHeight: item.sourceHeight,
      ops: item.ops,
      points: item.points,
      autoFilled: item.autoFilled,
      edited: item.edited,
    }
  })

  return {
    doc: {
      key: draftKey(userId, draftId),
      userId,
      draftId,
      savedAt: Date.now(),
      mode: state.mode,
      documentName: state.documentName,
      text: state.text,
      textName: state.textName,
      items,
    },
    files,
  }
}
