import { ShieldAlert, Lock, Eye } from "lucide-react";
import { usePermissions } from "../lib/permissions-context";

interface PermissionGateProps {
  module: string;
  action?: "view" | "add" | "edit" | "delete";
  children: React.ReactNode;
  /** What to render when access is denied. Defaults to null (hide) */
  fallback?: React.ReactNode;
  /** If true, shows a styled "no access" block instead of hiding */
  showBlock?: boolean;
}

/**
 * Wraps content that requires a specific permission.
 * If user doesn't have the permission, content is hidden or replaced with fallback.
 */
export function PermissionGate({ module, action = "view", children, fallback, showBlock }: PermissionGateProps) {
  const { can } = usePermissions();

  if (can(module, action)) {
    return <>{children}</>;
  }

  if (showBlock) {
    return <NoAccessBlock />;
  }

  return fallback ? <>{fallback}</> : null;
}

/**
 * Full-page "no access" component shown when a user doesn't have view permission.
 */
export function NoAccessPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-[#ef4444]/10 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert className="w-8 h-8 text-[#ef4444]" />
        </div>
        <h2 className="text-[18px] text-white mb-2" style={{ fontWeight: 600 }}>Acesso Restrito</h2>
        <p className="text-[14px] text-[#8a8a99] leading-relaxed mb-4">
          Voce nao possui permissao para acessar este modulo.
          Entre em contato com o administrador do sistema para solicitar acesso.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.04] rounded-xl text-[12px] text-[#8a8a99]">
          <Lock className="w-3.5 h-3.5" />
          Permissao necessaria: Visualizar
        </div>
      </div>
    </div>
  );
}

/**
 * Inline "no access" block for sections within a page.
 */
export function NoAccessBlock() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#ef4444]/5 border border-[#ef4444]/10 rounded-xl">
      <Lock className="w-4 h-4 text-[#ef4444] shrink-0" />
      <span className="text-[12px] text-[#8a8a99]">Voce nao possui permissao para esta acao.</span>
    </div>
  );
}

/**
 * Read-only badge shown on pages where user only has view permission.
 */
export function ReadOnlyBadge() {
  const { can } = usePermissions();
  // Show badge if user can view but can't add, edit, or delete
  // (we call this per-module, so we check current module from the caller)
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3b82f6]/10 border border-[#3b82f6]/15 rounded-lg text-[11px] text-[#3b82f6]" style={{ fontWeight: 500 }}>
      <Eye className="w-3.5 h-3.5" />
      Somente leitura
    </div>
  );
}
