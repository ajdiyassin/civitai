import {
  Button,
  Center,
  Group,
  Stack,
  Text,
  createStyles,
  Chip,
  Loader,
  Input,
  Accordion,
  ThemeIcon,
} from '@mantine/core';
import { Currency, Price } from '@prisma/client';
import { IconArrowsExchange, IconBolt, IconInfoCircle, IconMoodDollar } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';

import { AlertWithIcon } from '../AlertWithIcon/AlertWithIcon';
import { CurrencyIcon } from '../Currency/CurrencyIcon';
import { useQueryBuzzPackages } from '../Buzz/buzz.utils';
import { NumberInputWrapper } from '~/libs/form/components/NumberInputWrapper';
import { openStripeTransactionModal } from '~/components/Modals/StripeTransactionModal';
import { CurrencyBadge } from '~/components/Currency/CurrencyBadge';
import { formatPriceForDisplay } from '~/utils/number-helpers';
import { PaymentIntentMetadataSchema } from '~/server/schema/stripe.schema';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { useIsMobile } from '~/hooks/useIsMobile';
import { constants } from '~/server/common/constants';

const useStyles = createStyles((theme) => ({
  chipGroup: {
    gap: theme.spacing.md,

    '& > *': {
      width: '100%',
    },

    [theme.fn.smallerThan('sm')]: {
      gap: theme.spacing.md,
    },
  },

  // Chip styling
  chipLabel: {
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    height: 'auto',
    width: '100%',
    borderRadius: theme.radius.md,

    '&[data-variant="filled"]': {
      backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[0],
    },

    '&[data-checked]': {
      border: `2px solid ${theme.colors.accent[5]}`,
      color: theme.colors.accent[5],
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,

      '&[data-variant="filled"], &[data-variant="filled"]:hover': {
        backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[7] : theme.white,
      },
    },
  },

  chipCheckmark: {
    display: 'none',
  },

  chipDisabled: {
    opacity: 0.3,
  },

  // Accordion styling
  accordionItem: {
    backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[0],

    '&:first-of-type, &:first-of-type>[data-accordion-control]': {
      borderTopLeftRadius: theme.radius.md,
      borderTopRightRadius: theme.radius.md,
    },

    '&:last-of-type, &:last-of-type>[data-accordion-control]': {
      borderBottomLeftRadius: theme.radius.md,
      borderBottomRightRadius: theme.radius.md,
    },

    '&[data-active="true"]': {
      border: `1px solid ${theme.colors.accent[5]}`,
      backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[7] : theme.white,
    },
  },

  // Icon styling
  buzzIcon: {
    filter: `drop-shadow(0 0 2px ${theme.colors.accent[5]})`,

    '&:not(:first-of-type)': {
      marginLeft: -4,
    },
  },
}));

type SelectablePackage = Pick<Price, 'id' | 'unitAmount'> & { buzzAmount?: number | null };

type Props = {
  message?: string;
  purchaseSuccessMessage?: (purchasedBalance: number) => React.ReactNode;
  onPurchaseSuccess?: () => void;
  minBuzzAmount?: number;
  onCancel?: () => void;
};

