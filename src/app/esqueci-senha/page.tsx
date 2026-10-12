import { IconUser } from "@/components/icons";
import { ForgotPasswordForm } from "@/app/esqueci-senha/forgot-password-form";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[linear-gradient(135deg,#c9bbb0_0%,#f7f4f0_40%,#fff_70%,#eee2d4_100%)] px-4 py-8">
      <section aria-labelledby="forgot-title" className="ui-card w-full max-w-md p-6 sm:p-8">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <span className="grid size-16 place-items-center rounded-2xl border-[3px] border-gold text-gold">
            <IconUser className="size-10" />
          </span>
          <p className="text-xl font-bold">Cartão de Visita Digital</p>
        </div>
        <h1 id="forgot-title" className="text-2xl font-semibold">Esqueci a senha</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-muted-foreground">
          Informe seu usuário. A administração será avisada para criar uma nova senha.
        </p>
        <ForgotPasswordForm />
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Consulte o <Link href="/privacidade" className="font-medium text-gold hover:underline">aviso de privacidade</Link>.
        </p>
      </section>
    </main>
  );
}
