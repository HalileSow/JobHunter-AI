/**
 * PostgreSQL creates VARCHAR(255) for Knex table.string(). Search criteria are
 * user-provided and may contain long lists of jobs, keywords or countries.
 *
 * Convert every remaining character-varying column in the two search
 * definition tables to TEXT. This is deliberately data-preserving and
 * idempotent: already-TEXT columns and missing columns are skipped. SQLite
 * does not need this migration because its TEXT affinity has no 255 limit.
 */
const TABLES = ['search_configs', 'scheduled_searches'];

exports.up = async function (knex) {
  if (knex.client.config.client !== 'pg') return;

  for (const tableName of TABLES) {
    const result = await knex.raw(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ?
        AND data_type = 'character varying'
      ORDER BY ordinal_position
    `, [tableName]);

    for (const { column_name: column } of result.rows || []) {
      // Identifiers come from information_schema, not user input. Quoting
      // still protects names should the schema evolve.
      const quotedTable = `"${tableName.replaceAll('"', '""')}"`;
      const quotedColumn = `"${column.replaceAll('"', '""')}"`;
      await knex.raw(
        `ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedColumn} TYPE TEXT USING ${quotedColumn}::text`
      );
    }
  }
};

exports.down = async function () {
  // Intentionally irreversible: narrowing back to VARCHAR(255) could destroy
  // valid data that this migration is meant to preserve.
};
