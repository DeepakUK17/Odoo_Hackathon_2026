/**
 * Asset Health Score Engine
 * Factors: Age (30%), Repair Count (30%), Maintenance Frequency (20%), Condition (20%)
 */

const conditionScores = { excellent: 100, good: 80, fair: 55, poor: 30 };

const computeHealthScore = async (asset, maintenanceHistory) => {
  const now = new Date();

  // Factor 1: Age score (newer = better)
  let ageScore = 100;
  if (asset.purchase_date) {
    const ageYears = (now - new Date(asset.purchase_date)) / (1000 * 60 * 60 * 24 * 365);
    if (ageYears <= 1) ageScore = 100;
    else if (ageYears <= 2) ageScore = 90;
    else if (ageYears <= 3) ageScore = 75;
    else if (ageYears <= 5) ageScore = 60;
    else if (ageYears <= 7) ageScore = 40;
    else ageScore = 20;
  }

  // Factor 2: Repair count score (fewer repairs = better)
  const resolvedRepairs = maintenanceHistory.filter(m => m.status === 'resolved').length;
  let repairScore = 100;
  if (resolvedRepairs === 0) repairScore = 100;
  else if (resolvedRepairs <= 2) repairScore = 85;
  else if (resolvedRepairs <= 4) repairScore = 65;
  else if (resolvedRepairs <= 7) repairScore = 45;
  else repairScore = 25;

  // Factor 3: Maintenance frequency (recent maintenance = concerning)
  const recentMaintenance = maintenanceHistory.filter(m => {
    const mDate = new Date(m.created_at);
    return (now - mDate) < (90 * 24 * 60 * 60 * 1000); // Last 90 days
  });
  let freqScore = 100;
  if (recentMaintenance.length === 0) freqScore = 100;
  else if (recentMaintenance.length === 1) freqScore = 80;
  else if (recentMaintenance.length === 2) freqScore = 60;
  else freqScore = 40;

  // Factor 4: Physical condition
  const conditionScore = conditionScores[asset.condition] || 70;

  // Weighted average
  const score = Math.round(
    ageScore * 0.30 +
    repairScore * 0.30 +
    freqScore * 0.20 +
    conditionScore * 0.20
  );

  // Determine label and prediction
  let label, color, prediction;
  if (score >= 90) { label = 'Excellent'; color = '#00D4AA'; }
  else if (score >= 70) { label = 'Good'; color = '#6C63FF'; }
  else if (score >= 50) { label = 'Needs Attention'; color = '#FF6B35'; }
  else { label = 'Replace Recommended'; color = '#FF4757'; }

  // Predictive maintenance
  let predictiveDays = null;
  if (score < 70 || (recentMaintenance.length >= 2)) {
    const daysSinceLast = maintenanceHistory.length > 0
      ? Math.floor((now - new Date(maintenanceHistory[maintenanceHistory.length - 1].created_at)) / (1000 * 60 * 60 * 24))
      : 999;
    if (score < 50) predictiveDays = 7;
    else if (score < 70 || daysSinceLast > 90) predictiveDays = 15;
    else predictiveDays = 30;
  }

  return {
    score,
    label,
    color,
    factors: {
      age: { score: ageScore, weight: '30%' },
      repairs: { score: repairScore, weight: '30%', count: resolvedRepairs },
      frequency: { score: freqScore, weight: '20%', recentCount: recentMaintenance.length },
      condition: { score: conditionScore, weight: '20%', value: asset.condition },
    },
    predictiveMaintenance: predictiveDays
      ? { dueSoon: true, estimatedDays: predictiveDays, message: `Maintenance likely needed within ${predictiveDays} days` }
      : { dueSoon: false },
  };
};

module.exports = { computeHealthScore };
