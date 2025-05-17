export interface Explanation {
  id: number
  title: string
  description: string
  part_ids: number[]
  created_at: string
  updated_at: string
  row_order: number
}

export interface ExplanationWrapper {
  explanation: Explanation
}

export interface ExplanationsResponse {
  explanations: ExplanationWrapper[]
} 