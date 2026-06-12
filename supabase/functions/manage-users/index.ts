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

// Rate-limit en mémoire : 20/min, 100/h
const rlMap = new Map<string, { minute: number[]; hour: number[] }>()
function rateLimit(userId: string): { ok: boolean; reason?: string } {
  const now = Date.now()
  const entry = rlMap.get(userId) || { minute: [], hour: [] }
  entry.minute = entry.minute.filter(t => now - t < 60_000)
  entry.hour = entry.hour.filter(t => now - t < 3_600_000)
  if (entry.minute.length >= 20) return { ok: false, reason: 'Trop de requêtes (max 20/min)' }
  if (entry.hour.length >= 100) return { ok: false, reason: 'Trop de requêtes (max 100/h)' }
  entry.minute.push(now); entry.hour.push(now)
  rlMap.set(userId, entry)
  return { ok: true }
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

    const rl = rateLimit(caller.id)
    if (!rl.ok) return jsonResponse({ error: rl.reason }, 429)

    // Caller doit être CEO OU developer
    const { data: callerRoles } = await adminClient
      .from('user_roles').select('role').eq('user_id', caller.id)
    const callerRoleSet = new Set((callerRoles || []).map((r: any) => r.role))
    const isCeo = callerRoleSet.has('ceo')
    const isDev = callerRoleSet.has('developer')
    if (!isCeo && !isDev) return jsonResponse({ error: 'Accès réservé au CEO' }, 403)

    const body = await req.json()
    const { action } = body

    if (action === 'list') {
      const { data: profiles } = await adminClient.from('profiles').select('*').order('created_at')
      const { data: roles } = await adminClient.from('user_roles').select('user_id, role')
      const { data: { users } } = await adminClient.auth.admin.listUsers()
      let result = (profiles || []).map((p: any) => {
        const authUser = users?.find(u => u.id === p.id)
        const userRoles = (roles || []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role)
        return { ...p, email: authUser?.email || '', roles: userRoles }
      })
      // Filtrer les comptes cachés (developer) — sauf si le caller EST developer
      if (!isDev) {
        result = result.filter((u: any) => !u.is_hidden && !u.roles.includes('developer'))
      }
      return jsonResponse(result)
    }

    if (action === 'create') {
      const { email, password, full_name, role, is_hidden } = body
      if (!email || !password || !full_name || !role) return jsonResponse({ error: 'Champs requis manquants' }, 400)
      // Seul un developer peut créer un autre developer ou un user caché
      if ((role === 'developer' || is_hidden) && !isDev) {
        return jsonResponse({ error: 'Action réservée au developer' }, 403)
      }
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      })
      if (createError) return jsonResponse({ error: createError.message }, 400)
      await adminClient.from('profiles').update({
        full_name, role, is_hidden: !!is_hidden,
      }).eq('id', newUser.user.id)
      await adminClient.from('user_roles').delete().eq('user_id', newUser.user.id)
      await adminClient.from('user_roles').insert({ user_id: newUser.user.id, role })
      return jsonResponse({ success: true, user: newUser.user })
    }

    if (action === 'update') {
      const { user_id, full_name, role, roles, email, password, is_hidden } = body
      if (!user_id) return jsonResponse({ error: 'user_id requis' }, 400)
      // Protection : un CEO non-dev ne peut pas modifier un compte developer ou caché
      const { data: target } = await adminClient.from('profiles').select('is_hidden').eq('id', user_id).maybeSingle()
      const { data: targetRoles } = await adminClient.from('user_roles').select('role').eq('user_id', user_id)
      const targetIsDev = (targetRoles || []).some((r: any) => r.role === 'developer')
      if ((target?.is_hidden || targetIsDev) && !isDev) {
        return jsonResponse({ error: 'Action réservée au developer' }, 403)
      }
      if (full_name || role || typeof is_hidden === 'boolean') {
        const updates: Record<string, any> = {}
        if (full_name) updates.full_name = full_name
        if (role) updates.role = role
        if (typeof is_hidden === 'boolean' && isDev) updates.is_hidden = is_hidden
        await adminClient.from('profiles').update(updates).eq('id', user_id)
      }
      if (Array.isArray(roles)) {
        if (roles.includes('developer') && !isDev) {
          return jsonResponse({ error: 'Seul un developer peut accorder ce rôle' }, 403)
        }
        await adminClient.from('user_roles').delete().eq('user_id', user_id)
        if (roles.length > 0) {
          await adminClient.from('user_roles').insert(roles.map((r: string) => ({ user_id, role: r })))
        }
      } else if (role) {
        if (role === 'developer' && !isDev) {
          return jsonResponse({ error: 'Seul un developer peut accorder ce rôle' }, 403)
        }
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
      const { data: target } = await adminClient.from('profiles').select('is_hidden').eq('id', user_id).maybeSingle()
      const { data: targetRoles } = await adminClient.from('user_roles').select('role').eq('user_id', user_id)
      const targetIsDev = (targetRoles || []).some((r: any) => r.role === 'developer')
      if ((target?.is_hidden || targetIsDev) && !isDev) {
        return jsonResponse({ error: 'Action réservée au developer' }, 403)
      }
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
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
