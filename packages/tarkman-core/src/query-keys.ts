export const sessionsKeys = {
  all: ['sessions'] as const,
  list: () => [...sessionsKeys.all, 'list'] as const,
  session: (id: string) => [...sessionsKeys.all, 'session', id] as const,
  sessionParts: (id: string) => [...sessionsKeys.all, 'session', id, 'parts'] as const,
}

export const sessionMutationKeys = {
  controls: (id: string) => ['sessionControls', id] as const,
}

export const partQueryKeys = {
  all: (sessionId: string) => ['part', sessionId] as const,
  detail: (sessionId: string, partId: number) => ['part', sessionId, partId] as const,
}

export const explanationQueryKeys = {
  all: (sessionId: string) => ['explanation', sessionId] as const,
  detail: (sessionId: string, explanationId: string) => ['explanation', sessionId, explanationId] as const,
  current: (sessionId: string) => ['explanation', sessionId, 'current'] as const,
  upcoming: (sessionId: string) => ['explanation', sessionId, 'upcoming'] as const,
  liturgy: (liturgyId: string) => ['explanation', 'liturgy', liturgyId] as const,
  liturgyDetail: (liturgyId: string, explanationId: string) => ['explanation', 'liturgy', liturgyId, explanationId] as const,
  partExplanations: (liturgyId: string, partId: string) => ['explanation', 'liturgy', liturgyId, 'part', partId] as const,
  citations: (liturgyId: string, explanationId: string) => ['explanation', 'liturgy', liturgyId, explanationId, 'citations'] as const,
  ratings: (liturgyId: string, explanationId: string) => ['explanation', 'liturgy', liturgyId, explanationId, 'ratings'] as const,
}

export const currentSessionKeys = {
  current: () => ['currentSession'] as const,
  user: (userId: string | null) => ['userCurrentSession', userId] as const,
}
