<template>
  <div>
    <div class="container" :class="{ vertical }">
      <div class="channels">
        <div class="channel" v-for="channel in channels">
          <div class="peak-label">{{ channel.label }}</div>
          <div class="peak-bar" :style="`--audio-clip-path: ${channel.percent}%`"></div>
        </div>
      </div>
      <div class="ticks">
        <div
          class="tick"
          :style="`--percent-in-range: ${percentInRange}%`"
          v-for="{ tick, percentInRange } in ticks"
        >
          {{ tick }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue';
import { defaultConfig } from '../config';
import type { PeakMeterConfig } from '../config';
import { audioClipPercent, dbFromFloat, dbTicks } from '../utils';
import peakSampleProcessor from '../peak-sample-processor?url';
import truePeakProcessor from '../true-peak-processor?url';

const horizontalLabelWidth = computed(() => 3);
const verticalLabelHeight = computed(() => 1.5);
const horizontalTickHeight = computed(() => 1.5);
const verticalTickWidth = computed(() => 2);

const srcNode = defineModel<AudioNode>('srcNode');
const node = defineModel<AudioWorkletNode>('node');
const props = withDefaults(defineProps<PeakMeterConfig>(), defaultConfig);

const tempPeaks = ref<Array<number>>([]);
const heldPeaks = ref<Array<number>>([]);
const peakHoldTimeouts = ref<Array<number>>([]);

function handleNodePortMessage(ev: MessageEvent) {
  if (ev.data.type === 'message') {
    //console.log(ev.data.message);
  }
  window.requestAnimationFrame(() => {
    if (ev.data.type === 'peaks') {
      const { peaks } = ev.data;
      for (let i = 0; i < tempPeaks.value.length; i += 1) {
        if (peaks.length > i) {
          tempPeaks.value[i] = peaks[i];
        } else {
          tempPeaks.value[i] = 0.0;
        }
      }
      if (peaks.length < channelCount) {
        tempPeaks.value.fill(0.0, peaks.length);
      }
      for (let i = 0; i < peaks.length; i += 1) {
        if (peaks[i] > heldPeaks.value[i]) {
          heldPeaks.value[i] = peaks[i];
          if (peakHoldTimeouts.value[i]) {
            clearTimeout(peakHoldTimeouts.value[i]);
          }
          if (props.peakHoldDuration) {
            peakHoldTimeouts.value[i] = window.setTimeout(() => {
              clearPeak(i);
            }, props.peakHoldDuration);
          }
        }
      }
    }
  });
}

function clearPeak(i: number) {
  heldPeaks.value[i] = tempPeaks.value[i];
}

function clearPeaks() {
  for (let i = 0; i < heldPeaks.value.length; i += 1) {
    clearPeak(i);
  }
}

const channelCount = computed(() => srcNode.value?.channelCount || 0);
const channels = computed<{ label: string; percent: number }[]>(() => {
  const { dbRangeMax, dbRangeMin } = props;
  const chans: { label: string; percent: number }[] = [];
  for (let i = 0; i < channelCount.value; i++) {
    const db = dbFromFloat(tempPeaks.value[i]);
    let percent = audioClipPercent(db, dbRangeMin, dbRangeMax);

    let label = '-∞';
    if (heldPeaks.value[i] !== 0.0) {
      const heldPeak = dbFromFloat(heldPeaks.value[i]);
      label = heldPeak.toFixed(1);
    }
    chans.push({ label, percent });
  }
  return chans;
});

const peaks = computed(() => ({
  current: tempPeaks.value,
  maxes: heldPeaks.value,
  currentDB: tempPeaks.value.map(dbFromFloat),
  maxesDB: heldPeaks.value.map(dbFromFloat)
}));

const ticks = computed<Array<{ tick: number; percentInRange: number }>>(() => {
  const { dbRangeMin, dbRangeMax, dbTickSize } = props;
  return dbTicks(dbRangeMin!, dbRangeMax!, dbTickSize!).map((tick) => ({
    tick,
    percentInRange: ((dbRangeMax! - tick) / (dbRangeMax! - dbRangeMin!)) * 100
  }));
});

const gradientJoined = computed(() => {
  return props.gradient.join(', ');
});

const cssVars = computed(() => ({
  verticalChannelWidth: props.fontSize * verticalTickWidth.value + 'px',
  verticalBarHeight: props.fontSize * verticalLabelHeight.value + 'px',
  horizontalBarWidth: props.fontSize * horizontalLabelWidth.value + 'px'
}));

defineExpose({ peaks, clearPeaks, srcNode });

onMounted(async () => {
  const { audioMeterStandard } = props;

  watchEffect(() => {
    tempPeaks.value = new Array(channelCount.value).fill(0.0);
    heldPeaks.value = new Array(channelCount.value).fill(0.0);
    peakHoldTimeouts.value = new Array(channelCount.value).fill(0);
  });

  watch(
    srcNode,
    async () => {
      if (srcNode.value) {
        try {
          node.value = new AudioWorkletNode(
            srcNode.value.context,
            `${audioMeterStandard}-processor`,
            {
              parameterData: {}
            }
          );
        } catch (_err) {
          const workletUrl =
            audioMeterStandard === 'true-peak' ? truePeakProcessor : peakSampleProcessor;
          await srcNode.value.context.audioWorklet.addModule(workletUrl);
          node.value = new AudioWorkletNode(
            srcNode.value.context,
            `${audioMeterStandard}-processor`,
            {
              parameterData: {}
            }
          );
        }
        node.value.port.onmessage = handleNodePortMessage;
        srcNode.value.connect(node.value).connect(srcNode.value.context.destination);
      }
    },
    {
      once: true
    }
  );
});

onUnmounted(() => {
  if (node.value) {
    node.value.disconnect();
  }
});
</script>

<style lang="scss" scoped>
.container {
  background-color: v-bind('backgroundColor');
  box-sizing: border-box;
  height: 100%;
  padding: calc(v-bind('borderSize') * 1px);

  .peak-label {
    color: v-bind('labelColor');
    font-size: calc(v-bind('fontSize') * 1px);
  }
  .channels {
    --channel-size: calc(50% - 1px);
    justify-content: space-between;
  }
  &:not(.vertical) .channels {
    display: flex;
    flex-direction: column;
    height: calc(100% - (v-bind('fontSize * horizontalTickHeight') * 1px));
    width: 100%;
    .channel {
      display: flex;
      height: var(--channel-size);
      width: 100%;
      flex-direction: row-reverse;
      .peak-label {
        display: flex;
        justify-content: center;
        align-items: center;
        width: calc(v-bind('fontSize * horizontalLabelWidth') * 1px);
      }
      .peak-bar {
        height: 100%;
        width: calc((100% - v-bind('cssVars.horizontalBarWidth')));
        background-image: linear-gradient(to left, v-bind('gradientJoined'));
        transition: clip-path v-bind('maskTransition');
        clip-path: inset(0 var(--audio-clip-path) 0 0);
      }
    }
  }

  &:not(.vertical) .ticks {
    position: relative;
    height: calc(v-bind('fontSize * horizontalTickHeight') * 1px);
    width: calc((100% - v-bind('fontSize * horizontalLabelWidth')) * 1px);
    margin-right: calc(v-bind('fontSize * horizontalLabelWidth') * 1px);
    .tick {
      position: absolute;
      color: v-bind('tickColor');
      font-size: calc(v-bind('fontSize') * 1px);
      right: var(--percent-in-range);
      transform: translateX(50%);
    }
  }

  &.vertical {
    display: flex;
    flex-direction: row-reverse;
    .channels {
      display: flex;
      flex-direction: row;
      height: 100%;
      width: calc((100% - v-bind('cssVars.verticalChannelWidth')));
      .channel {
        height: 100%;
        width: var(--channel-size);
        .peak-label {
          height: calc(v-bind('fontSize * verticalLabelHeight') * 1px);
          width: 100%;
          text-align: center;
        }
        .peak-bar {
          height: calc(100% - v-bind('cssVars.verticalBarHeight'));
          width: 100%;
          background-image: linear-gradient(to bottom, v-bind('gradientJoined'));
          clip-path: inset(var(--audio-clip-path) 0 0);
          transition: clip-path v-bind('maskTransition');
        }
      }
    }

    .ticks {
      position: relative;
      height: calc((100% - v-bind('fontSize * verticalLabelHeight')) * 1px);
      width: calc(v-bind('fontSize * verticalTickWidth') * 1px);
      margin-top: calc(v-bind('fontSize * verticalLabelHeight') * 1px);
      .tick {
        position: absolute;
        color: v-bind('tickColor');
        font-size: calc(v-bind('fontSize') * 1px);
        top: var(--percent-in-range);
        right: calc(v-bind('borderSize') * 1px);
        text-align: right;
      }
    }
  }
}
</style>
