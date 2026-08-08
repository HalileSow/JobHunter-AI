exports.up = async function(knex) {
    // Add is_primary column to distinguish master CV from optimized copies
    const hasColumn = await knex.schema.hasColumn('cvs', 'is_primary');
    if (!hasColumn) {
        await knex.schema.alterTable('cvs', (table) => {
            table.integer('is_primary').defaultTo(0);
        });
    }

    // For each SUPER_ADMIN user, mark one CV as primary:
    // 1. Prefer a CV named "CV Principal" or "CV Français" (oldest = original import)
    // 2. Fallback: prefer a non-optimized CV (oldest)
    // 3. Demote all other CVs to is_primary=0
    const superAdmins = await knex('users').where({ role: 'SUPER_ADMIN' }).select('id');

    for (const admin of superAdmins) {
        const cvs = await knex('cvs').where({ user_id: admin.id }).select('*');
        if (cvs.length === 0) continue;

        // First, try to find a source/primary candidate by name
        let candidate = cvs.find((cv) =>
            cv.name === 'CV Principal' || cv.name === 'CV Français'
        );

        // Fallback: prefer non-optimized CVs
        if (!candidate) {
            candidate = cvs.find((cv) =>
                !cv.path?.includes('_optimized_') && !cv.name?.includes('Optimisé')
            );
        }

        // Last fallback: oldest CV
        if (!candidate) {
            candidate = cvs.sort((a, b) => {
                const ta = a.created_at || '';
                const tb = b.created_at || '';
                return ta.localeCompare(tb);
            })[0];
        }

        if (candidate) {
            // Demote all, then promote the candidate
            await knex('cvs')
                .where({ user_id: admin.id })
                .where('id', '!=', candidate.id)
                .update({ is_primary: 0 });
            await knex('cvs')
                .where({ id: candidate.id })
                .update({ is_primary: 1, name: 'CV Principal', lang: 'fr' });
        }
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
