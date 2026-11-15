import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import '@fontsource-variable/manrope'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import { StoreProvider } from './lib/store'
import { I18nProvider } from './lib/i18n'
import Landing from './pages/Landing'
import SelectArea from './pages/SelectArea'
import DiagnosisPage from './pages/Diagnosis'
import Rotation from './pages/Rotation'
import Objectives from './pages/Objectives'
import Lab from './pages/Lab'
import Compare from './pages/Compare'
import Plan from './pages/Plan'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/terra" element={<SelectArea />} />
          <Route path="/diagnostico" element={<DiagnosisPage />} />
          <Route path="/rotacao" element={<Rotation />} />
          <Route path="/objetivos" element={<Objectives />} />
          <Route path="/laboratorio" element={<Lab />} />
          <Route path="/comparar" element={<Compare />} />
          <Route path="/plano" element={<Plan />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
    </I18nProvider>
  </StrictMode>,
)
