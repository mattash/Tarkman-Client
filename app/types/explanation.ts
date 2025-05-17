export interface Explanation {
  id: number
  title: string
  description: string
  part_ids: number[]
  created_at: string
  updated_at: string
  row_order: number
  liturgy_id: number
  user_id: number
}

export interface ExplanationWrapper {
  explanation: Explanation
}

export interface ExplanationsResponse {
  explanations: ExplanationWrapper[]
} 