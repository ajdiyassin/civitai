import { ActionIcon, ActionIconProps, Menu, MenuItemProps, MenuProps } from '@mantine/core';
import { closeAllModals, openConfirmModal } from '@mantine/modals';
import { IconDotsVertical, IconEdit, IconReceiptRefund, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { isDefined } from '~/utils/type-guards';
import { useMutateBounty } from './bounty.utils';
import { ReportMenuItem } from '../MenuItems/ReportMenuItem';
import { openContext } from '~/providers/CustomModalsProvider';
import { ReportEntity } from '~/server/schema/report.schema';

export function BountyContextMenu({
  bounty,
  buttonProps: { iconSize, ...buttonProps } = { iconSize: 16 },
  ...menuProps
}: Props) {
  const currentUser = useCurrentUser();
  const router = useRouter();
  const isModerator = currentUser?.isModerator ?? false;
  const isOwner = currentUser?.id === bounty.user?.id || isModerator;
  const expired = bounty.expiresAt < new Date();

  const { deleteBounty, refundBounty, refunding } = useMutateBounty({ bountyId: bounty.id });

  const menuItems: React.ReactElement<MenuItemProps>[] = [
    !expired && (isOwner || isModerator) ? (
      <Menu.Item
        key="delete"
        color="red"
        icon={<IconTrash size={14} stroke={1.5} />}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();

          openConfirmModal({
            title: 'Delete bounty',
            children:
              'Are you sure that you want to delete this bounty? This action is destructive and cannot be reverted.',
            centered: true,
            closeOnConfirm: false,
            labels: { cancel: 'No, keep it', confirm: 'Delete bounty' },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
              try {
                await deleteBounty();
                closeAllModals();
                const atDetailsPage = router.pathname === '/bounties/[id]/[[...slug]]';
                if (atDetailsPage) await router.push('/bounties');
              } catch (error) {
                // Do nothing since the query event will show an error notification
              }
            },
          });
        }}
      >
        Delete
      </Menu.Item>
    ) : null,
    !expired && (isOwner || isModerator) ? (
      <Link key="edit" href={`/bounties/${bounty.id}/edit`} passHref>
        <Menu.Item component="a" icon={<IconEdit size={14} stroke={1.5} />}>
          Edit
        </Menu.Item>
      </Link>
    ) : null,
    isModerator && !(bounty.complete || expired) ? (
      <Menu.Item
        key="refund"
        disabled={refunding}
        component="button"
        icon={<IconReceiptRefund size={14} stroke={1.5} />}
        onClick={() => {
          openConfirmModal({
            title: 'Refund bounty',
            children:
              'Are you sure that you want to refund this bounty? This action cannot be reverted.',
            centered: true,
            closeOnConfirm: false,
            labels: { cancel: 'No, keep it', confirm: 'Refund bounty' },
            confirmProps: { color: 'yellow' },
            onConfirm: async () => {
              try {
                await refundBounty();
                closeAllModals();
              } catch (error) {
                // Do nothing since the query event will show an error notification
              }
            },
          });
        }}
      >
        Refund
      </Menu.Item>
    ) : null,
    !isOwner || isModerator ? (
      <ReportMenuItem
        key="report"
        label="Report bounty"
        onReport={() =>
          openContext('report', { entityType: ReportEntity.Bounty, entityId: bounty.id })
        }
      />
    ) : null,
  ].filter(isDefined);

  if (!menuItems.length) return null;

  return (
    <Menu {...menuProps}>
      <Menu.Target>
        <ActionIcon
          color="gray"
          radius="xl"
          variant="filled"
          {...buttonProps}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <IconDotsVertical size={iconSize} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>{menuItems}</Menu.Dropdown>
    </Menu>
  );
}

type Props = MenuProps & {
  bounty: {
    id: number;
    user: { id: number } | null;
    complete: boolean;
    expiresAt: Date;
  };
  buttonProps?: ActionIconProps & { iconSize?: number };
};
