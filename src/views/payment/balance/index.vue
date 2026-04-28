<template>
  <div class="balance-page">
    <!-- 顶部汇总卡片 -->
    <el-row :gutter="16" class="summary-row">
      <el-col v-for="card in summaryCards" :key="card.key" :xs="24" :sm="12" :lg="6">
        <div class="summary-card" :class="`summary-card--${card.theme}`">
          <div class="summary-card__icon">
            <el-icon :size="28"><component :is="card.icon" /></el-icon>
          </div>
          <div class="summary-card__body">
            <span class="summary-card__label">{{ card.label }}</span>
            <div class="summary-card__value">
              <span v-if="summaryLoading" class="skeleton-text" />
              <template v-else>
                <span class="summary-card__currency">$</span>
                {{ formatAmount(summary[card.key]) }}
              </template>
            </div>
            <div class="summary-card__trend" v-if="!summaryLoading">
              <el-icon :class="summary[card.trendKey] >= 0 ? 'trend-up' : 'trend-down'">
                <component :is="summary[card.trendKey] >= 0 ? 'ArrowUp' : 'ArrowDown'" />
              </el-icon>
              <span :class="summary[card.trendKey] >= 0 ? 'trend-up' : 'trend-down'">
                {{ Math.abs(summary[card.trendKey] || 0).toFixed(2) }}% vs yesterday
              </span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 趋势图 + 资产分布 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="16">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">Balance Trend</span>
              <el-radio-group v-model="trendRange" size="small" @change="loadTrend">
                <el-radio-button label="7d">7D</el-radio-button>
                <el-radio-button label="30d">30D</el-radio-button>
                <el-radio-button label="90d">90D</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <BalanceTrendChart :data="trendData" height="280px" />
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="8">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">Asset Distribution</span>
            </div>
          </template>
          <div ref="pieChartRef" style="height:280px" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 余额列表 + 交易记录 -->
    <el-row :gutter="16" class="table-row">
      <el-col :xs="24" :lg="12">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">Balance by Currency</span>
              <el-button type="primary" size="small" plain @click="loadBalanceList">
                <el-icon><Refresh /></el-icon> Refresh
              </el-button>
            </div>
          </template>

          <el-table
            :data="balanceList"
            v-loading="balanceLoading"
            stripe
            size="small"
            class="balance-table"
          >
            <el-table-column label="Currency" min-width="110">
              <template #default="{ row }">
                <div class="currency-cell">
                  <img :src="row.icon" class="currency-icon" :alt="row.currency" />
                  <div>
                    <div class="currency-name">{{ row.currency }}</div>
                    <div class="currency-fullname">{{ row.fullName }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="Available" align="right" min-width="110">
              <template #default="{ row }">
                <span class="amount-text">{{ formatCryptoAmount(row.available) }}</span>
              </template>
            </el-table-column>

            <el-table-column label="Frozen" align="right" min-width="100">
              <template #default="{ row }">
                <span class="amount-text frozen">{{ formatCryptoAmount(row.frozen) }}</span>
              </template>
            </el-table-column>

            <el-table-column label="USD Value" align="right" min-width="110">
              <template #default="{ row }">
                <span class="amount-usd">${{ formatAmount(row.usdValue) }}</span>
              </template>
            </el-table-column>

            <el-table-column label="Change 24h" align="right" min-width="100">
              <template #default="{ row }">
                <span :class="row.change24h >= 0 ? 'change-up' : 'change-down'">
                  {{ row.change24h >= 0 ? '+' : '' }}{{ row.change24h?.toFixed(2) }}%
                </span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="12">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">Recent Transactions</span>
              <el-button type="primary" size="small" plain @click="handleExport">
                <el-icon><Download /></el-icon> Export
              </el-button>
            </div>
          </template>

          <!-- 筛选条件 -->
          <div class="filter-bar">
            <el-select
              v-model="txFilter.currency"
              placeholder="All Currencies"
              size="small"
              clearable
              style="width:140px"
              @change="loadTransactions"
            >
              <el-option
                v-for="item in currencyOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>

            <el-select
              v-model="txFilter.type"
              placeholder="All Types"
              size="small"
              clearable
              style="width:130px"
              @change="loadTransactions"
            >
              <el-option label="Deposit" value="deposit" />
              <el-option label="Withdrawal" value="withdrawal" />
              <el-option label="Transfer" value="transfer" />
              <el-option label="Fee" value="fee" />
            </el-select>

            <el-date-picker
              v-model="txFilter.dateRange"
              type="daterange"
              size="small"
              range-separator="-"
              start-placeholder="Start"
              end-placeholder="End"
              style="width:220px"
              value-format="YYYY-MM-DD"
              @change="loadTransactions"
            />
          </div>

          <el-table
            :data="transactions"
            v-loading="txLoading"
            stripe
            size="small"
            class="tx-table"
          >
            <el-table-column label="Time" width="150">
              <template #default="{ row }">
                <span class="time-text">{{ row.time }}</span>
              </template>
            </el-table-column>

            <el-table-column label="Type" width="90">
              <template #default="{ row }">
                <el-tag
                  :type="txTypeTag(row.type)"
                  size="small"
                  effect="light"
                >{{ row.type }}</el-tag>
              </template>
            </el-table-column>

            <el-table-column label="Currency" width="80" align="center">
              <template #default="{ row }">
                <span class="currency-badge">{{ row.currency }}</span>
              </template>
            </el-table-column>

            <el-table-column label="Amount" align="right">
              <template #default="{ row }">
                <span :class="row.direction === 'in' ? 'amount-in' : 'amount-out'">
                  {{ row.direction === 'in' ? '+' : '-' }}{{ formatCryptoAmount(row.amount) }}
                </span>
              </template>
            </el-table-column>

            <el-table-column label="Status" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-bar">
            <el-pagination
              v-model:current-page="txPagination.page"
              v-model:page-size="txPagination.pageSize"
              :total="txPagination.total"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next"
              small
              @size-change="loadTransactions"
              @current-change="loadTransactions"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Wallet, Money, Lock, TrendCharts, Refresh, Download, ArrowUp, ArrowDown } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import BalanceTrendChart from '@/components/charts/BalanceTrendChart.vue'