export const BuzzPurchase = ({
  message,
  onPurchaseSuccess,
  minBuzzAmount,
  purchaseSuccessMessage,
  onCancel,
}: Props) => {
  const { classes, cx } = useStyles();
  const isMobile = useIsMobile();

  const currentUser = useCurrentUser();
  const [selectedPrice, setSelectedPrice] = useState<SelectablePackage | null>(null);
  const [error, setError] = useState('');
  const [customAmount, setCustomAmount] = useState<number | undefined>();
  const [activeControl, setActiveControl] = useState<string | null>(null);
  const ctaEnabled = !!selectedPrice?.unitAmount || (!selectedPrice && customAmount);
  const {
    packages = [],
    isLoading,
    processing,
    completeStripeBuzzPurchaseMutation,
  } = useQueryBuzzPackages({
    onPurchaseSuccess: () => {
      onPurchaseSuccess?.();
    },
  });

  const handleSubmit = async () => {
    if (!selectedPrice && !customAmount) return setError('Please choose one option');

    const unitAmount = (selectedPrice?.unitAmount ?? customAmount) as number;
    const buzzAmount = selectedPrice?.buzzAmount ?? unitAmount * 10;

    if (unitAmount < constants.buzz.minChargeAmount)
      return setError(
        `Minimum amount is $${formatPriceForDisplay(constants.buzz.minChargeAmount)} USD`
      );

    if (!currentUser) {
      return setError('Please log in to continue');
    }

    if (!unitAmount) return setError('Please enter the amount you wish to buy');

    const metadata: PaymentIntentMetadataSchema = {
      type: 'buzzPurchase',
      unitAmount,
      buzzAmount,
      userId: currentUser.id as number,
      priceId: selectedPrice?.id,
    };

    openStripeTransactionModal(
      {
        unitAmount,
        message: (
          <Stack>
            <Text>
              You are about to purchase{' '}
              <CurrencyBadge currency={Currency.BUZZ} unitAmount={buzzAmount} />.
            </Text>
            <Text>Please fill in your data and complete your purchase.</Text>
          </Stack>
        ),
        successMessage: purchaseSuccessMessage ? (
          purchaseSuccessMessage(buzzAmount)
        ) : (
          <Stack>
            <Text>Thank you for your purchase!</Text>
            <Text>
              <CurrencyBadge currency={Currency.BUZZ} unitAmount={buzzAmount} /> have been credited
              to your account.
            </Text>
          </Stack>
        ),
        onSuccess: async (stripePaymentIntentId) => {
          // We do it here just in case, but the webhook should also do it
          await completeStripeBuzzPurchaseMutation({
            amount: buzzAmount,
            details: metadata,
            stripePaymentIntentId,
          });
        },
        metadata: metadata,
        // paymentMethodTypes: ['card'],
      },
      { fullScreen: isMobile }
    );
  };

  useEffect(() => {
    if (packages.length && !selectedPrice && !minBuzzAmount) {
      setSelectedPrice(packages[0]);
    }

    if (minBuzzAmount) {
      setSelectedPrice(null);
      setActiveControl('customAmount');
      // Need to round to avoid sending decimal values to stripe
      setCustomAmount(Math.max(Math.ceil(minBuzzAmount / 10), constants.buzz.minChargeAmount));
    }
  }, [packages, minBuzzAmount]);

  const minBuzzAmountPrice = minBuzzAmount
    ? Math.max(minBuzzAmount / 10, constants.buzz.minChargeAmount)
    : constants.buzz.minChargeAmount;

  return (
    <Stack spacing="md">
      {message && (
        <AlertWithIcon icon={<IconInfoCircle />} iconSize="md" size="md">
          {message}
        </AlertWithIcon>
      )}
      <Stack spacing={0}>
        <Text>Buy buzz as a one-off purchase. No commitment, no strings attached.</Text>
      </Stack>
      {isLoading || processing ? (
        <Center py="xl">
          <Loader variant="bars" />
        </Center>
      ) : (
        <Input.Wrapper error={error}>
          <Stack spacing="xl" mb={error ? 5 : undefined}>
            <Chip.Group
              className={classes.chipGroup}
              value={selectedPrice?.id ?? ''}
              onChange={(priceId: string) => {
                const selectedPackage = packages.find((p) => p.id === priceId);
                setCustomAmount(undefined);
                setError('');
                setSelectedPrice(selectedPackage ?? null);
                setActiveControl(null);
              }}
            >
              {packages.map((buzzPackage, index) => {
                if (!buzzPackage.unitAmount) return null;

                const price = buzzPackage.unitAmount / 100;
                const buzzAmount = buzzPackage.buzzAmount ?? buzzPackage.unitAmount * 10;
                const disabled = !!minBuzzAmount ? buzzAmount < minBuzzAmount : false;

                return (
                  <Chip
                    key={buzzPackage.id}
                    value={buzzPackage.id}
                    variant="filled"
                    classNames={{
                      root: cx(disabled && classes.chipDisabled),
                      label: classes.chipLabel,
                      iconWrapper: classes.chipCheckmark,
                    }}
                    disabled={disabled}
                  >
                    <Group spacing="sm" align="center">
                      <Text color="accent.5">
                        <BuzzTierIcon tier={index + 1} />
                      </Text>
                      {price ? (
                        <Group spacing={8} position="apart" sx={{ flexGrow: 1 }}>
                          <Text size={20} weight={510} color="accent.5">
                            {buzzAmount.toLocaleString()} Buzz
                          </Text>
                          <Text
                            color="initial"
                            size={20}
                            weight="bold"
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            ${price}
                          </Text>
                        </Group>
                      ) : (
                        <Text size="md" color="dimmed">
                          I&apos;ll enter my own amount
                        </Text>
                      )}
                    </Group>
                  </Chip>
                );
              })}
            </Chip.Group>

            <Accordion
              variant="contained"
              value={activeControl}
              classNames={{ item: classes.accordionItem }}
              onChange={(value) => {
                setSelectedPrice(null);
                setActiveControl(value);
              }}
            >
              <Accordion.Item value="customAmount">
                <Accordion.Control px="md" py={8}>
                  <Group spacing={8}>
                    <IconMoodDollar size={24} />
                    <Text>I&apos;ll enter my own amount</Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Group spacing={8} align="flex-end" sx={{ ['& > *']: { flexGrow: 1 } }} noWrap>
                    <NumberInputWrapper
                      label="Buzz"
                      labelProps={{ sx: { fontSize: 12, fontWeight: 590 } }}
                      placeholder={`Minimum ${Number(minBuzzAmountPrice * 10).toLocaleString()}`}
                      icon={<CurrencyIcon currency={Currency.BUZZ} size={18} />}
                      value={customAmount ? customAmount * 10 : undefined}
                      min={1000}
                      max={constants.buzz.maxChargeAmount * 10}
                      disabled={processing}
                      onChange={(value) => {
                        setError('');
                        setCustomAmount(Math.ceil((value ?? 0) / 10));
                      }}
                      step={100}
                    />
                    {/* @ts-ignore: transparent variant works with ThemeIcon */}
                    <ThemeIcon size={36} maw={24} variant="transparent" color="gray">
                      <IconArrowsExchange size={24} />
                    </ThemeIcon>
                    <NumberInputWrapper
                      label="USD ($)"
                      labelProps={{ sx: { fontSize: 12, fontWeight: 590 } }}
                      placeholder={`Minimum $${formatPriceForDisplay(minBuzzAmountPrice)}`}
                      icon={<CurrencyIcon currency="USD" size={18} fill="transparent" />}
                      value={customAmount}
                      min={100}
                      step={100}
                      max={constants.buzz.maxChargeAmount}
                      precision={2}
                      disabled={processing}
                      rightSection={null}
                      rightSectionWidth="auto"
                      format="currency"
                      currency="USD"
                      onChange={(value) => {
                        setError('');
                        setCustomAmount(value ?? 0);
                      }}
                    />
                  </Group>
                  <Text size="xs" color="dimmed" mt="xs">
                    {`Minimum amount ${Number(
                      constants.buzz.minChargeAmount * 10
                    ).toLocaleString()} Buzz or $${formatPriceForDisplay(
                      constants.buzz.minChargeAmount
                    )} USD`}
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </Input.Wrapper>
      )}
      <Group position="right">
        {onCancel && (
          <Button variant="light" color="gray" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button disabled={!ctaEnabled} onClick={handleSubmit} loading={processing}>
          {processing ? 'Completing your purchase...' : 'Continue'}
        </Button>
      </Group>
    </Stack>
  );
};

const iconSizesRatio = [1, 1.3, 1.6];

const BuzzTierIcon = ({ tier }: { tier: number }) => {
  const { classes } = useStyles();

  return (
    <Group spacing={-4} noWrap>
      {Array.from({ length: 3 }).map((_, i) => (
        <IconBolt
          key={i}
          className={classes.buzzIcon}
          size={20 * iconSizesRatio[i]}
          color="currentColor"
          fill="currentColor"
          opacity={i < tier ? 1 : 0.2}
        />
      ))}
    </Group>
  );
};
