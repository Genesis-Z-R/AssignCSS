import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') ?? ''
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') ?? ''

serve(async (req) => {
  try {
    const payload = await req.json()
    // payload should be the webhook payload from Supabase
    // payload.record will contain the newly inserted assignment
    const assignment = payload.record

    if (!assignment) {
      return new Response("No assignment record found in payload", { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the course name to include in the notification
    const { data: course } = await supabase
      .from('courses')
      .select('name')
      .eq('id', assignment.course_id)
      .single()

    const courseName = course?.name || 'a course'

    // Format the date nicely
    const dueDate = new Date(assignment.due_date)
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    const dateString = dueDate.toLocaleString('en-US', options)

    const message = `A new assignment for ${courseName} has been posted! Due: ${dateString}`

    const notificationPayload = {
      app_id: ONESIGNAL_APP_ID,
      contents: { en: message },
      headings: { en: "New Assignment!" },
      filters: [
        { field: "tag", key: "course_id", relation: "=", value: assignment.course_id }
      ]
    }

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(notificationPayload)
    })
    
    const resData = await res.json()

    return new Response(JSON.stringify({ success: true, resData }), { headers: { "Content-Type": "application/json" } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
