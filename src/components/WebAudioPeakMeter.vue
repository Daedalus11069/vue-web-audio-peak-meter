<template>
  <div>
    <div class="meter-container" :class="{ 'meter-vertical': vertical }">
      <div class="meter-channels">
        <div class="meter-channel" v-for="channel in channels">
          <div class="meter-peak-label">{{ channel.label }}</div>
          <div class="meter-peak-bar" :style="`--audio-clip-path: ${channel.percent}%`"></div>
        </div>
      </div>
      <div class="meter-ticks">
        <div
          class="meter-tick"
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
import { dbFromFloat, dbTicks } from '../utils';
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
        heldPeaks.value[i] = peaks[i];
        // if (peaks[i] > heldPeaks.value[i]) {
        //   heldPeaks.value[i] = peaks[i];
        //   if (peakHoldTimeouts.value[i]) {
        //     clearTimeout(peakHoldTimeouts.value[i]);
        //   }
        //   if (props.peakHoldDuration) {
        //     peakHoldTimeouts.value[i] = window.setTimeout(() => {
        //       clearPeak(i);
        //     }, props.peakHoldDuration);
        //   }
        // }
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
    let percent = Math.floor(((dbRangeMax! - db) * 100) / (dbRangeMax! - dbRangeMin!));
    if (percent > 100) {
      percent = 100;
    }
    if (percent < 0) {
      percent = 0;
    }

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

//const totalBorder = computed(() => (channels.value.length - 1) * props.borderSize);

defineExpose({ peaks, clearPeaks });

watchEffect(() => {
  //console.log(channels.value[0]);
});

onMounted(async () => {
  const { audioMeterStandard } = props;

  watchEffect(() => {
    tempPeaks.value = new Array(channelCount.value).fill(0.0);
    heldPeaks.value = new Array(channelCount.value).fill(0.0);
    peakHoldTimeouts.value = new Array(channelCount.value).fill(0);
  });

  watch(
    srcNode,
    async (isReady) => {
      if (isReady) {
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
          node.value.port.onmessage = (ev: MessageEvent) => handleNodePortMessage(ev);
          srcNode.value.connect(node.value).connect(srcNode.value.context.destination);
        }
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
.meter-container {
  background-color: v-bind('backgroundColor');
  box-sizing: border-box;
  height: 100%;
  padding: v-bind('borderSize + "px"');

  .meter-peak-label {
    color: v-bind('labelColor');
    font-size: v-bind('fontSize');
  }
  .meter-channels {
    --channel-size: calc(50% - 1px);
    justify-content: space-between;
  }
  &:not(&.meter-vertical) .meter-channels {
    display: flex;
    flex-direction: column;
    height: calc(100% - v-bind('fontSize * horizontalTickHeight + "px"'));
    width: 100%;
    .meter-channel {
      display: flex;
      height: var(--channel-size);
      width: 100%;
      flex-direction: row-reverse;
      .meter-peak-label {
        display: flex;
        justify-content: center;
        align-items: center;
        width: v-bind('fontSize * horizontalLabelWidth + "px"');
      }
      .meter-peak-bar {
        transition: clip-path v-bind('maskTransition');
        height: 100%;
        width: calc(100% - v-bind('fontSize * horizontalLabelWidth + "px"'));
        background-image: linear-gradient(to left, v-bind('gradientJoined'));
        clip-path: inset(0 var(--audio-clip-path) 0 0);
        transition: clip-path 0.1s ease 0s;
      }
    }
  }

  &:not(&.meter-vertical) .meter-ticks {
    position: relative;
    height: v-bind('fontSize * horizontalTickHeight + "px"');
    width: calc(100% - v-bind('fontSize * horizontalLabelWidth + "px"'));
    margin-right: v-bind('fontSize * horizontalLabelWidth + "px"');
    .meter-tick {
      position: absolute;
      color: v-bind('tickColor');
      font-size: v-bind('fontSize + "px"');
      right: var(--percent-in-range);
      transform: translateX(50%);
    }
  }

  &.meter-vertical {
    display: flex;
    flex-direction: row-reverse;
    .meter-channels {
      display: flex;
      flex-direction: row;
      height: 100%;
      width: calc(100% - v-bind('fontSize * verticalTickWidth + "px"'));
      .meter-channel {
        height: 100%;
        width: var(--channel-size);
        .meter-peak-label {
          height: v-bind('fontSize * verticalLabelHeight + "px"');
          width: 100%;
          text-align: center;
        }
        .meter-peak-bar {
          height: calc(100% - v-bind('fontSize * verticalLabelHeight + "px"'));
          width: 100%;
          background-image: linear-gradient(to bottom, v-bind('gradientJoined'));
          clip-path: inset(var(--audio-clip-path) 0 0);
          transition: clip-path 0.1s ease 0s;
        }
      }
    }

    .meter-ticks {
      position: relative;
      height: calc(100% - v-bind('fontSize * verticalLabelHeight + "px"'));
      width: v-bind('fontSize * verticalTickWidth + "px"');
      margin-top: v-bind('fontSize * verticalLabelHeight + "px"');
      .meter-tick {
        position: absolute;
        color: v-bind('tickColor');
        font-size: v-bind('fontSize + "px"');
        top: calc(var(--percent-in-range) - v-bind('fontSize / 2 + "px"'));
        right: v-bind('borderSize + "px"');
        text-align: right;
      }
    }
  }
}
</style>
