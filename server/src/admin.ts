import type {Account,Store} from './store/types.js';
/**
 * The one admin check. The stored role (tn2_accounts.is_admin, granted by UID with /gm admin) decides;
 * ADMIN_IDS (internal ids or 9-digit UIDs) stays as a bootstrap/emergency override that commands cannot revoke.
 * Always reads the account fresh, so a grant or revoke applies to connected players at once.
 */
export function adminAccess(store:Store,overrideIds:string[]=[]) {
 const overridden=(a:Account)=>overrideIds.some(id=>id.trim()===a.id||id.trim()===a.uid);
 const isAdminAccount=(a:Account|undefined)=>!!a&&(a.isAdmin===true||overridden(a));
 return {
  isAdminAccount,
  /** True for an ADMIN_IDS account (its role is not stored, so it cannot be removed by command). */
  overridden,
  async isAdmin(accountId:string){return isAdminAccount(await store.account(accountId));},
 };
}
export type AdminAccess=ReturnType<typeof adminAccess>;
