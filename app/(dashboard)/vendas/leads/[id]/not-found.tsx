import Link from "next/link";
import { FileQuestion, ArrowLeft, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LeadNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <FileQuestion className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <CardTitle>Lead não encontrado</CardTitle>
              <CardDescription>
                Este lead pode ter sido excluído, ou não está atribuído a você.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-slate-600">
            Verifique se o link está correto. Se você chegou aqui por um
            card de alerta, é possível que outro vendedor já tenha assumido
            este lead.
          </p>
          <div className="flex gap-2 pt-2">
            <Button asChild>
              <Link href="/vendas/leads">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Ver meus leads
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/vendas/alertas">
                <Phone className="mr-2 h-4 w-4" />
                Meus alertas
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
