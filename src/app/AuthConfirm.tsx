import { useEffect } from "react";
import { Navigate } from "react-router";

export default function AuthConfirm() {
  useEffect(() => {
    window.location.replace("/login");
  }, []);

  return <Navigate to="/login" replace />;
}

