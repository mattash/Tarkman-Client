type RequiredEnvironmentVariable = 'VITE_API_URL'

type Environment = Partial<Record<RequiredEnvironmentVariable, unknown>>

export function getRequiredEnvironmentVariable(
  key: RequiredEnvironmentVariable,
  environment: Environment,
): string {
  const value = environment[key]

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export const apiBaseUrl = getRequiredEnvironmentVariable('VITE_API_URL', import.meta.env)
