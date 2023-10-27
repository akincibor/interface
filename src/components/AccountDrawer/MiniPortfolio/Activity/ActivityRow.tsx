import { BrowserEvent, InterfaceElementName, SharedEventName } from '@uniswap/analytics-events'
import { TraceEvent } from 'analytics'
import Column from 'components/Column'
import AlertTriangleFilled from 'components/Icons/AlertTriangleFilled'
import { LoaderV2 } from 'components/Icons/LoadingSpinner'
import Row from 'components/Row'
import { JudgementalActivity } from 'components/SocialFeed/hooks'
import { TransactionStatus } from 'graphql/data/__generated__/types-and-hooks'
import useENSName from 'hooks/useENSName'
import { getTimeDifference } from 'nft/utils/date'
import { useCallback } from 'react'
import styled from 'styled-components'
import { EllipsisStyle, ThemedText } from 'theme/components'
import { shortenAddress } from 'utils'
import { ExplorerDataType, getExplorerLink } from 'utils/getExplorerLink'

import { PortfolioAvatar, PortfolioLogo } from '../PortfolioLogo'
import PortfolioRow from '../PortfolioRow'
import { useOpenOffchainActivityModal } from './OffchainActivityModal'
import { useTimeSince } from './parseRemote'
import { Activity } from './types'

const ActivityRowDescriptor = styled(ThemedText.BodySmall)`
  color: ${({ theme }) => theme.neutral2};
  ${EllipsisStyle}
`

const StyledTimestamp = styled(ThemedText.BodySmall)`
  color: ${({ theme }) => theme.neutral2};
  font-variant: small;
  font-feature-settings: 'tnum' on, 'lnum' on, 'ss02' on;
`

function StatusIndicator({ activity: { status, timestamp } }: { activity: Activity }) {
  const timeSince = useTimeSince(timestamp)

  switch (status) {
    case TransactionStatus.Pending:
      return <LoaderV2 />
    case TransactionStatus.Confirmed:
      return <StyledTimestamp>{timeSince}</StyledTimestamp>
    case TransactionStatus.Failed:
      return <AlertTriangleFilled />
  }
}

export function ActivityRow({ activity }: { activity: Activity }) {
  const { chainId, title, descriptor, logos, otherAccount, currencies, hash, prefixIconSrc, offchainOrderStatus } =
    activity
  const openOffchainActivityModal = useOpenOffchainActivityModal()

  const { ENSName } = useENSName(otherAccount)
  const explorerUrl = getExplorerLink(chainId, hash, ExplorerDataType.TRANSACTION)

  const onClick = useCallback(() => {
    if (offchainOrderStatus) {
      openOffchainActivityModal({ orderHash: hash, status: offchainOrderStatus })
      return
    }

    window.open(getExplorerLink(chainId, hash, ExplorerDataType.TRANSACTION), '_blank')
  }, [offchainOrderStatus, chainId, hash, openOffchainActivityModal])

  return (
    <TraceEvent
      events={[BrowserEvent.onClick]}
      name={SharedEventName.ELEMENT_CLICKED}
      element={InterfaceElementName.MINI_PORTFOLIO_ACTIVITY_ROW}
      properties={{ hash, chain_id: chainId, explorer_url: explorerUrl }}
    >
      <PortfolioRow
        left={
          <Column>
            <PortfolioLogo chainId={chainId} currencies={currencies} images={logos} accountAddress={otherAccount} />
          </Column>
        }
        title={
          <Row gap="4px">
            {prefixIconSrc && <img height="14px" width="14px" src={prefixIconSrc} alt="" />}
            <ThemedText.SubHeader>{title}</ThemedText.SubHeader>
          </Row>
        }
        descriptor={
          <ActivityRowDescriptor color="neutral2">
            {descriptor}
            {ENSName ?? shortenAddress(otherAccount)}
          </ActivityRowDescriptor>
        }
        right={<StatusIndicator activity={activity} />}
        onClick={onClick}
      />
    </TraceEvent>
  )
}

function isJudgementalActivity(activity: Activity | JudgementalActivity): activity is JudgementalActivity {
  return (activity as JudgementalActivity).friend !== undefined
}

const ActivityCard = styled.div`
  display: flex;
  flex-direction: column;

  gap: 20px;
  padding: 20px;
  width: 500px;

  background-color: ${({ theme }) => theme.surface1};
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.surface3};
`
const CardHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20px;
  justify-content: space-between;
  white-space: nowrap;
`

const Who = styled.div`
  display: flex;
  flex-direction: row;
  gap: 10px;
  width: 100%;
`

function NormalFeedRow({ activity }: { activity: Activity }) {
  const { ENSName } = useENSName(activity.owner)
  const { ENSName: otherAccountENS } = useENSName(activity.otherAccount)

  if (activity.title.includes('Approved')) return null

  return (
    <ActivityCard>
      <CardHeader>
        <Who>
          <PortfolioAvatar accountAddress={activity.from} size="30px" />
          <ThemedText.BodyPrimary>{ENSName ?? shortenAddress(activity.from)}</ThemedText.BodyPrimary>
        </Who>
        <ThemedText.LabelSmall>{getTimeDifference(activity.timestamp.toString())}</ThemedText.LabelSmall>
      </CardHeader>
      <ThemedText.BodySecondary>
        {activity.title} {activity.descriptor}
        {otherAccountENS ?? activity.otherAccount}
      </ThemedText.BodySecondary>
      {/* {activity.image && (
        <img src={activity.image} alt="activity image" style={{ maxHeight: '100%', maxWidth: '100%' }} />
      )} */}
    </ActivityCard>
  )
}

export function FeedRow({ activity }: { activity: Activity | JudgementalActivity }) {
  if (!isJudgementalActivity(activity)) {
    return <NormalFeedRow activity={activity} />
  }
  return null
}
