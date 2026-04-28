import request from '@/utils/request'

export function getBalanceSummary() {
  return request({ url: '/payment/balance/summary', method: 'get' })
}

export function getBalanceList(params) {
  return request({ url: '/payment/balance/list', method: 'get', params })
}

export function getBalanceTrend(params) {
  return request({ url: '/payment/balance/trend', method: 'get', params })
}

export function getTransactionList(params) {
  return request({ url: '/payment/balance/transactions', method: 'get', params })
}

export function exportTransactions(params) {
  return request({
    url: '/payment/balance/transactions/export',
    method: 'get',
    params,
    responseType: 'blob'
  })
}
