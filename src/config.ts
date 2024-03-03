export interface PeakMeterConfig {
  height?: number;
  borderSize?: number;
  fontSize?: number;
  backgroundColor?: string;
  tickColor?: string;
  labelColor?: string;
  gradient?: Array<string>;
  dbRangeMin?: number;
  dbRangeMax?: number;
  dbTickSize?: number;
  dbDotSize?: number;
  maskTransition?: string;
  audioMeterStandard?: string;
  peakHoldDuration?: number;
}

export const defaultConfig = {
  height: 80,
  borderSize: 2,
  fontSize: 9,
  backgroundColor: 'black',
  tickColor: '#ddd',
  labelColor: '#ddd',
  gradient: () => ['red 1%', '#ff0 16%', 'lime 45%', '#080 100%'],
  dbRangeMin: -48,
  dbRangeMax: 0,
  dbTickSize: 6,
  dbDotSize: 10,
  maskTransition: '0.1s',
  audioMeterStandard: 'peak-sample',
  peakHoldDuration: 0
};
