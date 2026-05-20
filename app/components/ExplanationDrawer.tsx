import * as React from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { X, HelpCircle } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Explanation } from '../types/explanation'
import { explanationQueryKeys, fetchCurrentExplanation } from '../queries/explanationQueries'
import { useActionCable } from '../hooks/useActionCable'
import ReactMarkdown from 'react-markdown'
import { TagBadge } from './TagBadge'
import { RatingDisplay } from './RatingDisplay'
import { CitationsList } from './CitationsList'

interface ExplanationDrawerProps {
  title?: string,
  sessionId: string
}

export function ExplanationDrawer({
  title = 'Explanation',
  sessionId
}: ExplanationDrawerProps) {
  const queryClient = useQueryClient()
  const actionCableData = useActionCable(`channel_${sessionId}`, 'part_change')

  React.useEffect(() => {
    if (actionCableData) {
      queryClient.invalidateQueries({ queryKey: explanationQueryKeys.current(sessionId) })
    }
  }, [actionCableData, queryClient, sessionId])

  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: explanationQueryKeys.current(sessionId),
    queryFn: () => fetchCurrentExplanation(sessionId),
  })

  return (
    <Drawer direction="bottom">
      <DrawerTrigger className="fixed bottom-4 right-4 rounded-full bg-tarkman-purple-light" asChild>
        <Button>
          Need help
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-gray-100 flex flex-col rounded-t-[10px] mt-24 h-[80%] lg:h-[320px] fixed bottom-0 left-0 right-0 outline-none">
        <div className="p-4 bg-white rounded-t-[10px] flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto space-y-4">
            <DrawerHeader className="flex items-center justify-between border-b px-4 py-2">
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="p-4">
              {isLoading ? (
                <div className="animate-pulse">Loading explanation...</div>
              ) : explanations?.length ? (
                <div className="prose max-w-none space-y-6">
                  {explanations.map((explanation) => (
                    <div key={explanation.id} className="space-y-3">
                      <div>
                        <h2 className="text-xl font-semibold mb-2">{explanation.title}</h2>

                        {/* Tags */}
                        {explanation.tags && explanation.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {explanation.tags.map((tag, index) => (
                              <TagBadge key={index} tag={tag} />
                            ))}
                          </div>
                        )}

                        {/* Rating */}
                        {explanation.average_rating !== undefined && explanation.rating_count !== undefined && (
                          <div className="mb-3">
                            <RatingDisplay
                              averageRating={explanation.average_rating}
                              ratingCount={explanation.rating_count}
                            />
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      {explanation.summary && (
                        <div className="text-sm italic text-gray-600 border-l-4 border-blue-200 pl-3 py-1">
                          {explanation.summary}
                        </div>
                      )}

                      {/* Description */}
                      <div className="text-gray-800">
                        <ReactMarkdown>{explanation.description}</ReactMarkdown>
                      </div>

                      {/* Citations */}
                      {explanation.liturgy_id && (
                        <CitationsList
                          liturgyId={explanation.liturgy_id.toString()}
                          explanationId={explanation.id.toString()}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div>No explanation available</div>
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
} 