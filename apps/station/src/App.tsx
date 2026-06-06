import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProviders } from './components/layout/AppProviders'
import { ProtectedLayout } from './components/layout/ProtectedLayout'
import LoginPage from './pages/login'
import DashboardPage from './pages/dashboard'

// Las rutas de shifts, tickets y tanks se agregan en el paso de migración de páginas

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* shifts */}
            {/* <Route path="/shifts" element={<ShiftsPage />} /> */}
            {/* <Route path="/shifts/new" element={<NewShiftPage />} /> */}
            {/* <Route path="/shifts/:id" element={<ShiftDetailPage />} /> */}
            {/* <Route path="/shifts/:id/readings/new" element={<NewReadingsPage />} /> */}
            {/* <Route path="/shifts/:id/report" element={<ShiftReportPage />} /> */}

            {/* tickets */}
            {/* <Route path="/tickets" element={<TicketsPage />} /> */}
            {/* <Route path="/tickets/new" element={<NewTicketPage />} /> */}
            {/* <Route path="/tickets/:id" element={<TicketDetailPage />} /> */}

            {/* tanks */}
            {/* <Route path="/tanks" element={<TanksPage />} /> */}
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  )
}
