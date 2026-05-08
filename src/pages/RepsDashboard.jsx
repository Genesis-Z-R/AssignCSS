import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Plus, X, Trash2, Bell, BellOff } from 'lucide-react'
import OneSignal from 'react-onesignal'
import { supabase } from '../lib/supabase'
import AssignmentCard from '../components/AssignmentCard'

export default function RepsDashboard() {
  const { year_group } = useParams()
  const navigate = useNavigate()
  const className = localStorage.getItem('assigncss_class')
  
  const [courses, setCourses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  
  const [isCoursesModalOpen, setIsCoursesModalOpen] = useState(false)
  const [newCourseName, setNewCourseName] = useState('')
  
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false)
  const [newAssignment, setNewAssignment] = useState({
    course_id: '',
    description: '',
    due_date: '',
    file: null
  })

  useEffect(() => {
    async function initOneSignal() {
      try {
        const appId = import.meta.env.VITE_ONESIGNAL_APP_ID
        if (!appId) return
        
        await OneSignal.init({ appId, allowLocalhostAsSecureOrigin: true })
        OneSignal.User.addTag("year_group", year_group)
        
        const optedIn = OneSignal.User.PushSubscription.optedIn
        setIsSubscribed(optedIn)

        // Auto-prompt on supported browsers if not already subscribed
        if (!optedIn) {
          OneSignal.Slidedown.promptPush()
        }

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
    // Check auth
    const token = localStorage.getItem('assigncss_token')
    const role = localStorage.getItem('assigncss_role')
    const localClassName = localStorage.getItem('assigncss_class')
    
    if (!token || (role !== 'admin' && localClassName !== year_group)) {
      navigate('/')
      return
    }

    fetchData()
  }, [year_group, navigate])

  async function fetchData() {
    const { data: coursesData } = await supabase.from('courses').select('*').eq('year_group', year_group)
    if (coursesData) setCourses(coursesData)

    const { data: assignmentsData } = await supabase
      .from('assignments')
      .select('*, courses!inner(name, year_group)')
      .eq('courses.year_group', year_group)
      .order('due_date', { ascending: true })
    
    if (assignmentsData) setAssignments(assignmentsData)
  }

  const handleAddCourse = async () => {
    if (!newCourseName.trim()) return
    const { data, error } = await supabase.rpc('add_course', { p_name: newCourseName, p_year_group: year_group })
    if (!error && data && data.length > 0) {
      setCourses([...courses, data[0]])
      setNewCourseName('')
    } else if (error) {
      alert("Error adding course: " + error.message)
    }
  }

  const handleDeleteCourse = async (id) => {
    await supabase.rpc('delete_course', { p_id: id })
    setCourses(courses.filter(c => c.id !== id))
    fetchData() // Refresh assignments
  }

  const handleCreateAssignment = async (e) => {
    e.preventDefault()
    let fileUrl = null
    
    // Create an explicitly authenticated client for the upload to ensure the custom JWT is sent
    const token = localStorage.getItem('assigncss_token')
    const supabaseAuth = supabase // fallback if we can't recreate it
    
    // Actually, we can just instantiate it dynamically here
    const { createClient } = await import('@supabase/supabase-js')
    const authClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    
    if (newAssignment.file) {
      // Sanitize the file name to avoid 400 Bad Request errors from spaces or special characters
      const safeName = newAssignment.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fileName = `${Date.now()}_${safeName}`
      
      const { data: uploadData, error: uploadError } = await authClient.storage
        .from('assignment-attachments')
        .upload(fileName, newAssignment.file)
      
      if (uploadError) {
        alert("Warning: Could not upload file. " + uploadError.message)
      } else if (uploadData) {
        const { data: publicUrlData } = authClient.storage.from('assignment-attachments').getPublicUrl(fileName)
        fileUrl = publicUrlData.publicUrl
      }
    }

    const { error } = await supabase.rpc('create_assignment', {
      p_course_id: newAssignment.course_id,
      p_description: newAssignment.description,
      p_due_date: new Date(newAssignment.due_date).toISOString(),
      p_file_url: fileUrl
    })

    if (!error) {
      setIsAssignmentModalOpen(false)
      setNewAssignment({ course_id: '', description: '', due_date: '', file: null })
      fetchData()
    } else {
      alert("Error creating assignment: " + error.message)
    }
  }

  const [activeTab, setActiveTab] = useState('active')
  const [historyCourseId, setHistoryCourseId] = useState('all')

  const displayedAssignments = assignments.filter(a => {
    const isHistory = new Date(a.due_date) < new Date()
    
    if (activeTab === 'active' && isHistory) return false
    if (activeTab === 'history' && !isHistory) return false
    
    if (activeTab === 'history' && historyCourseId !== 'all') {
      if (a.course_id !== historyCourseId) return false
    }
    
    return a.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
           (a.courses?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header>
        <div className="container header-inner">
          <Link to="/" className="header-title">AssignCSS (Rep)</Link>
          <div className="header-actions">
            <span style={{ fontWeight: '600', marginRight: 'auto' }}>{className} Dashboard</span>
            <button 
              onClick={handleSubscribe}
              disabled={isToggling}
              className={`btn ${isSubscribed ? 'btn-outline' : ''}`}
              style={{ opacity: isToggling ? 0.7 : 1, cursor: isToggling ? 'wait' : 'pointer' }}
            >
              {isSubscribed ? <BellOff size={18} /> : <Bell size={18} />}
              {isToggling ? 'Updating...' : (isSubscribed ? 'Notifications On' : 'Enable Notifications')}
            </button>
            <button className="btn btn-outline" onClick={() => setIsCoursesModalOpen(true)}>
              Manage Courses
            </button>
            <button className="btn btn-danger" onClick={() => {
              localStorage.clear()
              navigate('/')
            }}>Logout</button>
          </div>
        </div>
      </header>

      <div style={{ backgroundColor: 'var(--surface)', borderBottom: 'var(--glass-border)', padding: '1rem 0', position: 'sticky', top: '72px', zIndex: 20 }}>
        <div className="container" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            className="input" 
            placeholder="Search assignments..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: '1 1 200px' }}
          />
          <div className="scroll-x" style={{ flex: '0 0 auto' }}>
            <button 
              className={`btn ${activeTab === 'active' ? 'btn-active' : 'btn-outline'}`}
              onClick={() => setActiveTab('active')}
            >
              Active
            </button>
            <button 
              className={`btn ${activeTab === 'history' ? 'btn-active' : 'btn-outline'}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
          </div>
        </div>

        {activeTab === 'history' && courses.length > 0 && (
          <div className="container scroll-x" style={{ paddingTop: '1rem' }}>
            <button 
              className={`btn ${historyCourseId === 'all' ? 'btn-active' : 'btn-outline'}`}
              onClick={() => setHistoryCourseId('all')}
              style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}
            >
              All Courses
            </button>
            {courses.map(course => (
              <button 
                key={course.id}
                className={`btn ${historyCourseId === course.id ? 'btn-active' : 'btn-outline'}`}
                onClick={() => setHistoryCourseId(course.id)}
                style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}
              >
                {course.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <main className="container" style={{ padding: '2rem 1rem', flex: 1 }}>
        {displayedAssignments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            No {activeTab} assignments found.
          </div>
        ) : (
          <div className="grid grid-cols-3">
            {displayedAssignments.map(assignment => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        )}
      </main>

      <button className="fab" onClick={() => setIsAssignmentModalOpen(true)}>
        <Plus size={24} />
      </button>

      {/* Manage Courses Modal */}
      {isCoursesModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCoursesModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Manage Courses</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setIsCoursesModalOpen(false)}><X /></button>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                className="input" 
                placeholder="New Course Name (e.g. Math)" 
                value={newCourseName}
                onChange={e => setNewCourseName(e.target.value)}
              />
              <button className="btn" onClick={handleAddCourse}>Add</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {courses.map(course => (
                <div key={course.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border)' }}>
                  <span>{course.name}</span>
                  <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => handleDeleteCourse(course.id)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {courses.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No courses found. Add one above.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Create Assignment Modal */}
      {isAssignmentModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAssignmentModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Create Assignment</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setIsAssignmentModalOpen(false)}><X /></button>
            </div>
            
            <form onSubmit={handleCreateAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Course</label>
                <select 
                  className="input" 
                  required
                  value={newAssignment.course_id}
                  onChange={e => setNewAssignment({...newAssignment, course_id: e.target.value})}
                >
                  <option value="">Select a course...</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Description</label>
                <textarea 
                  className="input" 
                  required
                  rows="3"
                  value={newAssignment.description}
                  onChange={e => setNewAssignment({...newAssignment, description: e.target.value})}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Due Date & Time</label>
                <input 
                  type="datetime-local" 
                  className="input" 
                  required
                  value={newAssignment.due_date}
                  onChange={e => setNewAssignment({...newAssignment, due_date: e.target.value})}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Attachment (Optional)</label>
                <input 
                  type="file" 
                  className="input" 
                  onChange={e => setNewAssignment({...newAssignment, file: e.target.files[0]})}
                />
              </div>

              <button type="submit" className="btn" style={{ marginTop: '1rem' }}>Create Assignment</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
