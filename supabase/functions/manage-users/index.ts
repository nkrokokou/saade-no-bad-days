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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Non autorisé' }, 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !caller) return jsonResponse({ error: 'Non autorisé' }, 401)

    // CEO check via user_roles
    const { data: ceoCheck } = await adminClient.from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'ceo').maybeSingle()
    if (!ceoCheck) return jsonResponse({ error: 'Accès réservé au CEO' }, 403)

    const body = await req.json()
    const { action } = body

    if (action === 'list') {
      const { data: profiles } = await adminClient.from('profiles').select('*').order('created_at')
      const { data: roles } = await adminClient.from('user_roles').select('user_id, role')
      const { data: { users } } = await adminClient.auth.admin.listUsers()
      const result = (profiles || []).map(p => {
        const authUser = users?.find(u => u.id === p.id)
        const userRoles = (roles || []).filter(r => r.user_id === p.id).map(r => r.role)
        return { ...p, email: authUser?.email || '', roles: userRoles }
      })
      return jsonResponse(result)
    }

    if (action === 'create') {
      const { email, password, full_name, role } = body
      if (!email || !password || !full_name || !role) return jsonResponse({ error: 'Champs requis manquants' }, 400)
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      })
      if (createError) return jsonResponse({ error: createError.message }, 400)
      await adminClient.from('profiles').update({ full_name, role }).eq('id', newUser.user.id)
      // Replace default role with chosen role
      await adminClient.from('user_roles').delete().eq('user_id', newUser.user.id)
      await adminClient.from('user_roles').insert({ user_id: newUser.user.id, role })
      return jsonResponse({ success: true, user: newUser.user })
    }

    if (action === 'update') {
      const { user_id, full_name, role, roles, email, password } = body
      if (!user_id) return jsonResponse({ error: 'user_id requis' }, 400)
      if (full_name || role) {
        const updates: Record<string, string> = {}
        if (full_name) updates.full_name = full_name
        if (role) updates.role = role
        await adminClient.from('profiles').update(updates).eq('id', user_id)
      }
      // Multi-roles support
      if (Array.isArray(roles)) {
        await adminClient.from('user_roles').delete().eq('user_id', user_id)
        if (roles.length > 0) {
          await adminClient.from('user_roles').insert(roles.map((r: string) => ({ user_id, role: r })))
        }
      } else if (role) {
        await adminClient.from('user_roles').delete().eq('user_id', user_id)
        await adminClient.from('user_roles').insert({ user_id, role })
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
      if (!user_id || user_id === caller.id) return jsonResponse({ error: 'Impossible de supprimer ce compte' }, 400)
      await adminClient.auth.admin.deleteUser(user_id)
      return jsonResponse({ success: true })
    }

    if (action === 'export_all') {
      const tables = ['produits', 'bons_transfert', 'bon_transfert_lignes', 'stock_tampon', 'pertes', 'production_labo', 'inventaire', 'cloture_journaliere', 'degustations', 'achats_mp', 'fiches_techniques', 'mouvements_stock', 'user_roles', 'module_permissions']
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
