<template>
  <div class="balance-page">

    <!-- ── Estimated Total Banner ─────────────────────────────────────────── -->
    <div class="total-banner">
      <div class="total-banner__left">
        <div class="total-banner__label">Estimated Total</div>
        <div class="total-banner__amount">
          <span v-if="totalLoading" class="skeleton total-skeleton" />
          <template v-else>
            <span class="total-banner__number">{{ estimatedTotal }}</span>
            <el-select
              v-model="totalCurrency"
              size="small"
              class="currency-select"
              @change="onCurrencyChange"
            >
              <el-option v-for="c in currencyList" :key="c" :label="c" :value="c" />
            </el-select>
          </template>
        </div>
        <div class="total-banner__sub">
          Your total balance estimate in
          <b>{{ totalCurrency }}</b> at {{ refreshTime }}
          <el-button
            :icon="Refresh"
            size="small"
            circle
            plain
            class="refresh-btn"
            :loading="totalLoading"
            @click="loadAll"
          />
        </div>
      </div>

      <!-- Mini stat pills -->
      <div class="total-banner__stats">
        <div class="stat-pill stat-pill--green">
          <span class="stat-pill__label">Available</span>
          <span class="stat-pill__value">{{ totalAvailable }} {{ totalCurrency }}</span>
        </div>
        <div class="stat-pill stat-pill--orange">
          <span class="stat-pill__label">Frozen</span>
          <span class="stat-pill__value">{{ totalFrozen }} {{ totalCurrency }}</span>
        </div>
        <div class="stat-pill stat-pill--blue">
          <span class="stat-pill__label">Pending</span>
          <span class="stat-pill__value">{{ totalPending }} {{ totalCurrency }}</span>
        </div>
      </div>
    </div>

    <!-- ── Balances Section ────────────────────────────────────────────────── -->
    <div class="balances-section">
      <div class="section-header">
        <h2 class="section-title">Balances</h2>

        <div class="section-toolbar">
          <el-input
            v-model="searchKeyword"
            placeholder="Search currency..."
            :prefix-icon="Search"
            clearable
            size="small"
            class="search-input"
          />
          <el-checkbox v-model="hideZero" class="hide-zero-check">
            Hide zero balance
          </el-checkbox>
          <el-button size="small" :icon="Download" plain @click="handleExport">
            Export
          </el-button>
        </div>
      </div>

      <!-- Loading skeleton -->
      <template v-if="listLoading">
        <div v-for="n in 3" :key="n" class="balance-card balance-card--skeleton">
          <div class="skeleton sk-icon" />
          <div class="sk-lines">
            <div class="skeleton sk-line sk-line--wide" />
            <div class="skeleton sk-line sk-line--narrow" />
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <el-empty
        v-else-if="filteredBalances.length === 0"
        description="No balances found"
        :image-size="120"
        class="empty-state"
      />

      <!-- Balance cards -->
      <template v-else>
        <div
          v-for="item in filteredBalances"
          :key="item.currency"
          class="balance-card"
          :class="{ 'balance-card--zero': item.total === 0 }"
        >
          <!-- Left: icon + amounts -->
          <div class="balance-card__main">
            <div class="balance-card__icon-wrap">
              <img
                :src="item.icon"
                :alt="item.currency"
                class="balance-card__icon"
                @error="onImgError($event, item)"
              />
            </div>

            <div class="balance-card__info">
              <div class="balance-card__primary">
                <span class="balance-card__amount">{{ formatCrypto(item.total) }}</span>
                <span class="balance-card__currency">{{ item.currency }}</span>
                <el-tag
                  v-if="item.network"
                  size="small"
                  effect="plain"
                  class="network-tag"
                >{{ item.network }}</el-tag>
              </div>
              <div class="balance-card__usd">≈ $ {{ formatUSD(item.usdValue) }}</div>
            </div>
          </div>

          <!-- Middle: balance breakdown -->
          <div class="balance-card__breakdown">
            <div class="breakdown-item">
              <span class="breakdown-label">Available</span>
              <span class="breakdown-value breakdown-value--available">
                {{ formatCrypto(item.available) }}
              </span>
            </div>
            <div class="breakdown-divider" />
            <div class="breakdown-item">
              <span class="breakdown-label">Frozen</span>
              <span class="breakdown-value breakdown-value--frozen">
                {{ formatCrypto(item.frozen) }}
              </span>
            </div>
            <div class="breakdown-divider" />
            <div class="breakdown-item">
              <span class="breakdown-label">Pending</span>
              <span class="breakdown-value breakdown-value--pending">
                {{ formatCrypto(item.pending) }}
              </span>
            </div>
          </div>

          <!-- Right: actions -->
          <div class="balance-card__actions">
            <el-button
              size="small"
              type="primary"
              plain
              :icon="Tickets"
              @click="handlePayout(item)"
            >Payout</el-button>
            <el-button
              size="small"
              type="warning"
              plain
              :icon="Upload"
              @click="handleWithdraw(item)"
            >Withdraw</el-button>
            <el-button
              size="small"
              plain
              :icon="Clock"
              @click="handleHistory(item)"
            >History</el-button>
          </div>
        </div>
      </template>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Download, Tickets, Upload, Clock } from '@element-plus/icons-vue'

