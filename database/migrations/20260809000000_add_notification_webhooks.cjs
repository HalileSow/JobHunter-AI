/**
 * Add notification_webhooks table for per-user Telegram/Slack alerts.
 */

exports.up = async function (knex) {
    const hasTable = await knex.schema.hasTable('notification_webhooks');
    if (!hasTable) {
        await knex.schema.createTable('notification_webhooks', (table) => {
            table.increments('id');
            table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.string('platform').notNullable(); // 'telegram' | 'slack'
            table.string('webhook_url').notNullable();
            table.string('label').nullable(); // optional display name
            table.boolean('enabled').notNullable().defaultTo(1);
            table.integer('score_threshold').notNullable().defaultTo(70); // only notify for jobs >= this score
            table.boolean('notify_on_new_job').notNullable().defaultTo(1);
            table.boolean('notify_on_high_score').notNullable().defaultTo(1);
            table.datetime('last_sent_at').nullable();
            table.integer('total_sent').notNullable().defaultTo(0);
            table.string('last_error').nullable();
            table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
            table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
        });

        await knex.schema.raw('CREATE INDEX idx_notification_webhooks_user ON notification_webhooks(user_id)');
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('notification_webhooks');
};
