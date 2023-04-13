import { call, put, take } from 'typed-redux-saga'
import { sendRejectionToContentScript } from '../../utils/messageUtils'
import { logger } from '../logger/logger'
import {
  ChangeChainRequest,
  ConnectRequest,
  DappRequestType,
  SendTransactionRequest,
} from './dappRequestTypes'
import {
  changeChain,
  confirmRequest,
  connect,
  getAccount,
  rejectRequest,
  sendTransaction,
} from './saga'
import { dappRequestActions } from './slice'

/**
 * Watch for pending requests to be confirmed or rejected and dispatch action
 */
export function* dappRequestApprovalWatcher() {
  while (true) {
    const { type, payload: request } = yield* take<
      ReturnType<typeof confirmRequest> | ReturnType<typeof rejectRequest>
    >([confirmRequest.type, rejectRequest.type])

    try {
      if (type === confirmRequest.type) {
        logger.info(
          'dappRequestApprovalWatcher',
          'confirmRequest',
          request.toString()
        )

        switch (request.dappRequest.type) {
          case DappRequestType.SendTransaction:
            yield* call(
              sendTransaction,
              (request.dappRequest as SendTransactionRequest).transaction,
              request.account,
              request.dappRequest.requestId,
              request.senderTabId
            )
            break
          case DappRequestType.GetAccount:
            yield* call(
              getAccount,
              request.dappRequest.requestId,
              request.senderTabId
            )
            break
          case DappRequestType.ChangeChain:
            yield* call(
              changeChain,
              request.dappRequest.requestId,
              (request.dappRequest as ChangeChainRequest).chainId,
              request.senderTabId
            )
            break
          case DappRequestType.Connect:
            yield* call(
              connect,
              request.dappRequest.requestId,
              (request.dappRequest as ConnectRequest).chainId,
              request.senderTabId
            )
          // Add more request types here
        }
      } else if (type === rejectRequest.type) {
        logger.info(
          'dappRequestApprovalWatcher',
          'rejectRequest',
          request.toString()
        )
        yield* call(
          sendRejectionToContentScript,
          request.dappRequest.requestId,
          request.senderTabId
        )
      }
    } catch (error) {
      logger.error(
        'wallet',
        'dappRequestApprovalWatcher',
        'Error while watching transaction requests',
        request,
        error
      )
    } finally {
      yield* put(dappRequestActions.remove(request.dappRequest.requestId))
    }
  }
}