import {
  getBalanceSummary,
  getBalanceList,
  getBalanceTrend,
  getTransactionList,
  exportTransactions
} from '@/api/balance'

// ─── Summary ────────────────────────────────────────────────────────────────

const summaryLoading = ref(false)
const summary = reactive({
  total: 0, totalTrend: 0,
  available: 0, availableTrend: 0,
  frozen: 0, frozenTrend: 0,
  todayIncome: 0, todayIncomeTrend: 0
})

const summaryCards = [
  { key: 'total', trendKey: 'totalTrend', label: 'Total Balance', icon: 'Wallet', theme: 'blue' },
  { key: 'available', trendKey: 'availableTrend', label: 'Available Balance', icon: 'Money', theme: 'green' },
  { key: 'frozen', trendKey: 'frozenTrend', label: 'Frozen Balance', icon: 'Lock', theme: 'orange' },
  { key: 'todayIncome', trendKey: 'todayIncomeTrend', label: "Today's Income", icon: 'TrendCharts', theme: 'purple' }
]

async function loadSummary() {
  summaryLoading.value = true
  try {
    // Mock data – replace with: const { data } = await getBalanceSummary()
    await sleep(400)
    Object.assign(summary, {
      total: 2584732.46,    totalTrend: 3.21,
      available: 1923415.80, availableTrend: 1.87,
      frozen: 661316.66,   frozenTrend: -0.54,
      todayIncome: 18472.30, todayIncomeTrend: 12.4
    })
  } catch {
    ElMessage.error('Failed to load balance summary')
  } finally {
    summaryLoading.value = false
  }
}

// ─── Trend Chart ─────────────────────────────────────────────────────────────

const trendRange = ref('30d')
const trendData = ref({})

async function loadTrend() {
  try {
    // const { data } = await getBalanceTrend({ range: trendRange.value })
    await sleep(300)
    const days = trendRange.value === '7d' ? 7 : trendRange.value === '30d' ? 30 : 90
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (days - i - 1))
      return `${d.getMonth() + 1}/${d.getDate()}`
    })
    const base = 2200000
    trendData.value = {
      dates,
      total: dates.map((_, i) => +(base + Math.sin(i / 5) * 120000 + i * 5000 + Math.random() * 40000).toFixed(0)),
      available: dates.map((_, i) => +(base * 0.74 + Math.sin(i / 4) * 80000 + i * 3800 + Math.random() * 25000).toFixed(0)),
      frozen: dates.map((_, i) => +(base * 0.26 + Math.cos(i / 6) * 30000 + Math.random() * 15000).toFixed(0))
    }
  } catch {
    ElMessage.error('Failed to load trend data')
  }
}

