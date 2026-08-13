const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Persist the content of legacy default primary CV rows that predate the
 * `cvs.content` column. This only fills NULL content on an existing row whose
 * path is the known per-user default import name; it never creates, deletes or
 * replaces a CV, and is safe to run repeatedly.
 */
exports.up = async function (knex) {
    if (knex.client.config.client !== 'pg') return;
    if (!(await knex.schema.hasColumn('cvs', 'content'))) return;

    const sourcePath = path.resolve(__dirname, '../../cv/cv_fr.md');
    let content;
    try {
        content = await fs.readFile(sourcePath, 'utf8');
    } catch {
        return;
    }
    if (!content.trim()) return;

    const rows = await knex('cvs')
        .where({ is_primary: 1 })
        .whereNull('content')
        .select('id', 'user_id', 'path');

    for (const row of rows) {
        if (!row.user_id || path.basename(row.path || '') !== `${row.user_id}_cv_fr.md`) continue;
        await knex('cvs').where({ id: row.id }).update({
            content,
            mime_type: 'text/markdown',
            size_bytes: Buffer.byteLength(content, 'utf8')
        });
    }
};

exports.down = async function () {
    // Do not remove persisted CV content on rollback: that would destroy data.
};
