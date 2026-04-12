import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Admin client (service role — bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Get and verify caller from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Non autorisé' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !caller) {
      console.error('Auth error:', userError?.message)
      return jsonResponse({ error: 'Non autorisé' }, 401)
    }

    // Check caller is CEO
    const { data: callerProfile } = await adminClient.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'ceo') {
      return jsonResponse({ error: 'Accès réservé au CEO' }, 403)
    }

    const body = await req.json()
    const { action } = body

    if (action === 'list') {
      const { data: profiles } = await adminClient.from('profiles').select('*').order('created_at')
      const { data: { users } } = await adminClient.auth.admin.listUsers()
      const result = (profiles || []).map(p => {
        const authUser = users?.find(u => u.id === p.id)
        return { ...p, email: authUser?.email || '' }
      })
      return jsonResponse(result)
    }

    if (action === 'create') {
      const { email, password, full_name, role } = body
      if (!email || !password || !full_name || !role) {
        return jsonResponse({ error: 'Champs requis manquants' }, 400)
      }
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name },
      })
      if (createError) {
        return jsonResponse({ error: createError.message }, 400)
      }
      // Update profile role (trigger creates profile with default role)
      await adminClient.from('profiles').update({ role, full_name }).eq('id', newUser.user.id)
      return jsonResponse({ success: true, user: newUser.user })
    }

    if (action === 'update') {
      const { user_id, full_name, role, email, password } = body
      if (!user_id) {
        return jsonResponse({ error: 'user_id requis' }, 400)
      }
      if (full_name || role) {
        const updates: Record<string, string> = {}
        if (full_name) updates.full_name = full_name
        if (role) updates.role = role
        await adminClient.from('profiles').update(updates).eq('id', user_id)
      }
      if (email || password) {
        const authUpdates: Record<string, string> = {}
        if (email) authUpdates.email = email
        if (password) authUpdates.password = password
        await adminClient.auth.admin.updateUserById(user_id, authUpdates)
      }
      return jsonResponse({ success: true })
    }

    if (action === 'delete') {
      const { user_id } = body
      if (!user_id || user_id === caller.id) {
        return jsonResponse({ error: 'Impossible de supprimer ce compte' }, 400)
      }
      await adminClient.auth.admin.deleteUser(user_id)
      return jsonResponse({ success: true })
    }

    if (action === 'export_all') {
      const tables = ['produits', 'bons_transfert', 'bon_transfert_lignes', 'stock_tampon', 'pertes', 'production_labo', 'inventaire', 'cloture_journaliere', 'degustations']
      const backup: Record<string, unknown[]> = {}
      for (const t of tables) {
        const { data } = await adminClient.from(t).select('*')
        backup[t] = data || []
      }
      return jsonResponse(backup)
    }

    return jsonResponse({ error: 'Action inconnue' }, 400)

  } catch (err) {
    console.error('Edge function error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
