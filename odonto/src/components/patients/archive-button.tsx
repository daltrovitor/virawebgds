// Hello World
"use client";

import { setPatientStatusAction } from "@/actions/patients";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";

/** Arquivar preserva todo o histórico clínico e financeiro; nada é apagado. */
export function ArchivePatientButton({ patientId, status }: { patientId: string; status: "active" | "archived" }) {
  const { run, pending } = useAction((s: "active" | "archived") => setPatientStatusAction(patientId, s), {
    success: status === "active" ? "Paciente arquivado" : "Paciente reativado",
  });
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() => {
        if (status === "active" && !window.confirm("Arquivar o paciente? O histórico é preservado e ele deixa de aparecer na busca padrão.")) return;
        void run(status === "active" ? "archived" : "active");
      }}
    >
      {status === "active" ? "Arquivar" : "Reativar"}
    </Button>
  );
}
