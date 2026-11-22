import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import {
  WhatsappSimulator,
  type Cenario,
} from "@/components/shared/whatsapp/whatsapp-simulator";
import { statusIA } from "@/lib/whatsapp/llm";

/**
 * Simulador de WhatsApp — Sprint 22.
 *
 * Permite demonstrar o fluxo completo (mensagem → lead → análise) antes da
 * conexão com a Meta: a mensagem entra pelo mesmo pipeline do webhook.
 */

const CENARIOS: Cenario[] = [
  {
    titulo: "Interesse com preço",
    nome: "Marcos Oliveira",
    telefone: "551199900001",
    mensagem:
      "Olá! Vi o anúncio no Instagram. Quero saber quanto custa o curso de NR-35 e se tem turmas noturnas.",
  },
  {
    titulo: "Quer se matricular",
    nome: "Juliana Reis",
    telefone: "551199900002",
    mensagem:
      "Bom dia, meu nome é Juliana Reis. Gostaria de me matricular no NR-10, vocês atendem em Sorocaba?",
  },
  {
    titulo: "Quer visitar a escola",
    nome: "Carlos Mendes",
    telefone: "552199900003",
    mensagem:
      "Oi! Sou Carlos Mendes, de Campinas. Posso visitar a escola pra conhecer? Quero fazer o curso de mecânica automotiva.",
  },
  {
    titulo: "Dúvida sobre pagamento",
    nome: "Ana Beatriz",
    telefone: "553199900004",
    mensagem:
      "Bom dia, recebi o boleto do curso de eletricista industrial, mas não consigo pagar hoje. Vocês conseguem gerar segunda via?",
  },
  {
    titulo: "Cliente de fora da área",
    nome: "Pedro Nunes",
    telefone: "553499900005",
    mensagem: "Olá, moro em Curitiba. Vocês têm curso de NR-10 à distância?",
  },
  {
    titulo: "Mensagem curta",
    nome: "Rita",
    telefone: "551199900006",
    mensagem: "oi, quero o curso de nr 35",
  },
];

export default async function SimuladorWhatsAppPage() {
  const ia = await statusIA();

  return (
    <div>
      <PageHeader
        title="Simulador de WhatsApp"
        description="Teste o fluxo de captação sem o número da Meta conectado"
        icon={FlaskConical}
        action={
          <Button variant="outline" asChild>
            <Link href="/captacao/whatsapp">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar à fila
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como funciona</CardTitle>
            <CardDescription>
              A mensagem abaixo entra exatamente pelo mesmo caminho de uma mensagem real da Meta:
              o sistema identifica o contato, cria o lead, grava a conversa no chat-log e roda a
              análise.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>
              A mensagem abaixo entra exatamente pelo mesmo caminho de uma mensagem real da Meta:
              o sistema identifica o contato, cria o lead, grava a conversa no chat-log e roda a
              análise.
            </p>
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              <span className="font-medium">Atenção:</span> o simulador grava no banco de verdade
              (lead, mensagem e análise). Se o telefone já existir em um lead, a mensagem entra
              naquele lead — é o mesmo comportamento de produção.
            </p>
            {ia.configurada ? (
              <p>
                Análise por IA <span className="font-medium text-emerald-700">ligada</span> (modelo{" "}
                {ia.modelo}).
              </p>
            ) : (
              <p>
                Análise por IA <span className="font-medium text-amber-700">desligada</span> — sem
                chave de IA cadastrada (Administração &gt; Integrações), a qualificação usa apenas
                as regras. O lead é criado do mesmo jeito.
              </p>
            )}
          </CardContent>
        </Card>

        <WhatsappSimulator cenarios={CENARIOS} />
      </div>
    </div>
  );
}
