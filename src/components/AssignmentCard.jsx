import { FileText, Clock } from 'lucide-react'

export default function AssignmentCard({ assignment }) {
  const isPastDue = new Date(assignment.due_date) < new Date()
  
  // Calculate time left
  const calculateTimeLeft = () => {
    if (isPastDue) return 'Past Due'
    
    const diff = new Date(assignment.due_date) - new Date()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    
    if (days > 0) return `${days}d ${hours}h left`
    return `${hours}h left`
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h3 className="handwritten" style={{ fontSize: '1.75rem', fontWeight: '700' }}>
          {assignment.courses?.name || 'Assignment'}
        </h3>
        <span className={`badge ${isPastDue ? 'badge-danger' : 'badge-primary'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Clock size={14} />
          {calculateTimeLeft()}
        </span>
      </div>
      
      <p style={{ color: 'var(--text-main)', marginBottom: '1.5rem', flex: 1, whiteSpace: 'pre-wrap', lineHeight: '1.75rem' }}>
        {assignment.description}
      </p>
      
      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '1rem', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Due: {new Date(assignment.due_date).toLocaleDateString()}
        </span>
        {assignment.file_url && (
          <a href={assignment.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: '500' }}>
            <FileText size={18} />
            Attachment
          </a>
        )}
      </div>
    </div>
  )
}
