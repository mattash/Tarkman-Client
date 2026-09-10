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

  // New fields from API enhancement
  summary?: string              // Short preview text
  status?: 0 | 1 | 2           // Draft (0), Published (1), Archived (2)
  tags?: string[]              // theology, history, practice, ritual
  average_rating?: number      // Aggregate rating (0-5)
  rating_count?: number        // Total number of ratings
  view_count?: number          // Usage analytics
}

export interface ExplanationWrapper {
  explanation: Explanation
}

export interface ExplanationsResponse {
  explanations: ExplanationWrapper[]
}

export interface Citation {
  id: number
  citation_type: 0 | 1 | 2    // scripture (0), cross-references (1), external (2)
  text: string
  source: string
  url?: string
  created_at: string
  updated_at: string
}

export interface CitationsResponse {
  citations: Citation[]
}

export interface ExplanationRating {
  id: number
  explanation_id: number
  user_id: number
  rating: number              // 1-5
  comment?: string
  created_at: string
}

export interface RatingsResponse {
  average_rating: number
  rating_count: number
  ratings: ExplanationRating[]
} 