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
    // Simple health check - no database access required for basic monitoring
    // This ensures the function itself is operational
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        edge_functions: 'operational'
      },
      message: 'Supabase Edge Functions are operational',
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
        edge_functions: 'error'
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