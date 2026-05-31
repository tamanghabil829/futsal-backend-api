// backend/src/utils/priceCalculator.js
export const calculateSlotPrice = (basePrice, peakPrice, date, startTime) => {
  const slotDate = new Date(date);
  const dayOfWeek = slotDate.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = parseInt(startTime.split(':')[0]);
  
  // Peak hours: 5 PM - 8 PM (17 to 20)
  const isPeakHour = hour >= 17 && hour <= 20;
  
  // Weekend: Saturday (6) or Sunday (0)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Apply peak pricing if available and conditions met
  if (peakPrice && (isPeakHour || isWeekend)) {
    return peakPrice;
  }
  
  return basePrice;
};