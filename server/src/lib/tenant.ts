import { kvGet } from "./kv.js";

export function orgFinanceKey(orgId: string) {
  return `finance_data_org_${orgId}`;
}

export function orgTeamKey(orgId: string) {
  return `team_members_org_${orgId}`;
}

export function orgProfilesKey(orgId: string) {
  return `access_profiles_org_${orgId}`;
}

export function userThemeKey(userId: string) {
  return `user_theme_${userId}`;
}

export function orgInvoicesKey(orgId: string) {
  return `invoices_org_${orgId}`;
}

export function orgInvoiceConfigKey(orgId: string) {
  return `invoice_config_org_${orgId}`;
}

export function tenantKey(orgId: string) {
  return `saas_tenant_${orgId}`;
}

export function allTenantsKey() {
  return "saas_all_tenants";
}

export function couponKey(code: string) {
  return `saas_coupon_${code}`;
}

export function allCouponsKey() {
  return "saas_all_coupons";
}

export function ticketKey(id: string) {
  return `saas_ticket_${id}`;
}

export function allTicketsKey() {
  return "saas_all_tickets";
}

export function tenantTicketsKey(orgId: string) {
  return `saas_tenant_tickets_${orgId}`;
}

export function allPlansKey() {
  return "saas_all_plans";
}

export function legacyFinanceKey(userId: string) {
  return `finance_data_${userId}`;
}

export function legacyTeamKey(userId: string) {
  return `team_members_${userId}`;
}

export async function resolveOrgId(userId: string) {
  const mapping = await kvGet(`user_org_${userId}`);
  if (mapping && typeof mapping === "string") {
    return mapping;
  }

  return userId;
}
