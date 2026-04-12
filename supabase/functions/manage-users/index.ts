import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller is authenticated CEO
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify the caller
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check caller is CEO
    const { data: callerProfile } = await userClient.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'ceo') {
      return new Response(JSON.stringify({ error: 'Accès réservé au CEO' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const body = await req.json()
    const { action } = body

    if (action === 'list') {
      const { data: profiles } = await adminClient.from('profiles').select('*').order('created_at')
      const { data: { users } } = await adminClient.auth.admin.listUsers()
      const result = (profiles || []).map(p => {
        const authUser = users?.find(u => u.id === p.id)
        return { ...p, email: authUser?.email || '' }
      })
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'create') {
      const { email, password, full_name, role } = body
      if (!email || !password || !full_name || !role) {
        return new Response(JSON.stringify({ error: 'Champs requis manquants' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name },
      })
      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      // Update profile role
      await adminClient.from('profiles').update({ role, full_name }).eq('id', newUser.user.id)
      return new Response(JSON.stringify({ success: true, user: newUser.user }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'update') {
      const { user_id, full_name, role, email, password } = body
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id requis' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      const { user_id } = body
      if (!user_id || user_id === caller.id) {
        return new Response(JSON.stringify({ error: 'Impossible de supprimer ce compte' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      await adminClient.auth.admin.deleteUser(user_id)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'export_all') {
      // Export all tables data for backup
      const tables = ['produits', 'bons_transfert', 'bon_transfert_lignes', 'stock_tampon', 'pertes', 'production_labo', 'inventaire', 'cloture_journaliere', 'degustations']
      const backup: Record<string, any[]> = {}
      for (const t of tables) {
        const { data } = await adminClient.from(t).select('*')
        backup[t] = data || []
      }
      return new Response(JSON.stringify(backup), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Action inconnue' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
