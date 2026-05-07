import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SignJWT } from "https://deno.land/x/jose@v4.14.4/index.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { password } = await req.json()
    
    if (!password) {
      return new Response(JSON.stringify({ error: 'Password is required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify password via DB using pgcrypto crypt function
    // We can do this by executing a Postgres function or checking hashes manually. 
    // Wait, let's just create a Postgres function to verify passwords.
    // Actually, since we have pg_crypto, we can just select passwords and compare. But checking crypt('plain', password_hash) = password_hash must be done in DB.
    
    // Instead of querying all and comparing, let's just call a raw query using RPC.
    const { data: userRecord, error } = await supabase.rpc('verify_password', { input_password: password })
    
    if (error || !userRecord || userRecord.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid password' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    }

    const user = userRecord[0]

    // Create JWT
    const secretStr = Deno.env.get('MY_JWT_SECRET')
    if (!secretStr) {
      throw new Error('MY_JWT_SECRET is not set in edge function secrets')
    }
    const secret = new TextEncoder().encode(secretStr)
    const jwt = await new SignJWT({ 
        role: 'authenticated', 
        user_role: user.user_role,
        class_name: user.user_class_name,
        // Add sub and aud for Supabase to recognize it
        sub: user.user_id,
        aud: 'authenticated',
        iss: 'supabase'
      })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret)

    return new Response(
      JSON.stringify({ token: jwt, role: user.user_role, class_name: user.user_class_name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
