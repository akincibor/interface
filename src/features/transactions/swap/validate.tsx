import { Percent } from '@uniswap/sdk-core'
import { TFunction } from 'react-i18next'
import { Warning, WarningAction, WarningLabel, WarningSeverity } from 'src/components/modals/types'
import { SWAP_NO_ROUTE_ERROR } from 'src/features/routing/routingApi'
import { DerivedSwapInfo } from 'src/features/transactions/swap/hooks'
import { CurrencyField } from 'src/features/transactions/transactionState/transactionState'
import { Account, AccountType } from 'src/features/wallet/accounts/types'
import { formatPriceImpact } from 'src/utils/format'

const PRICE_IMPACT_THRESHOLD_MEDIUM = new Percent(3, 100) // 3%
const PRICE_IMPACT_THRESHOLD_HIGH = new Percent(5, 100) // 5%

export type PartialDerivedSwapInfo = Pick<
  DerivedSwapInfo,
  | 'currencyBalances'
  | 'currencyAmounts'
  | 'currencies'
  | 'exactCurrencyField'
  | 'trade'
  | 'nativeCurrencyBalance'
> & {
  account?: Account
}

export function getSwapWarnings(t: TFunction, state: PartialDerivedSwapInfo) {
  const { account, currencyBalances, currencyAmounts, currencies, trade } = state

  const warnings: Warning[] = []
  const priceImpact = trade.trade?.priceImpact

  // insufficient balance for swap
  const currencyBalanceIn = currencyBalances[CurrencyField.INPUT]
  const currencyAmountIn = currencyAmounts[CurrencyField.INPUT]
  const swapBalanceInsufficient = currencyAmountIn && currencyBalanceIn?.lessThan(currencyAmountIn)
  if (swapBalanceInsufficient) {
    warnings.push({
      type: WarningLabel.InsufficientFunds,
      severity: WarningSeverity.None,
      action: WarningAction.DisableReview,
      title: t('You don’t have enough {{ symbol }}.', {
        symbol: currencyAmountIn.currency?.symbol,
      }),
    })
  }

  // low liquidity and other swap errors
  if (trade.error) {
    // cast as any here because rtk-query recommends not typing error objects
    // https://github.com/reduxjs/redux-toolkit/issues/1591
    const errorData = trade.error as any
    // assume swaps with no routes available are due to low liquidity
    if (errorData?.data?.errorCode === SWAP_NO_ROUTE_ERROR) {
      warnings.push({
        type: WarningLabel.LowLiquidity,
        severity: WarningSeverity.Medium,
        action: WarningAction.DisableReview,
        title: t('This trade cannot be completed'),
        message: t(
          'There is currently insufficient liquidity between these tokens to perform a swap.'
        ),
      })
    } else {
      // catch all other router errors in a generic swap router error message
      warnings.push({
        type: WarningLabel.SwapRouterError,
        severity: WarningSeverity.Medium,
        action: WarningAction.DisableReview,
        title: t('This trade cannot be completed right now'),
        message: t(
          'You may have lost connection or the network may be down. If the problem persists, please try again later.'
        ),
      })
    }
  }

  // TODO: add error for insufficient funds for gas

  // swap form is missing input, output fields
  if (formIncomplete(state)) {
    warnings.push({
      type: WarningLabel.FormIncomplete,
      severity: WarningSeverity.None,
      action: WarningAction.DisableReview,
    })
  }

  // price impact warning
  if (priceImpact?.greaterThan(PRICE_IMPACT_THRESHOLD_MEDIUM)) {
    const highImpact = !priceImpact.lessThan(PRICE_IMPACT_THRESHOLD_HIGH)
    warnings.push({
      type: highImpact ? WarningLabel.PriceImpactHigh : WarningLabel.PriceImpactMedium,
      severity: highImpact ? WarningSeverity.High : WarningSeverity.Medium,
      action: WarningAction.WarnBeforeSubmit,
      title: t('Rate impacted by swap size ({{ swapSize }})', {
        swapSize: formatPriceImpact(priceImpact),
      }),
      message: t(
        'Due to the amount of {{ currencyOut }} liquidity currently available, the more {{ currencyIn }} you try to swap, the less {{ currencyOut }} you will receive.',
        {
          currencyIn: currencies[CurrencyField.INPUT]?.symbol,
          currencyOut: currencies[CurrencyField.OUTPUT]?.symbol,
        }
      ),
    })
  }

  if (account?.type === AccountType.Readonly) {
    warnings.push({
      type: WarningLabel.ViewOnlyAccount,
      severity: WarningSeverity.Medium,
      action: WarningAction.DisableSubmit,
      title: t('This wallet is view-only'),
      message: t('You need to import this wallet via recovery phrase to swap tokens.'),
    })
  }

  return warnings
}

const formIncomplete = (state: PartialDerivedSwapInfo) => {
  const { currencyAmounts, currencies, exactCurrencyField } = state

  if (
    !currencies[CurrencyField.INPUT] ||
    !currencies[CurrencyField.OUTPUT] ||
    (exactCurrencyField === CurrencyField.INPUT && !currencyAmounts[CurrencyField.INPUT]) ||
    (exactCurrencyField === CurrencyField.OUTPUT && !currencyAmounts[CurrencyField.OUTPUT])
  ) {
    return true
  }

  return false
}
