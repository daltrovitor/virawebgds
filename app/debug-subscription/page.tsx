import { createClient } from "@/lib/supabase/server"

export default async function DebugSubscriptionPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div className="p-8">Usuário não autenticado</div>
  }

  const { data: subscription, error } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).single()

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug - Dados da Assinatura</h1>

      <div className="bg-muted p-4 rounded-lg mb-4">
        <h2 className="font-semibold mb-2">User ID:</h2>
        <pre className="text-sm">{user.id}</pre>
      </div>

      <div className="bg-muted p-4 rounded-lg mb-4">
        <h2 className="font-semibold mb-2">Erro (se houver):</h2>
        <pre className="text-sm">{error ? JSON.stringify(error, null, 2) : "Nenhum erro"}</pre>
      </div>

      <div className="bg-muted p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Dados da Assinatura:</h2>
        <pre className="text-sm overflow-auto">
          {subscription ? JSON.stringify(subscription, null, 2) : "Nenhuma assinatura encontrada"}
        </pre>
      </div>

      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <h2 className="font-semibold mb-2">Valores esperados para plan_type:</h2>
        <ul className="list-disc list-inside text-sm">
          <li>basic</li>
          <li>premium</li>
          <li>master</li>
        </ul>
      </div>
    </div>
  )
}
