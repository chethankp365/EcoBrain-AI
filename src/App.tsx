import { QueryClient } from '@tanstack/query-core'
import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { ToastProvider } from '@/components/ui'
import Landing from '@/pages/Landing'

const AppShell = lazy(() => import('@/pages/AppShell'))
const Dispatch = lazy(() => import('@/pages/Dispatch'))
const LoginPage = lazy(() => import('@/pages/Auth').then((module) => ({ default: module.LoginPage })))
const SignupPage = lazy(() => import('@/pages/Auth').then((module) => ({ default: module.SignupPage })))
const ForgotPage = lazy(() => import('@/pages/Auth').then((module) => ({ default: module.ForgotPage })))
const ResetPasswordPage = lazy(() => import('@/pages/Auth').then((module) => ({ default: module.ResetPasswordPage })))
const MyReports = lazy(() => import('@/pages/MyReports'))
const ReportWizard = lazy(() => import('@/pages/ReportWizard'))
const RoutesPage = lazy(() => import('@/pages/RoutesPage'))
const Worker = lazy(() => import('@/pages/Worker'))
const WorkerRoute = lazy(() => import('@/pages/Worker').then((module) => ({ default: module.WorkerRoute })))
const AdminPage = lazy(() => import('@/pages/Insights').then((module) => ({ default: module.AdminPage })))
const AnalyticsPage = lazy(() => import('@/pages/Insights').then((module) => ({ default: module.AnalyticsPage })))
const BinsPage = lazy(() => import('@/pages/Insights').then((module) => ({ default: module.BinsPage })))
const EvaluationPage = lazy(() => import('@/pages/Insights').then((module) => ({ default: module.EvaluationPage })))
const HotspotsPage = lazy(() => import('@/pages/Insights').then((module) => ({ default: module.HotspotsPage })))
const TransparencyPage = lazy(() => import('@/pages/Insights').then((module) => ({ default: module.TransparencyPage })))

function App() {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-white/50">Loading EcoBrain…</div>}>
              <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<AppShell />}>
              <Route path="/report" element={<ReportWizard />} />
              <Route path="/my-reports" element={<MyReports />} />
              <Route path="/my-reports/:id" element={<MyReports />} />
              <Route path="/worker" element={<Worker />} />
              <Route path="/worker/route" element={<WorkerRoute />} />
              <Route path="/dispatch" element={<Dispatch />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/hotspots" element={<HotspotsPage />} />
              <Route path="/bins" element={<BinsPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/evaluation" element={<EvaluationPage />} />
              <Route path="/transparency" element={<TransparencyPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
