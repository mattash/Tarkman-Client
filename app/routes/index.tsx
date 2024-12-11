import { createFileRoute } from '@tanstack/react-router'
import { SessionList } from '../components/SessionList'

export const Route = createFileRoute('/')({
  component: SessionList,
}) 