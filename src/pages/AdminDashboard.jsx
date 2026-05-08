import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [passwords, setPasswords] = useState([])
  const [error, setError] = useState('')
  const [inputValues, setInputValues] = useState({})

  const CLASSES = ['master', 'CS1', 'CS2', 'CS3', 'CS4']

  useEffect(() => {
    // Check auth
    const token = localStorage.getItem('assigncss_token')
    const role = localStorage.getItem('assigncss_role')
    
    if (!token || role !== 'admin') {
      navigate('/')
      return
    }

    fetchPasswords()
  }, [navigate])

  async function fetchPasswords() {
    // Uses the new get_all_passwords RPC so 'master' is included
    const { data, error } = await supabase.rpc('get_all_passwords')
    if (data) setPasswords(data)
  }

  const handleUpdatePassword = async (className) => {
    const newPassword = inputValues[className]
    if (!newPassword) return

    setError('')
    const role = className === 'master' ? 'admin' : 'rep'
    
    // Uses the new upsert RPC
    const { error } = await supabase.rpc('upsert_class_password', { 
      p_class_name: className, 
      p_password: newPassword,
      p_role: role
    })
    
    if (!error) {
      fetchPasswords()
      setInputValues({ ...inputValues, [className]: '' })
      alert(`${className} password successfully set/updated!`)
    } else {
      setError(error.message)
    }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.rpc('delete_class_password', { p_id: id })
    if (!error) {
      fetchPasswords()
    } else {
      setError(error.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header>
        <div className="container header-inner">
          <div className="header-title">AssignCSS (Admin)</div>
          <div className="header-actions">
            <span style={{ fontWeight: '600', marginRight: 'auto' }}>Admin Dashboard</span>
            <button className="btn btn-danger" onClick={() => {
              localStorage.clear()
              navigate('/')
            }}>Logout</button>
          </div>
        </div>
      </header>

      <main className="container" style={{ padding: '2rem 1rem', flex: 1, maxWidth: '800px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Manage Class Passwords</h1>

        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '1rem', border: '1px solid var(--danger)' }}>{error}</div>}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {CLASSES.map((cls, idx) => {
            const existing = passwords.find(p => p.class_name === cls)
            
            return (
              <div key={cls} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', borderBottom: idx < CLASSES.length - 1 ? 'var(--glass-border)' : 'none' }}>
                <div style={{ flex: '0 0 150px' }}>
                  <strong style={{ fontSize: '1.125rem' }}>{cls}</strong>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {cls === 'master' ? 'Master Admin' : 'Class Rep'}
                  </div>
                </div>
                
                <div style={{ flex: 1, display: 'flex', gap: '1rem', padding: '0 1rem' }}>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder={existing ? "•••••••• (Type to override)" : "No password set..."}
                    value={inputValues[cls] !== undefined ? inputValues[cls] : ''}
                    onChange={e => setInputValues({ ...inputValues, [cls]: e.target.value })}
                  />
                  <button 
                    className="btn" 
                    onClick={() => handleUpdatePassword(cls)}
                    disabled={!inputValues[cls]}
                  >
                    {existing ? 'Update' : 'Set Password'}
                  </button>
                </div>

                <div style={{ flex: '0 0 50px', textAlign: 'right' }}>
                  {existing && cls !== 'master' && (
                    <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.5rem' }} onClick={() => handleDelete(existing.id)} title="Remove Password">
                      <Trash2 size={20} />
                    </button>
                  )}
                  {existing && cls === 'master' && (
                    <div style={{ padding: '0.5rem', color: 'var(--success)' }} title="Admin Password is Active">
                      <Check size={20} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.5' }}>
          <strong>Security Note:</strong> Passwords are cryptographically hashed using <code>pgcrypto</code>. 
          For security reasons, it is mathematically impossible to reverse the hash to "see" the plaintext password. 
          You can only view whether a password is set (••••••••) and overwrite it with a new one.
        </p>
      </main>
    </div>
  )
}
