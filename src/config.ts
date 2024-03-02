export interface PeakMeterConfig {
  vertical?: boolean;
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
  maskTransition?: string;
  audioMeterStandard?: string;
  peakHoldDuration?: number;
}

export const defaultConfig = {
  vertical: false,
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
  maskTransition: '0.1s',
  audioMeterStandard: 'peak-sample',
  peakHoldDuration: 0
};
