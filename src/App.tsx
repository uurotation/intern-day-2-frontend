import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import Layout, { ProtectedRoute } from './components/Layout'
import LoginPage from './pages/LoginPage'
import MatrixPage from './pages/MatrixPage'
import MemoPage from './pages/MemoPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout>
                  <Outlet />
                </Layout>
              </ProtectedRoute>
            }
          >
            <Route path="/memo" element={<MemoPage />} />
            <Route path="/matrix" element={<MatrixPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/memo" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
