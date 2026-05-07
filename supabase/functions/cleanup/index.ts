import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // Check auth header if we want to secure it, or just allow local calls
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Find assignments past due date where file_url is not null
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('id, file_url')
    .lt('due_date', new Date().toISOString())
    .not('file_url', 'is', null)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const results = []

  for (const assignment of assignments) {
    if (assignment.file_url) {
      // Extract file path from URL or assume file_url is the path
      // If we store the direct path in file_url (e.g. 'folder/file.pdf')
      const { error: removeError } = await supabase
        .storage
        .from('assignment-attachments')
        .remove([assignment.file_url])
      
      if (!removeError) {
        // Update DB
        await supabase
          .from('assignments')
          .update({ file_url: null })
          .eq('id', assignment.id)
        
        results.push({ id: assignment.id, status: 'cleaned' })
      } else {
        results.push({ id: assignment.id, status: 'error', message: removeError.message })
      }
    }
  }

  return new Response(
    JSON.stringify({ message: "Cleanup complete", results }),
    { headers: { "Content-Type": "application/json" } },
  )
})