const router = useRouter()

// ─── State ────────────────────────────────────────────────────────────────────

const totalLoading = ref(false)
const listLoading  = ref(false)

const estimatedTotal = ref('0.000000')
const totalAvailable = ref('0.000000')
const totalFrozen    = ref('0.000000')
const totalPending   = ref('0.000000')
const totalCurrency  = ref('USDT')
const refreshTime    = ref('')

const searchKeyword = ref('')
const hideZero      = ref(false)

const currencyList = ['USDT', 'USD', 'EUR', 'BTC', 'ETH']

const balances = ref([])

// ─── Computed ─────────────────────────────────────────────────────────────────

const filteredBalances = computed(() => {
  let list = balances.value
  if (hideZero.value) list = list.filter(b => b.total > 0)
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(b =>
      b.currency.toLowerCase().includes(kw) ||
      b.fullName.toLowerCase().includes(kw)
    )
  }
  return list
})

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadSummary() {
  totalLoading.value = true
  try {
    // TODO: replace with real API → getBalanceSummary({ currency: totalCurrency.value })
    await sleep(400)
    estimatedTotal.value = '0.000000'
    totalAvailable.value = '0.000000'
    totalFrozen.value    = '0.000000'
    totalPending.value   = '0.000000'
    refreshTime.value    = formatNow()
  } finally {
    totalLoading.value = false
  }
}

async function loadBalances() {
  listLoading.value = true
  try {
    // TODO: replace with real API → getBalanceList()
    await sleep(500)
    balances.value = [
      {
        currency: 'USD', fullName: 'US Dollar',
        icon: 'https://flagcdn.com/w40/us.png',
        total: 0, available: 0, frozen: 0, pending: 0, usdValue: 0,
        network: null
      },
      {
        currency: 'USDC', fullName: 'USD Coin',
        icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
        total: 0, available: 0, frozen: 0, pending: 0, usdValue: 0,
        network: 'ERC-20'
      },
      {
        currency: 'USDT', fullName: 'Tether USD',
        icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
        total: 0, available: 0, frozen: 0, pending: 0, usdValue: 0,
        network: 'TRC-20'
      },
      {
        currency: 'BTC', fullName: 'Bitcoin',
        icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
        total: 0, available: 0, frozen: 0, pending: 0, usdValue: 0,
        network: null
      },
      {
        currency: 'ETH', fullName: 'Ethereum',
        icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        total: 0, available: 0, frozen: 0, pending: 0, usdValue: 0,
        network: 'ERC-20'
      }
    ]
  } finally {
    listLoading.value = false
  }
}

async function loadAll() {
  await Promise.all([loadSummary(), loadBalances()])
}

