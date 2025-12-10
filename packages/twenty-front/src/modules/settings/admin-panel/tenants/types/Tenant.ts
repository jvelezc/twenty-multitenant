export type TenantSummary = {
  id: string;
  displayName: string;
  subdomain: string;
  createdAt: string;
  isDisabled: boolean;
  userCount: number;
};

export type TenantUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

export type TenantDetails = TenantSummary & {
  users: TenantUser[];
  disabledAt?: string;
  disabledReason?: string;
  adminNotes?: string;
  contactCount?: number;
  companyCount?: number;
  opportunityCount?: number;
};

export type TenantStats = {
  totalTenants: number;
  activeTenants: number;
  disabledTenants: number;
  totalUsers: number;
};
