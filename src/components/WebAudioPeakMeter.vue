<template>
  <div ref="mainContainer" class="web-audio-peak-meter">
    <div class="wapm-container">
      <div class="wapm-channels">
        <div class="wapm-channel">
          <div class="wapm-peak-label">{{ channels[0].label }}</div>
          <div class="wapm-peak-bar">
            <div
              class="wapm-led"
              :class="{
                'wapm-led-green': dotPercent <= 45 && dotPercent >= 0,
                'wapm-led-yellow': dotPercent >= 46 && dotPercent <= 80,
                'wapm-led-red': dotPercent >= 81 && dotPercent <= 100,
                'wapm-led-off': channels[0].percent <= dotPercent,
                'wapm-led-on': channels[0].percent > dotPercent
              }"
              v-for="dotPercent in dots"
            ></div>
          </div>
        </div>
        <div class="wapm-ticks">
          <div
            class="wapm-tick"
            :style="`--percent-in-range: ${percentInRange}%`"
            v-for="{ tick, percentInRange } in ticks"
          >
            {{ tick }}
          </div>
        </div>
        <div class="wapm-channel">
          <div class="wapm-peak-label">{{ channels[1].label }}</div>
          <div class="wapm-peak-bar">
            <div
              class="wapm-led"
              :data-percent="dotPercent"
              :class="{
                'wapm-led-green': dotPercent <= 45 && dotPercent >= 0,
                'wapm-led-yellow': dotPercent >= 46 && dotPercent <= 80,
                'wapm-led-red': dotPercent >= 81 && dotPercent <= 100,
                'wapm-led-off': channels[1].percent <= dotPercent,
                'wapm-led-on': channels[1].percent > dotPercent
              }"
              v-for="dotPercent in dots"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue';
import { defaultConfig } from '../config';
import type { PeakMeterConfig } from '../config';
import { audioPercent, dbFromFloat, dbTicks } from '../utils';
import peakSampleProcessor from '../peak-sample-processor?url';
import truePeakProcessor from '../true-peak-processor?url';

const mainContainer = ref<HTMLDivElement>();

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
const peakBarHeight = ref(0);

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

const channelCount = computed(() => {
  return 2;
  //return srcNode.value?.channelCount || 0;
});
const channels = computed<{ label: string; percent: number }[]>(() => {
  const { dbRangeMax, dbRangeMin } = props;
  const chans: { label: string; percent: number }[] = [];
  for (let i = 0; i < channelCount.value; i++) {
    const db = dbFromFloat(tempPeaks.value[i]);
    let percent = audioPercent(db, dbRangeMin, dbRangeMax);

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

function observeHeight() {
  const resizeObserver = new ResizeObserver(function () {
    peakBarHeight.value = mainContainer.value?.querySelector('.wapm-peak-bar')?.clientHeight || 0;
  });

  resizeObserver.observe(mainContainer.value?.querySelector('.wapm-peak-bar')!);
  peakBarHeight.value = mainContainer.value?.querySelector('.wapm-peak-bar')?.clientHeight || 0;
}

const dots = computed<Array<number>>(() => {
  const { dbDotSize } = props;
  const dots = [];
  if (mainContainer.value) {
    let height = peakBarHeight.value;
    for (let i = 0; i < height - dbDotSize; i++) {
      if (i % dbDotSize === 0) {
        dots.push(0);
      }
    }
    dots.splice(
      0,
      dots.length,
      ...dots
        .reverse()
        .map((_dot, dot) => {
          return Math.floor((dot / dots.length) * 100);
        })
        .reverse()
    );

    dots.splice(0, 1, 100);
  }
  return dots;
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
  observeHeight();
});

onUnmounted(() => {
  if (node.value) {
    node.value.disconnect();
    node.value = undefined;
  }
});
</script>

<style lang="scss" scoped>
.web-audio-peak-meter {
  .wapm-led {
    margin: 0 auto;
    width: calc(v-bind('dbDotSize') * 1px);
    height: calc(v-bind('dbDotSize') * 1px);
    border: 1px solid black;
    border-radius: 50%;
    box-sizing: border-box;

    &.wapm-led-yellow {
      &.wapm-led-on {
        box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 7px 1px, #808002 0 -1px 9px, #ff0 0 2px 12px;
        background-color: rgb(255, 255, 0);
      }
      &.wapm-led-off {
        background-color: rgb(100, 100, 0);
      }
    }

    &.wapm-led-green {
      &.wapm-led-on {
        box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 7px 1px, #304701 0 -1px 9px, #68c400 0 2px 12px;
        background-color: rgb(0, 255, 0);
      }
      &.wapm-led-off {
        background-color: rgb(0, 100, 0);
      }
    }
    &.wapm-led-red {
      &.wapm-led-on {
        box-shadow: rgba(0, 0, 0, 0.2) 0 -1px 7px 1px, #441313 0 -1px 9px,
          rgba(255, 0, 0, 0.5) 0 2px 12px;
        background-color: rgb(255, 0, 0);
      }
      &.wapm-led-off {
        background-color: rgb(100, 0, 0);
      }
    }
    &.wapm-led-gray {
      background-color: #888;
    }
  }

  .wapm-container {
    background-color: v-bind('backgroundColor');
    box-sizing: border-box;
    height: 100%;
    padding: calc(v-bind('borderSize') * 1px);
    display: flex;
    flex-direction: row-reverse;

    .wapm-peak-label {
      color: v-bind('labelColor');
      font-size: calc(v-bind('fontSize') * 1px);
    }
    .wapm-channels {
      --channel-size: calc(50% - 1px);
      justify-content: space-between;
    }

    .wapm-channels {
      display: flex;
      flex-direction: row;
      height: 100%;
      width: 100%;
      .wapm-channel {
        height: 100%;
        width: var(--channel-size);
        .wapm-peak-label {
          height: calc(v-bind('fontSize * verticalLabelHeight') * 1px);
          width: 100%;
          text-align: center;
        }
        .wapm-peak-bar {
          display: flex;
          flex-direction: column;
          height: calc(100% - v-bind('cssVars.verticalBarHeight'));
          width: 100%;
          transition: all v-bind('maskTransition');
        }
      }
    }

    .wapm-ticks {
      position: relative;
      height: calc((100% - v-bind('fontSize * verticalLabelHeight')) * 1px);
      width: calc(v-bind('fontSize * verticalTickWidth') * 1px);
      margin-top: calc(v-bind('fontSize * verticalLabelHeight') * 1px);
      .wapm-tick {
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
