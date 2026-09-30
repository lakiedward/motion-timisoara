import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/manrope/index.css'
import './index.css'
import App from './App.tsx'
import { initializeNativeKeyboard } from './layout/native/native-keyboard'

void initializeNativeKeyboard()
  .catch((error) => console.error('Native keyboard initialization failed', error))
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
