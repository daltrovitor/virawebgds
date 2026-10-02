// Hello World
import type { Metadata } from "next"
import DemoExperience from "@/components/vwo/demo-experience"

export const metadata: Metadata = {
  title: "Demonstração interativa",
  description:
    "Experimente o Vira Web Odonto com uma clínica fictícia: agenda semanal, orçamento pelo odontograma e plano de pagamento — sem cadastro.",
}

export default function DemoPage() {
  return <DemoExperience />
}
