<template>
  <div ref="chartRef" :style="{ height, width: '100%' }" />
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  height: { type: String, default: '300px' },
  data: { type: Object, default: () => ({}) }
})

const chartRef = ref(null)
let chart = null

function buildOption(data) {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter(params) {
        let html = `<div style="font-size:13px;font-weight:600;margin-bottom:4px">${params[0].axisValue}</div>`
        params.forEach(p => {
          html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span style="flex:1">${p.seriesName}</span>
            <b>$${Number(p.value).toLocaleString()}</b>
          </div>`
        })
        return html
      }
    },
    legend: {
      top: 8,
      right: 16,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 12 }
    },
    grid: { top: 48, right: 24, bottom: 40, left: 64 },
    xAxis: {
      type: 'category',
      data: data.dates || [],
      axisLine: { lineStyle: { color: '#e0e6ed' } },
      axisTick: { show: false },
      axisLabel: { color: '#8492a6', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#8492a6',
        fontSize: 11,
        formatter: v => `$${(v / 1000).toFixed(0)}K`
      },
      splitLine: { lineStyle: { color: '#f0f4f8', type: 'dashed' } }
    },
    series: [
      {
        name: 'Total Balance',
        type: 'line',
        smooth: true,
        data: data.total || [],
        symbol: 'circle',
        symbolSize: 5,
        itemStyle: { color: '#409eff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64,158,255,0.2)' },
            { offset: 1, color: 'rgba(64,158,255,0.01)' }
          ])
        }
      },
      {
        name: 'Available',
        type: 'line',
        smooth: true,
        data: data.available || [],
        symbol: 'circle',
        symbolSize: 5,
        itemStyle: { color: '#67c23a' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(103,194,58,0.15)' },
            { offset: 1, color: 'rgba(103,194,58,0.01)' }
          ])
        }
      },
      {
        name: 'Frozen',
        type: 'line',
        smooth: true,
        data: data.frozen || [],
        symbol: 'circle',
        symbolSize: 5,
        itemStyle: { color: '#e6a23c' },
        lineStyle: { type: 'dashed' }
      }
    ]
  }
}

function initChart() {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  chart.setOption(buildOption(props.data))
}

function resize() {
  chart && chart.resize()
}

watch(() => props.data, val => {
  chart && chart.setOption(buildOption(val))
}, { deep: true })

onMounted(() => {
  initChart()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart && chart.dispose()
})
</script>