// ─── Pie Chart ───────────────────────────────────────────────────────────────

const pieChartRef = ref(null)
let pieChart = null

const pieData = [
  { name: 'USDT', value: 1120000, color: '#26a17b' },
  { name: 'BTC',  value: 680000,  color: '#f7931a' },
  { name: 'ETH',  value: 430000,  color: '#627eea' },
  { name: 'USDC', value: 220000,  color: '#2775ca' },
  { name: 'Others', value: 134732, color: '#a0a0b0' }
]

function initPieChart() {
  if (!pieChartRef.value) return
  pieChart = echarts.init(pieChartRef.value)
  pieChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: p => `<b>${p.name}</b><br/>$${Number(p.value).toLocaleString()} (${p.percent}%)`
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'middle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 12 }
    },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold' },
        scaleSize: 6
      },
      data: pieData.map(d => ({
        name: d.name, value: d.value,
        itemStyle: { color: d.color }
      }))
    }]
  })
}

function resizePie() { pieChart && pieChart.resize() }

// ─── Balance List ─────────────────────────────────────────────────────────────

const balanceLoading = ref(false)
const balanceList = ref([])

async function loadBalanceList() {
  balanceLoading.value = true
  try {
    // const { data } = await getBalanceList()
    await sleep(500)
    balanceList.value = [
      { currency: 'USDT', fullName: 'Tether USD',    icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png', available: 984521.34, frozen: 135478.66, usdValue: 1120000, change24h: 0.01 },
      { currency: 'BTC',  fullName: 'Bitcoin',        icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',  available: 8.42180,   frozen: 1.83200,   usdValue: 680000,  change24h: 2.34 },
      { currency: 'ETH',  fullName: 'Ethereum',       icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png', available: 124.5560,  frozen: 12.4400,   usdValue: 430000,  change24h: -1.12 },
      { currency: 'USDC', fullName: 'USD Coin',       icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',available: 210430.00, frozen: 9570.00,   usdValue: 220000,  change24h: 0.02 },
      { currency: 'BNB',  fullName: 'BNB',            icon: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',      available: 142.2300,  frozen: 20.0000,   usdValue: 68500,   change24h: 0.87 },
      { currency: 'TRX',  fullName: 'TRON',           icon: 'https://cryptologos.cc/logos/tron-trx-logo.png',     available: 152340.00, frozen: 8760.00,   usdValue: 24100,   change24h: -0.45 }
    ]
  } catch {
    ElMessage.error('Failed to load balance list')
  } finally {
    balanceLoading.value = false
  }
}

// ─── Transactions ─────────────────────────────────────────────────────────────

const txLoading = ref(false)
const transactions = ref([])
const txFilter = reactive({ currency: '', type: '', dateRange: [] })
const txPagination = reactive({ page: 1, pageSize: 10, total: 0 })

const currencyOptions = computed(() =>
  balanceList.value.map(b => ({ label: b.currency, value: b.currency }))
)

const TX_TYPES = ['deposit', 'withdrawal', 'transfer', 'fee']
const CURRENCIES = ['USDT', 'BTC', 'ETH', 'USDC', 'BNB', 'TRX']
const STATUSES = ['completed', 'pending', 'failed']

async function loadTransactions() {
  txLoading.value = true
  try {
    // const { data } = await getTransactionList({ ...txFilter, ...txPagination })
    await sleep(400)
    const total = 128
    txPagination.total = total
    transactions.value = Array.from({ length: txPagination.pageSize }, (_, i) => {
      const type = TX_TYPES[Math.floor(Math.random() * TX_TYPES.length)]
      const currency = CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)]
      const status = STATUSES[Math.floor(Math.random() * (STATUSES.length - 0.3))]
      return {
        time: formatTime(new Date(Date.now() - Math.random() * 86400000 * 7)),
        type,
        currency,
        direction: type === 'deposit' ? 'in' : 'out',
        amount: +(Math.random() * 10000 + 10).toFixed(6),
        status
      }
    }).sort((a, b) => b.time.localeCompare(a.time))
  } catch {
    ElMessage.error('Failed to load transactions')
  } finally {
    txLoading.value = false
  }
}

async function handleExport() {
  try {
    ElMessage.info('Generating export file...')
    // const blob = await exportTransactions({ ...txFilter })
    // downloadBlob(blob, 'transactions.csv')
    await sleep(800)
    ElMessage.success('Export started, file will download shortly')
  } catch {
    ElMessage.error('Export failed')
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(val) {
  if (val === undefined || val === null) return '0.00'
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCryptoAmount(val) {
  if (val === undefined || val === null) return '0'
  const n = Number(val)
  return n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toFixed(6).replace(/\.?0+$/, '')
}

function formatTime(d) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function txTypeTag(type) {
  return { deposit: 'success', withdrawal: 'danger', transfer: 'primary', fee: 'warning' }[type] || 'info'
}

function statusTag(status) {
  return { completed: 'success', pending: 'warning', failed: 'danger' }[status] || 'info'
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadSummary(), loadTrend(), loadBalanceList(), loadTransactions()])
  await nextTick()
  initPieChart()
  window.addEventListener('resize', resizePie)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizePie)
  pieChart && pieChart.dispose()
})
</script>

<style scoped>
.balance-page {
  padding: 16px;
  background: #f5f7fa;
  min-height: 100vh;
}

/* ── Summary Cards ─────────────────────────────────────────────────────────── */
.summary-row { margin-bottom: 16px; }

.summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
  transition: box-shadow .2s, transform .2s;
  cursor: default;
}
.summary-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,.10);
  transform: translateY(-2px);
}

