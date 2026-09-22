/** URL publique du back-office (non listée dans le header catalogue). */
export const ADMIN_BASE_PATH = '/gestion-afeconcatalogue';

export function adminPath(segment = '') {
  if (!segment) return ADMIN_BASE_PATH;
  const clean = segment.replace(/^\//, '');
  return `${ADMIN_BASE_PATH}/${clean}`;
}
