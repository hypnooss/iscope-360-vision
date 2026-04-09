import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (data.valid === true) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleConfirm = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-lg border border-border p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Cancelar inscrição</h1>

        {status === "loading" && (
          <p className="text-muted-foreground">Verificando...</p>
        )}

        {status === "valid" && (
          <>
            <p className="text-muted-foreground">
              Deseja cancelar o recebimento de emails do iScope360?
            </p>
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-destructive text-destructive-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Confirmar cancelamento
            </button>
          </>
        )}

        {status === "success" && (
          <p className="text-green-500">Inscrição cancelada com sucesso. Você não receberá mais emails.</p>
        )}

        {status === "already" && (
          <p className="text-muted-foreground">Você já cancelou a inscrição anteriormente.</p>
        )}

        {status === "invalid" && (
          <p className="text-destructive">Link inválido ou expirado.</p>
        )}

        {status === "error" && (
          <p className="text-destructive">Erro ao processar. Tente novamente mais tarde.</p>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
