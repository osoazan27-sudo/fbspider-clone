// Seed static service/pricing rows from the real fbspider getServiceList response.
const fs = require('fs');
const path = require('path');
const db = require('./db');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'services_seed.json'), 'utf8'));
const rows = seed.data || [];

const insert = db.prepare(`
  INSERT OR REPLACE INTO services
    (id, module_id, module_name, level, level_id, name, num, total_num, price, rateCNY, type, sort, create_time, update_time)
  VALUES (@id, @module_id, @module_name, @level, @level_id, @name, @num, @total_num, @price, @rateCNY, @type, @sort, @create_time, @update_time)
`);

const tx = db.transaction((list) => {
  for (const r of list) insert.run({
    id: r.id, module_id: r.module_id, module_name: r.module_name,
    level: r.level, level_id: r.level_id, name: r.name,
    num: r.num, total_num: r.total_num, price: String(r.price),
    rateCNY: r.rateCNY, type: r.type, sort: r.sort,
    create_time: r.create_time, update_time: r.update_time,
  });
});
tx(rows);

console.log('Seeded services:', rows.length);

// Ensure module list is complete even if a module has no paid plan seeded.
const MODULES = require('./modules');
for (const m of MODULES) {
  const exists = db.prepare('SELECT COUNT(*) c FROM services WHERE module_id=?').get(m.module_id).c;
  if (!exists) {
    insert.run({
      id: 1000 + m.module_id, module_id: m.module_id, module_name: m.name,
      level: 'free', level_id: 0, name: '免费版', num: 10, total_num: 50,
      price: '0.00', rateCNY: 6.7291, type: 1, sort: 0,
      create_time: '2025-07-21 03:09:11', update_time: '2025-07-21 03:09:11',
    });
    console.log('  + placeholder free plan for module', m.module_id, m.name);
  }
}

console.log('Done.');
