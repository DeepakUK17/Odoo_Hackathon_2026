const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('../config/db');

let genAI;
try {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} catch (err) {
  console.warn('⚠️ Gemini AI not initialized:', err.message);
}

const getModel = () => genAI?.getGenerativeModel({ model: 'gemini-2.5-flash' });

/**
 * Fetch DB context based on detected intent keywords
 */
const fetchContext = async (orgId, userQuery) => {
  const q = userQuery.toLowerCase();
  let contextData = {};

  // Always include summary stats
  const stats = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'available') as available,
       COUNT(*) FILTER (WHERE status = 'allocated') as allocated,
       COUNT(*) FILTER (WHERE status = 'maintenance') as in_maintenance,
       COUNT(*) as total
     FROM assets WHERE org_id = $1`, [orgId]
  );
  contextData.summary = stats.rows[0];

  if (q.includes('overdue') || q.includes('due') || q.includes('return')) {
    const overdue = await query(
      `SELECT a.tag, a.name, e.name as holder, al.expected_return
       FROM allocations al JOIN assets a ON al.asset_id = a.id JOIN employees e ON al.employee_id = e.id
       WHERE a.org_id = $1 AND al.status = 'active' AND al.expected_return < NOW()
       ORDER BY al.expected_return ASC LIMIT 10`, [orgId]
    );
    contextData.overdueAssets = overdue.rows;
  }

  if (q.includes('who has') || q.includes('holder') || q.includes('allocated to') || q.match(/af-\d+/)) {
    const tag = (userQuery.match(/AF-\d+/i) || [])[0];
    if (tag) {
      const asset = await query(
        `SELECT a.tag, a.name, a.status, e.name as holder, e.email, d.name as dept, al.allocated_at, al.expected_return
         FROM assets a LEFT JOIN allocations al ON al.asset_id = a.id AND al.status = 'active'
         LEFT JOIN employees e ON al.employee_id = e.id LEFT JOIN departments d ON al.dept_id = d.id
         WHERE a.org_id = $1 AND UPPER(a.tag) = UPPER($2)`, [orgId, tag]
      );
      contextData.specificAsset = asset.rows[0];
    }
  }

  if (q.includes('maintenance') || q.includes('repair') || q.includes('broken')) {
    const maint = await query(
      `SELECT a.tag, a.name, mr.title, mr.status, mr.priority, mr.created_at
       FROM maintenance_requests mr JOIN assets a ON mr.asset_id = a.id
       WHERE a.org_id = $1 AND mr.status != 'resolved' ORDER BY mr.priority DESC LIMIT 10`, [orgId]
    );
    contextData.maintenanceAssets = maint.rows;
  }

  if (q.includes('available') || q.includes('free')) {
    const avail = await query(
      `SELECT a.tag, a.name, ac.name as category, a.location, a.health_score
       FROM assets a LEFT JOIN asset_categories ac ON a.category_id = ac.id
       WHERE a.org_id = $1 AND a.status = 'available' ORDER BY a.health_score DESC LIMIT 15`, [orgId]
    );
    contextData.availableAssets = avail.rows;
  }

  if (q.includes('department') || q.includes('dept') || q.includes('highest') || q.includes('most')) {
    const deptStats = await query(
      `SELECT d.name as dept, COUNT(mr.id) as maintenance_count
       FROM departments d LEFT JOIN employees e ON e.dept_id = d.id
       LEFT JOIN maintenance_requests mr ON mr.raised_by = e.id
       WHERE d.org_id = $1 GROUP BY d.id ORDER BY maintenance_count DESC LIMIT 5`, [orgId]
    );
    contextData.departmentStats = deptStats.rows;
  }

  if (q.includes('unused') || q.includes('idle') || q.includes('90 days') || q.includes('days')) {
    const idle = await query(
      `SELECT a.tag, a.name, a.location,
         EXTRACT(DAYS FROM NOW() - COALESCE(al.returned_at, a.created_at)) as days_idle
       FROM assets a LEFT JOIN allocations al ON al.asset_id = a.id AND al.status = 'returned'
       WHERE a.org_id = $1 AND a.status = 'available'
       ORDER BY days_idle DESC LIMIT 10`, [orgId]
    );
    contextData.idleAssets = idle.rows;
  }

  return contextData;
};

/**
 * Rule-based fallback when Gemini API is unavailable
 */
const fallbackResponse = (contextData, userQuery) => {
  const q = userQuery.toLowerCase();
  if (contextData.specificAsset) {
    const a = contextData.specificAsset;
    return a.holder
      ? `Asset ${a.tag} (${a.name}) is currently allocated to **${a.holder}** in the ${a.dept || 'N/A'} department since ${new Date(a.allocated_at).toLocaleDateString()}. Expected return: ${a.expected_return ? new Date(a.expected_return).toLocaleDateString() : 'No date set'}.`
      : `Asset ${a.tag} (${a.name}) is currently **${a.status}** and not allocated to anyone.`;
  }
  if (contextData.overdueAssets?.length > 0) {
    return `There are **${contextData.overdueAssets.length} overdue assets**:\n` +
      contextData.overdueAssets.map(a => `• ${a.tag} (${a.name}) — held by ${a.holder}, due ${new Date(a.expected_return).toLocaleDateString()}`).join('\n');
  }
  if (contextData.availableAssets?.length > 0) {
    return `Here are some available assets:\n` +
      contextData.availableAssets.map(a => `• ${a.tag} (${a.name}) — Health: ${a.health_score}`).join('\n');
  }
  if (contextData.maintenanceAssets?.length > 0) {
    return `There are assets currently under maintenance:\n` +
      contextData.maintenanceAssets.map(a => `• ${a.tag} (${a.name}) — ${a.title} (Priority: ${a.priority})`).join('\n');
  }
  return `Here's your asset summary: **${contextData.summary.total} total assets** — ${contextData.summary.available} available, ${contextData.summary.allocated} allocated, ${contextData.summary.in_maintenance} in maintenance.`;
};

