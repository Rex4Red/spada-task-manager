/**
 * Database Migration Script: Neon → Supabase
 * 
 * 1. Pushes Prisma schema to Supabase (creates tables)
 * 2. Exports all data from Neon
 * 3. Imports all data into Supabase
 */

const { PrismaClient } = require('@prisma/client');

// Source: Neon DB
const neonUrl = 'postgresql://neondb_owner:npg_0emZkJEnrt8c@ep-broad-paper-ahlqbxr3-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Destination: Supabase
const supabaseUrl = 'postgresql://postgres.lokikcgjsvzxebkhxsyp:KingF1reStar123%40@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
const supabaseDirect = 'postgresql://postgres.lokikcgjsvzxebkhxsyp:KingF1reStar123%40@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

const source = new PrismaClient({
    datasources: { db: { url: neonUrl } }
});

const dest = new PrismaClient({
    datasources: { db: { url: supabaseDirect } }
});

// Tables in dependency order (parents first)
const tables = [
    'User',
    'Course',
    'Task',
    'TelegramConfig',
    'DiscordConfig',
    'WhatsAppConfig',
    'NotificationSettings',
    'Notification',
    'AttendanceSchedule',
    'AttendanceLog',
];

async function migrate() {
    console.log('🔄 Starting migration: Neon → Supabase\n');

    try {
        // Test connections
        console.log('📡 Testing Neon connection...');
        await source.$connect();
        console.log('✅ Neon connected!\n');

        console.log('📡 Testing Supabase connection...');
        await dest.$connect();
        console.log('✅ Supabase connected!\n');

        // Migrate each table
        for (const table of tables) {
            const modelName = table.charAt(0).toLowerCase() + table.slice(1);

            try {
                // Read from source
                const data = await source[modelName].findMany();
                console.log(`📦 ${table}: ${data.length} records found in Neon`);

                if (data.length === 0) {
                    console.log(`   ⏭️  Skipping (empty)\n`);
                    continue;
                }

                // Insert into destination one by one to handle conflicts
                let inserted = 0;
                let skipped = 0;

                for (const record of data) {
                    try {
                        await dest[modelName].create({ data: record });
                        inserted++;
                    } catch (err) {
                        if (err.code === 'P2002') {
                            // Unique constraint violation - record already exists
                            skipped++;
                        } else {
                            console.log(`   ⚠️  Error inserting record id=${record.id}: ${err.message}`);
                        }
                    }
                }

                console.log(`   ✅ Inserted: ${inserted}, Skipped: ${skipped}\n`);
            } catch (err) {
                console.log(`   ❌ Error migrating ${table}: ${err.message}\n`);
            }
        }

        // Reset auto-increment sequences to match the max id
        console.log('🔧 Resetting sequences...');
        for (const table of tables) {
            try {
                const tableName = table.replace(/([A-Z])/g, '_$1').replace(/^_/, '');
                await dest.$executeRawUnsafe(
                    `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
                );
                console.log(`   ✅ ${table} sequence reset`);
            } catch (err) {
                console.log(`   ⚠️  ${table} sequence: ${err.message}`);
            }
        }

        console.log('\n🎉 Migration complete!');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await source.$disconnect();
        await dest.$disconnect();
    }
}

migrate();
