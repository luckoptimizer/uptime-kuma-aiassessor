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
    // Check database connectivity
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2")
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Simple health check - try to get current timestamp
    const { data, error } = await supabase
      .from('_health_check')
      .select('*')
      .limit(1)

    if (error && !error.message.includes('relation "_health_check" does not exist')) {
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
      uptime: 'unknown', // Could be enhanced with more metrics
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