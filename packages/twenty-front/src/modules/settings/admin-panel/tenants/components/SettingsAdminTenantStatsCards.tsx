import type { TenantStats } from '@/settings/admin-panel/tenants/types/Tenant';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import {
    IconBuilding,
    IconBuildingSkyscraper,
    IconUserOff,
    IconUsers,
} from 'twenty-ui/display';
import { Card } from 'twenty-ui/layout';

const StyledStatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing(4)};
  margin-bottom: ${({ theme }) => theme.spacing(6)};
`;

const StyledStatCard = styled(Card)`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  padding: ${({ theme }) => theme.spacing(4)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledStatHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledStatValue = styled.div`
  font-size: ${({ theme }) => theme.font.size.xxl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledStatLabel = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

type SettingsAdminTenantStatsCardsProps = {
  stats: TenantStats | null;
  isLoading?: boolean;
};

export const SettingsAdminTenantStatsCards = ({
  stats,
  isLoading,
}: SettingsAdminTenantStatsCardsProps) => {
  if (isLoading) {
    return (
      <StyledStatsGrid>
        {[1, 2, 3, 4].map((i) => (
          <StyledStatCard key={i} rounded>
            <StyledStatHeader>Loading...</StyledStatHeader>
            <StyledStatValue>--</StyledStatValue>
          </StyledStatCard>
        ))}
      </StyledStatsGrid>
    );
  }

  const statItems = [
    {
      Icon: IconBuildingSkyscraper,
      value: stats?.totalTenants ?? 0,
      label: t`Total Tenants`,
      color: 'blue',
    },
    {
      Icon: IconBuilding,
      value: stats?.activeTenants ?? 0,
      label: t`Active Tenants`,
      color: 'green',
    },
    {
      Icon: IconUserOff,
      value: stats?.disabledTenants ?? 0,
      label: t`Disabled Tenants`,
      color: 'red',
    },
    {
      Icon: IconUsers,
      value: stats?.totalUsers ?? 0,
      label: t`Total Users`,
      color: 'purple',
    },
  ];

  return (
    <StyledStatsGrid>
      {statItems.map((item) => (
        <StyledStatCard key={item.label} rounded>
          <StyledStatHeader>
            <item.Icon size={16} />
            {item.label}
          </StyledStatHeader>
          <StyledStatValue>{item.value.toLocaleString()}</StyledStatValue>
          <StyledStatLabel>{item.label}</StyledStatLabel>
        </StyledStatCard>
      ))}
    </StyledStatsGrid>
  );
};
