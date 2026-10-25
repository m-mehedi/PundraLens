export interface Corner {
  x: number
  y: number
}

/** A rectangle expressed as a percentage of the image it was drawn on. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * A region of the notice to hide.
 *
 * Every measurement is a percentage of the image it was drawn on, so a
 * shape survives zooming, and a crop can be re-expressed in the smaller
 * frame afterwards. A circle's radius is measured against the *width*, so
 * it stays a circle on a portrait page.
 */
export type MaskShape =
  | {
      id: string
      kind: "rect"
      x: number
      y: number
      width: number
      height: number
    }
  | {
      id: string
      kind: "circle"
      cx: number
      cy: number
      radius: number
    }
  | { id: string; kind: "triangle"; points: Array<[number, number]> }
  | { id: string; kind: "polygon"; points: Array<[number, number]> }
  | {
      id: string
      kind: "stroke"
      points: Array<[number, number]>
      width: number
    }

/** The shapes the Hide tool can draw. */
export type MaskShapeKind = MaskShape["kind"]

/**
 * One pending change on top of the confirmed image.
 *
 * `frameWidth`/`frameHeight` record the size of the image the operation was
 * drawn on, so the operation can still be interpreted after the frame
 * changes (for example when a crop is undone).
 */
export type EditOp =
  | {
      id: string
      kind: "crop"
      rect: Rect
      frameWidth: number
      frameHeight: number
    }
  | { id: string; kind: "grayscale" }
  | { id: string; kind: "sharpen" }
  | {
      id: string
      kind: "mask"
      shapes: MaskShape[]
      frameWidth: number
      frameHeight: number
    }

/** The tool that owns the pointer on the editing surface. */
export type EditorTool = "move" | "corners" | "crop" | "hide" | "adjust"

/** What kind of document is open in the workbench. */
export type DocumentMode = "images" | "text"

/**
 * One page of a PDF, or one photo, in the document being edited.
 *
 * Every page keeps its own pending changes, its own corners and its own
 * rendered preview, so the strip can show a document made of many parts
 * without them bleeding into each other.
 */
export interface NoticeItem {
  id: string
  /** What the page is called in the strip. */
  label: string
  /** The bytes as they arrived — the rendered page or the photo. */
  sourceFile: File
  /** Blob URL of the untouched original, for the hold-to-compare. */
  sourceUrl: string
  /** A small render for the filmstrip. */
  thumbUrl: string
  /** The natural size of the original. */
  sourceWidth: number
  sourceHeight: number
  /** The confirmed working image. */
  baseFile: File
  /** Pending changes on top of the confirmed image. */
  ops: EditOp[]
  /** The four corners, as percentages of the preview. */
  points: Corner[]
  /** Which corners the detector could not find on its own. */
  autoFilled: boolean[]
  /** The rendered preview of the current state. */
  preview?: PreviewImage
  /** The revision the preview was rendered from. */
  previewRevision?: number
  /** Bumped whenever the image itself changes. */
  revision: number
  /** True once something about this page was changed. */
  edited: boolean
}

/** One extraction result, tied to the page it was read from. */
export interface ItemResult {
  id: string
  /** What the result is called in the list. */
  label: string
  result: ExtractResult
  /** The state of the document at the moment it was read. */
  fingerprint: string
}

/** The image currently shown in the editor. */
export interface PreviewImage {
  url: string
  blob: Blob
  width: number
  height: number
}

/** One entry of the backend model catalogue. */
export interface ModelOption {
  key: string
  label: string
  provider: string
  provider_model_id: string
  temperature: number
  max_tokens: number
  strict_json: boolean
  vision: boolean
  notes: string
  available: boolean
}

export interface ModelsResponse {
  success: boolean
  data: {
    default: string
    models: ModelOption[]
  }
}

export interface AlignResponse {
  /** Always 4 slots, in TL→TR→BR→BL order. A null slot means the backend
   *  did not detect that corner. */
  corners: (Corner | null)[]
  count: number
  image_width: number
  image_height: number
}

/**
 * The stage the extraction pipeline is in.
 *
 * The backend runs OCR and then the model in one call, so the stage is
 * inferred from the clock rather than reported. It is worded loosely enough
 * not to promise a precision the pipeline does not have.
 */
export type ExtractionStage = "preparing" | "reading" | "understanding"

/**
 * Flat extraction result matching the backend `ExtractionSchema`.
 *
 * The backend no longer wraps the result in a `{ success, data }` envelope
 * or returns metadata fields like `raw_text`, `preview_image_base64`, or
 * `potential_duplicates`.  A non-OK HTTP status already signals failure.
 */
export interface ExtractResult {
  title: string
  issuing_office: string
  date_of_issue: string
  category: string
  deadline: string
  event_date_and_time: string
  venue: string
  departments: string
  batches: number[]
  required_action: string
  fees: string
  contact: string
  notice_no: string
  notice_summary_bn: string
  notice_summary_en: string
}

/**
 * The editable form of a notice.
 *
 * Everything the model produced is copied in here so a staff member can
 * correct it before the notice reaches the board. Departments and batches
 * are stored as arrays so the form controls can work with them directly.
 */
export interface NoticeFormValues {
  title: string
  issuingOffice: string
  dateOfIssue: string
  category: string
  deadline: string
  eventDateTime: string
  venue: string
  departments: string[]
  batches: number[]
  requiredAction: string
  fees: string
  contact: string
  noticeNo: string
  noticeSummaryBn: string
  noticeSummaryEn: string
}

/**
 * The fields the extraction is expected to fill in. A staff member should
 * look at each of these before the notice goes on the board — an empty one
 * means the model could not read it, not that the notice lacks it.
 */
export type NoticeFieldKey =
  | "title"
  | "issuingOffice"
  | "dateOfIssue"
  | "deadline"
  | "requiredAction"
  | "audience"
  | "noticeSummaryBn"
  | "noticeSummaryEn"
