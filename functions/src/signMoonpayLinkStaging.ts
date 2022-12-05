import cors from 'cors'
import * as crypto from 'crypto'
import * as functions from 'firebase-functions'
import { URL } from 'url'

const corsHandler = cors({ origin: true })

/**
 * @param {object} params Object of query params
 * @return {string} A serialized string of query params
 */
function serializeQueryParams(params: Record<string, Parameters<typeof encodeURIComponent>[0]>) {
  const queryString = []
  for (const param in params) {
    if (params[param]) {
      queryString.push(`${encodeURIComponent(param)}=${encodeURIComponent(params[param])}`)
    }
  }
  return queryString.join('&')
}

export const signMoonpayLinkStaging = functions
  .runWith({
    secrets: [
      'MOONPAY_API_KEY_STAGING',
      'MOONPAY_SECRET_KEY_STAGING',
      'MOONPAY_PUBLISHABLE_KEY_STAGING_WEB',
      'MOONPAY_SECRET_KEY_STAGING_WEB',
    ],
  })
  .https.onRequest((request: functions.Request<any>, response: functions.Response<any>) => {
    corsHandler(request, response, () => {
      const platform = request.query.platform

      const { MOONPAY_URL_STAGING } = process.env
      let { MOONPAY_API_KEY_STAGING, MOONPAY_SECRET_KEY_STAGING } = process.env
      if (platform && platform === 'web') {
        MOONPAY_API_KEY_STAGING = process.env.MOONPAY_PUBLISHABLE_KEY_STAGING_WEB
        MOONPAY_SECRET_KEY_STAGING = process.env.MOONPAY_SECRET_KEY_STAGING_WEB
      }

      const {
        baseCurrencyAmount,
        colorCode,
        currencyCode,
        defaultCurrencyCode,
        externalTransactionId,
        externalCustomerId,
        redirectURL,
        walletAddress,
        walletAddresses,
      } = request.body

      const url = `${MOONPAY_URL_STAGING}?`.concat(
        serializeQueryParams({
          apiKey: MOONPAY_API_KEY_STAGING ?? '',
          baseCurrencyAmount,
          colorCode,
          currencyCode,
          defaultCurrencyCode,
          externalTransactionId,
          externalCustomerId,
          redirectURL,
          walletAddress,
          walletAddresses,
        })
      )

      console.log(`Requested signature for: ${url}`)

      const signature = crypto
        .createHmac('sha256', MOONPAY_SECRET_KEY_STAGING ?? '')
        .update(new URL(url).search)
        .digest('base64')

      const urlWithSignature = `${url}&signature=${encodeURIComponent(signature)}`

      console.log(`Returning signed URL: ${urlWithSignature}`)
      response.send(JSON.stringify({ url: urlWithSignature }))
    })
  })
