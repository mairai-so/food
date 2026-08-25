export function filterTenantRecords<T extends { restaurantId?: string; companyId?: string }>(records: T[], companyId: string | undefined): T[] {
  if (!companyId) return [];
  return records.filter((record) => {
    const recordCompanyId = record.restaurantId ?? record.companyId;
    return recordCompanyId === companyId;
  });
}
