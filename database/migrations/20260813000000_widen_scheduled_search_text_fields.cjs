/**
 * PostgreSQL stores Knex table.string() columns as VARCHAR(255).
 * Search names, titles and free-form filter values are user-provided and can
 * naturally be longer than 255 characters. Widen only those fields; preserve
 * all existing data.
 *
 * providers_list is intentionally absent: it is already TEXT.
 */
const TEXT_COLUMNS = [
    'name',
    'title',
    'keywords',
    'city'
];

exports.up = async function (knex) {
    if (knex.client.config.client !== 'pg') return;

    for (const column of TEXT_COLUMNS) {
        const exists = await knex.schema.hasColumn('scheduled_searches', column);
        if (!exists) continue;

        const result = await knex.raw(`
            SELECT data_type
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'scheduled_searches'
              AND column_name = ?
        `, [column]);
        if (result.rows?.[0]?.data_type === 'text') continue;

        await knex.raw(`ALTER TABLE "scheduled_searches" ALTER COLUMN "${column}" TYPE TEXT USING "${column}"::text`);
    }
};

exports.down = async function () {
    // Deliberately irreversible: narrowing columns could destroy existing data.
};
