import { positiveId, record, requiredId } from '../live/contracts'

export interface PartTexts { grabar: string | null; translit: string | null; en: string | null; ru: string | null; hyEast: string | null; hyWest: string | null }
export interface PartDetail {
  id: number; role: string; posture: string | null; position: number | null; page: number | null
  texts: PartTexts; explanationIds: number[]
}
export interface PartExplanation { id: number; title: string; description: string | null }

const LOAD_ERROR = 'Could not load this part. Please retry.'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

export function normalizePartDetail(value: unknown): PartDetail {
  const part = record(record(value).part)
  return {
    id: requiredId(part.id),
    role: text(part.role) ?? 'Part',
    posture: text(part.posture),
    position: positiveId(part.position),
    page: positiveId(part.page),
    texts: { grabar: text(part.grabar), translit: text(part.translit), en: text(part.en), ru: text(part.ru), hyEast: text(part.hy_east), hyWest: text(part.hy_west) },
    explanationIds: Array.isArray(part.explanation_ids) ? part.explanation_ids.map(id => positiveId(id)).filter((id): id is number => id !== null) : [],
  }
}

export function normalizePartExplanation(value: unknown): PartExplanation {
  const explanation = record(record(value).explanation ?? value)
  return { id: requiredId(explanation.id), title: text(explanation.title) ?? 'Explanation', description: text(explanation.description) }
}

/** Public reads, matching what the website's part page shows. No credentials are sent. */
export function createPartsApi(base: string, request: typeof fetch = fetch) {
  async function get(path: string, signal: AbortSignal): Promise<unknown> {
    const response = await request(`${base}${path}`, { signal, credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(response.status === 404 ? 'This part is no longer available.' : LOAD_ERROR)
    return response.json()
  }
  return {
    part: async (sessionId: number, partId: number, signal: AbortSignal) => normalizePartDetail(await get(`/s/${sessionId}/parts/${partId}.json`, signal)),
    explanation: async (sessionId: number, explanationId: number, signal: AbortSignal) => normalizePartExplanation(await get(`/s/${sessionId}/explanations/${explanationId}.json`, signal)),
  }
}
