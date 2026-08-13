/**
 * Search runs keep the user's original search parameters. Country can contain
 * a list of countries, while title and keywords are free-form and may exceed
 * PostgreSQL's default VARCHAR(255) created by Knex table.string().
 *
 * Only these three parameter columns are widened. lang and status remain
 * bounded values, and no user_id or ownership constraint is changed.
 */
const TEXT_COLUMNS = ['country', 'title', 'keywords'];

exports.up = async function (knex) {
    if (knex.client.config.client !== 'pg') return;

    for (const column of TEXT_COLUMNS) {
        const result = await knex.raw(`
            SELECT data_type
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'search_runs'
              AND column_name = ?
        `, [column]);

        if (!result.rows?.[0]) continue;
        if (result.rows[0].data_type === 'text') continue;

        await knex.raw(
            `ALTER TABLE "search_runs" ALTER COLUMN "${column}" TYPE TEXT USING "${column}"::text`
        );
    }
};

exports.down = async function () {
    // Deliberately irreversible: narrowing could destroy existing values.
};
