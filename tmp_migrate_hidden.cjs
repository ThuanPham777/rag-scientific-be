// Verify is_hidden column exists in notebook_collaborators
// Run: node tmp_migrate_hidden.cjs
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
    await client.connect();

    const res = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'notebook_collaborators'
    ORDER BY ordinal_position;
  `);

    console.log('\n📋 Columns in notebook_collaborators:');
    console.table(res.rows);

    const hasHidden = res.rows.some(r => r.column_name === 'is_hidden');
    if (hasHidden) {
        console.log('✅ is_hidden column EXISTS!');
    } else {
        console.log('❌ is_hidden column MISSING!');
    }

    await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