function onCurrencyChange() {
  loadSummary()
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function handlePayout(item) {
  router.push({ path: '/payment/payout', query: { currency: item.currency } })
}

function handleWithdraw(item) {
  router.push({ path: '/payment/withdraw', query: { currency: item.currency } })
}

function handleHistory(item) {
  router.push({ path: '/payment/transactions', query: { currency: item.currency } })
}

async function handleExport() {
  ElMessage.info('Preparing export...')
  // TODO: call exportBalances()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCrypto(v) {
  if (v === undefined || v === null) return '0.000000'
  return Number(v).toFixed(6)
}

function formatUSD(v) {
  if (!v) return '0.00'
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatNow() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function onImgError(e, item) {
  e.target.style.display = 'none'
  // Fallback: show currency initials via parent's ::after handled by CSS class
  e.target.parentElement.classList.add('icon-fallback')
  e.target.parentElement.dataset.initials = item.currency.slice(0, 2)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

onMounted(loadAll)
</script>

<style scoped>
/* ── Page ──────────────────────────────────────────────────────────────────── */
.balance-page {
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
}

/* ── Total Banner ──────────────────────────────────────────────────────────── */
.total-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px;
  background: #fff;
  border-radius: 12px;
  padding: 28px 32px;
  margin-bottom: 20px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, .06);
}

.total-banner__label {
  font-size: 13px;
  color: #8492a6;
  font-weight: 500;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: .5px;
}

.total-banner__amount {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.total-banner__number {
  font-size: 36px;
  font-weight: 700;
  color: #1f2d3d;
  letter-spacing: -.5px;
  font-variant-numeric: tabular-nums;
}

.currency-select {
  width: 96px;
}

.total-banner__sub {
  font-size: 13px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 6px;
}
.total-banner__sub b { color: #1f2d3d; }

.refresh-btn {
  border: none !important;
  padding: 0 !important;
  color: #c0c4cc !important;
}
.refresh-btn:hover { color: #409eff !important; }

/* Stat pills */
.total-banner__stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-self: center;
}

.stat-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 10px 16px;
  border-radius: 8px;
  min-width: 220px;
}
.stat-pill--green  { background: #f0f9eb; }
.stat-pill--orange { background: #fdf6ec; }
.stat-pill--blue   { background: #ecf5ff; }

.stat-pill__label {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
}
.stat-pill__value {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.stat-pill--green  .stat-pill__value { color: #67c23a; }
.stat-pill--orange .stat-pill__value { color: #e6a23c; }
.stat-pill--blue   .stat-pill__value { color: #409eff; }

/* ── Balances Section ──────────────────────────────────────────────────────── */
.balances-section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, .06);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #1f2d3d;
  margin: 0;
}

.section-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.search-input { width: 200px; }

.hide-zero-check {
  font-size: 13px;
  color: #606266;
}

/* ── Balance Card ──────────────────────────────────────────────────────────── */
.balance-card {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 18px 20px;
  border-radius: 10px;
  border: 1px solid #e8edf3;
  margin-bottom: 10px;
  transition: border-color .2s, box-shadow .2s, background .2s;
  background: #fafbfc;
}

.balance-card:hover {
  border-color: #409eff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, .10);
  background: #fff;
}

.balance-card--zero {
  opacity: .72;
}

/* Main section */
.balance-card__main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 200px;
  flex: 0 0 220px;
}

.balance-card__icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #f0f4f8;
  display: flex;
  align-items: center;
  justify-content: center;
}
.balance-card__icon-wrap.icon-fallback::after {
  content: attr(data-initials);
  font-size: 14px;
  font-weight: 700;
  color: #606266;
}

.balance-card__icon {
  width: 44px;
  height: 44px;
  object-fit: contain;
}

.balance-card__primary {
  display: flex;
  align-items: baseline;
  gap: 5px;
  flex-wrap: wrap;
}

.balance-card__amount {
  font-size: 17px;
  font-weight: 700;
  color: #1f2d3d;
  font-variant-numeric: tabular-nums;
}

.balance-card__currency {
  font-size: 13px;
  font-weight: 600;
  color: #5a6a7e;
}

.network-tag {
  font-size: 10px !important;
  padding: 0 5px !important;
  height: 18px !important;
  line-height: 18px !important;
  border-radius: 3px !important;
  color: #909399 !important;
  border-color: #dcdfe6 !important;
}

.balance-card__usd {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

/* Breakdown */
.balance-card__breakdown {
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
  justify-content: center;
}

.breakdown-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0 24px;
}

.breakdown-divider {
  width: 1px;
  height: 32px;
  background: #e8edf3;
}

.breakdown-label {
  font-size: 11px;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: .3px;
  font-weight: 500;
}

.breakdown-value {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.breakdown-value--available { color: #67c23a; }
.breakdown-value--frozen    { color: #e6a23c; }
.breakdown-value--pending   { color: #409eff; }

/* Actions */
.balance-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── Skeleton ──────────────────────────────────────────────────────────────── */
.skeleton {
  background: linear-gradient(90deg, #f0f2f5 25%, #e8ebef 50%, #f0f2f5 75%);
  background-size: 200% 100%;
  animation: shimmer 1.3s infinite;
  border-radius: 6px;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.total-skeleton { display: inline-block; width: 180px; height: 40px; }

.balance-card--skeleton {
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fafbfc;
}
.sk-icon  { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; }
.sk-lines { display: flex; flex-direction: column; gap: 8px; flex: 1; }
.sk-line  { height: 14px; }
.sk-line--wide   { width: 40%; }
.sk-line--narrow { width: 20%; }

/* ── Empty state ───────────────────────────────────────────────────────────── */
.empty-state { padding: 40px 0; }

/* ── Responsive ────────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .balance-page { padding: 12px; }
  .total-banner { flex-direction: column; }
  .total-banner__stats { flex-direction: row; flex-wrap: wrap; }
  .stat-pill { min-width: 140px; flex: 1; }

  .balance-card {
    flex-wrap: wrap;
    gap: 14px;
  }
  .balance-card__main     { flex: 0 0 100%; }
  .balance-card__breakdown { justify-content: flex-start; }
  .breakdown-item          { padding: 0 16px; }
  .breakdown-item:first-child { padding-left: 0; }
}

@media (max-width: 600px) {
  .balance-card__breakdown { flex-wrap: wrap; gap: 10px; }
  .breakdown-divider { display: none; }
  .breakdown-item { padding: 0; align-items: flex-start; }
  .balance-card__actions { flex-wrap: wrap; }
  .search-input { width: 100%; }
}
</style>