/**
 * Main AI Chat Handler
 */
const chatWithAI = async (orgId, userQuery, conversationHistory = []) => {
  const contextData = await fetchContext(orgId, userQuery);

  const systemPrompt = `You are AssetFlow AI Assistant — an intelligent enterprise asset management assistant.
You help managers and employees track assets, understand utilization, and make operational decisions.
Be concise, professional, and data-driven. Format key values in **bold**.
Always refer to specific Asset IDs (like AF-0012) when available.

Current Asset Summary: ${JSON.stringify(contextData.summary)}
${contextData.specificAsset ? `Specific Asset Data: ${JSON.stringify(contextData.specificAsset)}` : ''}
${contextData.overdueAssets ? `Overdue Assets: ${JSON.stringify(contextData.overdueAssets)}` : ''}
${contextData.availableAssets ? `Available Assets (sample): ${JSON.stringify(contextData.availableAssets.slice(0, 5))}` : ''}
${contextData.maintenanceAssets ? `Assets Under Maintenance: ${JSON.stringify(contextData.maintenanceAssets)}` : ''}
${contextData.departmentStats ? `Department Stats: ${JSON.stringify(contextData.departmentStats)}` : ''}
${contextData.idleAssets ? `Idle Assets: ${JSON.stringify(contextData.idleAssets)}` : ''}

Answer the user's question based on this data. If you don't have specific data, say so clearly.`;

  try {
    const model = getModel();
    if (!model) throw new Error('Gemini not initialized');

    const chat = model.startChat({
      history: conversationHistory,
      generationConfig: { maxOutputTokens: 500, temperature: 0.3 },
    });

    const result = await chat.sendMessage(`${systemPrompt}\n\nUser question: ${userQuery}`);
    const response = result.response.text();
    return { response, source: 'gemini', contextData };
  } catch (err) {
    console.warn('Gemini API failed, using fallback:', err.message);
    return { response: fallbackResponse(contextData, userQuery), source: 'fallback', contextData };
  }
};

/**
 * AI Report Summary using Gemini
 */
const generateReportSummary = async (reportData) => {
  const prompt = `You are an enterprise asset management analyst. Write a brief executive summary (3-4 sentences) of this monthly asset report data. Focus on key trends, concerns, and actionable recommendations. Be specific with numbers.

Report Data: ${JSON.stringify(reportData)}`;

  try {
    const model = getModel();
    if (!model) throw new Error('Gemini not initialized');
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    // Fallback template summary
    return `This month, the organization managed ${reportData.totalAssets || 'N/A'} total assets with a utilization rate of ${reportData.utilizationRate || 'N/A'}%. Maintenance requests ${reportData.maintenanceChange > 0 ? `increased by ${reportData.maintenanceChange}%` : `decreased by ${Math.abs(reportData.maintenanceChange || 0)}%`}. ${reportData.idleCount || 0} assets remain idle and should be considered for reallocation.`;
  }
};

/**
 * AI Recommendations
 */
const generateRecommendations = async (orgId) => {
  const data = await query(
    `SELECT
       (SELECT COUNT(*) FROM assets WHERE org_id = $1 AND status = 'available'
        AND id NOT IN (SELECT asset_id FROM allocations WHERE status = 'active')) as idle_count,
       (SELECT COUNT(*) FROM assets WHERE org_id = $1 AND health_score < 50) as poor_health_count,
       (SELECT COUNT(*) FROM maintenance_requests mr JOIN assets a ON mr.asset_id = a.id
        WHERE a.org_id = $1 AND mr.status NOT IN ('resolved','cancelled')) as open_maintenance
    `, [orgId]
  );

  const stats = data.rows[0];
  const prompt = `You are an enterprise asset management consultant. Based on these operational stats, provide 3-5 specific, actionable recommendations. Format as a JSON array with fields: {title, description, priority, category}.

Stats: ${JSON.stringify(stats)}`;

  try {
    const model = getModel();
    if (!model) throw new Error('Gemini not initialized');
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : fallbackRecommendations(stats);
  } catch (err) {
    return fallbackRecommendations(stats);
  }
};

const fallbackRecommendations = (stats) => {
  const recs = [];
  if (stats.idle_count > 5) recs.push({ title: 'Reallocate Idle Assets', description: `${stats.idle_count} assets are idle. Consider redistributing to departments with higher demand.`, priority: 'high', category: 'utilization' });
  if (stats.poor_health_count > 0) recs.push({ title: 'Replace Low-Health Assets', description: `${stats.poor_health_count} assets have health scores below 50. Schedule replacements.`, priority: 'critical', category: 'maintenance' });
  if (stats.open_maintenance > 3) recs.push({ title: 'Clear Maintenance Backlog', description: `${stats.open_maintenance} maintenance requests are pending. Assign technicians to reduce backlog.`, priority: 'medium', category: 'maintenance' });
  return recs;
};

module.exports = { chatWithAI, generateReportSummary, generateRecommendations };
