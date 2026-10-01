// Hello World
import { EmptyState } from "./page";

export function NoAccess({ what = "esta área" }: { what?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white">
      <EmptyState title="Acesso não permitido" description={`Seu papel nesta clínica não inclui ${what}. Fale com o administrador se precisar de acesso.`} />
    </div>
  );
}
