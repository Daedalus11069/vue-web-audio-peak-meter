<template>
  <div>
    Vertical:
    <input type="checkbox" v-model="vertical" />
    <button type="button" @click="toggleAudioContext">{{ audioContextState }}</button>
    <audio preload="metadata" crossorigin="anonymous" ref="audioElement" controls>
      <source src="https://assets.rpy.xyz/testmedia/semper_fidelis.mp3" type="audio/mpeg" />
    </audio>
    <WebAudioPeakMeter
      v-model:src-node="audioNode"
      style="height: 80px; margin-bottom: 1rem"
    ></WebAudioPeakMeter>
    <div style="display: flex">
      <WebAudioPeakMeter
        v-model:src-node="audioNode"
        :peak-hold-duration="config.peakHoldDuration"
        :vertical="true"
        style="height: 300px; width: 80px; margin-right: 1rem"
      />
      <WebAudioPeakMeter
        v-model:src-node="audioNode"
        :peak-hold-duration="config.peakHoldDuration"
        :vertical="true"
        style="height: 300px; width: 80px"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const audioElement = ref<HTMLMediaElement>();
const audioContext = ref<AudioContext>();
const audioContextState = ref('resume');
const audioNode = ref<AudioNode>();
const config = ref({
  peakHoldDuration: 1
});
const vertical = ref(false);

async function toggleAudioContext() {
  if (!audioContext.value) {
    audioContext.value = new AudioContext();
  }
  if (audioElement.value && !audioNode.value) {
    audioNode.value = audioContext.value.createMediaElementSource(audioElement.value);
    audioNode.value.connect(audioContext.value.destination);
  }
  if (audioContext.value.state === 'suspended') {
    await audioContext.value.resume();
    audioContextState.value = 'suspend';
  } else {
    await audioContext.value.suspend();
    audioContextState.value = 'resume';
  }
}
</script>

<style scoped></style>
