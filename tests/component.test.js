import { expect, describe, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { WebAudioPeakMeter } from '../src/components';

describe('component is able to mount', () => {
  it('is true', () => {
    const wrapper = mount(WebAudioPeakMeter, { props: { srcNode: null } });

    expect(wrapper.text()).toContain('-42');
  });
});
