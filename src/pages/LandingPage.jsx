import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function LandingPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false)
  const navigate = useNavigate()

  const yearGroups = ['CS1', 'CS2', 'CS3', 'CS4']

  const handleRepLogin = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('login', {
        body: { password }
      })

      if (fnError || !data?.token) {
        throw new Error(data?.error || fnError?.message || 'Invalid password')
      }

      // Supabase JS v2 allows setting the session directly using the token we just minted!
      // This will ensure the storage and database requests use the new JWT!
      const { error: authError } = await supabase.auth.setSession({
        access_token: data.token,
        refresh_token: ''
      })

      if (authError) {
        console.warn('Could not set session automatically, but token was saved.', authError)
      }

      localStorage.setItem('assigncss_token', data.token)
      localStorage.setItem('assigncss_class', data.class_name)
      localStorage.setItem('assigncss_role', data.role)

      if (data.role === 'admin' || data.role === 'master' || data.class_name === 'master') {
        localStorage.setItem('assigncss_role', 'admin')
        navigate('/admin')
      } else if (data.role === 'rep') {
        navigate(`/reps/${data.class_name}`)
      } else {
        throw new Error(`Unknown role: ${data.role}`)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header>
        <div className="container header-inner">
          <div className="header-title">AssignCSS</div>
          <form onSubmit={handleRepLogin} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="password" 
              className="input" 
              placeholder="Reps Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '0.5rem', width: '200px' }}
            />
            <button type="submit" className="btn">Login</button>
          </form>
        </div>
      </header>

      <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '4rem 1rem' }}>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '1rem', border: '1px solid var(--danger)' }}>{error}</div>}
        
        <h1 style={{ fontSize: '3rem', marginBottom: '3rem', textAlign: 'center', color: 'var(--primary)' }}>Select Your Class</h1>
        
        <div className="grid grid-cols-2" style={{ width: '100%', maxWidth: '800px' }}>
          {yearGroups.map(yg => (
            <div 
              key={yg} 
              className="card" 
              style={{ cursor: 'pointer', textAlign: 'center', padding: '3rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => navigate(`/class/${yg}`)}
            >
              <h2 style={{ fontSize: '2rem' }}>{yg}</h2>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ padding: '2rem', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <button 
          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '500', cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => setIsInstallModalOpen(true)}
        >
          How to Install AssignCSS (PWA)
        </button>
      </footer>

      {isInstallModalOpen && (
        <div className="modal-overlay" onClick={() => setIsInstallModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--primary)' }}>How to Install AssignCSS</h2>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
              AssignCSS is a Progressive Web App (PWA). You can install it directly to your device for quick access, offline support, and push notifications!
            </p>
            
            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>📱 iOS (Safari)</strong>
              1. Tap the Share icon (square with arrow) at the bottom.<br/>
              2. Scroll down and tap "Add to Home Screen".
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>🤖 Android (Chrome)</strong>
              1. Tap the 3-dot menu at the top right.<br/>
              2. Tap "Install App" or "Add to Home Screen".
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>💻 Desktop (Chrome/Edge)</strong>
              1. Look for the install icon (monitor with down arrow) in the right side of the URL bar.<br/>
              2. Click it and select "Install".
            </div>
            
            <button className="btn" style={{ width: '100%' }} onClick={() => setIsInstallModalOpen(false)}>Got it!</button>
          </div>
        </div>
      )}
    </div>
  )
}
