interface TagBadgeProps {
  tag: string
  variant?: 'default' | 'outline'
}

export function TagBadge({ tag, variant = 'default' }: TagBadgeProps) {
  const getTagColors = (tagName: string) => {
    const lowercaseTag = tagName.toLowerCase()

    if (lowercaseTag.includes('theolog')) {
      return variant === 'outline'
        ? 'border-blue-500 text-blue-700 bg-blue-50'
        : 'bg-blue-100 text-blue-800'
    }
    if (lowercaseTag.includes('histor')) {
      return variant === 'outline'
        ? 'border-purple-500 text-purple-700 bg-purple-50'
        : 'bg-purple-100 text-purple-800'
    }
    if (lowercaseTag.includes('practice') || lowercaseTag.includes('practical')) {
      return variant === 'outline'
        ? 'border-green-500 text-green-700 bg-green-50'
        : 'bg-green-100 text-green-800'
    }
    if (lowercaseTag.includes('ritual')) {
      return variant === 'outline'
        ? 'border-amber-500 text-amber-700 bg-amber-50'
        : 'bg-amber-100 text-amber-800'
    }

    // Default gray for unknown tags
    return variant === 'outline'
      ? 'border-gray-500 text-gray-700 bg-gray-50'
      : 'bg-gray-100 text-gray-800'
  }

  const borderClass = variant === 'outline' ? 'border' : ''

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${borderClass} ${getTagColors(tag)}`}
    >
      {tag}
    </span>
  )
}
