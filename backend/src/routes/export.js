const router = require('express').Router();
const ExcelJS = require('exceljs');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const modules = {
  assets: {
    title: 'Asset Directory',
    sql: (orgId, filters) => ({
      text: `SELECT a.tag, a.name, ac.name as category, a.serial_number, a.status, a.condition,
                    a.health_score, a.location, a.purchase_date, a.purchase_cost, a.warranty_end,
                    e.name as current_holder, d.name as department
             FROM assets a LEFT JOIN asset_categories ac ON a.category_id = ac.id
             LEFT JOIN departments d ON a.dept_id = d.id
             LEFT JOIN allocations al ON al.asset_id = a.id AND al.status = 'active'
             LEFT JOIN employees e ON al.employee_id = e.id
             WHERE a.org_id = $1 ORDER BY a.tag`,
      values: [orgId],
    }),
    columns: ['tag','name','category','serial_number','status','condition','health_score','location','purchase_date','purchase_cost','warranty_end','current_holder','department'],
  },
  allocations: {
    title: 'Allocation History',
    sql: (orgId) => ({
      text: `SELECT a.tag, a.name as asset, e.name as employee, d.name as department,
                    al.allocated_at, al.expected_return, al.returned_at, al.return_condition, al.status
             FROM allocations al JOIN assets a ON al.asset_id = a.id JOIN employees e ON al.employee_id = e.id
             LEFT JOIN departments d ON al.dept_id = d.id WHERE a.org_id = $1 ORDER BY al.allocated_at DESC`,
      values: [orgId],
    }),
    columns: ['tag','asset','employee','department','allocated_at','expected_return','returned_at','return_condition','status'],
  },
  maintenance: {
    title: 'Maintenance Report',
    sql: (orgId) => ({
      text: `SELECT a.tag, a.name as asset, mr.title, mr.description, mr.priority, mr.status,
                    re.name as raised_by, as2.name as assigned_to, mr.actual_cost, mr.created_at, mr.resolved_at
             FROM maintenance_requests mr JOIN assets a ON mr.asset_id = a.id
             LEFT JOIN employees re ON mr.raised_by = re.id LEFT JOIN employees as2 ON mr.assigned_to = as2.id
             WHERE a.org_id = $1 ORDER BY mr.created_at DESC`,
      values: [orgId],
    }),
    columns: ['tag','asset','title','description','priority','status','raised_by','assigned_to','actual_cost','created_at','resolved_at'],
  },
  employees: {
    title: 'Employee Directory',
    sql: (orgId) => ({
      text: `SELECT e.name, e.email, e.role, e.status, d.name as department, e.created_at
             FROM employees e LEFT JOIN departments d ON e.dept_id = d.id
             WHERE e.org_id = $1 ORDER BY e.name`,
      values: [orgId],
    }),
    columns: ['name','email','role','status','department','created_at'],
  },
};

router.get('/:module', authenticate, async (req, res) => {
  const mod = modules[req.params.module];
  if (!mod) return res.status(404).json({ error: 'Export module not found' });
  try {
    const { text, values } = mod.sql(req.user.org_id);
    const result = await query(text, values);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AssetFlow';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(mod.title);

    // Header row styling
    sheet.addRow(mod.columns.map(c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C63FF' } };
    sheet.getRow(1).height = 20;

    // Data rows
    result.rows.forEach(row => {
      sheet.addRow(mod.columns.map(col => {
        const val = row[col];
        if (val instanceof Date) return val.toLocaleString();
        return val ?? '';
      }));
    });

    // Auto-fit columns
    sheet.columns.forEach(col => {
      let maxLen = 12;
      col.eachCell({ includeEmpty: true }, cell => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 4, 50);
    });

    // Export info row
    sheet.addRow([]);
    const infoRow = sheet.addRow([`Exported from AssetFlow on ${new Date().toLocaleString()} | Total: ${result.rows.length} records`]);
    infoRow.font = { italic: true, color: { argb: 'FF888888' } };

    const filename = `${mod.title.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
