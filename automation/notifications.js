/**
 * Notification engine — supports Telegram and Slack webhooks.
 * Auto-detects platform from URL pattern, formats payload accordingly.
 */

const TELEGRAM_PATTERN = /api\.telegram\.org\/bot/;
const SLACK_PATTERNS = [/hooks\.slack\.com\//, /slack\.com\/api\/chat\.postMessage/];

function detectPlatform(url) {
    if (TELEGRAM_PATTERN.test(url)) return 'telegram';
    if (SLACK_PATTERNS.some(p => p.test(url))) return 'slack';
    return 'generic';
}

function formatTelegram(job) {
    const stars = job.score >= 85 ? '⭐⭐⭐' : job.score >= 70 ? '⭐⭐' : '⭐';
    return {
        parse_mode: 'Markdown',
        text: `🚀 *Nouvelle offre détectée* ${stars}

🏢 *Entreprise :* ${escapeMarkdown(job.company)}
💼 *Titre :* ${escapeMarkdown(job.title)}
📊 *Score :* ${job.score}/100
📍 *Lieu :* ${escapeMarkdown(job.location || 'Non spécifié')}
🔗 [Voir l'offre](${job.link})`
    };
}

function formatSlack(job) {
    const emoji = job.score >= 85 ? ':star2:' : job.score >= 70 ? ':star:' : ':briefcase:';
    return {
        text: `🚀 Nouvelle offre détectée ${emoji}`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Nouvelle offre détectée*\n*Entreprise :* ${job.company}\n*Titre :* ${job.title}\n*Score :* ${job.score}/100\n*Lieu :* ${job.location || 'Non spécifié'}`
                }
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: { type: 'plain_text', text: 'Voir l\'offre' },
                        url: job.link
                    }
                ]
            }
        ]
    };
}

function formatGeneric(job) {
    return {
        text: `🚀 Nouvelle offre détectée — ${job.title} chez ${job.company} (Score: ${job.score}/100) — ${job.link}`
    };
}

function escapeMarkdown(text) {
    if (!text) return '';
    return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function buildPayload(job, platform) {
    switch (platform) {
        case 'telegram': return formatTelegram(job);
        case 'slack': return formatSlack(job);
        default: return formatGeneric(job);
    }
}

/**
 * Send a notification for a single job to a specific webhook.
 * @param {Object} webhook - { webhook_url, platform, id }
 * @param {Object} job - Job object with title, company, score, link, location
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendToWebhook(webhook, job) {
    const platform = webhook.platform || detectPlatform(webhook.webhook_url);
    const payload = buildPayload(job, platform);

    try {
        const response = await fetch(webhook.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Send notifications for jobs to all enabled webhooks of a user.
 * Respects score_threshold per webhook.
 * @param {Object} params - { db, userId, jobs } where jobs is an array or a single job
 * @returns {Promise<{sent: number, failed: number, errors: string[]}>}
 */
export async function notifyUserJob({ db, userId, jobs }) {
    const jobList = Array.isArray(jobs) ? jobs : [jobs];
    if (!jobList.length) return { sent: 0, failed: 0, errors: [] };

    const webhooks = await db('notification_webhooks')
        .where({ user_id: userId, enabled: true });

    if (!webhooks.length) return { sent: 0, failed: 0, errors: [] };

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const webhook of webhooks) {
        const eligibleJobs = jobList.filter(j => j.score >= webhook.score_threshold);
        if (!eligibleJobs.length) continue;

        for (const job of eligibleJobs) {
            const result = await sendToWebhook(webhook, job);

            if (result.success) {
                sent++;
            } else {
                failed++;
                errors.push(`Webhook #${webhook.id} (${job.title}): ${result.error}`);
                await db('notification_webhooks').where({ id: webhook.id }).update({
                    last_error: result.error,
                    updated_at: db.fn.now()
                });
                break; // stop sending to this webhook if it's failing
            }
        }

        if (sent > 0 || failed > 0) {
            await db('notification_webhooks').where({ id: webhook.id }).update({
                last_sent_at: db.fn.now(),
                total_sent: db.raw('total_sent + ?', [eligibleJobs.length]),
                last_error: failed > 0 ? errors[errors.length - 1] : null,
                updated_at: db.fn.now()
            });
        }
    }

    if (sent > 0) {
        console.log(`📬 [Notifications] ${sent} notification(s) envoyée(s) pour ${jobList.length} offre(s) (user ${userId})`);
    }
    if (failed > 0) {
        console.warn(`⚠️ [Notifications] ${failed} échec(s): ${errors.slice(0, 3).join('; ')}`);
    }

    return { sent, failed, errors };
}

/**
 * Send a test message to a webhook URL (for the "test" endpoint).
 * @param {string} webhookUrl
 * @returns {Promise<{success: boolean, platform: string, error?: string}>}
 */
export async function testWebhook(webhookUrl) {
    const platform = detectPlatform(webhookUrl);
    const testJob = {
        title: 'Développeur Full-Stack (test)',
        company: 'JobHunter AI',
        score: 92,
        location: 'Paris, France',
        link: 'https://example.com/test-job'
    };

    const payload = buildPayload(testJob, platform);

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
        }

        return { success: true, platform };
    } catch (error) {
        return { success: false, platform, error: error.message };
    }
}

export { detectPlatform };
