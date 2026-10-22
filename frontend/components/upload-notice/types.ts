export interface Corner {
  x: number
  y: number
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

export interface ExtractResult {
  success: boolean
  data: {
    raw_text: string
    source_type: string
    file_name: string
    /** True when OCR failed and the pipeline degraded to a placeholder. */
    ocr_unavailable: boolean
    /** Which model produced this extraction. */
    model: {
      key: string
      label: string
      provider: string
      provider_model_id: string
    }
    title: string | null
    issuing_office: string | null
    date_of_issue: string | null
    deadlines: Array<{ date: string; description: string }> | null
    event_date_time: { date: string; time: string | null } | null
    venue: string | null
    target_students: {
      department: string | null
      batch: string | null
      semester: string | null
    } | null
    required_action: string | null
    fees: { amount: number; currency: string } | null
    contact: string | null
    category: string
    summary_bengali: string
    summary_english: string
    preview_image_base64: string | null
    potential_duplicates: Array<{
      id: number
      title: string
      similarity: number
      status: string
    }>
  }
}
