import { Star } from 'lucide-react'

interface RatingDisplayProps {
  averageRating: number
  ratingCount: number
}

export function RatingDisplay({ averageRating, ratingCount }: RatingDisplayProps) {
  if (ratingCount === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="flex">
          {[1, 2, 3, 4, 5].map(star => (
            <Star key={star} className="h-4 w-4 text-gray-300" fill="none" />
          ))}
        </div>
        <span>No ratings yet</span>
      </div>
    )
  }

  const fullStars = Math.floor(averageRating)
  const hasHalfStar = averageRating % 1 >= 0.5
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

  const pluralRatings = ratingCount === 1 ? 'rating' : 'ratings'

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex">
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`full-${i}`} className="h-4 w-4 text-yellow-500" fill="currentColor" />
        ))}

        {/* Half star */}
        {hasHalfStar && (
          <div className="relative">
            <Star className="h-4 w-4 text-gray-300" fill="currentColor" />
            <div className="absolute top-0 left-0 overflow-hidden" style={{ width: '50%' }}>
              <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
            </div>
          </div>
        )}

        {/* Empty stars */}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" fill="currentColor" />
        ))}
      </div>

      <span className="text-gray-700 font-medium">{averageRating.toFixed(1)}</span>
      <span className="text-gray-500">({ratingCount} {pluralRatings})</span>
    </div>
  )
}