.summary-card__icon {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.summary-card--blue  .summary-card__icon { background: #ecf5ff; color: #409eff; }
.summary-card--green .summary-card__icon { background: #f0f9eb; color: #67c23a; }
.summary-card--orange .summary-card__icon { background: #fdf6ec; color: #e6a23c; }
.summary-card--purple .summary-card__icon { background: #f3ecff; color: #9254de; }

.summary-card__body { flex: 1; min-width: 0; }
.summary-card__label {
  font-size: 12px;
  color: #909399;
  display: block;
  margin-bottom: 4px;
}
.summary-card__value {
  font-size: 22px;
  font-weight: 700;
  color: #1f2d3d;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.summary-card__currency {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
  margin-right: 2px;
}
.summary-card__trend {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
  font-size: 12px;
}
.trend-up  { color: #67c23a; }
.trend-down { color: #f56c6c; }

.skeleton-text {
  display: inline-block;
  width: 100px;
  height: 22px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Chart Row ────────────────────────────────────────────────────────────── */
.chart-row, .table-row { margin-bottom: 16px; }

.chart-card { height: 100%; }

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
}

/* ── Tables ───────────────────────────────────────────────────────────────── */
.currency-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.currency-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: contain;
  flex-shrink: 0;
}
.currency-name { font-size: 13px; font-weight: 600; color: #1f2d3d; }
.currency-fullname { font-size: 11px; color: #909399; }

.amount-text { font-size: 12px; color: #303133; font-variant-numeric: tabular-nums; }
.amount-text.frozen { color: #e6a23c; }
.amount-usd { font-size: 12px; font-weight: 600; color: #303133; }

.change-up   { color: #67c23a; font-size: 12px; font-weight: 600; }
.change-down { color: #f56c6c; font-size: 12px; font-weight: 600; }

.currency-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f0f4f8;
  font-size: 11px;
  font-weight: 600;
  color: #5a6a7e;
}

.time-text { font-size: 12px; color: #606266; }

.amount-in  { color: #67c23a; font-size: 12px; font-weight: 600; }
.amount-out { color: #f56c6c; font-size: 12px; font-weight: 600; }

/* ── Filter + Pagination ─────────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

/* ── Element Plus overrides ──────────────────────────────────────────────── */
:deep(.el-card__body) { padding: 16px; }
:deep(.el-card__header) { padding: 12px 16px; border-bottom: 1px solid #f0f4f8; }
:deep(.el-table) { font-size: 12px; }
:deep(.el-table__header) th { background: #fafbfc !important; color: #606266; }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .balance-page { padding: 10px; }
  .summary-card { padding: 14px; }
  .summary-card__value { font-size: 18px; }
  .filter-bar .el-date-picker { width: 100% !important; }
}
</style>
