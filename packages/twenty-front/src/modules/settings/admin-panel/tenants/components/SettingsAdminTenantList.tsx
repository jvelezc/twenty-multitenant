import type { TenantSummary } from '@/settings/admin-panel/tenants/types/Tenant';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { formatDistanceToNow } from 'date-fns';
import {
    IconBuilding,
    IconCalendar,
    IconChevronRight,
    IconPlayerPause,
    IconPlayerPlay,
    IconUsers,
} from 'twenty-ui/display';
import { Card } from 'twenty-ui/layout';

const StyledTenantCard = styled(Card)<{ isDisabled?: boolean }>`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  padding: ${({ theme }) => theme.spacing(4)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: ${({ isDisabled }) => (isDisabled ? 0.6 : 1)};

  &:hover {
    border-color: ${({ theme }) => theme.border.color.strong};
    background-color: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledTenantHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledTenantName = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledStatusBadge = styled.span<{ status: 'active' | 'disabled' }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ theme, status }) =>
    status === 'active'
      ? theme.color.green10
      : theme.color.red10};
  color: ${({ theme, status }) =>
    status === 'active'
      ? theme.color.green
      : theme.color.red};
`;

const StyledTenantMeta = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledMetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledChevron = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledEmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing(8)};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

type SettingsAdminTenantListProps = {
  tenants: TenantSummary[];
  onSelectTenant: (tenant: TenantSummary) => void;
  isLoading?: boolean;
};

export const SettingsAdminTenantList = ({
  tenants,
  onSelectTenant,
  isLoading,
}: SettingsAdminTenantListProps) => {
  if (isLoading) {
    return (
      <div>
        {[1, 2, 3].map((i) => (
          <StyledTenantCard key={i} rounded>
            <StyledTenantHeader>
              <StyledTenantName>Loading...</StyledTenantName>
            </StyledTenantHeader>
          </StyledTenantCard>
        ))}
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <StyledEmptyState>
        <IconBuilding size={48} />
        <p>{t`No tenants found`}</p>
      </StyledEmptyState>
    );
  }

  return (
    <div>
      {tenants.map((tenant) => (
        <StyledTenantCard
          key={tenant.id}
          rounded
          isDisabled={tenant.isDisabled}
          onClick={() => onSelectTenant(tenant)}
        >
          <StyledTenantHeader>
            <StyledTenantName>
              <IconBuilding size={20} />
              {tenant.displayName}
              <span style={{ opacity: 0.5, fontWeight: 'normal' }}>
                ({tenant.subdomain})
              </span>
            </StyledTenantName>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StyledStatusBadge
                status={tenant.isDisabled ? 'disabled' : 'active'}
              >
                {tenant.isDisabled ? (
                  <>
                    <IconPlayerPause size={12} />
                    {t`Disabled`}
                  </>
                ) : (
                  <>
                    <IconPlayerPlay size={12} />
                    {t`Active`}
                  </>
                )}
              </StyledStatusBadge>
              <StyledChevron>
                <IconChevronRight size={20} />
              </StyledChevron>
            </div>
          </StyledTenantHeader>
          <StyledTenantMeta>
            <StyledMetaItem>
              <IconUsers size={14} />
              {tenant.userCount} {tenant.userCount === 1 ? t`user` : t`users`}
            </StyledMetaItem>
            <StyledMetaItem>
              <IconCalendar size={14} />
              {t`Created`}{' '}
              {formatDistanceToNow(new Date(tenant.createdAt), {
                addSuffix: true,
              })}
            </StyledMetaItem>
          </StyledTenantMeta>
        </StyledTenantCard>
      ))}
    </div>
  );
};
