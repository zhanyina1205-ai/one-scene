import { createRoot } from 'react-dom/client'
import { App } from './App'
import { WorkspaceProvider } from './store'
import './styles.css'

createRoot(document.getElementById('root')!).render(<WorkspaceProvider><App /></WorkspaceProvider>)
