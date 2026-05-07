import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AssignmentCard from '../components/AssignmentCard'

export default function ClassDashboard() {
  const { year_group } = useParams()
  const [assignments, setAssignments] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

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
          <div style={{ fontWeight: '600', fontSize: '1.25rem' }}>
            {year_group} Dashboard
          </div>
        </div>
      </header>

      <div style={{ backgroundColor: 'var(--primary)', padding: '1rem 0' }}>
        <div className="container">
          <input 
            type="text" 
            className="input" 
            placeholder="Search assignments..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', padding: '1rem' }}
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
