import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') ?? ''
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') ?? ''

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get assignments that are upcoming
    // Simplification: just query all assignments in the future and calculate if we should notify right now.
    // In a real scenario, we'd add columns like 'notified_1d', 'notified_1h' to ensure idempotency.
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('id, course_id, description, due_date, created_at, courses(name, year_group)')
      .gt('due_date', new Date().toISOString())

    if (error) throw error

    const now = new Date().getTime()
    const notificationsToSend = []

    for (const a of assignments) {
      const dueDate = new Date(a.due_date).getTime()
      const createdDate = new Date(a.created_at).getTime()
      const halfway = createdDate + (dueDate - createdDate) / 2
      const oneDay = dueDate - 24 * 60 * 60 * 1000
      const oneHour = dueDate - 60 * 60 * 1000

      const courseName = a.courses.name
      const yearGroup = a.courses.year_group
      let message = null

      // If we are within a 15 minute window of these triggers (assuming cron runs every 15m)
      const window = 15 * 60 * 1000
      
      if (Math.abs(now - halfway) < window) {
         message = `You are halfway to the deadline for ${courseName}!`
      } else if (Math.abs(now - oneDay) < window) {
         message = `Only 1 day left for ${courseName} assignment!`
      } else if (Math.abs(now - oneHour) < window) {
         message = `Hurry! 1 hour left for ${courseName} assignment!`
      }

      if (message) {
        notificationsToSend.push({
          app_id: ONESIGNAL_APP_ID,
          contents: { en: message },
          headings: { en: "AssignCSS Reminder" },
          // Send to users subscribed to this year group tag
          filters: [
            { field: "tag", key: "year_group", relation: "=", value: yearGroup }
          ]
        })
      }
    }

    const results = []
    for (const payload of notificationsToSend) {
      const res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify(payload)
      })
      const resData = await res.json()
      results.push(resData)
    }

    return new Response(JSON.stringify({ sent: notificationsToSend.length, results }), { headers: { "Content-Type": "application/json" } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
