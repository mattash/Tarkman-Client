import { createFileRoute } from '@tanstack/react-router';
import { ProtectedRoute } from '~/components/ProtectedRoute';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <ProtectedRoute>
      <div>
        <h1>Dashboard</h1>
        {/* Protected content here */}
      </div>
    </ProtectedRoute>
  );
} 