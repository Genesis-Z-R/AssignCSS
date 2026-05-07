import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ClassDashboard from './pages/ClassDashboard'
import RepsDashboard from './pages/RepsDashboard'
import AdminDashboard from './pages/AdminDashboard'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/class/:year_group" element={<ClassDashboard />} />
      <Route path="/reps/:year_group" element={<RepsDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  )
}

export default App
