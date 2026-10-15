export const stationeryOptions = value => value === 'default' ? {} : {
  letterhead: value === 'with', footer: value === 'with', watermark: value === 'with'
};
