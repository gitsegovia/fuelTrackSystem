import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProviders } from './components/layout/AppProviders'
import { ProtectedLayout } from './components/layout/ProtectedLayout'
import LoginPage from './pages/login'
import DashboardPage from './pages/dashboard'
import ShiftsPage from './pages/shifts'
import NewShiftPage from './pages/shifts/new'
import ShiftDetailPage from './pages/shifts/[id]'
import NewReadingsPage from './pages/shifts/[id]/readings/new'
import ShiftReportPage from './pages/shifts/[id]/report'
import TicketsPage from './pages/tickets'
import NewTicketPage from './pages/tickets/new'
import TicketDetailPage from './pages/tickets/[id]'
import TanksPage from './pages/tanks'

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/shifts" element={<ShiftsPage />} />
            <Route path="/shifts/new" element={<NewShiftPage />} />
            <Route path="/shifts/:id" element={<ShiftDetailPage />} />
            <Route path="/shifts/:id/readings/new" element={<NewReadingsPage />} />
            <Route path="/shifts/:id/report" element={<ShiftReportPage />} />

            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/new" element={<NewTicketPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />

            <Route path="/tanks" element={<TanksPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  )
}
