/**
 * Azure Marketplace SaaS Fulfillment API v2.
 *
 * Docs: https://learn.microsoft.com/en-us/azure/marketplace/partner-center-portal/pc-saas-fulfillment-api-v2
 *
 * Required env vars:
 *   AZURE_MARKETPLACE_TENANT_ID
 *   AZURE_MARKETPLACE_CLIENT_ID
 *   AZURE_MARKETPLACE_CLIENT_SECRET
 */

const FULFILLMENT_BASE = "https://marketplaceapi.microsoft.com/api/saas"
const API_VERSION = "2018-08-31"
const TOKEN_RESOURCE = "20e940b3-4c77-4b0b-9a53-9e16a1b010a7"

let _tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 60_000) {
    return _tokenCache.token
  }

  const tenantId = process.env.AZURE_MARKETPLACE_TENANT_ID!
  const clientId = process.env.AZURE_MARKETPLACE_CLIENT_ID!
  const clientSecret = process.env.AZURE_MARKETPLACE_CLIENT_SECRET!

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        resource: TOKEN_RESOURCE,
      }),
    },
  )

  if (!res.ok) throw new Error(`Azure token error ${res.status}: ${await res.text()}`)

  const data = (await res.json()) as { access_token: string; expires_in: string }
  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + parseInt(data.expires_in) * 1000,
  }
  return _tokenCache.token
}

async function fulfillmentRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getAccessToken()
  const url = `${FULFILLMENT_BASE}${path}?api-version=${API_VERSION}`

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-ms-requestid": crypto.randomUUID(),
      "x-ms-correlationid": crypto.randomUUID(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Azure Fulfillment ${method} ${path} error ${res.status}: ${err}`)
  }

  // 202 Accepted returns no body
  if (res.status === 202) return {} as T

  const text = await res.text()
  return text ? JSON.parse(text) : ({} as T)
}

export interface AzureSubscription {
  id: string
  name: string
  publisherId: string
  offerId: string
  planId: string
  quantity: number
  subscription: {
    id: string
    publisherId: string
    offerId: string
    name: string
    saasSubscriptionStatus: string
    beneficiary: { emailId: string; objectId: string; tenantId: string }
    purchaser: { emailId: string; objectId: string; tenantId: string }
    planId: string
    term: { startDate: string; endDate: string; termUnit: string }
  }
}

/** Resolves a marketplace token from the landing page into subscription details. */
export async function resolveSubscription(marketplaceToken: string): Promise<AzureSubscription> {
  const token = await getAccessToken()
  const url = `${FULFILLMENT_BASE}/subscriptions/resolve?api-version=${API_VERSION}`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-ms-marketplace-token": marketplaceToken,
      "x-ms-requestid": crypto.randomUUID(),
      "x-ms-correlationid": crypto.randomUUID(),
    },
  })

  if (!res.ok) throw new Error(`Azure resolve error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<AzureSubscription>
}

/** Activates a subscription after the customer completes landing page flow. */
export async function activateSubscription(
  subscriptionId: string,
  planId: string,
  quantity: number = 1,
): Promise<void> {
  await fulfillmentRequest("POST", `/subscriptions/${subscriptionId}/activate`, {
    planId,
    quantity,
  })
}

/** Updates a subscription plan or quantity. */
export async function updateSubscription(
  subscriptionId: string,
  planId: string,
  quantity?: number,
): Promise<void> {
  await fulfillmentRequest("PATCH", `/subscriptions/${subscriptionId}`, {
    planId,
    ...(quantity !== undefined ? { quantity } : {}),
  })
}

/** Gets current subscription details. */
export async function getSubscription(subscriptionId: string): Promise<AzureSubscription> {
  return fulfillmentRequest("GET", `/subscriptions/${subscriptionId}`)
}

/** Acknowledges a webhook operation (required within 10 seconds). */
export async function acknowledgeOperation(
  subscriptionId: string,
  operationId: string,
  status: "Success" | "Failure",
  planId?: string,
  quantity?: number,
): Promise<void> {
  await fulfillmentRequest(
    "PATCH",
    `/subscriptions/${subscriptionId}/operations/${operationId}`,
    {
      status,
      ...(planId ? { planId } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
    },
  )
}

export function isAzureMarketplaceConfigured(): boolean {
  return !!(
    process.env.AZURE_MARKETPLACE_TENANT_ID &&
    process.env.AZURE_MARKETPLACE_CLIENT_ID &&
    process.env.AZURE_MARKETPLACE_CLIENT_SECRET
  )
}
