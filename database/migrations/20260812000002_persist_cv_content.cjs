exports.up = async function (knex) {
    const hasContent = await knex.schema.hasColumn('cvs', 'content');
    if (!hasContent) {
        await knex.schema.table('cvs', (table) => {
            table.text('content').nullable();
            table.string('mime_type').nullable();
            table.integer('size_bytes').nullable();
        });
    }
};

exports.down = async function (knex) {
    const hasContent = await knex.schema.hasColumn('cvs', 'content');
    if (hasContent) {
        await knex.schema.table('cvs', (table) => {
            table.dropColumn('content');
            table.dropColumn('mime_type');
            table.dropColumn('size_bytes');
        });
    }
};
