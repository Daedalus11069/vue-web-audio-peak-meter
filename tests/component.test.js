import { expect, describe, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { WebAudioPeakMeter } from '../src/components';

describe('component is able to mount', () => {
  it('can render the ticks', () => {
    const wrapper = mount(WebAudioPeakMeter, { props: { srcNode: null } });

    expect(wrapper.text()).toContain('-42');
  });
  it('can render the ticks at the correct offset', () => {
    const wrapper = mount(WebAudioPeakMeter, { props: { srcNode: null } });

    expect(wrapper.findAll('.tick').at(4).attributes().style).toBe('--percent-in-range: 37.5%;');
  });
});
