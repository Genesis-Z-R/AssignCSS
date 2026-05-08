import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Bell, BellOff } from 'lucide-react'
import OneSignal from 'react-onesignal'
import { supabase } from '../lib/supabase'
import AssignmentCard from '../components/AssignmentCard'

export default function ClassDashboard() {
  const { year_group } = useParams()
  const [assignments, setAssignments] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  useEffect(() => {
    async function initOneSignal() {
      try {
        const appId = import.meta.env.VITE_ONESIGNAL_APP_ID
        if (!appId) return
        
        await OneSignal.init({ appId, allowLocalhostAsSecureOrigin: true })
        
        // Tag user with year_group so edge function filters match them
        OneSignal.User.addTag("year_group", year_group)
        
        // Check current subscription status
        const optedIn = OneSignal.User.PushSubscription.optedIn
        setIsSubscribed(optedIn)

        // Auto-prompt on supported browsers if not already subscribed
        if (!optedIn) {
          OneSignal.Slidedown.promptPush()
        }

        // Listen for changes
        OneSignal.User.PushSubscription.addEventListener('change', (e) => {
          setIsSubscribed(e.current.optedIn)
        })
      } catch (err) {
        console.warn('OneSignal initialization failed:', err)
      }
    }
    initOneSignal()
  }, [year_group])

  const handleSubscribe = async () => {
    if (!import.meta.env.VITE_ONESIGNAL_APP_ID) {
      alert("Push notifications are not configured yet (Missing App ID)")
      return
    }
    
    setIsToggling(true)
    try {
      if (isSubscribed) {
        // Toggle OFF
        setIsSubscribed(false) // Instant optimistic update
        await OneSignal.User.PushSubscription.optOut()
      } else {
        // Toggle ON
        await OneSignal.Slidedown.promptPush()
        await OneSignal.User.PushSubscription.optIn()
        setIsSubscribed(OneSignal.User.PushSubscription.optedIn)
      }
    } finally {
      setIsToggling(false)
    }
  }

  useEffect(() => {
    async function fetchData() {
      // Fetch assignments joined with courses to filter by year_group
      // Since supabase JS doesn't easily let you filter a main table by a joined table's column unless you use inner joins properly,
      // we can do this:
        const { data } = await supabase
          .from('assignments')
          .select('*, courses!inner(name, year_group)')
          .eq('courses.year_group', year_group)
          .gte('due_date', new Date().toISOString())
          .order('due_date', { ascending: true })
      
      if (data) setAssignments(data)
    }
    fetchData()
  }, [year_group])

  const filteredAssignments = assignments.filter(a => 
    a.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (a.courses?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header>
        <div className="container header-inner">
          <Link to="/" className="header-title">AssignCSS</Link>
          <div className="header-actions">
            <span style={{ fontWeight: '600', fontSize: '1.25rem', marginRight: 'auto' }}>
              {year_group} Dashboard
            </span>
            <button 
              onClick={handleSubscribe}
              disabled={isToggling}
              className={`btn ${isSubscribed ? 'btn-outline' : ''}`}
              style={{ opacity: isToggling ? 0.7 : 1, cursor: isToggling ? 'wait' : 'pointer' }}
            >
              {isSubscribed ? <BellOff size={18} /> : <Bell size={18} />}
              {isToggling ? 'Updating...' : (isSubscribed ? 'Notifications On' : 'Enable Notifications')}
            </button>
          </div>
        </div>
      </header>

      <div style={{ backgroundColor: 'var(--surface)', borderBottom: '2px solid var(--border)', padding: '1rem 0', position: 'sticky', top: '72px', zIndex: 20 }}>
        <div className="container">
          <input 
            type="text" 
            className="input" 
            placeholder="Search assignments..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <main className="container" style={{ padding: '2rem 1rem', flex: 1 }}>
        {filteredAssignments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            No assignments found.
          </div>
        ) : (
          <div className="grid grid-cols-3">
            {filteredAssignments.map(assignment => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
