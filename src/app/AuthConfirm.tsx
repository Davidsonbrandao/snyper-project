import { useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import type { EmailOtpType } from "@supabase/supabase-js";

export default function AuthConfirm() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let finished = false;

    const goSuccess = () => {
      if (finished) return;
      finished = true;
      window.location.replace("/");
    };

    const goError = () => {
      if (finished) return;
      finished = true;
      window.location.replace("/login?error=magic_link");
    };

    const waitForSession = async (tries = 20, delayMs = 300) => {
      for (let i = 0; i < tries; i++) {
        const { data, error } = await supabase.auth.getSession();

        if (!error && data.session) {
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      return false;
    };

    const run = async () => {
      try {
        const url = new URL(window.location.href);

        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const typeParam = (url.searchParams.get("type") || "email") as EmailOtpType;

        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;

        const hashParams = new URLSearchParams(hash);
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        const errorCode =
          url.searchParams.get("error_code") || hashParams.get("error_code");
        const errorDescription =
          url.searchParams.get("error_description") ||
          hashParams.get("error_description");

        if (errorCode) {
          console.error("Erro no callback do Supabase:", errorCode, errorDescription);
          goError();
          return;
        }

        // Fluxo recomendado para token_hash vindo do e-mail
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: typeParam,
          });

          if (error) {
            console.error("verifyOtp error:", error.message);
            goError();
            return;
          }

          const ok = await waitForSession();

          if (ok) {
            window.history.replaceState({}, document.title, "/auth/confirm");
            goSuccess();
          } else {
            goError();
          }

          return;
        }

        // Fluxo alternativo com ?code=
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error("exchangeCodeForSession error:", error.message);
            goError();
            return;
          }

          const ok = await waitForSession();

          if (ok) {
            window.history.replaceState({}, document.title, "/auth/confirm");
            goSuccess();
          } else {
            goError();
          }

          return;
        }

        // Fluxo alternativo com #access_token
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            console.error("setSession error:", error.message);
            goError();
            return;
          }

          const ok = await waitForSession();

          if (ok) {
            window.history.replaceState({}, document.title, "/auth/confirm");
            goSuccess();
          } else {
            goError();
          }

          return;
        }

        // Última checagem
        const ok = await waitForSession(8, 250);

        if (ok) {
          goSuccess();
        } else {
          goError();
        }
      } catch (error) {
        console.error("AuthConfirm crash:", error);
        goError();
      }
    };

    run();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: 8 }}>Validando seu acesso...</h2>
        <p style={{ opacity: 0.7 }}>Aguarde alguns segundos.</p>
      </div>
    </div>
  );
}