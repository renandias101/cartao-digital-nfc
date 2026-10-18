import type { Metadata } from "next";
import Link from "next/link";

import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacidade | Cartão de Visita Digital",
  description: "Como o Cartão de Visita Digital trata e protege dados pessoais.",
};

const updatedAt = "12 de outubro de 2026";

export default function PrivacyPage() {
  const contactUrl = `https://wa.me/${publicEnv.whatsappRenovacao}?text=${encodeURIComponent("Olá, quero falar sobre meus dados pessoais no Cartão de Visita Digital.")}`;

  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-8 sm:py-12">
      <article className="ui-card mx-auto max-w-3xl space-y-8 p-6 sm:p-10">
        <header className="space-y-3 border-b border-border pb-6">
          <p className="text-sm font-medium text-gold">Cartão de Visita Digital</p>
          <h1 className="text-3xl font-semibold tracking-tight">Aviso de privacidade</h1>
          <p className="text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
          <p className="leading-relaxed text-zinc-700">
            Este aviso explica quais dados usamos, para quais finalidades, por quanto tempo e como você pode exercer seus direitos.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Quem cuida dos dados</h2>
          <p className="leading-relaxed text-zinc-700">
            Renan Monteiro Dias, pessoa física, é o responsável pelo tratamento realizado neste sistema. Para questões sobre seus dados, use o WhatsApp (96) 98123-3398, indicado ao final deste aviso.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Dados tratados e finalidades</h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed text-zinc-700">
            <li>nome, usuário e dados de contato, para criar e administrar a conta;</li>
            <li>conteúdo e imagens do cartão, para editar e publicar a página solicitada;</li>
            <li>informações de pagamento, vencimento e renovação, para administrar o serviço;</li>
            <li>pedidos de suporte e redefinição de senha, para atendimento e segurança;</li>
            <li>registros de ações administrativas e dados técnicos mínimos, para prevenir abuso, investigar falhas e proteger contas.</li>
          </ul>
          <p className="leading-relaxed text-zinc-700">
            O navegador pode guardar somente o nome de usuário quando você marca “Lembrar de mim”. A senha não é guardada por essa opção e o dado pode ser removido desmarcando-a ou limpando os dados do site.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Uso e compartilhamento</h2>
          <p className="leading-relaxed text-zinc-700">
            Usamos os dados para executar o serviço contratado, atender solicitações, cumprir obrigações aplicáveis e proteger o sistema. A página pública mostra apenas o conteúdo que foi publicado enquanto a conta está ativa. Dados administrativos, pagamentos, rascunhos e chamados não aparecem no cartão público.
          </p>
          <p className="leading-relaxed text-zinc-700">
            O sistema usa Supabase para banco de dados, autenticação e armazenamento, e Vercel para hospedagem. Esses fornecedores processam dados técnicos necessários à operação e segurança conforme seus próprios compromissos contratuais e de privacidade. Não vendemos dados pessoais nem enviamos mensagens automáticas por e-mail ou WhatsApp no fluxo de recuperação de senha.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Retenção e exclusão</h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed text-zinc-700">
            <li>dados da conta e do cartão permanecem durante a prestação do serviço;</li>
            <li>uma conta cancelada torna-se elegível para exclusão após três meses; a remoção é feita pela administração após verificar obrigações pendentes;</li>
            <li>tentativas de recuperação de senha são mantidas para aplicar limites de frequência; uma rotina horária exclui os registros depois que completam 24 horas;</li>
            <li>pedidos de suporte e recuperação concluídos são revisados periodicamente e mantidos somente pelo prazo necessário ao atendimento e à segurança;</li>
            <li>registros financeiros e de auditoria podem ser preservados pelo prazo exigido para obrigações legais, prevenção de fraude e defesa de direitos;</li>
            <li>cópias de segurança seguem o ciclo de retenção do provedor e deixam de ser usadas para operação normal após a exclusão.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Seus direitos</h2>
          <p className="leading-relaxed text-zinc-700">
            Você pode pedir confirmação e acesso, correção, informação sobre compartilhamentos, portabilidade quando aplicável, revisão, anonimização ou exclusão. Alguns dados podem precisar ser preservados para cumprir obrigação legal ou proteger direitos. Antes de atender ao pedido, confirmaremos sua identidade por um canal seguro.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Segurança e contato</h2>
          <p className="leading-relaxed text-zinc-700">
            Aplicamos controle de acesso, isolamento entre contas, armazenamento privado de imagens e registro de ações administrativas. Nenhum sistema elimina todos os riscos; se você suspeitar de acesso indevido, avise a administração imediatamente.
          </p>
          <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn-primary w-fit">
            Falar sobre meus dados
          </a>
        </section>

        <footer className="border-t border-border pt-6">
          <Link href="/login" className="text-sm font-medium text-gold hover:underline">Voltar para a entrada</Link>
        </footer>
      </article>
    </main>
  );
}
