import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LandingPage from './components/LandingPage.tsx'
import { DOJOS } from './dojo/registry'
import { resolveRoute } from './routing'

const route = resolveRoute(window.location.hostname, DOJOS)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {route.view === 'landing'
      ? <LandingPage dojos={DOJOS} />
      : <App forcedDojoSlug={route.slug} />}
  </StrictMode>,
)
