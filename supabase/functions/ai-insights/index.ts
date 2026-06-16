import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const token = authHeader.replace('Bearer ', '')
    const authClient = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userErr } = await authClient.auth.getUser(token)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Server-side permission check (don't trust the client-side gate)
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: isCeo } = await adminClient.rpc('is_ceo', { _user_id: userData.user.id })
    let allowed = !!isCeo
    if (!allowed) {
      const { data: canRead } = await adminClient.rpc('can_perform', { _user_id: userData.user.id, _module: 'insights', _action: 'read' })
      allowed = !!canRead
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const db = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } })

    const today = new Date().toISOString().slice(0, 10)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    const [
      { data: recentPertes },
      { data: recentProduction },
      { data: recentCloture },
      { data: recentAchats },
      { data: produits },
      { data: economatStock },
      { data: economatMouv },
      { data: ventes },
    ] = await Promise.all([
      db.from('pertes').select('*, produits(nom, categorie)').gte('semaine_debut', weekAgo).limit(100),
      db.from('production_labo').select('*, produits(nom, categorie)').gte('date_production', weekAgo).limit(100),
      db.from('cloture_journaliere').select('*, produits(nom, categorie)').gte('date_cloture', weekAgo).limit(200),
      db.from('achats_mp').select('*').gte('date_achat', monthAgo).limit(100),
      db.from('produits').select('nom, categorie, prix_vente, prix_cout, actif').eq('actif', true).limit(300),
      db.from('v_economat_stock').select('*').limit(500),
      db.from('economat_mouvements').select('*, economat_articles(nom, unite)').gte('date_mouvement', weekAgo).limit(100),
      db.from('ventes').select('id, total, mode_paiement, created_at').gte('created_at', weekAgo).limit(200),
    ])

    const alertesEconomat = (economatStock || []).filter((s: any) => Number(s.stock_courant) <= Number(s.stock_min) && Number(s.stock_min) > 0);
    const valeurStock = (economatStock || []).reduce((sum: number, s: any) => sum + Number(s.valeur_stock || 0), 0);
    const caSemaine = (ventes || []).reduce((sum: number, v: any) => sum + Number(v.total || 0), 0);

    const dataContext = `
DONNÉES SAADÉ (pâtisserie libanaise, Lomé, Togo) — Date: ${today}
CA 7 jours: ${caSemaine.toLocaleString('fr-FR')} F · Ventes: ${ventes?.length || 0}
Valeur économat totale: ${valeurStock.toLocaleString('fr-FR')} F · Articles en alerte: ${alertesEconomat.length}

PRODUITS ACTIFS (${produits?.length || 0}): ${produits?.slice(0, 100).map(p => `${p.nom} [${p.categorie}] ${p.prix_vente}F`).join(' | ') || '—'}

ÉCONOMAT — État du stock (${economatStock?.length || 0} articles):
${(economatStock || []).map((s: any) => `${s.categorie} · ${s.nom} : stock=${s.stock_courant} ${s.unite} (init=${s.stock_initial}, entrées=${s.total_entrees}, sorties=${s.total_sorties}, pertes=${s.total_pertes}) · ${s.prix_unitaire}F → ${s.valeur_stock}F${Number(s.stock_courant) <= Number(s.stock_min) && Number(s.stock_min) > 0 ? ' ⚠️ ALERTE' : ''}`).join('\n')}

ÉCONOMAT — Mouvements 7j:
${(economatMouv || []).map((m: any) => `${m.date_mouvement} ${m.type} ${m.quantite} ${m.economat_articles?.unite || ''} de ${m.economat_articles?.nom || '?'} (${m.motif || '—'})`).join('\n')}

PERTES 7j: ${JSON.stringify(recentPertes?.map(p => ({ produit: (p as any).produits?.nom, qte: p.quantite, jour: p.jour, labo: p.type_labo })) || [])}

PRODUCTION 7j: ${JSON.stringify(recentProduction?.map(p => ({ produit: (p as any).produits?.nom, produite: p.qte_produite, perte: p.qte_perte, sortie_salle: p.qte_sortie_en_salle, date: p.date_production })) || [])}

CLÔTURE SALLE 7j: ${JSON.stringify(recentCloture?.map(c => ({ produit: (c as any).produits?.nom, vendue: c.qte_vendue, invendu: c.qte_invendu, perte: c.qte_perte, date: c.date_cloture })) || [])}

ACHATS MP 30j: ${JSON.stringify(recentAchats?.map(a => ({ produit: a.produit, fournisseur: a.fournisseur, qte: a.quantite, total: a.prix_total, date: a.date_achat })) || [])}
`

    const { messages } = await req.json()

    const systemPrompt = `Tu es l'**Assistante personnelle de la CEO de SAADÉ** (pâtisserie libanaise, Lomé, Togo). Tu es vive, précise, et tu raisonnes comme une CEO expérimentée mais 1000× plus vite.

📋 **Tes capacités** :
1. Répondre en temps réel sur les **stocks** (économat, articles, alertes, valeur)
2. Analyser **ventes**, **pertes**, **production**, **achats** avec des chiffres précis
3. Lire les **fichiers joints** (Excel, CSV, PDF) que la CEO te fournit et les croiser avec les données live
4. Suggérer des **actions concrètes** : commandes à passer, alertes critiques, optimisations
5. Quand la CEO te demande un **mouvement de stock** (entrée, sortie, perte), tu PRÉPARES la donnée à saisir et tu indiques précisément où elle doit cliquer dans l'app (page Économat → bouton Mouvement). Pour l'instant, tu ne peux pas valider la saisie toi-même, mais tu peux préparer un récap copiable.
6. Si on te joint un fichier d'inventaire, **compare-le aux stocks actuels** et signale les écarts.

🎯 **Style** : français, concis, bullet points + emojis pour la lisibilité. Toujours des chiffres précis. Conclus par 1 ou 2 actions à faire.

${dataContext}`

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      const status = response.status
      if (status === 429) return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      if (status === 402) return new Response(JSON.stringify({ error: 'Credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const t = await response.text()
      console.error('AI error:', status, t)
      return new Response(JSON.stringify({ error: 'AI service unavailable' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(response.body, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } })
  } catch (e) {
    console.error('Error:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
