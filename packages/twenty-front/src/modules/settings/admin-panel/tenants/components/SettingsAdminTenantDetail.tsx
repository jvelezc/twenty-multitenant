import { SettingsAdminTableCard } from '@/settings/admin-panel/components/SettingsAdminTableCard';
import type { TenantDetails } from '@/settings/admin-panel/tenants/types/Tenant';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { format, formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import {
    H2Title,
    IconAddressBook,
    IconArrowLeft,
    IconBriefcase,
    IconBuilding,
    IconCalendar,
    IconCurrencyDollar,
    IconId,
    IconMail,
    IconNote,
    IconPlayerPause,
    IconPlayerPlay,
    IconUsers,
} from 'twenty-ui/display';
import { Button, TextArea } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-bottom: ${({ theme }) => theme.spacing(6)};
`;

const StyledBackButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledTenantTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledStatusBadge = styled.span<{ status: 'active' | 'disabled' }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ theme, status }) =>
    status === 'active' ? theme.color.green10 : theme.color.red10};
  color: ${({ theme, status }) =>
    status === 'active' ? theme.color.green : theme.color.red};
`;

const StyledActionsRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

const StyledUserCard = styled(Card)`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  padding: ${({ theme }) => theme.spacing(3)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledUserInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StyledUserName = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledUserEmail = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledNotesContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

type SettingsAdminTenantDetailProps = {
  tenant: TenantDetails;
  onBack: () => void;
  onDisable: (tenantId: string, reason: string) => Promise<void>;
  onEnable: (tenantId: string) => Promise<void>;
  onUpdateNotes: (tenantId: string, notes: string) => Promise<void>;
  isLoading?: boolean;
};

export const SettingsAdminTenantDetail = ({
  tenant,
  onBack,
  onDisable,
  onEnable,
  onUpdateNotes,
  isLoading,
}: SettingsAdminTenantDetailProps) => {
  const [notes, setNotes] = useState(tenant.adminNotes || '');
  const [disableReason, setDisableReason] = useState('');
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  const tenantInfoItems = [
    {
      Icon: IconId,
      label: t`ID`,
      value: tenant.id,
    },
    {
      Icon: IconBuilding,
      label: t`Subdomain`,
      value: tenant.subdomain,
    },
    {
      Icon: IconCalendar,
      label: t`Created`,
      value: format(new Date(tenant.createdAt), 'PPP'),
    },
    {
      Icon: IconUsers,
      label: t`Users`,
      value: tenant.userCount,
    },
  ];

  const statsItems = [
    {
      Icon: IconAddressBook,
      label: t`Contacts`,
      value: tenant.contactCount ?? 0,
    },
    {
      Icon: IconBriefcase,
      label: t`Companies`,
      value: tenant.companyCount ?? 0,
    },
    {
      Icon: IconCurrencyDollar,
      label: t`Opportunities`,
      value: tenant.opportunityCount ?? 0,
    },
  ];

  const handleDisable = async () => {
    await onDisable(tenant.id, disableReason);
    setShowDisableConfirm(false);
    setDisableReason('');
  };

  const handleSaveNotes = async () => {
    await onUpdateNotes(tenant.id, notes);
  };

  return (
    <>
      <StyledHeader>
        <StyledBackButton onClick={onBack}>
          <IconArrowLeft size={16} />
          {t`Back to Tenants`}
        </StyledBackButton>
        <StyledTenantTitle>
          <IconBuilding size={24} />
          {tenant.displayName}
        </StyledTenantTitle>
        <StyledStatusBadge status={tenant.isDisabled ? 'disabled' : 'active'}>
          {tenant.isDisabled ? (
            <>
              <IconPlayerPause size={14} />
              {t`Disabled`}
            </>
          ) : (
            <>
              <IconPlayerPlay size={14} />
              {t`Active`}
            </>
          )}
        </StyledStatusBadge>
      </StyledHeader>

      <Section>
        <H2Title title={t`Tenant Information`} description={t`Basic details about this tenant`} />
        <SettingsAdminTableCard
          items={tenantInfoItems}
          rounded
          gridAutoColumns="1fr 3fr"
        />
      </Section>

      <Section>
        <H2Title title={t`Usage Statistics`} description={t`Records created by this tenant`} />
        <SettingsAdminTableCard
          items={statsItems}
          rounded
          gridAutoColumns="1fr 3fr"
        />
      </Section>

      <Section>
        <H2Title
          title={t`Users`}
          description={t`${tenant.users.length} users in this workspace`}
        />
        {tenant.users.map((user) => (
          <StyledUserCard key={user.id} rounded>
            <StyledUserInfo>
              <div>
                <StyledUserName>
                  {user.firstName} {user.lastName}
                </StyledUserName>
                <StyledUserEmail>
                  <IconMail size={12} /> {user.email}
                </StyledUserEmail>
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                {t`Joined`}{' '}
                {formatDistanceToNow(new Date(user.createdAt), {
                  addSuffix: true,
                })}
              </div>
            </StyledUserInfo>
          </StyledUserCard>
        ))}
      </Section>

      <Section>
        <H2Title title={t`Admin Notes`} description={t`Internal notes about this tenant`} />
        <StyledNotesContainer>
          <TextArea
            value={notes}
            onChange={(value) => setNotes(value)}
            placeholder={t`Add notes about this tenant...`}
            minRows={3}
          />
          <StyledActionsRow>
            <Button
              Icon={IconNote}
              title={t`Save Notes`}
              variant="secondary"
              onClick={handleSaveNotes}
              disabled={isLoading || notes === tenant.adminNotes}
            />
          </StyledActionsRow>
        </StyledNotesContainer>
      </Section>

      <Section>
        <H2Title title={t`Actions`} description={t`Manage this tenant`} />
        {!showDisableConfirm ? (
          <StyledActionsRow>
            {tenant.isDisabled ? (
              <Button
                Icon={IconPlayerPlay}
                title={t`Enable Tenant`}
                variant="primary"
                accent="blue"
                onClick={() => onEnable(tenant.id)}
                disabled={isLoading}
              />
            ) : (
              <Button
                Icon={IconPlayerPause}
                title={t`Disable Tenant`}
                variant="secondary"
                accent="danger"
                onClick={() => setShowDisableConfirm(true)}
                disabled={isLoading}
              />
            )}
          </StyledActionsRow>
        ) : (
          <div>
            <TextArea
              value={disableReason}
              onChange={(value) => setDisableReason(value)}
              placeholder={t`Reason for disabling (optional)...`}
              minRows={2}
            />
            <StyledActionsRow>
              <Button
                Icon={IconPlayerPause}
                title={t`Confirm Disable`}
                variant="primary"
                accent="danger"
                onClick={handleDisable}
                disabled={isLoading}
              />
              <Button
                title={t`Cancel`}
                variant="secondary"
                onClick={() => setShowDisableConfirm(false)}
              />
            </StyledActionsRow>
          </div>
        )}

        {tenant.isDisabled && tenant.disabledReason && (
          <div style={{ marginTop: '16px', color: '#888', fontSize: '14px' }}>
            <strong>{t`Disabled reason:`}</strong> {tenant.disabledReason}
          </div>
        )}
      </Section>
    </>
  );
};
