import { SettingsAdminTenantDetail } from '@/settings/admin-panel/tenants/components/SettingsAdminTenantDetail';
import { SettingsAdminTenantList } from '@/settings/admin-panel/tenants/components/SettingsAdminTenantList';
import { SettingsAdminTenantStatsCards } from '@/settings/admin-panel/tenants/components/SettingsAdminTenantStatsCards';
import { useTenantApi } from '@/settings/admin-panel/tenants/hooks/useTenantApi';
import type {
    TenantDetails,
    TenantStats,
    TenantSummary,
} from '@/settings/admin-panel/tenants/types/Tenant';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useState } from 'react';
import { H2Title, IconFilter, IconRefresh, IconSearch } from 'twenty-ui/display';
import { Button, TextInput, Toggle } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';

const StyledSearchContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  align-items: center;
`;

const StyledSearchInput = styled.div`
  flex: 1;
`;

const StyledFilterContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const SettingsAdminTenants = () => {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [includeDisabled, setIncludeDisabled] = useState(true);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const { enqueueSnackBar } = useSnackBar();
  const {
    getTenants,
    getTenantDetails,
    getStats,
    disableTenant,
    enableTenant,
    updateAdminNotes,
    isLoading,
  } = useTenantApi();

  const loadTenants = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const data = await getTenants({ includeDisabled, search: searchQuery });
      setTenants(data);
    } catch (error) {
      enqueueSnackBar({
        message: t`Failed to load tenants`,
        variant: 'error',
      });
    } finally {
      setIsLoadingList(false);
    }
  }, [getTenants, includeDisabled, searchQuery, enqueueSnackBar]);

  const loadStats = useCallback(async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [getStats]);

  useEffect(() => {
    loadTenants();
    loadStats();
  }, [loadTenants, loadStats]);

  const handleSelectTenant = async (tenant: TenantSummary) => {
    setIsLoadingDetail(true);
    try {
      const details = await getTenantDetails(tenant.id);
      setSelectedTenant(details);
    } catch (error) {
      enqueueSnackBar({
        message: t`Failed to load tenant details`,
        variant: 'error',
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleBack = () => {
    setSelectedTenant(null);
  };

  const handleDisable = async (tenantId: string, reason: string) => {
    try {
      await disableTenant(tenantId, reason);
      enqueueSnackBar({
        message: t`Tenant disabled successfully`,
        variant: 'success',
      });
      // Refresh data
      const details = await getTenantDetails(tenantId);
      setSelectedTenant(details);
      loadTenants();
      loadStats();
    } catch (error) {
      enqueueSnackBar({
        message: t`Failed to disable tenant`,
        variant: 'error',
      });
    }
  };

  const handleEnable = async (tenantId: string) => {
    try {
      await enableTenant(tenantId);
      enqueueSnackBar({
        message: t`Tenant enabled successfully`,
        variant: 'success',
      });
      // Refresh data
      const details = await getTenantDetails(tenantId);
      setSelectedTenant(details);
      loadTenants();
      loadStats();
    } catch (error) {
      enqueueSnackBar({
        message: t`Failed to enable tenant`,
        variant: 'error',
      });
    }
  };

  const handleUpdateNotes = async (tenantId: string, notes: string) => {
    try {
      await updateAdminNotes(tenantId, notes);
      enqueueSnackBar({
        message: t`Notes updated successfully`,
        variant: 'success',
      });
      // Refresh tenant details
      const details = await getTenantDetails(tenantId);
      setSelectedTenant(details);
    } catch (error) {
      enqueueSnackBar({
        message: t`Failed to update notes`,
        variant: 'error',
      });
    }
  };

  const handleSearch = () => {
    loadTenants();
  };

  const handleRefresh = () => {
    loadTenants();
    loadStats();
  };

  // Show detail view if a tenant is selected
  if (selectedTenant) {
    return (
      <SettingsAdminTenantDetail
        tenant={selectedTenant}
        onBack={handleBack}
        onDisable={handleDisable}
        onEnable={handleEnable}
        onUpdateNotes={handleUpdateNotes}
        isLoading={isLoading || isLoadingDetail}
      />
    );
  }

  // Show list view
  return (
    <>
      <Section>
        <H2Title
          title={t`Platform Overview`}
          description={t`Summary of all tenants on the platform`}
        />
        <SettingsAdminTenantStatsCards stats={stats} isLoading={isLoadingList} />
      </Section>

      <Section>
        <H2Title
          title={t`Tenants`}
          description={t`Manage all workspaces on the platform`}
        />

        <StyledSearchContainer>
          <StyledSearchInput>
            <TextInput
              value={searchQuery}
              onChange={setSearchQuery}
              onInputEnter={handleSearch}
              placeholder={t`Search by name, subdomain, or email...`}
              LeftIcon={IconSearch}
              fullWidth
            />
          </StyledSearchInput>
          <Button
            Icon={IconSearch}
            title={t`Search`}
            variant="secondary"
            onClick={handleSearch}
          />
          <Button
            Icon={IconRefresh}
            title={t`Refresh`}
            variant="tertiary"
            onClick={handleRefresh}
          />
        </StyledSearchContainer>

        <StyledFilterContainer>
          <IconFilter size={16} />
          <span>{t`Show disabled tenants`}</span>
          <Toggle
            value={includeDisabled}
            onChange={() => {
              setIncludeDisabled(!includeDisabled);
            }}
          />
        </StyledFilterContainer>

        <div style={{ marginTop: '16px' }}>
          <SettingsAdminTenantList
            tenants={tenants}
            onSelectTenant={handleSelectTenant}
            isLoading={isLoadingList}
          />
        </div>
      </Section>
    </>
  );
};
