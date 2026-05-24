import { useQuery } from '@tanstack/react-query'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, BookOpen, Link2, ExternalLink } from 'lucide-react'
import { fetchExplanationCitations, explanationQueryKeys } from '@/queries/explanationQueries'
import { Citation } from '@/types/explanation'
import { useState } from 'react'

interface CitationsListProps {
  liturgyId: string
  explanationId: string
}

export function CitationsList({ liturgyId, explanationId }: CitationsListProps) {
  const { data: citations, isLoading, error } = useQuery({
    queryKey: explanationQueryKeys.citations(liturgyId, explanationId),
    queryFn: () => fetchExplanationCitations(liturgyId, explanationId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0, 1, 2]))

  const toggleSection = (type: number) => {
    setOpenSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        <div className="h-3 bg-gray-100 rounded w-3/4"></div>
        <div className="h-3 bg-gray-100 rounded w-2/3"></div>
      </div>
    )
  }

  if (error) {
    return null // Silently handle errors as citations are supplementary
  }

  if (!citations || citations.length === 0) {
    return null // Don't show anything if there are no citations
  }

  // Group citations by type
  const scripture = citations.filter(c => c.citation_type === 0)
  const crossRefs = citations.filter(c => c.citation_type === 1)
  const external = citations.filter(c => c.citation_type === 2)

  const renderCitations = (citationsList: Citation[], type: number) => {
    if (citationsList.length === 0) return null

    const titles = ['Scripture References', 'Cross-References', 'External Sources']
    const icons = [
      <BookOpen className="h-4 w-4" key="scripture" />,
      <Link2 className="h-4 w-4" key="crossref" />,
      <ExternalLink className="h-4 w-4" key="external" />,
    ]

    return (
      <Collapsible
        key={type}
        open={openSections.has(type)}
        onOpenChange={() => toggleSection(type)}
        className="border-b border-gray-200 last:border-0"
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-left hover:text-blue-600 transition-colors">
          <div className="flex items-center gap-2">
            {icons[type]}
            <span>{titles[type]}</span>
            <span className="text-xs text-gray-500">({citationsList.length})</span>
          </div>
          {openSections.has(type) ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pb-3">
          <ul className="space-y-2 ml-6">
            {citationsList.map(citation => (
              <li key={citation.id} className="text-sm">
                <div className="flex flex-col gap-1">
                  <div className="font-medium text-gray-900">{citation.text}</div>
                  <div className="text-xs text-gray-600">
                    {citation.source}
                    {citation.url && type === 2 && (
                      <>
                        {' — '}
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          Visit source
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div className="mt-4 border-t pt-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Citations</h3>
      <div className="space-y-1">
        {renderCitations(scripture, 0)}
        {renderCitations(crossRefs, 1)}
        {renderCitations(external, 2)}
      </div>
    </div>
  )
}
