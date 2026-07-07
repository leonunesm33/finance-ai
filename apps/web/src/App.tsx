import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { HomePage } from '@/pages/HomePage'
import { HealthPage } from '@/pages/HealthPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/health" element={<HealthPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
