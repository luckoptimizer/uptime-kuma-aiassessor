import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Health check function loaded")

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // For public health checks, we'll skip authentication
    // Check database connectivity
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2")
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Use service key for internal checks

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Simple health check - try to get current timestamp or check a system table
    const { data, error } = await supabase
      .rpc('version') // This is a built-in PostgreSQL function that should always work

    if (error) {
      throw error
    }

    // Return health status
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'operational',
        edge_functions: 'operational'
      },
      version: '1.0.0'
    }

    return new Response(
      JSON.stringify(healthData),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      }
    )

  } catch (error) {
    console.error('Health check failed:', error)

    const errorData = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: 'unknown',
        edge_functions: 'operational'
      }
    }

    return new Response(
      JSON.stringify(errorData),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      }
    )
  }
})