exports.up = async function(knex) {
    // Add is_primary column to distinguish master CV from optimized copies
    const hasColumn = await knex.schema.hasColumn('cvs', 'is_primary');
    if (!hasColumn) {
        await knex.schema.alterTable('cvs', (table) => {
            table.integer('is_primary').defaultTo(0);
        });
    }

    // Mark existing "CV Français" for SUPER_ADMIN users as primary
    const superAdmins = await knex('users').where({ role: 'SUPER_ADMIN' }).select('id');
    for (const admin of superAdmins) {
        await knex('cvs')
            .where({ user_id: admin.id })
            .where('name', 'like', '%Français%')
            .update({ is_primary: 1 });
    }
};

exports.down = async function(knex) {
    const hasColumn = await knex.schema.hasColumn('cvs', 'is_primary');
    if (hasColumn) {
        await knex.schema.alterTable('cvs', (table) => {
            table.dropColumn('is_primary');
        });
    }
};
